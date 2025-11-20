/**
 * CCTP API Route for User-Controlled Wallets
 * Handles cross-chain USDC transfers via Circle's Cross-Chain Transfer Protocol
 * 
 * Actions:
 * - initiate: Start CCTP transfer (burn USDC on source chain)
 * - continue: Continue transfer after burn (get attestation + mint on destination)
 * - status: Check transfer status
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  transferCCTPUser, 
  continueCCTPTransfer,
  getSupportedChains,
  isCCTPAvailable 
} from "@/lib/cctp/cctp-implementation-user";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: "Action is required" },
        { status: 400 }
      );
    }

    // Initiate CCTP transfer
    if (action === "initiate") {
      const { userId, userToken, walletId, walletAddress, amount, fromChain, toChain, destinationAddress } = body;

      if (!userId || !userToken || !walletId || !walletAddress || !amount || !fromChain || !toChain || !destinationAddress) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Missing required fields: userId, userToken, walletId, walletAddress, amount, fromChain, toChain, destinationAddress" 
          },
          { status: 400 }
        );
      }

      if (!isCCTPAvailable(fromChain, toChain)) {
        return NextResponse.json(
          { 
            success: false, 
            error: `CCTP not available between ${fromChain} and ${toChain}. Supported: ${getSupportedChains().join(', ')}` 
          },
          { status: 400 }
        );
      }

      console.log(`[CCTP User API] Initiating transfer: ${amount} USDC from ${fromChain} to ${toChain}`);

      const result = await transferCCTPUser({
        userId,
        userToken,
        walletId,
        walletAddress,
        amount,
        fromChain,
        toChain,
        destinationAddress,
      });

      if (result.success) {
        return NextResponse.json({
          success: true,
          data: {
            burnChallengeId: result.burnChallengeId,
            status: result.status,
            message: "Please complete the burn challenge in your wallet. Then call action=continue to finish the transfer.",
          },
        });
      } else {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }
    }

    // Continue CCTP transfer after burn
    if (action === "continue") {
      const { userId, userToken, walletId, toChain, burnTxHash, messageBytes } = body;

      if (!userId || !userToken || !walletId || !toChain || !burnTxHash || !messageBytes) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Missing required fields: userId, userToken, walletId, toChain, burnTxHash, messageBytes" 
          },
          { status: 400 }
        );
      }

      console.log(`[CCTP User API] Continuing transfer to ${toChain}`);

      const result = await continueCCTPTransfer(
        userId,
        userToken,
        walletId,
        toChain,
        burnTxHash,
        messageBytes
      );

      if (result.success) {
        return NextResponse.json({
          success: true,
          data: {
            mintChallengeId: result.mintChallengeId,
            attestation: result.attestation,
            status: result.status,
            message: "Please complete the mint challenge in your wallet to receive USDC on destination chain.",
          },
        });
      } else {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }
    }

    // Get supported chains
    if (action === "supported-chains") {
      return NextResponse.json({
        success: true,
        data: {
          chains: getSupportedChains(),
        },
      });
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[CCTP User API] Error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || "Internal server error" 
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    data: {
      name: "CCTP User-Controlled Wallets API",
      description: "Cross-Chain Transfer Protocol for bridging USDC across chains",
      endpoints: {
        initiate: "POST with action=initiate - Start CCTP transfer (burn)",
        continue: "POST with action=continue - Continue transfer (attestation + mint)",
        supportedChains: "POST with action=supported-chains - Get supported chains",
      },
      supportedChains: getSupportedChains(),
      estimatedTime: "13-19 minutes",
    },
  });
}












