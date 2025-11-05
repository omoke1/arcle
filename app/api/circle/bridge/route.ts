/**
 * CCTP Bridge API
 * 
 * Handles cross-chain USDC transfers via Circle's Cross-Chain Transfer Protocol (CCTP)
 * Supports: Arc ↔ Base, Arc ↔ Arbitrum, etc.
 */

import { NextRequest, NextResponse } from "next/server";
import { initiateBridge, getBridgeStatus, pollBridgeStatus } from "@/lib/bridge/cctp-bridge";

interface BridgeRequest {
  walletId: string;
  amount: string; // USDC amount
  fromChain: "ARC" | "BASE" | "ARBITRUM" | "ETH";
  toChain: "ARC" | "BASE" | "ARBITRUM" | "ETH";
  destinationAddress: string;
}

/**
 * POST /api/circle/bridge
 * Initiate a cross-chain bridge transaction
 */
export async function POST(request: NextRequest) {
  try {
    const body: BridgeRequest = await request.json();
    const { walletId, amount, fromChain, toChain, destinationAddress } = body;

    if (!walletId || !amount || !fromChain || !toChain || !destinationAddress) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate chain names
    const validChains = ["ARC", "BASE", "ARBITRUM", "ETH"];
    if (!validChains.includes(fromChain) || !validChains.includes(toChain)) {
      return NextResponse.json(
        { success: false, error: "Invalid chain name" },
        { status: 400 }
      );
    }

    if (fromChain === toChain) {
      return NextResponse.json(
        { success: false, error: "Source and destination chains must be different" },
        { status: 400 }
      );
    }

    // Use CCTP bridge service
    const bridgeStatus = await initiateBridge({
      walletId,
      amount,
      fromChain,
      toChain,
      destinationAddress,
    });

    return NextResponse.json({
      success: true,
      ...bridgeStatus,
    });
  } catch (error: any) {
    console.error("Error initiating bridge:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to initiate bridge",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/circle/bridge?bridgeId=xxx
 * Get bridge transaction status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bridgeId = searchParams.get("bridgeId");

    if (!bridgeId) {
      return NextResponse.json(
        { success: false, error: "bridgeId is required" },
        { status: 400 }
      );
    }

    // Get bridge status from service
    const status = await getBridgeStatus(bridgeId);

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error: any) {
    console.error("Error checking bridge status:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to check bridge status",
      },
      { status: 500 }
    );
  }
}

