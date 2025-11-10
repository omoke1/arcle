/**
 * Arbitrage API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { scanArbitrageOpportunities, executeArbitrage } from "@/lib/defi/arbitrage";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("walletAddress");
    const minProfitMargin = parseFloat(searchParams.get("minProfitMargin") || "0.5");
    
    if (!walletAddress) {
      return NextResponse.json({ success: false, error: "walletAddress is required" }, { status: 400 });
    }
    
    const opportunities = await scanArbitrageOpportunities(walletAddress, minProfitMargin);
    return NextResponse.json({ success: true, data: opportunities });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletId, walletAddress, opportunity } = body;
    
    if (!walletId || !walletAddress || !opportunity) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }
    
    const execution = await executeArbitrage(walletId, walletAddress, opportunity);
    return NextResponse.json({ success: execution.status === "completed", data: execution });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

