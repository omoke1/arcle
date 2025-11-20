/**
 * Gateway API Route for User-Controlled Wallets
 * Handles instant cross-chain USDC transfers via Circle Gateway
 * 
 * Actions:
 * - balance: Check Gateway balance
 * - deposit: Deposit USDC to Gateway (one-time setup)
 * - transfer: Initiate Gateway transfer (create burn intent + sign)
 * - submit: Submit signed burn intent to Gateway API
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  checkGatewayBalanceUser,
  depositToGatewayUser,
  transferViaGatewayUser,
  submitGatewayTransfer,
  getSupportedGatewayChains,
  isGatewayAvailable 
} from "@/lib/gateway/gateway-sdk-implementation-user";

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

    // Check Gateway balance
    if (action === "balance") {
      const { walletAddress, chain } = body;

      if (!walletAddress || !chain) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Missing required fields: walletAddress, chain" 
          },
          { status: 400 }
        );
      }

      console.log(`[Gateway User API] Checking balance on ${chain}`);

      const balance = await checkGatewayBalanceUser(walletAddress, chain);

      return NextResponse.json({
        success: true,
        data: {
          balance: balance.toString(),
          chain,
        },
      });
    }

    // Deposit to Gateway
    if (action === "deposit") {
      const { userId, userToken, walletId, chain, amount } = body;

      if (!userId || !userToken || !walletId || !chain || !amount) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Missing required fields: userId, userToken, walletId, chain, amount" 
          },
          { status: 400 }
        );
      }

      console.log(`[Gateway User API] Depositing ${amount} USDC to Gateway on ${chain}`);

      const result = await depositToGatewayUser(userId, userToken, walletId, chain, amount);

      if (result.success) {
        return NextResponse.json({
          success: true,
          data: {
            challengeId: result.challengeId,
            message: "Please complete the approval and deposit challenges in your wallet",
          },
        });
      } else {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }
    }

    // Initiate Gateway transfer
    if (action === "transfer") {
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

      if (!isGatewayAvailable(fromChain, toChain)) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Gateway not available between ${fromChain} and ${toChain}. Supported: ${getSupportedGatewayChains().join(', ')}` 
          },
          { status: 400 }
        );
      }

      console.log(`[Gateway User API] Initiating transfer: ${amount} USDC from ${fromChain} to ${toChain}`);

      const result = await transferViaGatewayUser({
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
            challengeId: result.challengeId,
            burnIntent: result.burnIntent,
            status: result.status,
            message: "Please complete the signing challenge in your wallet. Then call action=submit with the signature.",
          },
        });
      } else {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }
    }

    // Submit signed burn intent
    if (action === "submit") {
      const { burnIntent, signature } = body;

      if (!burnIntent || !signature) {
        return NextResponse.json(
          { 
            success: false, 
            error: "Missing required fields: burnIntent, signature" 
          },
          { status: 400 }
        );
      }

      console.log(`[Gateway User API] Submitting signed burn intent to Gateway API`);

      const result = await submitGatewayTransfer(burnIntent, signature);

      if (result.success) {
        return NextResponse.json({
          success: true,
          data: {
            attestation: result.attestation,
            message: "Transfer submitted successfully! Funds should arrive in seconds.",
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
          chains: getSupportedGatewayChains(),
        },
      });
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[Gateway User API] Error:", error);
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
      name: "Gateway User-Controlled Wallets API",
      description: "Instant cross-chain USDC transfers via Circle Gateway",
      endpoints: {
        balance: "POST with action=balance - Check Gateway balance",
        deposit: "POST with action=deposit - Deposit USDC to Gateway",
        transfer: "POST with action=transfer - Initiate Gateway transfer",
        submit: "POST with action=submit - Submit signed burn intent",
        supportedChains: "POST with action=supported-chains - Get supported chains",
      },
      supportedChains: getSupportedGatewayChains(),
      estimatedTime: "Seconds",
      note: "Gateway requires one-time deposit before first transfer",
    },
  });
}












