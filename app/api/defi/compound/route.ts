/**
 * Auto-Compound API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { createCompoundStrategy, executeAutoCompound, checkAndExecuteCompounds } from "@/lib/defi/auto-compound";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const walletId = searchParams.get("walletId");
    const walletAddress = searchParams.get("walletAddress");
    
    if (action === "check" && walletId && walletAddress) {
      const executions = await checkAndExecuteCompounds(walletId, walletAddress);
      return NextResponse.json({ success: true, data: executions });
    }
    
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, positionIds, frequency, minRewardAmount, strategyId, walletId, walletAddress } = body;
    
    if (action === "create-strategy" && positionIds && frequency) {
      const strategy = createCompoundStrategy(positionIds, frequency, minRewardAmount);
      return NextResponse.json({ success: true, data: strategy });
    }
    
    if (action === "execute" && strategyId && walletId && walletAddress) {
      // In production, get strategy from database
      // For now, we'll need to pass the full strategy in the request body
      const strategy = body.strategy;
      
      if (!strategy) {
        return NextResponse.json({ success: false, error: "Strategy not found. Please provide strategy in request body." }, { status: 404 });
      }
      
      const execution = await executeAutoCompound(walletId, walletAddress, strategy);
      return NextResponse.json({ success: execution !== null, data: execution });
    }
    
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

