/**
 * Split Payment API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { executeSplitPayment, calculateEvenSplit, calculatePercentageSplit } from "@/lib/defi/split-payments";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, totalAmount, recipients, numberOfRecipients, percentages } = body;
    
    if (action === "execute") {
      if (!body.walletId || !body.walletAddress || !totalAmount || !recipients) {
        return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
      }
      
      const result = await executeSplitPayment({
        totalAmount,
        recipients,
        walletId: body.walletId,
        walletAddress: body.walletAddress,
      });
      
      return NextResponse.json({ success: result.success, data: result });
    }
    
    if (action === "calculate-even" && totalAmount && numberOfRecipients) {
      const amounts = calculateEvenSplit(totalAmount, numberOfRecipients);
      return NextResponse.json({ success: true, data: { amounts } });
    }
    
    if (action === "calculate-percentage" && totalAmount && percentages) {
      try {
        const amounts = calculatePercentageSplit(totalAmount, percentages);
        return NextResponse.json({ success: true, data: { amounts } });
      } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }
    }
    
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

