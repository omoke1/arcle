/**
 * Portfolio Rebalancing API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { analyzePortfolio, executeRebalancing, createDefaultStrategy } from "@/lib/defi/portfolio-rebalancing";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("walletAddress");
    const action = searchParams.get("action");
    
    if (action === "analyze" && walletAddress) {
      const strategy = createDefaultStrategy();
      const actions = await analyzePortfolio(walletAddress, strategy);
      return NextResponse.json({ success: true, data: { actions, strategy } });
    }
    
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletId, walletAddress, strategy } = body;
    
    if (!walletId || !walletAddress) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }
    
    const rebalanceStrategy = strategy || createDefaultStrategy();
    const result = await executeRebalancing(walletId, walletAddress, rebalanceStrategy);
    return NextResponse.json({ success: result.success, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

