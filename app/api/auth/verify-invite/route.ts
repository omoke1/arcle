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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

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
      // Log more details for debugging
      const { getInviteCodes } = await import("@/lib/auth/invite-codes");
      const allCodes = getInviteCodes();
      console.log(`[Invite] Invalid code attempt: ${trimmedCode}`);
      console.log(`[Invite] Total valid codes: ${allCodes.length}`);
      console.log(`[Invite] Code format check: length=${trimmedCode.length}, matches pattern=${/^[A-Z0-9]{8}$/.test(trimmedCode)}`);
      
      // In development, show first few codes for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Invite] First 5 valid codes: ${allCodes.slice(0, 5).join(', ')}`);
      }
      
      return NextResponse.json({
        valid: false,
        message: "Invalid invite code. Please check and try again.",
      });
    }

    // Step 2: Check if code has already been used (server-side)
    const alreadyUsed = await isCodeUsedOnServer(trimmedCode);

    if (alreadyUsed) {
      console.log(`[Invite] Code already used: ${trimmedCode}`);
      return NextResponse.json({
        valid: false,
        message: "This invite code has already been used. Each code can only be used once.",
      });
    }

    // Step 3: Mark code as used (server-side permanent tracking)
    try {
      // Get IP and user agent for audit trail
      const ipAddress = request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 
                       'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';

      await markCodeAsUsedOnServer(trimmedCode, {
        ipAddress,
        userAgent,
      });

      console.log(`[Invite] ✅ Code ${trimmedCode} successfully verified and marked as used`);

      return NextResponse.json({
        valid: true,
        message: "Access granted! Welcome to Arcle.",
      });
    } catch (markError: any) {
      // This could happen if there's a race condition (two requests at the same time)
      console.error(`[Invite] Error marking code as used: ${markError.message}`);
      return NextResponse.json({
        valid: false,
        message: "This invite code has already been used. Each code can only be used once.",
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



