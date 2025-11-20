/**
 * USYC API Route
 * Handles yield/savings operations with Circle's USYC token
 * 
 * Actions:
 * - subscribe: Deposit USDC to earn yield
 * - redeem: Withdraw USDC plus earned yield
 * - position: Get current USYC position
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  subscribeToUSYC, 
  redeemUSYC, 
  getUSYCPosition,
  isUSYCAvailable,
  getAvailableBlockchains 
} from "@/lib/defi/yield-savings-usyc-user";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userId, userToken, walletId, amount, blockchain } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: "Action is required" },
        { status: 400 }
      );
    }

    // Subscribe to USYC (deposit)
    if (action === "subscribe") {
      if (!userId || !userToken || !walletId || !amount) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Missing required fields: userId, userToken, walletId, amount" 
          },
          { status: 400 }
        );
      }

      const chain = blockchain || "ETH";

      if (!isUSYCAvailable(chain)) {
        return NextResponse.json(
          { 
            success: false, 
            error: `USYC not available on ${chain}. Available on: ${getAvailableBlockchains().join(', ')}` 
          },
          { status: 400 }
        );
      }

      console.log(`[USYC API] Subscribing ${amount} USDC on ${chain}`);

      const result = await subscribeToUSYC(userId, userToken, walletId, amount, chain);

      if (result.success) {
        return NextResponse.json({
          success: true,
          data: {
            challengeId: result.challengeId,
            usdcAmount: result.usdcAmount,
            estimatedUSYC: result.estimatedUSYC,
            message: "Please complete the approval and subscription challenges in your wallet",
          },
        });
      } else {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }
    }

    // Redeem USYC (withdraw)
    if (action === "redeem") {
      if (!userId || !userToken || !walletId || !amount) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Missing required fields: userId, userToken, walletId, amount" 
          },
          { status: 400 }
        );
      }

      const chain = blockchain || "ETH";

      if (!isUSYCAvailable(chain)) {
        return NextResponse.json(
          { 
            success: false, 
            error: `USYC not available on ${chain}. Available on: ${getAvailableBlockchains().join(', ')}` 
          },
          { status: 400 }
        );
      }

      console.log(`[USYC API] Redeeming ${amount} USYC on ${chain}`);

      const result = await redeemUSYC(userId, userToken, walletId, amount, chain);

      if (result.success) {
        return NextResponse.json({
          success: true,
          data: {
            challengeId: result.challengeId,
            usycAmount: result.usycAmount,
            estimatedUSDC: result.estimatedUSDC,
            message: "Please complete the approval and redemption challenges in your wallet",
          },
        });
      } else {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }
    }

    // Get USYC position
    if (action === "position") {
      const { walletAddress, initialInvestment } = body;

      if (!walletAddress || !initialInvestment) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Missing required fields: walletAddress, initialInvestment" 
          },
          { status: 400 }
        );
      }

      const chain = blockchain || "ETH";

      const position = await getUSYCPosition(walletAddress, initialInvestment, chain);

      if (position) {
        return NextResponse.json({
          success: true,
          data: position,
        });
      } else {
        return NextResponse.json(
          { success: false, error: "Failed to fetch USYC position" },
          { status: 400 }
        );
      }
    }

    // Get available blockchains
    if (action === "available-chains") {
      return NextResponse.json({
        success: true,
        data: {
          chains: getAvailableBlockchains(),
        },
      });
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[USYC API] Error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || "Internal server error" 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    data: {
      name: "USYC API",
      description: "Circle's yield-bearing token earning overnight federal funds rate",
      endpoints: {
        subscribe: "POST with action=subscribe - Deposit USDC to earn yield",
        redeem: "POST with action=redeem - Withdraw USDC plus earned yield",
        position: "POST with action=position - Get current USYC position",
        availableChains: "POST with action=available-chains - Get supported blockchains",
      },
      availableChains: getAvailableBlockchains(),
    },
  });
}












