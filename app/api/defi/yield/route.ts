/**
 * Yield Farming API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { getAvailableStrategies, getBestYieldStrategy, startYieldFarming, getActivePositions, withdrawYield } from "@/lib/defi/yield-farming";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const walletAddress = searchParams.get("walletAddress");
    
    if (action === "strategies") {
      const chain = searchParams.get("chain") as any;
      const strategies = await getAvailableStrategies(chain);
      return NextResponse.json({ success: true, data: strategies });
    }
    
    if (action === "positions" && walletAddress) {
      const positions = getActivePositions(walletAddress);
      return NextResponse.json({ success: true, data: positions });
    }
    
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, walletId, walletAddress, strategyId, amount, positionId } = body;
    
    if (action === "start" && walletId && walletAddress && strategyId && amount) {
      const result = await startYieldFarming(walletId, walletAddress, strategyId, amount);
      return NextResponse.json({ success: result.success, data: result });
    }
    
    if (action === "withdraw" && walletId && positionId) {
      const result = await withdrawYield(positionId, walletId);
      return NextResponse.json({ success: result.success, data: result });
    }
    
    if (action === "best-strategy" && amount) {
      const riskTolerance = body.riskTolerance || "low";
      const chain = body.chain;
      const strategy = await getBestYieldStrategy(amount, riskTolerance, chain);
      return NextResponse.json({ success: true, data: strategy });
    }
    
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

