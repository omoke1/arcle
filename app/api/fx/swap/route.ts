/**
 * FX Swap Execution API Route
 * 
 * POST /api/fx/swap
 * Executes actual currency swaps using Circle API
 */

import { NextRequest, NextResponse } from "next/server";
import { executeFXSwap } from "@/lib/archived/legacy-dev-controlled/fx-swap-execution";
import { isSupportedCurrency, type SupportedCurrency } from "@/lib/fx/currency-service";

interface SwapRequest {
  walletId: string;
  walletAddress?: string;
  fromCurrency: string;
  toCurrency: string;
  amount: string;
  idempotencyKey?: string;
  feeLevel?: "LOW" | "MEDIUM" | "HIGH";
}

export async function POST(request: NextRequest) {
  try {
    const body: SwapRequest = await request.json();
    const { walletId, walletAddress, fromCurrency, toCurrency, amount, idempotencyKey, feeLevel } = body;
    
    if (!walletId || !fromCurrency || !toCurrency || !amount) {
      return NextResponse.json(
        { success: false, error: "walletId, fromCurrency, toCurrency, and amount are required" },
        { status: 400 }
      );
    }
    
    // Validate currencies
    if (!isSupportedCurrency(fromCurrency.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: `Unsupported source currency: ${fromCurrency}. Supported: USDC, EURC` },
        { status: 400 }
      );
    }
    
    if (!isSupportedCurrency(toCurrency.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: `Unsupported target currency: ${toCurrency}. Supported: USDC, EURC` },
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
    
    // Execute swap
    const result = await executeFXSwap({
      walletId,
      walletAddress,
      fromCurrency: fromCurrency.toUpperCase() as SupportedCurrency,
      toCurrency: toCurrency.toUpperCase() as SupportedCurrency,
      amount,
      idempotencyKey,
      feeLevel,
    });
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Swap execution failed" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        transactionId: result.transactionId,
        fromCurrency: result.fromCurrency,
        toCurrency: result.toCurrency,
        fromAmount: result.fromAmount,
        toAmount: result.toAmount,
        rate: result.rate,
        blockchainHash: result.blockchainHash,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error("Error executing FX swap:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Swap execution failed",
      },
      { status: 500 }
    );
  }
}

