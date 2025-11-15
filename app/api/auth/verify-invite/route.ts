/**
 * API Route: Verify Invite Code
 * 
 * POST /api/auth/verify-invite
 * Body: { code: string }
 * Returns: { valid: boolean, message: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { isValidInviteCode } from "@/lib/auth/invite-codes";

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

    const isValid = isValidInviteCode(code);

    if (isValid) {
      return NextResponse.json({
        valid: true,
        message: "Access granted! Welcome to Arcle.",
      });
    } else {
      return NextResponse.json({
        valid: false,
        message: "Invalid invite code. Please check and try again.",
      });
    }
  } catch (error) {
    console.error("[Invite] Error verifying code:", error);
    return NextResponse.json(
      { valid: false, message: "Server error" },
      { status: 500 }
    );
  }
}



