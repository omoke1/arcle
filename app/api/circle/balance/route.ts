/**
 * Circle Balance API Routes
 * 
 * Handles wallet balance queries for USDC on Arc
 * Based on Circle API: GET /v1/w3s/wallets/{walletId}/balances
 */

import { NextRequest, NextResponse } from "next/server";
import { circleApiRequest } from "@/lib/circle";
import { getArcClient, getUSDCAddress, arcUtils } from "@/lib/arc";
import { erc20Abi } from "viem";

interface CircleBalanceResponse {
  data: Array<{
    tokenId: string;
    amount: string;
    updateDate: string;
  }>;
}

/**
 * GET /api/circle/balance
 * Get wallet balance via Circle API or directly from Arc blockchain
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletId = searchParams.get("walletId");
    const address = searchParams.get("address"); // Wallet address from Circle
    const useBlockchain = searchParams.get("useBlockchain") === "true"; // Optional: query directly from blockchain

    if (!walletId && !address) {
      return NextResponse.json(
        { success: false, error: "walletId or address is required" },
        { status: 400 }
      );
    }

    // Option 1: Query via Circle API (recommended)
    if (walletId && !useBlockchain) {
      const balances = await circleApiRequest<CircleBalanceResponse>(
        `/v1/w3s/wallets/${walletId}/balances`,
        {
          method: "GET",
        }
      );

      // Find USDC balance
      const usdcBalance = balances.data?.find(
        (b) => b.tokenId === getUSDCAddress()
      ) || {
        tokenId: getUSDCAddress(),
        amount: "0",
        updateDate: new Date().toISOString(),
      };

      return NextResponse.json({
        success: true,
        data: {
          walletId,
          balance: arcUtils.formatUSDC(BigInt(usdcBalance.amount)),
          balanceRaw: usdcBalance.amount,
          token: "USDC",
          network: "ARC",
          lastUpdated: usdcBalance.updateDate,
        },
      });
    }

    // Option 2: Query directly from Arc blockchain
    if (address) {
      if (!arcUtils.isValidAddress(address)) {
        return NextResponse.json(
          { success: false, error: "Invalid address format" },
          { status: 400 }
        );
      }

      const client = getArcClient();
      const usdcAddress = getUSDCAddress();

      const balance = await client.readContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });

      const formattedBalance = arcUtils.formatUSDC(balance);

      return NextResponse.json({
        success: true,
        data: {
          address,
          balance: formattedBalance,
          balanceRaw: balance.toString(),
          token: "USDC",
          network: "ARC",
        },
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid parameters" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error fetching balance:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch balance",
      },
      { status: 500 }
    );
  }
}
