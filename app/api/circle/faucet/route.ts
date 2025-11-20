/**
 * Testnet Faucet API Route
 * 
 * Requests testnet tokens (native and USDC) for Arc testnet wallets
 * Uses Circle's testnet token faucet
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserCircleClient } from "@/lib/circle-user-sdk";

interface FaucetRequest {
  walletId?: string;
  address: string;
  blockchain?: string;
  native?: boolean;
  usdc?: boolean;
  userToken?: string; // Required for User-Controlled Wallets
}

/**
 * POST /api/circle/faucet
 * Request testnet tokens from Circle's faucet
 */
export async function POST(request: NextRequest) {
  try {
    const body: FaucetRequest = await request.json();
    
    const { address, walletId, blockchain = "ARC-TESTNET", native = true, usdc = true, userToken } = body;

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

    // Get User-Controlled Wallets SDK client
    const client = getUserCircleClient();

    // Request testnet tokens via Circle SDK
    console.log(`Requesting testnet tokens for ${address} on ${blockchain}...`);
    
    try {
      // Build request params
      const faucetParams: any = {
        address,
        blockchain: blockchain as any,
        native, // Request native tokens (for gas)
        usdc,   // Request USDC tokens
      };
      
      // Add userToken if provided (User-Controlled Wallets)
      if (userToken) {
        faucetParams.userToken = userToken;
      }
      
      const faucetResponse = await (client as any).requestTestnetTokens(faucetParams);

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
      if (faucetError?.response?.status === 401) {
        return NextResponse.json(
          {
            success: false,
            error: "Unauthorized: Your API key may not have faucet access in sandbox. Please enable faucet/drips permission or provide guidance to enable testnet tokens on ARC-TESTNET.",
          },
          { status: 401 }
        );
      }
      if (faucetError?.response?.status === 429 || faucetError?.response?.data?.code === 5) {
        return NextResponse.json(
          {
            success: false,
            error: "⏳ Rate limit exceeded. Circle's faucet has a cooldown period (typically 5-10 minutes). Please wait before requesting again, or use the manual faucet at https://faucet.circle.com",
            errorCode: "RATE_LIMIT_EXCEEDED",
            retryAfter: 600, // 10 minutes in seconds
            manualFaucet: "https://faucet.circle.com",
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

