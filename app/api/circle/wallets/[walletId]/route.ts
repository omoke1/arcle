/**
 * Circle Wallet Detail API
 * 
 * GET /api/circle/wallets/[walletId]
 * Get wallet details and address
 */

import { NextRequest, NextResponse } from "next/server";
import { circleApiRequest } from "@/lib/circle";

export async function GET(
  request: NextRequest,
  { params }: { params: { walletId: string } }
) {
  try {
    const { walletId } = params;

    if (!walletId) {
      return NextResponse.json(
        { success: false, error: "walletId is required" },
        { status: 400 }
      );
    }

    // Get wallet details
    const wallet = await circleApiRequest(
      `/v1/w3s/wallets/${walletId}`,
      {
        method: "GET",
      }
    );

    return NextResponse.json({
      success: true,
      data: wallet,
    });
  } catch (error) {
    console.error("Error fetching wallet:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch wallet",
      },
      { status: 500 }
    );
  }
}

