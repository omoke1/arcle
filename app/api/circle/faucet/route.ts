/**
 * Testnet Faucet API Route
 * 
 * Requests testnet tokens (native and USDC) for Arc testnet wallets
 * Uses Circle's testnet token faucet
 */

import { NextRequest, NextResponse } from "next/server";
import { getCircleClient } from "@/lib/circle-sdk";

interface FaucetRequest {
  walletId?: string;
  address: string;
  blockchain?: string;
  native?: boolean;
  usdc?: boolean;
}

/**
 * POST /api/circle/faucet
 * Request testnet tokens from Circle's faucet
 */
export async function POST(request: NextRequest) {
  try {
    const body: FaucetRequest = await request.json();
    
    const { address, walletId, blockchain = "ARC-TESTNET", native = true, usdc = true } = body;

    if (!address) {
      return NextResponse.json(
        {
          success: false,
          error: "address is required",
        },
        { status: 400 }
      );
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid address format",
        },
        { status: 400 }
      );
    }

    // Get Circle SDK client
    const client = getCircleClient();

    // Request testnet tokens via Circle SDK
    console.log(`Requesting testnet tokens for ${address} on ${blockchain}...`);
    
    try {
      const faucetResponse = await client.requestTestnetTokens({
        address,
        blockchain: blockchain as any,
        native, // Request native tokens (for gas)
        usdc,   // Request USDC tokens
      });

      return NextResponse.json({
        success: true,
        message: "Testnet tokens requested successfully. They should arrive shortly.",
        data: {
          address,
          blockchain,
          native,
          usdc,
          requestedAt: new Date().toISOString(),
        },
      });
    } catch (faucetError: any) {
      // Handle specific faucet errors
      if (faucetError?.response?.status === 429) {
        return NextResponse.json(
          {
            success: false,
            error: "Rate limit exceeded. Please wait a few minutes before requesting again.",
          },
          { status: 429 }
        );
      }

      if (faucetError?.response?.status === 400) {
        return NextResponse.json(
          {
            success: false,
            error: faucetError?.response?.data?.message || "Invalid request. Please check the address and blockchain.",
          },
          { status: 400 }
        );
      }

      // Generic error
      throw faucetError;
    }
  } catch (error: any) {
    console.error("Error requesting testnet tokens:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.response?.data?.message || error?.message || "Failed to request testnet tokens",
      },
      { status: 500 }
    );
  }
}

