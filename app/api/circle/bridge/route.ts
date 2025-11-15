/**
 * Circle Bridge API Route
 * 
 * Handles cross-chain USDC transfers via CCTP for Developer-Controlled Wallets
 * 
 * CCTP (Cross-Chain Transfer Protocol) works by:
 * 1. Burning USDC on the source chain
 * 2. Getting attestation from Circle's Attestation Service
 * 3. Minting USDC on the destination chain using the attestation
 * 
 * Reference: https://developers.circle.com/cctp
 */

import { NextRequest, NextResponse } from "next/server";
import { getCircleClient } from "@/lib/circle-sdk";
import { circleApiRequest } from "@/lib/circle";
import { generateUUID } from "@/lib/utils/uuid";
import type { CCTPTransferResult } from "@/lib/cctp/cctp-implementation";

interface BridgeRequest {
  walletId: string;
  amount: string;
  fromChain: string;
  toChain: string;
  destinationAddress: string;
  idempotencyKey?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: BridgeRequest = await request.json();
    
    const { walletId, amount, fromChain, toChain, destinationAddress, idempotencyKey } = body;

    // Validate required fields
    if (!walletId || !amount || !toChain || !destinationAddress) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: walletId, amount, toChain, destinationAddress",
        },
        { status: 400 }
      );
    }

    // Convert amount to decimal string (SDK expects decimal format)
    const amountDecimal = parseFloat(amount).toFixed(6);

    // Get Circle SDK client
    const client = getCircleClient();

    // Check if this is a same-chain transfer
    if (fromChain === toChain) {
      // Same-chain transfer - use regular transaction API
      const transactionRequest: any = {
        walletId: walletId,
        destinationAddress: destinationAddress,
        amounts: [amountDecimal],
        fee: {
          type: "level",
          config: {
            feeLevel: "MEDIUM" as const,
          },
        },
        idempotencyKey: idempotencyKey || generateUUID(),
      };

      const response = await client.createTransaction(transactionRequest);
      
      if (!response.data) {
        throw new Error("SDK returned empty response");
      }

      const txData = response.data as any;

      return NextResponse.json({
        success: true,
        data: {
          id: txData.id || generateUUID(),
          bridgeId: txData.id || generateUUID(),
          status: txData.state === "COMPLETED" ? "completed" : 
                  txData.state === "FAILED" ? "failed" : "pending",
          transactionHash: txData.txHash || txData.transactionHash,
          txHash: txData.txHash || txData.transactionHash,
          fromChain,
          toChain,
          amount,
        },
      });
    }

    // Cross-chain transfer via CCTP
    // For Developer-Controlled Wallets, we need to:
    // 1. Create a transaction that burns USDC on the source chain
    // 2. Poll Circle's Attestation Service for the attestation
    // 3. Use the attestation to mint on the destination chain
    
    // Step 1: Create a burn transaction on the source chain
    // Note: This requires interacting with CCTP smart contracts
    // For now, we'll attempt to use Circle's API if it supports cross-chain destinations
    
    // Try using the Circle SDK with a cross-chain destination specification
    // The SDK might support this if we specify the destination blockchain
    try {
      // First, get the wallet to understand its current blockchain
      const walletResponse = await client.getWallet({ id: walletId });
      const walletData = walletResponse.data as any;
      let walletAddress = walletData?.address || walletData?.wallet?.address;
      
      if (!walletAddress) {
        console.warn("Could not retrieve wallet address, proceeding anyway");
      }

      // For CCTP, we need to send USDC to the CCTP burn contract on the source chain
      // Then poll for attestation and mint on destination
      // This is complex and requires CCTP contract addresses
      
      // CCTP V2 Implementation for Developer-Controlled Wallets
      // Circle API v2 supports cross-chain transfers via CCTP V2
      // Reference: https://developers.circle.com/cctp
      //
      // CCTP V2 features:
      // - Fast Transfer: Settles in seconds (vs 13-19 minutes in v1)
      // - Hooks: Automate post-transfer actions
      // - Native burn-and-mint: 1:1 USDC transfers
      
      // Try Circle API v2 transfers endpoint for cross-chain transfers
      // v2 API should support cross-chain destinations for developer-controlled wallets
      const transferPayload = {
        idempotencyKey: idempotencyKey || generateUUID(),
        source: {
          type: "wallet",
          id: walletId,
        },
        destination: {
          type: "blockchain",
          address: destinationAddress,
          chain: toChain,
        },
        amount: {
          amount: Math.floor(parseFloat(amount) * 1_000_000).toString(), // Convert to smallest unit (6 decimals)
          currency: "USDC",
        },
      };

      // Try v2 API endpoint first (preferred for cross-chain)
      let transferResponse: any;
      let lastError: any | null = null;
      
      // Attempt 1: v2 developer transfers endpoint
      try {
        transferResponse = await circleApiRequest<any>(
          `/v2/w3s/developer/transfers`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(transferPayload),
          }
        );
        
        // Success with v2 endpoint
        return NextResponse.json({
          success: true,
          data: {
            id: transferResponse.data?.id || generateUUID(),
            bridgeId: transferResponse.data?.id || generateUUID(),
            status: transferResponse.data?.status === "pending" ? "pending" : 
                    transferResponse.data?.status === "complete" ? "completed" : "attesting",
            transactionHash: transferResponse.data?.transactionHash,
            txHash: transferResponse.data?.transactionHash,
            fromChain,
            toChain,
            amount,
          },
          message: "CCTP V2 cross-chain transfer initiated successfully.",
        });
      } catch (v2Error: any) {
        lastError = v2Error;
        console.warn("v2 API endpoint failed, trying v1:", v2Error.message);
      }

      // Attempt 2: v2 general transfers endpoint
      try {
        transferResponse = await circleApiRequest<any>(
          `/v2/w3s/transfers`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(transferPayload),
          }
        );
        
        // Success with v2 general endpoint
        return NextResponse.json({
          success: true,
          data: {
            id: transferResponse.data?.id || generateUUID(),
            bridgeId: transferResponse.data?.id || generateUUID(),
            status: transferResponse.data?.status === "pending" ? "pending" : 
                    transferResponse.data?.status === "complete" ? "completed" : "attesting",
            transactionHash: transferResponse.data?.transactionHash,
            txHash: transferResponse.data?.transactionHash,
            fromChain,
            toChain,
            amount,
          },
          message: "CCTP V2 cross-chain transfer initiated successfully.",
        });
      } catch (v2GeneralError: any) {
        lastError = v2GeneralError;
        console.warn("v2 general endpoint failed, trying v1:", v2GeneralError.message);
      }

      // Attempt 3: v1 developer transfers endpoint (fallback)
      try {
        transferResponse = await circleApiRequest<any>(
          `/v1/w3s/developer/transfers`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(transferPayload),
          }
        );
        
        return NextResponse.json({
          success: true,
          data: {
            id: transferResponse.data?.id || generateUUID(),
            bridgeId: transferResponse.data?.id || generateUUID(),
            status: transferResponse.data?.status === "pending" ? "pending" : 
                    transferResponse.data?.status === "complete" ? "completed" : "attesting",
            transactionHash: transferResponse.data?.transactionHash,
            txHash: transferResponse.data?.transactionHash,
            fromChain,
            toChain,
            amount,
          },
          message: "Cross-chain transfer initiated via v1 API.",
        });
      } catch (v1Error: any) {
        lastError = v1Error;
        console.warn("v1 API endpoint also failed:", v1Error.message);
      }

      // All API endpoints failed - fall back to smart contract implementation
      console.log("API endpoints failed, attempting smart contract-based CCTP...");
      
      // Try using the CCTP smart contract implementation
      // Reference: https://github.com/circlefin/evm-cctp-contracts
      try {
        // Get wallet address if not already available
        if (!walletAddress) {
          try {
            const walletResponse = await client.getWallet({ id: walletId });
            const walletData = walletResponse.data as any;
            walletAddress = walletData?.address || walletData?.wallet?.address || walletData?.data?.address;
            
            // If still not found, try to get from balances endpoint
            if (!walletAddress) {
              const balancesResponse = await circleApiRequest<any>(
                `/v1/w3s/developer/wallets/${walletId}/balances?blockchain=${fromChain}`
              );
              // Sometimes wallet address is in the response
              walletAddress = balancesResponse.data?.walletAddress || balancesResponse.walletAddress;
            }
          } catch (walletError: any) {
            console.error("Error getting wallet address:", walletError);
            throw new Error(`Could not retrieve wallet address: ${walletError.message}`);
          }
        }
        
        if (!walletAddress) {
          throw new Error("Could not retrieve wallet address for CCTP transfer. Wallet may not exist or may not be accessible.");
        }
        
        console.log(`[Bridge] Using wallet address: ${walletAddress}`);
        
        // For now, initiate just the burn and return
        // The full flow will complete in the background
        const { burnUSDC, executeCCTPTransfer } = await import("@/lib/cctp/cctp-implementation");
        
        // Start the CCTP transfer asynchronously (don't await)
        // This allows us to return immediately after initiating the burn
        // Log the full flow for verification
        executeCCTPTransfer({
          walletId,
          walletAddress,
          amount,
          fromChain,
          toChain,
          destinationAddress,
        })
        .then((result) => {
          console.log("[Bridge] ✅ CCTP Transfer Completed Successfully!");
          console.log("[Bridge] Burn TX:", result.burnTxHash);
          console.log("[Bridge] Mint TX:", result.mintTxHash);
          console.log("[Bridge] Status:", result.status);
          if (result.error) {
            console.error("[Bridge] Error:", result.error);
          }
        })
        .catch((error) => {
          console.error("[Bridge] ❌ CCTP transfer error (async):", error);
          console.error("[Bridge] Error details:", {
            message: error.message,
            stack: error.stack,
          });
        });
        
        try {
          const burnResult = await burnUSDC({
            walletId,
            walletAddress,
            amount,
            fromChain,
            toChain,
            destinationAddress,
          });
          
          // Return immediately after burn is initiated
          return NextResponse.json({
            success: true,
            data: {
              id: burnResult.messageHash || generateUUID(),
              bridgeId: burnResult.messageHash || generateUUID(),
              status: "pending",
              transactionHash: burnResult.txHash,
              txHash: burnResult.txHash,
              burnTxHash: burnResult.txHash,
              fromChain,
              toChain,
              amount,
            },
            message: "CCTP burn transaction initiated. Bridge is processing in the background.",
          });
        } catch (burnError: any) {
          throw new Error(`Failed to initiate burn: ${burnError.message}`);
        }
      } catch (cctpError: any) {
        // If CCTP fails, try Gateway as alternative
        console.warn("CCTP failed, trying Gateway as alternative:", cctpError.message);
        
        try {
          // Use NEW Gateway SDK implementation (uses Circle SDK signing)
          const { executeGatewayTransferSDK } = await import("@/lib/gateway/gateway-sdk-implementation");
          
          // Get wallet address if not already available
          if (!walletAddress) {
            try {
              const walletResponse = await client.getWallet({ id: walletId });
              const walletData = walletResponse.data as any;
              walletAddress = walletData?.address || walletData?.wallet?.address || walletData?.data?.address;
              
              if (!walletAddress) {
                const balancesResponse = await circleApiRequest<any>(
                  `/v1/w3s/developer/wallets/${walletId}/balances?blockchain=${fromChain}`
                );
                walletAddress = balancesResponse.data?.walletAddress || balancesResponse.walletAddress;
              }
            } catch (walletError: any) {
              console.error("Error getting wallet address for Gateway:", walletError);
            }
          }
          
          if (!walletAddress) {
            throw new Error("Could not retrieve wallet address for Gateway transfer");
          }
          
          console.log(`[Bridge] Attempting Gateway transfer with Circle SDK signing...`);
          console.log(`[Bridge] Using wallet address: ${walletAddress}`);
          
          // Check if this is the user's first time using Gateway (for conversational messaging)
          let firstTimeUser = false;
          try {
            const { checkGatewayBalanceSDK } = await import("@/lib/gateway/gateway-sdk-implementation");
            const gatewayBalance = await checkGatewayBalanceSDK(walletId, fromChain);
            // If balance is zero or check fails, assume first-time user (balance is returned as number)
            firstTimeUser = !gatewayBalance || gatewayBalance === 0;
            if (firstTimeUser) {
              console.log(`[Bridge] First-time Gateway user - will auto-deposit for instant future bridges`);
            }
          } catch (balanceError: any) {
            console.log(`[Bridge] Could not check Gateway balance, assuming first-time: ${balanceError.message}`);
            firstTimeUser = true; // Assume first-time if we can't check
          }
          
          // Execute Gateway transfer using Circle SDK for signing
          // NO PRIVATE KEY REQUIRED - Circle SDK handles signing
          // This will auto-deposit to Gateway if it's the first time
          const gatewayResult = await executeGatewayTransferSDK({
            walletId,
            walletAddress,
            amount,
            fromChain,
            toChain,
            destinationAddress,
          });
          
          if (gatewayResult.status === "completed") {
            return NextResponse.json({
              success: true,
              firstTimeUser, // Flag to show conversational message about setup
              data: {
                id: generateUUID(),
                bridgeId: generateUUID(),
                status: "attesting",
                attestation: gatewayResult.attestation,
                signature: gatewayResult.signature,
                fromChain,
                toChain,
                amount,
                method: "gateway-sdk",
              },
              message: firstTimeUser 
                ? "Setting up your instant bridging... Your USDC is on its way! Future bridges will be even faster."
                : "Your USDC is on its way! Should arrive in about 10-30 seconds.",
            });
          } else {
            throw new Error(gatewayResult.error || "Gateway transfer failed");
          }
        } catch (gatewayError: any) {
          // If Gateway also fails, provide detailed error for both methods
          console.error("Gateway transfer error:", gatewayError);
          console.error("CCTP error:", cctpError);
          
          const errorMessage = cctpError.message || "Unknown error";
          const errorResponse = cctpError.response?.data || cctpError.response || {};
          const errorCode = cctpError.code || cctpError.response?.status || "N/A";
          
          return NextResponse.json(
            {
              success: false,
              error: `Failed to initiate cross-chain transfer. Tried CCTP and Gateway methods.`,
              details: {
                fromChain,
                toChain,
                apiError: lastError?.message || "N/A",
                cctpError: errorMessage,
                gatewayError: gatewayError.message || "N/A",
                errorCode: errorCode,
                errorResponse: errorResponse,
                walletId: walletId,
                walletAddress: walletAddress || "Not available",
                note: "Both CCTP and Gateway were attempted. " +
                      "CCTP Bridge Kit does NOT support Circle Wallets yet (confirmed by Circle). " +
                      "Gateway attempted using Circle SDK signing (signTypedData). " +
                      "Smart Contract Accounts (SCA) may have EIP-1271 compatibility issues. " +
                      "Check https://eip1271.io/ for SCA compatibility with Gateway.",
                resources: [
                  "https://docs.arc.network/arc/references/contract-addresses#cctp",
                  "https://docs.arc.network/arc/references/contract-addresses#gateway",
                  "https://developers.circle.com/gateway/concepts/technical-guide",
                  "https://developers.circle.com/cctp",
                ],
              },
            },
            { status: 500 }
          );
        }
      }
    } catch (error: any) {
      // If API approach fails, provide detailed error with next steps
      console.error("CCTP bridge error:", error);
      
      return NextResponse.json(
        {
          success: false,
          error: error.message || "Failed to initiate CCTP bridge",
          details: {
            fromChain,
            toChain,
            note: "CCTP for Developer-Controlled Wallets requires smart contract interaction. " +
                  "See https://github.com/circlefin/evm-cctp-contracts for contract addresses and ABIs.",
          },
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Bridge API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to initiate bridge",
        details: error.response?.data || error,
      },
      { status: 500 }
    );
  }
}
