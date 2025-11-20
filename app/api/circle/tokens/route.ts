/**
 * Multi-Token Balance API
 * 
 * Fetches all token balances for a wallet (USDC, EURC, ETH, etc.)
 * Uses Circle's balance endpoint which returns all tokens
 */

import { NextRequest, NextResponse } from "next/server";
import { circleApiRequest } from "@/lib/circle";

// Force dynamic rendering since we use request.nextUrl.searchParams
export const dynamic = 'force-dynamic';

interface TokenBalance {
  token: string;
  symbol: string;
  amount: string;
  decimals: number;
  usdValue?: string;
}

export async function GET(request: NextRequest) {
  try {
    const walletId = request.nextUrl.searchParams.get("walletId");
    const blockchain = request.nextUrl.searchParams.get("blockchain") || "ARC-TESTNET";

    if (!walletId) {
      return NextResponse.json(
        { success: false, error: "walletId is required" },
        { status: 400 }
      );
    }

    console.log(`[Tokens API] Fetching all token balances for wallet: ${walletId} on ${blockchain}`);

    // Get all balances from Circle
    const response = await circleApiRequest<any>(
      `/v1/w3s/developer/wallets/${walletId}/balances?blockchain=${blockchain}`
    );

    if (!response.data?.tokenBalances && !response.tokenBalances) {
      console.log(`[Tokens API] No token balances found`);
      return NextResponse.json({
        success: true,
        data: {
          tokens: [],
          totalValueUSD: "0.00",
        },
      });
    }

    // Extract token balances
    const rawBalances = response.data?.tokenBalances || response.tokenBalances || [];
    
    console.log(`[Tokens API] Found ${rawBalances.length} token balances`);

    // Format token balances
    const tokens: TokenBalance[] = rawBalances.map((balance: any) => {
      const amount = balance.amount || balance.balance || "0";
      const decimals = balance.token?.decimals || balance.decimals || 6;
      const symbol = balance.token?.symbol || balance.symbol || "UNKNOWN";
      const tokenAddress = balance.token?.address || balance.tokenAddress || "";

      // Convert from smallest unit to decimal
      const amountDecimal = (parseFloat(amount) / Math.pow(10, decimals)).toFixed(decimals);

      return {
        token: tokenAddress,
        symbol: symbol,
        amount: amountDecimal,
        decimals: decimals,
        // TODO: Add USD value calculation via price API
        usdValue: symbol === "USDC" || symbol === "EURC" ? amountDecimal : undefined,
      };
    });

    // Filter out zero balances
    const nonZeroTokens = tokens.filter(t => parseFloat(t.amount) > 0);

    // Calculate total USD value (for stablecoins)
    const totalValueUSD = nonZeroTokens
      .filter(t => t.usdValue)
      .reduce((sum, t) => sum + parseFloat(t.usdValue!), 0)
      .toFixed(2);

    console.log(`[Tokens API] Returning ${nonZeroTokens.length} non-zero token balances`);

    return NextResponse.json({
      success: true,
      data: {
        tokens: nonZeroTokens,
        totalValueUSD,
        walletId,
        blockchain,
      },
    });

  } catch (error: any) {
    console.error("[Tokens API] Error fetching token balances:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch token balances",
      },
      { status: 500 }
    );
  }
}



