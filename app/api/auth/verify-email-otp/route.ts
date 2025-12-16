import { NextRequest, NextResponse } from "next/server";

/**
 * Email OTP Verification API Route
 * 
 * NOTE: This endpoint is a placeholder. OTP verification happens CLIENT-SIDE
 * using the Circle W3S SDK, not server-side.
 * 
 * The client-side flow is:
 * 1. Call /api/circle/users with action="email-login" to get deviceToken
 * 2. Use W3S SDK client-side to verify OTP and create wallet
 * 3. SDK returns user credentials after successful verification
 * 
 * This endpoint exists for potential future server-side verification if Circle adds it.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: "OTP verification must be done client-side using the Circle W3S SDK. Use the CircleEmailWidget component instead.",
      hint: "Email OTP verification requires the @circle-fin/w3s-pw-web-sdk on the client side.",
    },
    { status: 501 } // Not Implemented
  );
}

