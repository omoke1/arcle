/**
 * Liquidity Aggregation API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { findBestLiquidity, executeAggregatedTrade } from "@/lib/defi/liquidity-aggregation";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, fromToken, toToken, amount, walletId, chains, quote } = body;
    
    if (action === "aggregate" && fromToken && toToken && amount) {
      const aggregated = await findBestLiquidity(fromToken, toToken, amount, chains);
      return NextResponse.json({ success: aggregated !== null, data: aggregated });
    }
    
    if (action === "execute" && walletId && quote) {
      const result = await executeAggregatedTrade(walletId, quote);
      return NextResponse.json({ success: result.success, data: result });
    }
    
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

