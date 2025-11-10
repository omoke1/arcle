/**
 * FX Market Data API Route
 * 
 * GET /api/fx/market-data?pair=USDC-EURC
 * Returns market data including 24h change, high/low
 */

import { NextRequest, NextResponse } from "next/server";
import { getMarketData, getHistoricalRates } from "@/lib/fx/fx-market-data";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pair = searchParams.get("pair");
    const historical = searchParams.get("historical") === "true";
    const days = parseInt(searchParams.get("days") || "30");
    
    if (!pair) {
      return NextResponse.json(
        { success: false, error: "pair parameter is required (e.g., USDC-EURC)" },
        { status: 400 }
      );
    }
    
    if (historical) {
      const rates = await getHistoricalRates(pair, days);
      return NextResponse.json({
        success: true,
        data: {
          pair,
          historicalRates: rates,
        },
      });
    }
    
    const marketData = await getMarketData(pair);
    
    if (!marketData) {
      return NextResponse.json(
        { success: false, error: "Could not fetch market data" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: marketData,
    });
  } catch (error) {
    console.error("Error fetching market data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch market data",
      },
      { status: 500 }
    );
  }
}

