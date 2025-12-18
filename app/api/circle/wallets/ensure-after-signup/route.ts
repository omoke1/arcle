/**
 * API Route: Ensure Wallet After Signup
 * 
 * Server-side endpoint to check for and create wallets after social/email signup.
 * This avoids client-side SDK issues and keeps API keys secure.
 */

import { NextRequest, NextResponse } from "next/server";
import { ensureWalletAfterSignup } from "@/lib/wallet/signup-wallet-creation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, userToken, encryptionKey, blockchain = "ARC-TESTNET" } = body;

    if (!userId || !userToken) {
      return NextResponse.json(
        {
          success: false,
          error: "userId and userToken are required",
        },
        { status: 400 }
      );
    }

    const result = await ensureWalletAfterSignup(
      userId,
      userToken,
      encryptionKey,
      blockchain
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[API] Error ensuring wallet after signup:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to ensure wallet after signup",
      },
      { status: 500 }
    );
  }
}


