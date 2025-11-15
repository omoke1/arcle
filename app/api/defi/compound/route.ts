/**
 * Auto-Compound API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { createCompoundStrategy, executeCompound, monitorAndCompound, getStrategiesByWallet } from "@/lib/defi/auto-compound";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const walletId = searchParams.get("walletId");
    const walletAddress = searchParams.get("walletAddress");
    
    if (action === "check" && walletAddress) {
      const executions = await monitorAndCompound(walletAddress);
      return NextResponse.json({ success: true, data: executions });
    }
    
    if (action === "list" && walletId) {
      const strategies = getStrategiesByWallet(walletId);
      return NextResponse.json({ success: true, data: strategies });
    }
    
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, walletId, name, frequency, minimumYield, reinvestPercentage, walletAddress, strategy } = body;
    
    if (action === "create-strategy" && walletId && name && frequency) {
      const newStrategy = createCompoundStrategy(walletId, name, frequency, minimumYield, reinvestPercentage);
      return NextResponse.json({ success: true, data: newStrategy });
    }
    
    if (action === "execute" && strategy && walletAddress) {
      const execution = await executeCompound(strategy, walletAddress);
      return NextResponse.json({ success: execution.success, data: execution });
    }
    
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

