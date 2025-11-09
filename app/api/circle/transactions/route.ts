/**
 * Circle Transactions API Routes
 * 
 * Handles transaction creation and status tracking
 * Based on Circle API: POST /v1/w3s/wallets/{walletId}/transactions
 */

import { NextRequest, NextResponse } from "next/server";
import { circleApiRequest } from "@/lib/circle";
import { getCircleClient, clearCircleClient } from "@/lib/circle-sdk";
import { getUSDCAddress, arcUtils } from "@/lib/arc";
import crypto from "crypto";

interface CreateTransactionRequest {
  idempotencyKey?: string;
  walletId: string;
  walletAddress?: string; // Optional: wallet address (if provided, can use walletAddress + blockchain instead of walletId)
  destinationAddress: string;
  amount: string; // Amount in USDC (e.g., "10.50")
  tokenId?: string; // USDC token address on Arc (optional, will use default)
  feeLevel?: "LOW" | "MEDIUM" | "HIGH";
}

interface CircleTransactionResponse {
  data: {
    id: string;
    walletId: string;
    idempotencyKey: string;
    destination: {
      type: string;
      address: string;
    };
    amount: {
      amount: string;
      currency: string;
    };
    fee: {
      amount: string;
      currency: string;
    };
    status: "pending" | "confirmed" | "failed";
    createDate: string;
    updateDate: string;
  };
}

