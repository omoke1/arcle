/**
 * Liquidity Aggregation API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { aggregateLiquidity, executeWithAggregatedLiquidity } from "@/lib/defi/liquidity-aggregation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, fromToken, toToken, amount, walletId, walletAddress } = body;
    
    if (action === "aggregate" && fromToken && toToken && amount) {
      const aggregated = await aggregateLiquidity(fromToken, toToken, amount);
      return NextResponse.json({ success: true, data: aggregated });
    }
    
    if (action === "execute" && walletId && walletAddress && fromToken && toToken && amount) {
      const result = await executeWithAggregatedLiquidity(walletId, walletAddress, fromToken, toToken, amount);
      return NextResponse.json({ success: result.success, data: result });
    }
    
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

