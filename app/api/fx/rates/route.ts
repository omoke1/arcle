/**
 * FX Rates API Route
 * 
 * GET /api/fx/rates?from=USDC&to=EURC
 * Returns real-time exchange rates
 */

import { NextRequest, NextResponse } from "next/server";
import { getFXRate, getMultipleFXRates } from "@/lib/fx/fx-rates";

// Force dynamic rendering since we use request.url
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from")?.toUpperCase();
    const to = searchParams.get("to")?.toUpperCase();
    const pairs = searchParams.get("pairs"); // Comma-separated pairs like "USDC-EURC,USDC-BTC"
    
    if (!from || !to) {
      // If pairs parameter is provided, return multiple rates
      if (pairs) {
        const pairList = pairs.split(",").map(pair => {
          const [f, t] = pair.split("-");
          return { from: f?.toUpperCase() || "", to: t?.toUpperCase() || "" };
        }).filter(p => p.from && p.to);
        
        const rates = await getMultipleFXRates(pairList);
        const ratesObj: Record<string, any> = {};
        rates.forEach((rate, key) => {
          ratesObj[key] = {
            from: rate.from,
            to: rate.to,
            rate: rate.rate,
            timestamp: rate.timestamp,
            source: rate.source,
          };
        });
        
        return NextResponse.json({
          success: true,
          data: ratesObj,
        });
      }
      
      return NextResponse.json(
        { success: false, error: "from and to parameters are required" },
        { status: 400 }
      );
    }
    
    const forceRefresh = searchParams.get("refresh") === "true";
    const result = await getFXRate(from, to, forceRefresh);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to fetch FX rate" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        from: result.rate!.from,
        to: result.rate!.to,
        rate: result.rate!.rate,
        timestamp: result.rate!.timestamp,
        source: result.rate!.source,
      },
    });
  } catch (error) {
    console.error("Error fetching FX rate:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch FX rate",
      },
      { status: 500 }
    );
  }
}

