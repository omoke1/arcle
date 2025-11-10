/**
 * Batch Transaction API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { createBatch, executeBatch, getBatchHistory } from "@/lib/defi/batch-transactions";

export async function GET(request: NextRequest) {
  try {
    const batches = getBatchHistory();
    return NextResponse.json({ success: true, data: batches });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, transactions, batchId, walletId, walletAddress } = body;
    
    if (action === "create" && transactions) {
      const batch = createBatch(transactions);
      return NextResponse.json({ success: true, data: batch });
    }
    
    if (action === "execute" && batchId && walletId && walletAddress) {
      const batches = getBatchHistory();
      const batch = batches.find(b => b.id === batchId);
      
      if (!batch) {
        return NextResponse.json({ success: false, error: "Batch not found" }, { status: 404 });
      }
      
      const result = await executeBatch(walletId, walletAddress, batch);
      return NextResponse.json({ success: result.status === "completed", data: result });
    }
    
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

