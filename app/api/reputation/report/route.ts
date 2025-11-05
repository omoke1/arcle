/**
 * Reputation Signals API
 * 
 * Handles scam reports and reputation signals from users
 */

import { NextRequest, NextResponse } from "next/server";
import { addScamAddress } from "@/lib/security/risk-scoring";

interface ScamReport {
  address: string;
  reason: string;
  description?: string;
  reporter?: string; // Optional: user identifier
}

/**
 * POST /api/reputation/report
 * Submit a scam report
 */
export async function POST(request: NextRequest) {
  try {
    const body: ScamReport = await request.json();
    const { address, reason, description, reporter } = body;

    if (!address || !reason) {
      return NextResponse.json(
        { success: false, error: "Address and reason are required" },
        { status: 400 }
      );
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { success: false, error: "Invalid address format" },
        { status: 400 }
      );
    }

    // Add to scam database
    addScamAddress(address);

    // In production, this would:
    // 1. Store in database with metadata (reporter, timestamp, reason)
    // 2. Notify community/other users
    // 3. Aggregate reputation signals
    // 4. Provide analytics

    return NextResponse.json({
      success: true,
      message: "Scam report submitted successfully",
      address,
    });
  } catch (error: any) {
    console.error("Error submitting scam report:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to submit scam report",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reputation/report?address=0x...
 * Check if address has been reported
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { success: false, error: "Address is required" },
        { status: 400 }
      );
    }

    // Check if address is in scam database
    // In production, this would query a database
    const { getAddressHistory } = await import("@/lib/security/risk-scoring");
    const history = getAddressHistory(address);

    // For MVP, return basic info
    // In production, return aggregated reputation data
    return NextResponse.json({
      success: true,
      address,
      reported: false, // Placeholder - would check database
      reportCount: 0,
      reputationScore: 50, // Neutral
    });
  } catch (error: any) {
    console.error("Error checking reputation:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to check reputation",
      },
      { status: 500 }
    );
  }
}