/**
 * POST /api/circle/transactions
 * Create a new transaction (send USDC on Arc)
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateTransactionRequest = await request.json();
    
    // Log incoming request for debugging
    console.log("📥 Transaction request received:", JSON.stringify(body, null, 2));
    
    let { walletId, walletAddress, destinationAddress, amount, idempotencyKey, tokenId, feeLevel } = body;

    // Validate required fields
    if (!walletId || !destinationAddress || !amount) {
      const missingFields = [];
      if (!walletId) missingFields.push("walletId");
      if (!destinationAddress) missingFields.push("destinationAddress");
      if (!amount) missingFields.push("amount");
      
      console.error("❌ Missing required fields:", missingFields);
      return NextResponse.json(
        {
          success: false,
          error: `Missing required fields: ${missingFields.join(", ")}`,
          details: { missingFields },
        },
        { status: 400 }
      );
    }

    if (!arcUtils.isValidAddress(destinationAddress)) {
      console.error("❌ Invalid destination address:", destinationAddress);
      return NextResponse.json(
        {
          success: false,
          error: `Invalid destination address format: ${destinationAddress}`,
          details: { destinationAddress },
        },
        { status: 400 }
      );
    }

    // Validate: Cannot send to the same wallet address
    // First, get the wallet address if not provided (CRITICAL for SDK transaction creation)
    let sourceWalletAddress = walletAddress;
    if (!sourceWalletAddress) {
      try {
        // Try to get wallet address from walletId using REST API (more reliable than SDK)
        const walletResponse = await circleApiRequest<any>(
          `/v1/w3s/wallets/${walletId}`,
          { method: "GET" }
        );
        
        if (walletResponse.data?.addresses && walletResponse.data.addresses.length > 0) {
          // Find ARC-TESTNET address
          const arcAddress = walletResponse.data.addresses.find(
            (addr: any) => addr.chain === "ARC-TESTNET" || addr.chain === "ARC"
          );
          sourceWalletAddress = arcAddress?.address || walletResponse.data.addresses[0]?.address;
          console.log("Fetched wallet address for transaction:", sourceWalletAddress);
          // Update walletAddress variable for use in transaction creation
          walletAddress = sourceWalletAddress;
        }
      } catch (error) {
        console.warn("Could not fetch wallet address:", error);
        // Continue without validation if we can't fetch the address
      }
    }
    
    if (sourceWalletAddress) {
      // Normalize addresses for comparison (case-insensitive)
      const normalizedSource = sourceWalletAddress.toLowerCase();
      const normalizedDest = destinationAddress.toLowerCase();
      
      if (normalizedSource === normalizedDest) {
        console.error("❌ Cannot send to same wallet:", { source: normalizedSource, dest: normalizedDest });
        return NextResponse.json(
          {
            success: false,
            error: "Cannot send tokens to the same wallet address. Please provide a different destination address.",
            details: { sourceAddress: sourceWalletAddress, destinationAddress },
          },
          { status: 400 }
        );
      }
    }

    // Convert amount to smallest unit (USDC has 6 decimals)
    const amountInSmallestUnit = arcUtils.parseUSDC(amount).toString();

    // Convert amount to decimal format (SDK expects decimal string, not smallest unit)
    const amountDecimal = arcUtils.formatUSDC(BigInt(amountInSmallestUnit));

    // Get tokenId from wallet balance if not provided
    // According to Circle docs, we need tokenId (not tokenAddress) for SDK transactions
    let usdcTokenId = tokenId;
    if (!usdcTokenId) {
      try {
        console.log("Fetching wallet balance to get USDC tokenId...");
        console.log(`Balance query for wallet: ${walletId}`);
        const balances = await circleApiRequest<any>(
          `/v1/w3s/wallets/${walletId}/balances`,
          { method: "GET" }
        );
        console.log("Balance query successful, response:", JSON.stringify(balances, null, 2));
        
        // Circle API returns: { data: { tokenBalances: [{ token: { id, symbol, blockchain, ... }, amount }] } }
        // OR: { data: [{ tokenId, amount }] } depending on endpoint
        const tokenBalances = balances.data?.tokenBalances || balances.data || [];
        
        // Find USDC token on ARC-TESTNET
        const usdcBalance = tokenBalances.find((b: any) => {
          // Handle both response formats
          if (b.token) {
            // Format: { token: { id, symbol, blockchain, ... }, amount }
            const token = b.token;
            return token && (
              (token.symbol === "USDC" || token.name === "USD Coin") &&
              (token.blockchain === "ARC-TESTNET" || token.blockchain === "ARC")
            );
          } else if (b.tokenId) {
            // Format: { tokenId, amount } - check if it matches USDC address
            // This is less reliable, but we'll try
            return b.tokenId && b.tokenId.toLowerCase() === getUSDCAddress().toLowerCase();
          }
          return false;
        });
        
        if (usdcBalance?.token?.id) {
          usdcTokenId = usdcBalance.token.id;
          console.log(`Found USDC tokenId: ${usdcTokenId}`);
        } else if (usdcBalance?.tokenId) {
          // If we got tokenId directly, use it (though this might be the address, not the Circle tokenId)
          usdcTokenId = usdcBalance.tokenId;
          console.log(`Using tokenId from balance: ${usdcTokenId}`);
        } else {
          console.warn("USDC tokenId not found in balance response.");
          console.log("Balance response structure:", JSON.stringify(balances, null, 2));
          // Don't throw error here - we'll try to continue without tokenId or use a default
          // The SDK might work with just the token address
        }
      } catch (error: any) {
        console.error("Could not fetch tokenId from balance:", error);
        console.error("Balance query error details:", {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
        });
        // If balance query fails, we can't get tokenId - this will cause transaction to fail
        // But let's continue and see what error we get from the SDK
      }
    }

    // Log request details for debugging
    console.log("Creating transaction:", {
      walletId,
      destinationAddress,
      amount,
      amountInSmallestUnit,
      amountDecimal,
      tokenId: usdcTokenId,
      feeLevel: feeLevel || "MEDIUM",
    });

    // Use Circle SDK for developer-controlled wallets
    // The SDK handles authentication with Entity Secret automatically
    const client = getCircleClient();
    
    let transaction: CircleTransactionResponse;
    let transactionRequest: any = null; // Declare outside try block for error logging
    try {
      // Use SDK createTransaction method
      // According to Circle docs: https://developers.circle.com/wallets/dev-controlled/transfer-tokens-across-wallets
      // We should use: walletId, tokenId, destinationAddress, amounts, fee
      console.log(`Creating transaction with SDK for wallet: ${walletId}`);
      
      // Build transaction request according to Circle SDK documentation
      transactionRequest = {
        walletId: walletId,
        destinationAddress: destinationAddress,
        amounts: [amountDecimal], // SDK expects decimal format string array
        fee: {
          type: "level",
          config: {
            feeLevel: (feeLevel || "MEDIUM") as "LOW" | "MEDIUM" | "HIGH",
          },
        },
      };
      
      // Add tokenId if we have it (preferred by SDK)
      // If not available, we can try using tokenAddress + blockchain instead
      if (usdcTokenId) {
        transactionRequest.tokenId = usdcTokenId;
        console.log(`Using tokenId: ${usdcTokenId}`);
      } else {
        // Fallback: Use tokenAddress + blockchain if tokenId is not available
        // This might work for some Circle API configurations
        console.warn("tokenId not available, trying with tokenAddress + blockchain...");
        transactionRequest.tokenAddress = getUSDCAddress();
        transactionRequest.blockchain = "ARC-TESTNET";
        console.log(`Using tokenAddress: ${transactionRequest.tokenAddress}, blockchain: ${transactionRequest.blockchain}`);
      }
      
      // Add idempotency key
      if (idempotencyKey) {
        transactionRequest.idempotencyKey = idempotencyKey;
      }
      
      const response = await client.createTransaction(transactionRequest);

      console.log("SDK transaction response:", JSON.stringify(response.data, null, 2));
      
      if (!response.data) {
        throw new Error("SDK returned empty response");
      }

      const txData = response.data as any;
      
      // Extract blockchain transaction hash if available
      // Circle transaction might have transactionHash, onChainTxHash, or hash field
      // Note: The hash might not be available immediately (transaction state: INITIATED)
      // It will be available once the transaction is sent to the blockchain (state: SENT/CONFIRMED)
      const blockchainHash = txData.transactionHash || 
                            txData.onChainTxHash || 
                            txData.hash || 
                            (txData.transaction && txData.transaction.hash) ||
                            null;
      
      console.log("Transaction hash extracted:", blockchainHash || "Not available yet (transaction may still be processing)");
      
      // Map SDK response to our expected format
      transaction = {
        data: {
          id: txData.id || "",
          walletId: walletId,
          idempotencyKey: idempotencyKey || crypto.randomUUID(),
          destination: {
            type: "address",
            address: destinationAddress,
          },
          amount: {
            amount: amountInSmallestUnit, // Keep in smallest unit for response
            currency: "USDC",
          },
          fee: {
            amount: "0", // SDK doesn't return fee in response, will be calculated
            currency: "USDC",
          },
          status: ((txData.state as string) === "COMPLETED" || (txData.state as string) === "CONFIRMED" ? "confirmed" : 
                  (txData.state as string) === "FAILED" ? "failed" : 
                  "pending") as "pending" | "confirmed" | "failed",
          createDate: new Date().toISOString(),
          updateDate: new Date().toISOString(),
          // Store blockchain hash if available
          transactionHash: blockchainHash || undefined,
        } as any,
      };
    } catch (sdkError: any) {
      console.error("SDK transaction creation failed:", sdkError);
      console.error("SDK Error details:", {
        message: sdkError.message,
        response: sdkError.response?.data,
        status: sdkError.response?.status,
        code: sdkError.code,
        url: sdkError.config?.url || sdkError.request?.url,
        baseURL: sdkError.config?.baseURL,
        stack: sdkError.stack,
      });
      
      // If it's a 400 error, provide more details and throw with helpful message
      if (sdkError.response?.status === 400) {
        const errorDetails = sdkError.response?.data;
        console.error("400 Bad Request - Request body:", JSON.stringify(transactionRequest, null, 2));
        console.error("400 Error response:", JSON.stringify(errorDetails, null, 2));
        
        // Include error details in the thrown error
        const errorMessages = errorDetails?.errors?.map((e: any) => 
          `${e.field || 'unknown'}: ${e.error || 'invalid'} (value: ${e.invalidValue})`
        ).join(', ') || errorDetails?.message || "Bad Request";
        const helpfulError = new Error(`Transaction creation failed with 400 Bad Request: ${errorMessages}. Request: ${JSON.stringify(transactionRequest)}`);
        (helpfulError as any).response = sdkError.response;
        (helpfulError as any).details = errorDetails;
        throw helpfulError;
      }
      
      // Provide helpful error message based on error type
      if (sdkError.response?.status === 401) {
        // Check if it's an Entity Secret authentication issue
        const errorUrl = sdkError.config?.url || sdkError.request?.url || sdkError.message || '';
        console.error("401 Error - URL being called:", errorUrl);
        console.error("Full error config:", {
          url: sdkError.config?.url,
          baseURL: sdkError.config?.baseURL,
          method: sdkError.config?.method,
          headers: sdkError.config?.headers,
        });
        if (errorUrl.includes('/config/entity/publicKey') || errorUrl.includes('publicKey')) {
          // SDK can't fetch entity public key - try REST API as fallback
          console.log("SDK failed to fetch entity public key, trying REST API fallback...");
          console.log("Error URL:", errorUrl);
          
          // Try REST API fallback with multiple endpoint attempts
          let restError: any = null;
          
          // Try 1: Developer transactions endpoint (not wallet-specific)
          try {
            console.log("Trying REST API endpoint: /v1/w3s/developer/transactions");
            const restResponse = await circleApiRequest<CircleTransactionResponse>(
              `/v1/w3s/developer/transactions`,
              {
                method: "POST",
                body: JSON.stringify({
                  idempotencyKey: idempotencyKey || crypto.randomUUID(),
                  walletId: walletId,
                  destinationAddress: destinationAddress,
                  amounts: [amountInSmallestUnit], // REST API expects smallest unit
                  feeLevel: feeLevel || "MEDIUM",
                  tokenId: usdcTokenId, // Use tokenId from balance query
                }),
              }
            );
            
            console.log("✅ REST API transaction created successfully!");
            console.log("REST API transaction response:", restResponse);
            transaction = restResponse;
            // Success! Break out of error handling
            return NextResponse.json({
              success: true,
              data: transaction.data,
            });
          } catch (devTxError: any) {
            console.error("Developer transactions endpoint failed:", devTxError);
            
            // Try 2: Developer-controlled wallets endpoint
            try {
              console.log("Trying REST API endpoint: /v1/w3s/developer/wallets/{walletId}/transactions");
              const restResponse = await circleApiRequest<CircleTransactionResponse>(
                `/v1/w3s/developer/wallets/${walletId}/transactions`,
                {
                  method: "POST",
                  body: JSON.stringify({
                    idempotencyKey: idempotencyKey || crypto.randomUUID(),
                    destinationAddress: destinationAddress,
                    amounts: [amountInSmallestUnit], // REST API expects smallest unit
                    feeLevel: feeLevel || "MEDIUM",
                    tokenId: usdcTokenId, // Use tokenId from balance query
                  }),
                }
              );
            
              console.log("✅ REST API transaction created successfully (developer wallets endpoint)!");
              transaction = restResponse;
              // Success! Break out of error handling
              return NextResponse.json({
                success: true,
                data: transaction.data,
              });
            } catch (devWalletError: any) {
              console.error("Developer wallets endpoint failed:", devWalletError);
              restError = devWalletError;
              
              // Try 3: Regular wallets endpoint (might work for developer-controlled wallets too)
              try {
                console.log("Trying REST API endpoint: /v1/w3s/wallets/{walletId}/transactions");
                const restResponse = await circleApiRequest<CircleTransactionResponse>(
                  `/v1/w3s/wallets/${walletId}/transactions`,
                  {
                    method: "POST",
                    body: JSON.stringify({
                      idempotencyKey: idempotencyKey || crypto.randomUUID(),
                      destinationAddress: destinationAddress,
                      amounts: [amountInSmallestUnit],
                      feeLevel: feeLevel || "MEDIUM",
                      tokenId: usdcTokenId, // Use tokenId from balance query
                    }),
                  }
                );
                
                console.log("✅ REST API transaction created successfully (regular endpoint)!");
                transaction = restResponse;
                // Success! Break out of error handling
                return NextResponse.json({
                  success: true,
                  data: transaction.data,
                });
              } catch (regularError: any) {
                console.error("Regular endpoint also failed:", regularError);
                restError = regularError;
              }
            }
          }
          
          // Both REST API attempts failed
          console.error("All REST API fallback attempts failed");
          throw new Error(
            `Transaction creation failed: SDK cannot fetch entity public key (401), and all REST API fallback attempts failed. ` +
            `\n\nThis suggests the Entity Secret may not be fully registered for transaction operations, ` +
            `or the wallet/endpoint configuration is incorrect.` +
            `\n\nPossible solutions:\n` +
            `1. Verify Entity Secret is registered: Run 'npm run register-entity-secret'\n` +
            `2. Check Circle Console: https://console.circle.com/ - ensure Entity Secret is registered\n` +
            `3. Verify wallet ID is correct: ${walletId}\n` +
            `4. Try creating a new Entity Secret and registering it\n` +
            `5. Contact Circle Support if the issue persists\n` +
            `\nSDK Error: ${sdkError.message}\n` +
            `REST API Errors:\n` +
            `  - Developer transactions: ${restError?.message || restError?.response?.data?.message || 'Unknown'}\n` +
            `  - Developer wallets: ${restError?.message || restError?.response?.data?.message || 'Unknown'}\n` +
            `  - Regular wallets: ${restError?.message || restError?.response?.data?.message || 'Unknown'}`
          );
        } else {
          // Re-throw if it's not the public key error
          throw new Error(
            `Authentication failed (401). Please verify your Circle API key and Entity Secret are correct. ` +
            `Error: ${sdkError.message}`
          );
        }
      }
      
      if (sdkError.response?.status === 404 || sdkError.message?.includes("not found")) {
        throw new Error(
          `Wallet not found. The wallet ID "${walletId}" does not exist in Circle. ` +
          `Please ensure the wallet was created successfully. Error: ${sdkError.message}`
        );
      }
      
      throw new Error(
        `Transaction creation failed: ${sdkError.message || "Unknown SDK error"}`
      );
    }

    // Extract blockchain hash from transaction data if available
    // Note: The blockchain hash might not be available immediately (transaction state: INITIATED)
    // It will be available once the transaction is sent to the blockchain (state: SENT/CONFIRMED)
    const transactionData = transaction.data as any;
    const blockchainHash = transactionData.transactionHash || 
                          transactionData.onChainTxHash || 
                          transactionData.hash ||
                          null;
    
    return NextResponse.json({
      success: true,
      data: {
        id: transaction.data.id,
        hash: blockchainHash || transaction.data.id, // Use blockchain hash if available, otherwise Circle transaction ID
        circleTransactionId: transaction.data.id, // Keep Circle transaction ID for reference
        walletId: transaction.data.walletId,
        from: walletId,
        to: destinationAddress,
        amount: arcUtils.formatUSDC(BigInt(transaction.data.amount.amount)),
        amountRaw: transaction.data.amount.amount,
        token: "USDC",
        network: "ARC",
        status: transaction.data.status,
        fee: transaction.data.fee.amount,
        createdAt: transaction.data.createDate,
        updatedAt: transaction.data.updateDate,
      },
    });
  } catch (error: any) {
    console.error("Error creating transaction:", error);
    
    // Log detailed error information
    let errorMessage = "Failed to create transaction";
    let errorDetails: any = {};
    
    // Check if error has response property (from circleApiRequest)
    if (error && typeof error === 'object') {
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error("Error message:", errorMessage);
        console.error("Error stack:", error.stack);
      }
      
      // Extract Circle API error details if available
      // circleApiRequest throws errors with a response property
      if ('response' in error && error.response) {
        errorDetails = {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
        };
        errorMessage = error.response.data?.message || error.response.data?.error || errorMessage || "Failed to create transaction";
        console.error("Circle API Error Response:", JSON.stringify(errorDetails, null, 2));
      } else if (error.message) {
        errorMessage = error.message;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    // Determine status code from error
    let statusCode = 500;
    if (errorDetails.status) {
      statusCode = errorDetails.status;
    } else if (errorMessage.includes("Missing required") || errorMessage.includes("Invalid")) {
      statusCode = 400;
    }
    
    console.error(`❌ Transaction creation failed (${statusCode}):`, errorMessage);
    if (Object.keys(errorDetails).length > 0) {
      console.error("Error details:", JSON.stringify(errorDetails, null, 2));
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: Object.keys(errorDetails).length > 0 ? errorDetails : undefined,
      },
      { status: statusCode }
    );
  }
}

/**
 * GET /api/circle/transactions
 * Get transaction status or list transactions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get("transactionId");
    const walletId = searchParams.get("walletId");
    const limit = searchParams.get("limit") || "10";

    if (!transactionId && !walletId) {
      return NextResponse.json(
        { success: false, error: "transactionId or walletId is required" },
        { status: 400 }
      );
    }

    let endpoint = "";
    if (transactionId) {
      endpoint = `/v1/w3s/transactions/${transactionId}`;
    } else if (walletId) {
      endpoint = `/v1/w3s/wallets/${walletId}/transactions?limit=${limit}`;
    }

    try {
      const transactions = await circleApiRequest(endpoint, {
        method: "GET",
      });

      // Extract blockchain hash and map Circle states to our status format
      const transactionsData = transactions as any;
      
      // Handle both single transaction and array of transactions
      if (transactionsData.data) {
        const txList = Array.isArray(transactionsData.data) ? transactionsData.data : [transactionsData.data];
        
        txList.forEach((txData: any) => {
          if (!txData) return;
          
          // Log raw transaction data for debugging
          console.log(`[GET Transaction] Raw transaction data:`, {
            id: txData.id,
            state: txData.state,
            status: txData.status,
            transactionHash: txData.transactionHash,
            onChainTxHash: txData.onChainTxHash,
            hash: txData.hash,
            transaction: txData.transaction,
          });
          
          // Extract blockchain hash from various possible fields
          const blockchainHash = txData.transactionHash || 
                                txData.onChainTxHash || 
                                txData.hash ||
                                (txData.transaction && txData.transaction.hash) ||
                                (txData.transaction && txData.transaction.transactionHash) ||
                                null;
          
          if (blockchainHash) {
            console.log(`[GET Transaction] Found blockchain hash: ${blockchainHash}`);
            // Add hash to response if not already present
            if (!txData.transactionHash && !txData.onChainTxHash && !txData.hash) {
              txData.transactionHash = blockchainHash;
            }
          }
          
          // Map Circle transaction state to our status format
          // Circle states: INITIATED, QUEUED, SENT, CONFIRMED, COMPLETED, FAILED, etc.
          const circleState = txData.state || txData.status;
          let mappedStatus: "pending" | "confirmed" | "failed" = "pending";
          
          if (circleState === "COMPLETED" || circleState === "CONFIRMED" || circleState === "SENT") {
            mappedStatus = "confirmed";
          } else if (circleState === "FAILED" || circleState === "DENIED" || circleState === "CANCELLED") {
            mappedStatus = "failed";
          } else {
            mappedStatus = "pending"; // INITIATED, QUEUED, etc.
          }
          
          // Add mapped status to response
          txData.status = mappedStatus;
          console.log(`[GET Transaction] ${txData.id} - Circle state: ${circleState} -> Mapped status: ${mappedStatus}, Hash: ${blockchainHash || 'none'}`);
        });
      }

      return NextResponse.json({
        success: true,
        data: transactions,
      });
    } catch (apiError: any) {
      // Handle 404 gracefully - wallet might not have transactions yet
      // or developer-controlled wallets might use different endpoint
      if (apiError.status === 404 || apiError.message?.includes("Resource not found")) {
        // Return empty array for no transactions found
        return NextResponse.json({
          success: true,
          data: {
            data: [],
          },
        });
      }
      throw apiError; // Re-throw other errors
    }
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch transactions",
      },
      { status: 500 }
    );
  }
}
