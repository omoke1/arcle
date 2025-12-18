/**
 * API Route: Verify Invite Code
 * 
 * POST /api/auth/verify-invite
 * Headers: Authorization: Bearer <token> (or session cookie)
 * Body: { code: string }
 * Returns: { valid: boolean, message: string }
 * 
 * Security:
 * - Requires authenticated session (401 if not authenticated)
 * - Uses authenticated user's ID from session (ignores any userId in body)
 * - Validates user ID format (UUID)
 * 
 * Features:
 * - Validates code exists in allowed list
 * - Checks if code has already been used (server-side tracking)
 * - Atomic redemption: marks code as used, then grants access (reverts on failure)
 * - Prevents re-redemption: user_id is unique, duplicate inserts fail
 * - Tracks IP and user agent for audit purposes
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { isValidInviteCode } from "@/lib/auth/invite-codes";
import { isCodeUsedOnServer, markCodeAsUsedOnServer, resetCode } from "@/lib/auth/used-codes-store";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Get authenticated user from request
 * Extracts session token from Authorization header or cookies and verifies it
 */
async function getAuthenticatedUser(request: NextRequest): Promise<{ id: string } | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[Auth] Supabase not configured");
      return null;
    }

    // Try to get token from Authorization header first
    const authHeader = request.headers.get("authorization");
    let accessToken: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      accessToken = authHeader.substring(7);
    } else {
      // Try to get from cookies - Supabase stores session in cookies
      // Look for common Supabase cookie patterns
      const cookies = request.cookies;
      const cookieHeader = request.headers.get("cookie") || "";
      
      // Try to extract access token from Supabase session cookie
      // Supabase stores session as JSON in cookies, we need to parse it
      for (const cookie of cookies.getAll()) {
        if (cookie.name.includes("supabase") || cookie.name.includes("sb-")) {
          try {
            // Supabase session cookies may contain JSON with access_token
            const cookieValue = decodeURIComponent(cookie.value);
            const parsed = JSON.parse(cookieValue);
            if (parsed.access_token) {
              accessToken = parsed.access_token;
              break;
            }
          } catch {
            // Cookie might not be JSON, try as direct token
            if (cookie.name.includes("access-token") || cookie.name.includes("auth-token")) {
              accessToken = cookie.value;
              break;
            }
          }
        }
      }
    }

    if (!accessToken) {
      return null;
    }

    // Verify token and get user using Supabase admin client
    const supabaseAdmin = getSupabaseAdmin();
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user || !user.id) {
      return null;
    }

    return { id: user.id };
  } catch (error) {
    console.error("[Auth] Error getting authenticated user:", error);
    return null;
  }
}

/**
 * Validate UUID format
 */
function isValidUUID(userId: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(userId);
}

/**
 * Hash userId for logging purposes to avoid exposing PII
 * Returns a deterministic hash that can be used for correlation across logs
 * but does not reveal the original userId
 */
function hashUserId(userId: string): string {
  // Use SHA-256 for secure, deterministic hashing
  // Add a salt from env var if available for additional security
  const salt = process.env.LOG_HASH_SALT || 'default-log-salt';
  const hash = createHash('sha256')
    .update(userId + salt)
    .digest('hex');
  // Return first 16 characters for readability (still provides good uniqueness)
  return hash.substring(0, 16);
}

/**
 * Revert code marking (remove from used codes set)
 * Used when user_access insert fails to maintain consistency
 */
