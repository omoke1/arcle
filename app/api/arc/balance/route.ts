/**
 * Arc Network Balance API
 * 
 * Query USDC balance directly from Arc blockchain
 */

import { NextRequest, NextResponse } from "next/server";
import { getArcClient, getUSDCAddress, arcUtils } from "@/lib/arc";
import { erc20Abi } from "viem";

// Force dynamic rendering since we use request.url
export const dynamic = 'force-dynamic';

/**
 * GET /api/arc/balance
 * Get USDC balance for an address on Arc
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { success: false, error: "address is required" },
        { status: 400 }
      );
    }

    if (!arcUtils.isValidAddress(address)) {
      return NextResponse.json(
        { success: false, error: "Invalid address format" },
        { status: 400 }
      );
    }

    const client = getArcClient();

    // Get USDC address for current network
    let usdcAddress: `0x${string}`;
    try {
      usdcAddress = getUSDCAddress();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "USDC contract address not configured",
        },
        { status: 500 }
      );
    }

    // Get USDC balance
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
        network: "arc",
      },
    });
  } catch (error) {
    console.error("Error fetching Arc balance:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch balance",
      },
      { status: 500 }
    );
  }
}

