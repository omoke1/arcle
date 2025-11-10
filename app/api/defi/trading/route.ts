/**
 * Trading Execution API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { findBestRoute, executeTrade, getTradeHistory } from "@/lib/defi/trading-execution";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("walletAddress");
    const action = searchParams.get("action");
    
    if (action === "history" && walletAddress) {
      const history = getTradeHistory(walletAddress);
      return NextResponse.json({ success: true, data: history });
    }
    
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, fromToken, toToken, amount, chain, slippageTolerance, walletId, walletAddress } = body;
    
    if (action === "find-route" && fromToken && toToken && amount && chain) {
      const routes = await findBestRoute({
        fromToken,
        toToken,
        amount,
        chain,
        slippageTolerance,
      });
      return NextResponse.json({ success: true, data: routes });
    }
    
    if (action === "execute" && walletId && walletAddress && fromToken && toToken && amount && chain) {
      const execution = await executeTrade(walletId, walletAddress, {
        fromToken,
        toToken,
        amount,
        chain,
        slippageTolerance,
      });
      return NextResponse.json({ success: execution.status === "completed", data: execution });
    }
    
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