async function revertCodeMarking(code: string): Promise<void> {
  try {
    const normalizedCode = code.toUpperCase().trim();
    const reverted = await resetCode(normalizedCode);
    if (reverted) {
      console.log(`[Invite] Reverted code marking for ${normalizedCode}`);
    } else {
      console.warn(`[Invite] Code ${normalizedCode} was not in used set (may have been already reverted)`);
    }
  } catch (error) {
    console.error(`[Invite] Error reverting code marking for ${code}:`, error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Step 1: Require and validate authentication
    const authenticatedUser = await getAuthenticatedUser(request);
    
    if (!authenticatedUser || !authenticatedUser.id) {
      return NextResponse.json(
        { valid: false, message: "Unauthorized. Please sign in to verify an invite code." },
        { status: 401 }
      );
    }

    const userId = authenticatedUser.id;

    // Step 2: Validate userId format (UUID check)
    if (!isValidUUID(userId)) {
      return NextResponse.json(
        { valid: false, message: "Invalid user ID format" },
        { status: 400 }
      );
    }

    // Step 3: Extract only the invite code from request body
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { valid: false, message: "Invalid request" },
        { status: 400 }
      );
    }

    const trimmedCode = code.trim().toUpperCase();

    // Step 4: Check if code is in the valid list
    const isValid = isValidInviteCode(trimmedCode);

    if (!isValid) {
      return NextResponse.json({
        valid: false,
        message: "Invalid invite code. Please check and try again.",
      });
    }

    // Step 5: Check if code has already been used (server-side)
    const alreadyUsed = await isCodeUsedOnServer(trimmedCode);

    if (alreadyUsed) {
      return NextResponse.json({
        valid: false,
        message: "This invite code has already been used. Each code can only be used once.",
      });
    }

    // Step 6: Atomic redemption flow
    // Since code tracking is in Redis/file and user_access is in PostgreSQL,
    // we mark the code as used first, then insert user_access, and revert on failure
    const ipAddress = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    let codeMarkedAsUsed = false;

    try {
      // Mark code as used first (atomic operation in Redis/file)
      // This prevents race conditions where two requests try to use the same code
      try {
        await markCodeAsUsedOnServer(trimmedCode, {
          ipAddress,
          userAgent,
        });
        codeMarkedAsUsed = true;
      } catch (markError: any) {
        // If code was already used (race condition), return early
        if (markError.message?.includes("already been used") || markError.message?.includes("already used")) {
          return NextResponse.json({
            valid: false,
            message: "This invite code has already been used. Each code can only be used once.",
          }, { status: 409 });
        }
        // Re-throw other errors
        throw markError;
      }

      // Now insert user_access (will fail if user_id already exists - prevents re-redemption)
      const supabaseAdmin = getSupabaseAdmin();
      
      // Check if user already has access (to provide better error message)
      const { data: existingAccess, error: checkError } = await supabaseAdmin
        .from('user_access')
        .select('user_id, access_code')
        .eq('user_id', userId)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error("[Invite] Error checking existing access:", checkError);
        throw new Error("Failed to check existing access");
      }

      if (existingAccess) {
        // User already has access - revert code marking and return error
        await revertCodeMarking(trimmedCode);
        return NextResponse.json({
          valid: false,
          message: "You have already redeemed an invite code. Each user can only redeem once.",
        }, { status: 409 }); // 409 Conflict
      }

      // Insert new access record (no onConflict - will fail if duplicate user_id)
      const { error: insertError } = await supabaseAdmin
        .from('user_access')
        .insert({
          user_id: userId,
          access_code: trimmedCode,
          granted_at: new Date().toISOString()
        });

      if (insertError) {
        // Check if it's a duplicate key error (user already has access)
        if (insertError.code === '23505') { // PostgreSQL unique violation
          console.error("[Invite] Duplicate user_id detected:", insertError);
          await revertCodeMarking(trimmedCode);
          return NextResponse.json({
            valid: false,
            message: "You have already redeemed an invite code. Each user can only redeem once.",
          }, { status: 409 }); // 409 Conflict
        }
        
        // Other database errors
        console.error("[Invite] DB Insert Error:", insertError);
        await revertCodeMarking(trimmedCode);
        throw new Error("Failed to save access record");
      }

      // Success - both operations completed
      const hashedUserId = hashUserId(userId);
      console.log(`[Invite] ✅ Code ${trimmedCode} used by user ${hashedUserId}`);

      return NextResponse.json({
        valid: true,
        message: "Access granted! Welcome to Arcle.",
      });

    } catch (error: any) {
      // If code was marked as used but insert failed, revert the marking
      if (codeMarkedAsUsed) {
        try {
          await revertCodeMarking(trimmedCode);
          console.log(`[Invite] Reverted code marking for ${trimmedCode} due to error`);
        } catch (revertError) {
          console.error(`[Invite] Failed to revert code marking for ${trimmedCode}:`, revertError);
          // Log but don't throw - the code is already marked, but we should investigate
        }
      }

      // Return appropriate error
      if (error.message?.includes("already been used") || error.message?.includes("already redeemed")) {
        return NextResponse.json({
          valid: false,
          message: error.message || "This invite code has already been used.",
        }, { status: 409 });
      }

      console.error("[Invite] Error in redemption flow:", error);
      return NextResponse.json(
        { valid: false, message: "Server error during redemption. Please try again." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Invite] Error verifying code:", error);
    return NextResponse.json(
      { valid: false, message: "Server error. Please try again." },
      { status: 500 }
    );
  }
}



