/**
 * Paymaster / Gas Station API
 * 
 * Handles gas sponsorship for sub-accounts
 * Uses Circle's Gas Station for sponsored transactions
 */

import { NextRequest, NextResponse } from "next/server";
import { circleApiRequest } from "@/lib/circle";

interface PaymasterRequest {
  walletId: string;
  transactionId?: string;
  userOpHash?: string; // For ERC-4337 user operations
}

/**
 * POST /api/circle/paymaster
 * Sponsor gas for a transaction
 */
export async function POST(request: NextRequest) {
  try {
    const body: PaymasterRequest = await request.json();
    const { walletId, transactionId, userOpHash } = body;

    if (!walletId) {
      return NextResponse.json(
        { success: false, error: "walletId is required" },
        { status: 400 }
      );
    }

    // For MVP: Use Circle's Gas Station API if available
    // For now, return a placeholder response
    // In production, this would call Circle's Paymaster API
    
    // TODO: Integrate with Circle Gas Station API
    // Reference: https://developers.circle.com/w3s/docs/gas-station
    
    return NextResponse.json({
      success: true,
      sponsored: true,
      message: "Gas sponsorship enabled for this transaction",
      // In production, this would include actual sponsorship details
    });
  } catch (error: any) {
    console.error("Error sponsoring gas:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to sponsor gas",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/circle/paymaster?walletId=xxx
 * Check if gas sponsorship is available for a wallet
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletId = searchParams.get("walletId");

    if (!walletId) {
      return NextResponse.json(
        { success: false, error: "walletId is required" },
        { status: 400 }
      );
    }

    // Check if gas sponsorship is enabled for this wallet
    // For MVP, we'll check if it's a sub-account
    // In production, this would check Circle Gas Station configuration

    return NextResponse.json({
      success: true,
      sponsored: true, // MVP: Always return true for sub-accounts
      available: true,
    });
  } catch (error: any) {
    console.error("Error checking gas sponsorship:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to check gas sponsorship",
      },
      { status: 500 }
    );
  }
}


