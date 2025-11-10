/**
 * FX Conversion API Route
 * 
 * POST /api/fx/convert
 * Converts amount from one currency to another
 */

import { NextRequest, NextResponse } from "next/server";
import { convertCurrency } from "@/lib/fx/fx-rates";
import { isSupportedCurrency } from "@/lib/fx/currency-service";

interface ConvertRequest {
  amount: string;
  from: string;
  to: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ConvertRequest = await request.json();
    const { amount, from, to } = body;
    
    if (!amount || !from || !to) {
      return NextResponse.json(
        { success: false, error: "amount, from, and to are required" },
        { status: 400 }
      );
    }
    
    // Validate currencies
    if (!isSupportedCurrency(from.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: `Unsupported currency: ${from}. Supported: USDC, EURC` },
        { status: 400 }
      );
    }
    
    if (!isSupportedCurrency(to.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: `Unsupported currency: ${to}. Supported: USDC, EURC` },
        { status: 400 }
      );
    }
    
    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid amount. Must be a positive number" },
        { status: 400 }
      );
    }
    
    const result = await convertCurrency(
      amount,
      from.toUpperCase(),
      to.toUpperCase()
    );
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Conversion failed" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        amount,
        convertedAmount: result.convertedAmount,
        rate: result.rate,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error("Error converting currency:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Conversion failed",
      },
      { status: 500 }
    );
  }
}

