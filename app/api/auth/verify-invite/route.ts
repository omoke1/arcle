/**
 * API Route: Verify Invite Code
 * 
 * POST /api/auth/verify-invite
 * Body: { code: string }
 * Returns: { valid: boolean, message: string }
 * 
 * Features:
 * - Validates code exists in allowed list
 * - Checks if code has already been used (server-side tracking)
 * - Marks code as used permanently after successful verification
 * - Tracks IP and user agent for audit purposes
 */

import { NextRequest, NextResponse } from "next/server";
import { isValidInviteCode } from "@/lib/auth/invite-codes";
import { isCodeUsedOnServer, markCodeAsUsedOnServer } from "@/lib/auth/used-codes-store";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, userId } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { valid: false, message: "Invalid request" },
        { status: 400 }
      );
    }

    const trimmedCode = code.trim().toUpperCase();

    // Step 1: Check if code is in the valid list
    const isValid = isValidInviteCode(trimmedCode);

    if (!isValid) {
      return NextResponse.json({
        valid: false,
        message: "Invalid invite code. Please check and try again.",
      });
    }

    // Step 2: Check if code has already been used (server-side)
    const alreadyUsed = await isCodeUsedOnServer(trimmedCode);

    if (alreadyUsed) {
      return NextResponse.json({
        valid: false,
        message: "This invite code has already been used. Each code can only be used once.",
      });
    }

    // Step 3: Grant Access (Database Write via Admin)
    if (userId) {
      try {
        const supabaseAdmin = getSupabaseAdmin();
        const { error } = await supabaseAdmin.from('user_access').upsert({
          user_id: userId,
          access_code: trimmedCode,
          granted_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

        if (error) {
          console.error("[Invite] DB Insert Error:", error);
          throw new Error("Failed to save access record");
        }
      } catch (dbError) {
        console.error("[Invite] Critical DB error:", dbError);
        return NextResponse.json(
          { valid: false, message: "Database errror granting access." },
          { status: 500 }
        );
      }
    }

    // Step 4: Mark code as used (server-side permanent tracking)
    try {
      const ipAddress = request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';

      await markCodeAsUsedOnServer(trimmedCode, {
        ipAddress,
        userAgent,
      });

      console.log(`[Invite] ✅ Code ${trimmedCode} used by user ${userId || 'anon'}`);

      return NextResponse.json({
        valid: true,
        message: "Access granted! Welcome to Arcle.",
      });
    } catch (markError: any) {
      console.error(`[Invite] Error marking code as used: ${markError.message}`);
      return NextResponse.json({
        valid: false,
        message: "This invite code has already been used.",
      });
    }
  } catch (error) {
    console.error("[Invite] Error verifying code:", error);
    return NextResponse.json(
      { valid: false, message: "Server error. Please try again." },
      { status: 500 }
    );
  }
}



