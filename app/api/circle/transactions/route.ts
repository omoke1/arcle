/**
 * Circle Transactions API Routes
 * 
 * Handles transaction creation and status tracking
 * Based on Circle API: POST /v1/w3s/wallets/{walletId}/transactions
 * 
 * NETWORK: Arc Testnet (ARC-TESTNET)
 * - RPC: https://rpc.testnet.arc.network
 * - Explorer: https://testnet.arcscan.app
 * - USDC: 0x3600000000000000000000000000000000000000
 */

import { NextRequest, NextResponse } from "next/server";
import { circleApiRequest } from "@/lib/circle";
import { getUserCircleClient } from "@/lib/circle-user-sdk";
import { getUSDCAddress, arcUtils, getUsdcDecimals } from "@/lib/arc";
import { generateUUID } from "@/lib/utils/uuid";

interface CreateTransactionRequest {
  idempotencyKey?: string;
  walletId: string;
  walletAddress?: string; // Optional: wallet address (if provided, can use walletAddress + blockchain instead of walletId)
  destinationAddress: string;
  amount: string; // Amount in USDC (e.g., "10.50")
  tokenId?: string; // USDC token address on Arc (optional, will use default)
  feeLevel?: "LOW" | "MEDIUM" | "HIGH";
  userId?: string; // Either userId OR userToken is required for User-Controlled Wallets (userToken preferred)
  userToken?: string; // Either userId OR userToken is required for User-Controlled Wallets (userToken preferred)
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
  // Declare body outside try block so it's accessible in catch block
  let body: CreateTransactionRequest | null = null;
  
  try {
    // Parse request body with error handling
    try {
      body = await request.json();
      
      // Validate body is not null/undefined
      if (!body || typeof body !== 'object') {
        console.error("❌ Invalid request body:", body);
        return NextResponse.json(
          {
            success: false,
            error: "Request body must be a valid JSON object",
            details: { hint: "Please provide a JSON body with walletId, destinationAddress, amount, userId, and userToken" },
          },
          { status: 400 }
        );
      }
    } catch (parseError: any) {
      console.error("❌ Failed to parse request body:", parseError.message);
      console.error("Parse error details:", {
        name: parseError.name,
        message: parseError.message,
        stack: parseError.stack,
      });
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON in request body",
          details: { 
            message: parseError.message,
            hint: "Please ensure the request body is valid JSON" 
          },
        },
        { status: 400 }
      );
    }
    
    // Log incoming request for debugging
    console.log("📥 Transaction request received:", JSON.stringify(body, null, 2));
    
    let { walletId, walletAddress, destinationAddress, amount, idempotencyKey, tokenId, feeLevel, userId, userToken } = body;

    // Validate required fields (check for both existence and non-empty strings)
    const missingFields: string[] = [];
    if (!walletId || (typeof walletId === 'string' && walletId.trim() === '')) {
      missingFields.push("walletId");
    }
    if (!destinationAddress || (typeof destinationAddress === 'string' && destinationAddress.trim() === '')) {
      missingFields.push("destinationAddress");
    }
    if (!amount || (typeof amount === 'string' && amount.trim() === '')) {
      missingFields.push("amount");
    }
    
    if (missingFields.length > 0) {
      console.error("❌ Missing required fields:", missingFields);
      console.error("❌ Request body received:", JSON.stringify(body, null, 2));
      return NextResponse.json(
        {
          success: false,
          error: `Missing required fields: ${missingFields.join(", ")}`,
          details: { 
            missingFields,
            receivedFields: Object.keys(body || {}),
            hint: "Please provide walletId, destinationAddress, and amount in the request body"
          },
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

    // Get tokenId and token decimals from wallet balance FIRST (before formatting amount)
    // According to Circle docs, we need tokenId (not tokenAddress) for SDK transactions
    // IMPORTANT: Arc Testnet USDC uses 6 decimals. We'll default to the on-chain value unless balance response says otherwise.
    let usdcTokenId = tokenId;
    let tokenDecimals = getUsdcDecimals(); // Default from chain/env config (Arc Testnet USDC = 6)
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
        
        if (usdcBalance?.token?.decimals && typeof usdcBalance.token.decimals === "number") {
          tokenDecimals = usdcBalance.token.decimals;
          console.log(`USDC token decimals from Circle balance response: ${tokenDecimals}`);
        }
        
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
    
    // Now format the amount with the correct decimals (after we know the token decimals)
    // Convert amount to decimal format (SDK expects decimal string, not smallest units)
    // IMPORTANT: Arc Testnet USDC currently uses 6 decimals.
    let amountForSDK: string;
    let amountInSmallestUnit: string;
    try {
      // Validate amount is a valid number format
      if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        throw new Error("Amount must be a positive number");
      }
      
      // Format amount with the correct number of decimals from token
      amountForSDK = parseFloat(amount).toFixed(tokenDecimals);
      
      // Calculate amount in smallest units using the correct decimals
      const [whole, fraction = ""] = amount.split(".");
      const paddedFraction = fraction.padEnd(tokenDecimals, "0").slice(0, tokenDecimals);
      amountInSmallestUnit = (BigInt(whole) * (10n ** BigInt(tokenDecimals)) + BigInt(paddedFraction)).toString();
      
      console.log(`💰 Amount formatting: ${amount} USDC with ${tokenDecimals} decimals = ${amountForSDK} (smallest unit: ${amountInSmallestUnit})`);
    } catch (amountError: any) {
      console.error("❌ Invalid amount format:", amount, amountError.message);
      return NextResponse.json(
        {
          success: false,
          error: `Invalid amount format: ${amountError.message || "Amount must be a valid positive number (e.g., '10.5')"}`,
          details: {
            amount,
            hint: "Amount should be a positive number in USDC format (e.g., '10.5' for 10.5 USDC)",
          },
        },
        { status: 400 }
      );
    }

    // Log request details for debugging
    console.log("Creating transaction:", {
      walletId,
      destinationAddress,
      amount,
      amountInSmallestUnit,
      amountForSDK,
      tokenId: usdcTokenId,
      tokenDecimals,
      feeLevel: feeLevel || "MEDIUM",
    });

    // User-Controlled Wallets is now the ONLY option
    // According to Circle API: EITHER userId OR userToken is required (not both)
    // userToken is preferred as it's the JWT representing the user
    if ((!userId || (typeof userId === 'string' && userId.trim() === '')) && 
        (!userToken || (typeof userToken === 'string' && userToken.trim() === ''))) {
      console.error("❌ Missing authentication: Need either userId or userToken");
      return NextResponse.json(
        {
          success: false,
          error: "Missing required authentication: Either userId or userToken is required",
          details: {
            hint: "For User-Controlled Wallets, provide either userId OR userToken (userToken is preferred). Please create a user first via /api/circle/users.",
          },
        },
        { status: 400 }
      );
    }

    // Use User-Controlled Wallets SDK
    let userClient;
    try {
      userClient = getUserCircleClient();
    } catch (clientError: any) {
      console.error("❌ Failed to initialize Circle SDK client:", clientError);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to initialize Circle SDK: ${clientError.message}`,
          details: {
            message: clientError.message,
            hint: "Check that CIRCLE_API_KEY and NEXT_PUBLIC_CIRCLE_APP_ID are set in .env.local",
          },
        },
        { status: 500 }
      );
    }
    
    let transaction: CircleTransactionResponse | null = null;
    let transactionRequest: any = null; // Declare outside try block for error logging
    try {
      // Use User-Controlled SDK createTransaction method
      // According to Circle docs: https://developers.circle.com/user-controlled-wallets/docs
      console.log(`Creating transaction with User-Controlled SDK for wallet: ${walletId}`);
      
      // Build transaction request for User-Controlled Wallets
      // Match the pattern from bridge route which works successfully
      // Bridge route uses decimal format: amounts: [parseFloat(amount).toFixed(6)]
      transactionRequest = {
        walletId: walletId,
        destinationAddress: destinationAddress,
        amounts: [amountForSDK], // SDK expects decimal format as string array (e.g., "10.500000" for 10.5 USDC)
        fee: {
          type: "level",
          config: {
            feeLevel: (feeLevel || "MEDIUM") as "LOW" | "MEDIUM" | "HIGH",
          },
        },
      };
      
      // Add tokenId if we have it (preferred by SDK)
      if (usdcTokenId) {
        transactionRequest.tokenId = usdcTokenId;
        console.log(`Using tokenId: ${usdcTokenId}`);
      } else {
        // Fallback: Use tokenAddress + blockchain if tokenId is not available
        console.warn("tokenId not available, trying with tokenAddress + blockchain...");
        transactionRequest.tokenAddress = getUSDCAddress();
        transactionRequest.blockchain = "ARC-TESTNET";
        console.log(`Using tokenAddress: ${transactionRequest.tokenAddress}, blockchain: ${transactionRequest.blockchain}`);
      }
      
      // Add idempotency key (required by Circle API)
      transactionRequest.idempotencyKey = idempotencyKey || generateUUID();
      
      console.log("📤 SDK transaction request:", JSON.stringify(transactionRequest, null, 2));
      
      // Call createTransaction according to Circle API pattern
      // Circle API accepts EITHER userId OR userToken (not both)
      // userToken is preferred as it's the JWT representing the user
      let response;
      try {
        console.log("=".repeat(80));
        console.log("🚀 Calling userClient.createTransaction()...");
        console.log("Wallet ID:", walletId);
        console.log("Destination:", destinationAddress);
        console.log("Amount:", amountForSDK);
        console.log("Auth method:", userToken ? "userToken" : (userId ? "userId" : "NONE"));
        console.log("=".repeat(80));
        
        // Build request with EITHER userId OR userToken (prefer userToken)
        const authParams: any = {};
        if (userToken && typeof userToken === 'string' && userToken.trim() !== '') {
          authParams.userToken = userToken;
          console.log("✅ Using userToken for authentication");
        } else if (userId && typeof userId === 'string' && userId.trim() !== '') {
          authParams.userId = userId;
          console.log("✅ Using userId for authentication");
        } else {
          console.error("❌ No authentication provided! Both userId and userToken are missing!");
        }
        
        const finalRequest = {
          ...transactionRequest,
          ...authParams,
        };
        console.log("📤 Final SDK request (without sensitive data):", JSON.stringify({
          ...finalRequest,
          userToken: finalRequest.userToken ? `${finalRequest.userToken.substring(0, 20)}...` : undefined,
          userId: finalRequest.userId,
          amounts: finalRequest.amounts, // Log amounts to verify they're correct
          amountForSDK: amountForSDK, // Log the formatted amount
          originalAmount: amount, // Log original amount
        }, null, 2));
        
        response = await userClient.createTransaction(finalRequest);
        
        console.log("✅ SDK createTransaction call completed successfully");
        
        // Log the response to see what Circle returns
        try {
          const responseData = response?.data;
          // Check if this is a challenge response (has challengeId) or transaction response (has id)
          if (responseData) {
            if ('challengeId' in responseData) {
              console.log("📥 Circle API Response (Challenge):", {
                challengeId: (responseData as any).challengeId,
                allKeys: Object.keys(responseData),
              });
            } else if ('id' in responseData) {
              // This is a transaction response
              const txData = responseData as any;
              console.log("📥 Circle API Response (Transaction):", {
                transactionId: txData.id,
                state: txData.state,
                amounts: txData.amounts,
                amount: txData.amount,
                destinationAddress: txData.destinationAddress,
                allKeys: Object.keys(txData),
              });
              
              // Log amounts specifically if present
              if (txData.amounts) {
                console.log("💰 Response amounts array:", JSON.stringify(txData.amounts));
              }
              if (txData.amount) {
                console.log("💰 Response amount object:", JSON.stringify(txData.amount));
              }
            } else {
              console.log("📥 Circle API Response (Unknown):", {
                allKeys: Object.keys(responseData),
                data: responseData,
              });
            }
          }
        } catch (logError) {
          console.warn("Could not log response details:", logError);
        }
      } catch (sdkCallError: any) {
        // Log error structure first (before extraction) to understand what we're dealing with
        console.error("=".repeat(80));
        console.error("❌ SDK createTransaction call threw an error");
        console.error("=".repeat(80));
        console.error("Error type:", typeof sdkCallError);
        console.error("Error constructor:", sdkCallError?.constructor?.name);
        console.error("Has 'response' property:", 'response' in sdkCallError);
        console.error("Has 'status' property:", 'status' in sdkCallError);
        console.error("Has 'code' property:", 'code' in sdkCallError);
        console.error("Has 'message' property:", 'message' in sdkCallError);
        
        // Try to log the raw error (safely) - this will help us see what the actual error is
        // AVOID String(sdkCallError) as it can cause circular reference errors
        try {
          if (sdkCallError.message) {
            console.error("Error message:", sdkCallError.message);
          }
          if (sdkCallError.name) {
            console.error("Error name:", sdkCallError.name);
          }
          if (sdkCallError.stack) {
            console.error("Error stack (first 500 chars):", sdkCallError.stack.substring(0, 500));
          }
        } catch (e) {
          console.error("Could not extract error details (circular reference)");
        }
        
        // Try to log error keys
        try {
          if (sdkCallError && typeof sdkCallError === 'object') {
            const keys = Object.keys(sdkCallError);
            console.error("Error object keys:", keys.slice(0, 30));
            // Try to log some key properties
            for (const key of keys.slice(0, 10)) {
              try {
                const value = (sdkCallError as any)[key];
                if (typeof value !== 'object' || value === null) {
                  console.error(`  ${key}:`, value);
                } else {
                  console.error(`  ${key}: [object]`);
                }
              } catch (e) {
                console.error(`  ${key}: [could not access]`);
              }
            }
          }
        } catch (e) {
          console.error("Could not get error keys");
        }
        
        // Extract error details BEFORE it gets circular - use try/catch for each access
        let errorStatus: number | undefined;
        let errorData: any;
        let errorCode: string | number | undefined;
        let errorMessage: string = "SDK transaction creation failed";
        
        // Extract message (safest - usually just a string)
        // AVOID String(sdkCallError) as it can cause circular reference errors
        try {
          if (sdkCallError.message && typeof sdkCallError.message === 'string') {
            errorMessage = sdkCallError.message;
          } else if (sdkCallError.toString && typeof sdkCallError.toString === 'function') {
            try {
              errorMessage = sdkCallError.toString();
            } catch (e) {
              // toString might also fail with circular refs, use default
              errorMessage = "SDK transaction creation failed (circular reference in error object)";
            }
          }
          console.error("Extracted message:", errorMessage);
        } catch (e: any) {
          console.error("Failed to extract message:", e?.message || "Unknown error");
          errorMessage = "SDK transaction creation failed (error extraction failed)";
        }
        
        // Extract status - try multiple approaches
        try {
          // Try direct status property first
          if ('status' in sdkCallError && sdkCallError.status !== undefined) {
            errorStatus = Number(sdkCallError.status);
            console.error("✓ Extracted status from error.status:", errorStatus);
          }
          // Try response.status using hasOwnProperty check
          else if ('response' in sdkCallError && sdkCallError.response) {
            const response = sdkCallError.response;
            if (response && typeof response === 'object' && 'status' in response) {
              // Direct property access (avoiding getters/setters)
              const statusValue = (response as any).status;
              if (statusValue !== undefined && statusValue !== null) {
                errorStatus = Number(statusValue);
                console.error("✓ Extracted status from response.status:", errorStatus);
              }
            }
          }
        } catch (e: any) {
          console.error("✗ Failed to extract status:", e?.message || "Unknown error");
        }
        
        // Extract response data
        try {
          if ('response' in sdkCallError && sdkCallError.response) {
            const response = sdkCallError.response;
            if (response && typeof response === 'object' && 'data' in response) {
              // Direct property access
              const dataValue = (response as any).data;
              if (dataValue !== undefined && dataValue !== null) {
                errorData = dataValue;
                console.error("✓ Extracted response.data");
              }
            }
          }
        } catch (e: any) {
          console.error("✗ Failed to extract response data:", e?.message || "Unknown error");
        }
        
        // Extract code
        try {
          errorCode = sdkCallError.code;
          if (errorCode !== undefined) {
            console.error("Extracted code:", errorCode);
          }
        } catch (e: any) {
          console.error("Failed to extract code:", e?.message);
        }
        
        console.error("\nExtracted Error Details:");
        console.error("  Status:", errorStatus || "N/A");
        console.error("  Code:", errorCode || "N/A");
        console.error("  Message:", errorMessage);
        if (errorData) {
          try {
            console.error("  Response Data:", JSON.stringify(errorData, null, 2));
            
            // Check if error response contains challengeId (sometimes Circle returns challengeId in error responses)
            if (errorData.data?.challengeId || errorData.challengeId) {
              const challengeId = errorData.data?.challengeId || errorData.challengeId;
              console.log("⚠️ ChallengeId found in error response! ChallengeId:", challengeId);
              console.log("ℹ️ This means the transaction requires PIN confirmation.");
              
              // Return challengeId to client instead of throwing error
              return NextResponse.json({
                success: true,
                data: {
                  challengeId: challengeId,
                  requiresChallenge: true,
                  message: "Transaction created. Please complete the challenge (PIN) to proceed.",
                  walletId: walletId,
                  destinationAddress: destinationAddress,
                  amount: amount,
                },
              });
            }
          } catch (e) {
            console.error("  Response Data: (could not stringify - circular reference)");
          }
        }
        console.error("=".repeat(80));
        
        // Create a clean error object without circular references
        // Make sure errorMessage doesn't contain circular reference errors
        let finalErrorMessage = errorMessage;
        if (errorMessage.includes("Converting circular structure to JSON")) {
          // The error message itself is about circular references - try to get more info
          finalErrorMessage = `SDK transaction creation failed (circular reference in error object). ` +
            `Status: ${errorStatus || 'unknown'}, Code: ${errorCode || 'unknown'}. ` +
            `Check server logs for detailed error extraction.`;
        }
        
        const cleanError: any = new Error(finalErrorMessage);
        // Always set these properties so they're available in outer catch
        if (errorStatus !== undefined) cleanError.status = errorStatus;
        if (errorCode !== undefined) cleanError.code = errorCode;
        if (errorData !== undefined) cleanError.responseData = errorData;
        // Also set a flag so we know this is a cleanError
        cleanError._isCleanError = true;
        // Store the original error message for reference
        cleanError.originalMessage = errorMessage;
        
        console.error("\n📤 Throwing clean error to outer catch block:");
        console.error("  Message:", finalErrorMessage);
        console.error("  Status:", errorStatus || "N/A");
        console.error("  Code:", errorCode || "N/A");
        console.error("  Has errorData:", !!errorData);
        
        throw cleanError; // Throw clean error to be caught by outer catch block
      }

      // Safely log response without circular references
      try {
        if (response?.data) {
          console.log("📥 SDK transaction response.data:", JSON.stringify(response.data, null, 2));
        } else {
          console.log("📥 SDK transaction response.data: undefined");
        }
        // Log response structure without stringifying the whole object
        console.log("📥 SDK transaction response structure:", {
          hasData: !!response?.data,
          dataKeys: response?.data ? Object.keys(response.data) : [],
        });
      } catch (e: any) {
        console.log("📥 SDK transaction response: (could not serialize - circular reference)");
        // Try to extract just the data we need
        try {
          if (response?.data) {
            const data = response.data as any;
            console.log("📥 SDK transaction response.data keys:", Object.keys(data));
            if (data.challengeId) console.log("  challengeId:", data.challengeId);
            if (data.id) console.log("  id:", data.id);
            if (data.state) console.log("  state:", data.state);
          }
        } catch (e2) {
          console.log("📥 SDK transaction response: (could not extract any details)");
        }
      }
      
      if (!response || !response.data) {
        console.error("❌ SDK returned empty or invalid response:", {
          hasResponse: !!response,
          hasData: !!response?.data,
          responseKeys: response ? Object.keys(response) : [],
          responseType: typeof response,
        });
        throw new Error("SDK returned empty or invalid response");
      }

      const responseData = response.data as any;
      
      // Circle API can return either:
      // 1. challengeId (when challenge is required) - { data: { challengeId: string } }
      // 2. Transaction object (when challenge already completed or not required) - { data: { id, state, ... } }
      
      // Log response structure for debugging
      console.log("📋 Response data structure:", {
        hasChallengeId: !!responseData.challengeId,
        challengeId: responseData.challengeId,
        hasId: !!responseData.id,
        id: responseData.id,
        allKeys: Object.keys(responseData),
      });
      
      // Check if response contains challengeId (challenge flow)
      if (responseData.challengeId) {
        console.log("⚠️ Transaction requires challenge completion. ChallengeId:", responseData.challengeId);
        console.log("ℹ️ The transaction will be created after the user completes the challenge (PIN).");
        
        // Return challengeId to client - they need to complete the challenge first
        return NextResponse.json({
          success: true,
          data: {
            challengeId: responseData.challengeId,
            requiresChallenge: true,
            message: "Transaction created. Please complete the challenge (PIN) to proceed.",
            walletId: walletId,
            destinationAddress: destinationAddress,
            amount: amount,
          },
        });
      }
      
      // Response contains transaction object (challenge already completed or not required)
      const txData = responseData;
      
      // Log full response structure for debugging
      console.log("📋 SDK transaction response structure:", {
        id: txData.id,
        state: txData.state,
        txHash: txData.txHash,
        transactionHash: txData.transactionHash,
        onChainTxHash: txData.onChainTxHash,
        hash: txData.hash,
        amounts: txData.amounts, // Log amounts from response
        amount: txData.amount, // Log amount object if present
        destinationAddress: txData.destinationAddress,
        sourceAddress: txData.sourceAddress,
        allKeys: Object.keys(txData),
      });
      
      // IMPORTANT: Check if amounts are missing or zero in response
      if (!txData.amounts || txData.amounts.length === 0 || txData.amounts[0] === '0' || txData.amounts[0] === '0.000000') {
        console.error("⚠️⚠️⚠️ WARNING: Circle response has missing or zero amounts!", {
          amounts: txData.amounts,
          amount: txData.amount,
          sentAmount: amountForSDK,
          originalAmount: amount,
        });
      }
      
      // Log amounts specifically to verify they match what we sent
      console.log("💰 Amount verification:", {
        sentAmount: amountForSDK,
        sentAmountsArray: [amountForSDK],
        responseAmounts: txData.amounts,
        responseAmount: txData.amount,
        amountsMatch: JSON.stringify(txData.amounts) === JSON.stringify([amountForSDK]),
      });
      
      // Extract blockchain transaction hash if available
      // Circle API uses txHash field for the blockchain transaction hash (priority)
      // Note: The hash might not be available immediately (transaction state: INITIATED)
      // It will be available once the transaction is sent to the blockchain (state: SENT/CONFIRMED/COMPLETE)
      const blockchainHash = txData.txHash ||
                            txData.transactionHash || 
                            txData.onChainTxHash || 
                            txData.hash || 
                            (txData.transaction && (txData.transaction.txHash || txData.transaction.transactionHash || txData.transaction.hash)) ||
                            null;
      
      console.log("Transaction hash extracted:", blockchainHash || "Not available yet (transaction may still be processing)");
      console.log("Transaction state:", txData.state);
      
      // Map SDK response to our expected format
      transaction = {
        data: {
          id: txData.id || "",
          walletId: walletId,
          idempotencyKey: idempotencyKey || generateUUID(),
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
          status: ((txData.state as string) === "COMPLETED" || 
                  (txData.state as string) === "COMPLETE" ||
                  (txData.state as string) === "CONFIRMED" || 
                  (txData.state as string) === "SENT" ? "confirmed" : 
                  (txData.state as string) === "FAILED" ? "failed" : 
                  "pending") as "pending" | "confirmed" | "failed",
          createDate: new Date().toISOString(),
          updateDate: new Date().toISOString(),
          // Store blockchain hash if available (use txHash field name for consistency)
          transactionHash: blockchainHash || undefined,
          txHash: blockchainHash || undefined,
        } as any,
      };
    } catch (sdkError: any) {
      // Extract error details safely (handle both cleanError and raw SDK errors)
      let errorStatus: number | undefined;
      let errorData: any;
      let errorCode: string | number | undefined;
      let errorMessage: string = "SDK transaction creation failed";
      
      // Check if this is our cleanError (has _isCleanError flag)
      if (sdkError._isCleanError) {
        // This is our cleanError - extract directly (no circular references)
        errorStatus = sdkError.status;
        errorData = sdkError.responseData;
        errorCode = sdkError.code;
        errorMessage = sdkError.message || errorMessage;
      } else {
        // This is a raw SDK error - extract carefully to avoid circular references
        // Extract error message first (safest)
        try {
          // Avoid String(sdkError) as it can cause circular reference errors
          if (sdkError.message && typeof sdkError.message === 'string') {
            errorMessage = sdkError.message;
          } else if (sdkError.toString && typeof sdkError.toString === 'function') {
            try {
              errorMessage = sdkError.toString();
            } catch (e) {
              // toString might also fail with circular refs
              errorMessage = errorMessage || "SDK error (circular reference)";
            }
          }
        } catch (e) {
          // Ignore
        }
        
        // Extract status (might have circular refs, so be careful)
        try {
          if (sdkError.status !== undefined) {
            errorStatus = sdkError.status;
          } else if (sdkError.response && typeof sdkError.response === 'object') {
            // Only access status property, not the whole response object
            errorStatus = (sdkError.response as any).status;
          }
        } catch (e) {
          // Ignore - might have circular reference
        }
        
        // Extract response data (might have circular refs)
        try {
          if (sdkError.responseData !== undefined) {
            errorData = sdkError.responseData;
          } else if (sdkError.response && typeof sdkError.response === 'object') {
            // Only access data property, not the whole response object
            errorData = (sdkError.response as any).data;
          }
        } catch (e) {
          // Ignore - might have circular reference
        }
        
        // Extract code
        try {
          errorCode = sdkError.code;
        } catch (e) {
          // Ignore
        }
      }
      
      console.error("=".repeat(80));
      console.error("SDK transaction creation failed:");
      console.error("  Status:", errorStatus || "N/A");
      console.error("  Code:", errorCode || "N/A");
      console.error("  Message:", errorMessage);
      if (errorData) {
        try {
          console.error("  Response Data:", JSON.stringify(errorData, null, 2));
        } catch (e) {
          console.error("  Response Data: (could not stringify - circular reference)");
        }
      }
      console.error("=".repeat(80));
      
      // If it's a 400 error, provide more details and throw with helpful message
      if (errorStatus === 400) {
        const errorDetails = errorData;
        console.error("\n" + "=".repeat(80));
        console.error("400 Bad Request - Circle API Validation Error");
        console.error("=".repeat(80));
        console.error("Request body:", JSON.stringify(transactionRequest, null, 2));
        console.error("Error response:", JSON.stringify(errorDetails, null, 2));
        console.error("=".repeat(80) + "\n");
        
        // Extract validation error messages from Circle API response
        // Circle API returns: { code: 2, message: "...", errors: [{ error, invalidValue, location, message }] }
        let errorMessages = errorDetails?.message || "Bad Request";
        
        if (errorDetails?.errors && Array.isArray(errorDetails.errors) && errorDetails.errors.length > 0) {
          const validationErrors = errorDetails.errors.map((e: any) => {
            const location = e.location || 'unknown';
            const errorType = e.error || 'invalid';
            const invalidValue = e.invalidValue ? (String(e.invalidValue).length > 50 ? String(e.invalidValue).substring(0, 50) + '...' : String(e.invalidValue)) : 'N/A';
            const errorMsg = e.message || `${location}: ${errorType}`;
            return `${errorMsg} (value: ${invalidValue})`;
          });
          errorMessages = validationErrors.join('; ');
        }
        
        // Safely stringify transactionRequest (avoid circular references)
        let requestSummary = "N/A";
        try {
          requestSummary = JSON.stringify(transactionRequest);
        } catch (stringifyError) {
          requestSummary = `{ walletId: ${transactionRequest?.walletId}, destinationAddress: ${transactionRequest?.destinationAddress}, amounts: ${transactionRequest?.amounts} }`;
        }
        
        const helpfulError = new Error(`Transaction creation failed: ${errorMessages}`);
        (helpfulError as any).status = 400;
        (helpfulError as any).code = errorDetails?.code || 2;
        (helpfulError as any).details = errorDetails;
        throw helpfulError;
      }
      
      // Handle 403 Forbidden errors (invalid or expired userToken)
      if (errorStatus === 403) {
        const errorDetails = errorData;
        const circleErrorCode = errorDetails?.code;
        const isExpired = circleErrorCode === 155104; // Token expired
        const isInvalid = circleErrorCode === 155105; // Token invalid
        
        console.error("\n" + "=".repeat(80));
        console.error(`403 Forbidden - User Token ${isExpired ? 'Expired' : isInvalid ? 'Invalid' : 'Error'}`);
        console.error("=".repeat(80));
        console.error("Error response:", JSON.stringify(errorDetails, null, 2));
        console.error("Circle Error Code:", circleErrorCode);
        console.error("=".repeat(80) + "\n");
        
        const errorMessage = errorDetails?.message || "The userToken is invalid.";
        
        // Provide specific error message based on error code
        let userFacingMessage: string;
        let hint: string;
        let recoveryAction: string;
        
        if (isExpired) {
          userFacingMessage = "Your authentication token has expired. Tokens expire after 60 minutes for security.";
          hint = "Please refresh your token or create a new user session.";
          recoveryAction = "Refresh the token using: REFRESH_USER_ID=your-user-id npm run refresh:user-token, or create a new user via /api/circle/users";
        } else if (isInvalid) {
          userFacingMessage = "Your authentication token is invalid.";
          hint = "Please create a new user session.";
          recoveryAction = "Create a new user via /api/circle/users";
        } else {
          userFacingMessage = errorMessage;
          hint = "User token is invalid or expired (tokens expire after 60 minutes).";
          recoveryAction = "Refresh the token or create a new user via /api/circle/users";
        }
        
        const authError: any = new Error(`Transaction creation failed: ${userFacingMessage}`);
        authError.status = 403;
        authError.code = circleErrorCode || 155105;
        authError.details = errorDetails;
        authError.hint = hint;
        authError.recoveryAction = recoveryAction;
        authError.isExpired = isExpired;
        authError.isInvalid = isInvalid;
        throw authError;
      }
      
      // Provide helpful error message based on error type
      if (errorStatus === 401) {
        // Check if it's a User Token authentication issue
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
                  idempotencyKey: idempotencyKey || generateUUID(),
                  walletId: walletId,
                  destinationAddress: destinationAddress,
                  amounts: [amountForSDK], // REST API also expects decimal format
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
            // Safely log error without circular references
            try {
              const errorMsg = devTxError?.message || devTxError?.response?.data?.message || "Unknown error";
              const errorStatus = devTxError?.response?.status || devTxError?.status || "N/A";
              console.error("Developer transactions endpoint failed:", {
                message: errorMsg,
                status: errorStatus,
                endpoint: "/v1/w3s/developer/transactions",
              });
            } catch (e) {
              console.error("Developer transactions endpoint failed (could not extract error details)");
            }
            
            // Try 2: Developer-controlled wallets endpoint
            try {
              console.log("Trying REST API endpoint: /v1/w3s/developer/wallets/{walletId}/transactions");
              const restResponse = await circleApiRequest<CircleTransactionResponse>(
                `/v1/w3s/developer/wallets/${walletId}/transactions`,
                {
                  method: "POST",
                  body: JSON.stringify({
                    idempotencyKey: idempotencyKey || generateUUID(),
                    destinationAddress: destinationAddress,
                    amounts: [amountForSDK], // REST API also expects decimal format
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
              // Safely log error without circular references
              try {
                const errorMsg = devWalletError?.message || devWalletError?.response?.data?.message || "Unknown error";
                const errorStatus = devWalletError?.response?.status || devWalletError?.status || "N/A";
                console.error("Developer wallets endpoint failed:", {
                  message: errorMsg,
                  status: errorStatus,
                  endpoint: `/v1/w3s/developer/wallets/${walletId}/transactions`,
                });
              } catch (e) {
                console.error("Developer wallets endpoint failed (could not extract error details)");
              }
              restError = devWalletError;
              
              // Try 3: Regular wallets endpoint (legacy fallback)
              try {
                console.log("Trying REST API endpoint: /v1/w3s/wallets/{walletId}/transactions");
                const restResponse = await circleApiRequest<CircleTransactionResponse>(
                  `/v1/w3s/wallets/${walletId}/transactions`,
                  {
                    method: "POST",
                    body: JSON.stringify({
                      idempotencyKey: idempotencyKey || generateUUID(),
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
                // Safely log error without circular references
                try {
                  const errorMsg = regularError?.message || regularError?.response?.data?.message || "Unknown error";
                  const errorStatus = regularError?.response?.status || regularError?.status || "N/A";
                  console.error("Regular endpoint also failed:", {
                    message: errorMsg,
                    status: errorStatus,
                    endpoint: `/v1/w3s/wallets/${walletId}/transactions`,
                  });
                } catch (e) {
                  console.error("Regular endpoint also failed (could not extract error details)");
                }
                restError = regularError;
              }
            }
          }
          
          // Both REST API fallback attempts failed
          console.error("All REST API fallback attempts failed");
          
          // Safely extract error messages without circular references
          let sdkErrorMessage = "Unknown SDK error";
          try {
            sdkErrorMessage = sdkError?.message || sdkError?.response?.data?.message || "Unknown SDK error";
          } catch (e) {
            sdkErrorMessage = "SDK error (could not extract message)";
          }
          
          let restErrorMessage = "Unknown REST API error";
          try {
            restErrorMessage = restError?.message || restError?.response?.data?.message || "Unknown REST API error";
          } catch (e) {
            restErrorMessage = "REST API error (could not extract message)";
          }
          
          const guidanceMessage =
            `Transaction creation failed: SDK cannot fetch entity public key (401), and all REST API fallback attempts failed. ` +
            `\n\nThis suggests the user token or userId may be invalid or expired, ` +
            `or the wallet/endpoint configuration is incorrect.` +
            `\n\nPossible solutions:\n` +
            `1. Verify user token/userId is valid: Create a new user via /api/circle/users\n` +
            `2. Check Circle Console: https://console.circle.com/ - ensure App ID is configured\n` +
            `3. Verify wallet ID matches the user: ${walletId}\n` +
            `4. Try creating a new user and wallet\n` +
            `5. Contact Circle Support if the issue persists\n` +
            `\nSDK Error: ${sdkErrorMessage}\n` +
            `REST API Error: ${restErrorMessage}`;
          
          const authError: any = new Error(guidanceMessage);
          authError.status = 401;
          authError.response = sdkError.response || {
            status: 401,
            statusText: "Unauthorized",
            data: sdkError.response?.data,
          };
          authError.details = {
            hint: "User token/userId is invalid or entity configuration is incomplete. Recreate the user/PIN flow.",
            suggestions: [
              "Create a new user via /api/circle/users and rerun the PIN challenge",
              "Verify NEXT_PUBLIC_CIRCLE_APP_ID and CIRCLE_API_KEY",
              "Ensure walletId matches the user (either userId or userToken must be valid)",
            ],
          };
          throw authError;
        } else {
          // Re-throw if it's not the public key error
          const authError: any = new Error(
            `Authentication failed (401). Please verify your Circle API key, App ID, and user token/userId are correct. ` +
            `Error: ${sdkError.message}`
          );
          authError.status = 401;
          authError.response = sdkError.response || {
            status: 401,
            statusText: "Unauthorized",
            data: sdkError.response?.data,
          };
          authError.details = {
            hint: "Likely caused by expired userToken or invalid userId. Prompt the client to recreate the user and run PIN setup again.",
          };
          throw authError;
        }
      }
      
      if (errorStatus === 404 || errorMessage?.includes("not found")) {
        throw new Error(
          `Wallet not found. The wallet ID "${walletId}" does not exist in Circle. ` +
          `Please ensure the wallet was created successfully. Error: ${sdkError.message}`
        );
      }
      
      // Log the full error for debugging (safely)
      try {
      console.error("❌ SDK transaction creation error (non-401/404):", {
        message: sdkError.message,
        response: sdkError.response?.data,
        status: sdkError.response?.status,
        code: sdkError.code,
        stack: sdkError.stack,
        });
        if (transactionRequest) {
          try {
            console.error("Transaction request:", JSON.stringify(transactionRequest, null, 2));
          } catch (e) {
            console.error("Transaction request (could not stringify)");
          }
        }
      } catch (logError) {
        console.error("Could not log error details (circular reference)");
      }
      
      // Use the error message we already extracted
      let safeErrorMessage = errorMessage || "Unknown SDK error";
      
      // If the message itself contains circular reference error, provide more context
      if (safeErrorMessage.includes("Converting circular structure")) {
        // Try to extract more details from the error object directly
        let errorSummary = `SDK error (status: ${errorStatus || 'unknown'}, code: ${errorCode || 'unknown'})`;
        
        // Try to get more details from errorData if available
        if (errorData) {
          try {
            if (errorData.message) errorSummary += ` - ${errorData.message}`;
            if (errorData.error) errorSummary += ` - ${errorData.error}`;
            if (errorData.code) errorSummary += ` (code: ${errorData.code})`;
          } catch (e) {
            // Ignore
          }
        }
        
        safeErrorMessage = errorSummary;
      }
      
      // If we still don't have a good error message, try to extract from the raw error
      if (safeErrorMessage === "Unknown SDK error" || safeErrorMessage.includes("unknown")) {
        try {
          // Try to get error message from various possible locations
          const possibleMessages = [
            sdkError?.message,
            sdkError?.response?.data?.message,
            sdkError?.response?.data?.error,
            errorData?.message,
            errorData?.error,
            (sdkError?.message || "Unknown SDK error").substring(0, 200), // First 200 chars of error message
          ].filter(Boolean);
          
          if (possibleMessages.length > 0) {
            safeErrorMessage = possibleMessages[0] as string;
          }
        } catch (e) {
          // Ignore - use default
        }
      }
      
      // Include error details in the error message if available
      // Circle API error structure: { code: number, message: string, errors?: [...] }
      if (errorData) {
        if (errorData.message) {
          safeErrorMessage = errorData.message;
          // Add validation errors if available
          if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
            const validationErrors = errorData.errors.map((e: any) => 
              e.message || `${e.location || 'unknown'}: ${e.error || 'invalid'}`
            ).join('; ');
            safeErrorMessage = `${safeErrorMessage}: ${validationErrors}`;
          }
        } else if (errorData.error) {
          safeErrorMessage = `${safeErrorMessage}: ${errorData.error}`;
        }
      }
      
      const finalError = new Error(`Transaction creation failed: ${safeErrorMessage}. Check server logs for details.`);
      (finalError as any).status = errorStatus;
      (finalError as any).code = errorCode || errorData?.code;
      (finalError as any).details = errorData;
      throw finalError;
    }

    // Ensure transaction was created successfully
    if (!transaction || !transaction.data) {
      console.error("❌ Transaction was not created successfully. Transaction object:", transaction);
      throw new Error("Transaction was not created successfully. The SDK call may have failed silently.");
    }

    // Extract blockchain hash from transaction data if available
    // Note: The blockchain hash might not be available immediately (transaction state: INITIATED)
    // It will be available once the transaction is sent to the blockchain (state: SENT/CONFIRMED)
    const transactionData = transaction.data as any;
    const blockchainHash = transactionData?.txHash ||
                          transactionData?.transactionHash || 
                          transactionData?.onChainTxHash || 
                          transactionData?.hash ||
                          null;
    
    // Safely extract amount - handle different response structures
    let amountValue: string;
    try {
      amountValue = transaction.data?.amount?.amount || 
                   (transaction.data as any)?.amount || 
                   amountInSmallestUnit;
      
      // Validate amountValue is a valid string
      if (!amountValue || typeof amountValue !== 'string') {
        console.warn("⚠️ Invalid amountValue, using fallback:", amountValue);
        amountValue = amountInSmallestUnit;
      }
    } catch (error) {
      console.error("Error extracting amount:", error);
      amountValue = amountInSmallestUnit;
    }
    
    // Safely convert amount to formatted string
    // IMPORTANT: Use the correct decimals (Arc Testnet USDC currently uses 6 decimals)
    let formattedAmount: string;
    try {
      if (amountValue && amountValue !== '0') {
        const amountBigInt = BigInt(amountValue);
        // Format with the correct decimals reported for the token (default: Arc = 6)
        const decimals = tokenDecimals || getUsdcDecimals();
        const divisor = 10n ** BigInt(decimals);
        const whole = amountBigInt / divisor;
        const fraction = amountBigInt % divisor;
        formattedAmount = `${whole.toString()}.${fraction.toString().padStart(decimals, "0")}`;
      } else {
        formattedAmount = amount; // Use original amount if amountValue is invalid
      }
    } catch (error) {
      console.error("Error formatting amount:", error, "amountValue:", amountValue);
      formattedAmount = amount; // Fallback to original amount string
    }
    
    // Safely extract all transaction properties with fallbacks
    const transactionId = transaction.data?.id || "";
    const transactionWalletId = transaction.data?.walletId || walletId;
    const transactionStatus = transaction.data?.status || transactionData?.state || "pending";
    const transactionFee = transaction.data?.fee?.amount || "0";
    const transactionCreateDate = transaction.data?.createDate || new Date().toISOString();
    const transactionUpdateDate = transaction.data?.updateDate || new Date().toISOString();
    
    console.log("📤 Returning transaction response:", {
      id: transactionId,
      hash: blockchainHash,
      txHash: transactionData?.txHash,
      transactionHash: transactionData?.transactionHash,
      state: transactionData?.state || transactionStatus,
      amount: amountValue,
      formattedAmount,
      originalAmount: amount,
      amountForSDK: amountForSDK,
      amountInSmallestUnit: amountInSmallestUnit,
    });
    
    return NextResponse.json({
      success: true,
      data: {
        id: transactionId,
        hash: blockchainHash || transactionId, // Use blockchain hash if available, otherwise Circle transaction ID
        circleTransactionId: transactionId, // Keep Circle transaction ID for reference
        walletId: transactionWalletId,
        from: walletId,
        to: destinationAddress,
        amount: formattedAmount,
        amountRaw: amountValue,
        token: "USDC",
        network: "ARC",
        // Include hash fields for easy access (prioritize txHash as that's what Circle uses)
        txHash: blockchainHash || undefined,
        transactionHash: blockchainHash || undefined,
        status: transactionStatus,
        fee: transactionFee,
        createdAt: transactionCreateDate,
        updatedAt: transactionUpdateDate,
      },
    });
  } catch (error: any) {
    // Check if error response contains challengeId BEFORE logging error
    // Sometimes Circle SDK returns challengeId in error responses
    if (error?.responseData) {
      try {
        const errorData = error.responseData;
        if (errorData.data?.challengeId || errorData.challengeId) {
          const challengeId = errorData.data?.challengeId || errorData.challengeId;
          console.log("⚠️ ChallengeId found in error response! ChallengeId:", challengeId);
          console.log("ℹ️ This means the transaction requires PIN confirmation.");
          
          // Extract walletId, destinationAddress, and amount from request body if available
          const errorWalletId = (body as any)?.walletId || "";
          const errorDestinationAddress = (body as any)?.destinationAddress || "";
          const errorAmount = (body as any)?.amount || "";
          
          return NextResponse.json({
            success: true,
            data: {
              challengeId: challengeId,
              requiresChallenge: true,
              message: "Transaction created. Please complete the challenge (PIN) to proceed.",
              walletId: errorWalletId,
              destinationAddress: errorDestinationAddress,
              amount: errorAmount,
            },
          });
        }
      } catch (e) {
        // Ignore - continue with normal error handling
      }
    }
    
    // Log comprehensive error information
    console.error("❌ Error creating transaction:");
    console.error("Error type:", error?.constructor?.name || typeof error);
    
    // Safely extract error message (avoid circular references)
    let errorMessage = "Failed to create transaction";
    try {
    if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      console.error("Error name:", error.name);
        console.error("Error message:", errorMessage);
      console.error("Error stack:", error.stack);
      } else {
        // Try to get message safely - AVOID String(error) as it can cause circular reference errors
        if (error?.message && typeof error.message === 'string') {
          errorMessage = error.message;
        } else if (error?.toString && typeof error.toString === 'function') {
          try {
            errorMessage = error.toString();
          } catch (e) {
            // toString might also fail with circular refs
            errorMessage = errorMessage || "Failed to create transaction (error details unavailable)";
          }
        }
      }
    } catch (extractError) {
      // If we can't extract message, use default
      console.error("Could not extract error message (circular reference?)");
      errorMessage = "Failed to create transaction (error details unavailable)";
    }
    
    // Log detailed error information
    // errorMessage already set above (extracted safely)
    let errorDetails: any = {};
    
    // Check if error has response property (from circleApiRequest)
    if (error && typeof error === 'object') {
      // errorMessage already extracted safely above - don't overwrite it
      
      // Extract Circle API error details if available
      // circleApiRequest throws errors with a response property
      if ('response' in error && error.response) {
        // Safely extract only serializable data (avoid circular references)
        // Extract response.data carefully - it might have circular references
        let responseData: any = null;
        try {
          // Try to extract data safely
          if (error.response.data && typeof error.response.data === 'object') {
            // Check if it's already a plain object (not a circular reference)
            try {
              JSON.stringify(error.response.data);
              responseData = error.response.data;
            } catch (e) {
              // Has circular references - extract only safe properties
              responseData = {
                message: error.response.data?.message,
                error: error.response.data?.error,
                code: error.response.data?.code,
                errors: error.response.data?.errors,
              };
            }
          } else {
            responseData = error.response.data;
          }
        } catch (e) {
          // If extraction fails, use null
          responseData = null;
        }
        
        errorDetails = {
          status: error.response.status,
          statusText: error.response.statusText,
          data: responseData, // Safely extracted data
        };
        
        // Check if error response contains challengeId (sometimes Circle returns challengeId in error responses)
        if (error.response.data?.data?.challengeId || error.response.data?.challengeId) {
          const challengeId = error.response.data?.data?.challengeId || error.response.data?.challengeId;
          console.log("⚠️ ChallengeId found in error.response.data! ChallengeId:", challengeId);
          console.log("ℹ️ This means the transaction requires PIN confirmation.");
          
          // Try to get walletId, destinationAddress, and amount from error context or body
          const errorWalletId = (error as any).walletId || (body as any)?.walletId || "";
          const errorDestinationAddress = (error as any).destinationAddress || (body as any)?.destinationAddress || "";
          const errorAmount = (error as any).amount || (body as any)?.amount || "";
          
          return NextResponse.json({
            success: true,
            data: {
              challengeId: challengeId,
              requiresChallenge: true,
              message: "Transaction created. Please complete the challenge (PIN) to proceed.",
              walletId: errorWalletId,
              destinationAddress: errorDestinationAddress,
              amount: errorAmount,
            },
          });
        }
        
        errorMessage = error.response.data?.message || error.response.data?.error || errorMessage || "Failed to create transaction";
        // Only stringify if data is safe (not a circular reference)
        try {
        console.error("Circle API Error Response:", JSON.stringify(errorDetails, null, 2));
        } catch (stringifyError) {
          console.error("Circle API Error Response (could not stringify):", {
            status: errorDetails.status,
            statusText: errorDetails.statusText,
            dataType: typeof errorDetails.data,
          });
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Log any additional error properties
      if (error.code) {
        console.error("Error code:", error.code);
        errorDetails.code = error.code;
      }
      if (error.status) {
        console.error("Error status:", error.status);
        errorDetails.status = error.status;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    // Determine status code from error
    let statusCode = 500;
    if (errorDetails.status) {
      statusCode = errorDetails.status;
    } else if (errorMessage.includes("Missing required") || errorMessage.includes("Invalid")) {
      statusCode = 400;
    }
    
    // Enhanced error logging for debugging 500 errors
    console.error("=".repeat(80));
    console.error("❌ TRANSACTION CREATION ERROR");
    console.error("=".repeat(80));
    console.error("Error Message:", errorMessage);
    console.error("Error Type:", error?.constructor?.name || typeof error);
    if (error?.stack) {
      console.error("Error Stack:", error.stack);
    }
    
    // Log request context (try to get from body if available)
    console.error("\n📋 Request Context:");
    try {
      // Note: request body is already consumed, but we logged it earlier
      console.error("  Check earlier logs for request body details");
    } catch (e) {
      console.error("  Could not parse request context");
    }
    
    // Log Circle API error details
    if (errorDetails.data) {
      console.error("\n🔍 Circle API Error Response:");
      try {
        console.error(JSON.stringify(errorDetails.data, null, 2));
      } catch (stringifyError) {
        // Avoid circular reference errors
        console.error("Circle API Error Response (could not stringify):", {
          dataType: typeof errorDetails.data,
          hasMessage: !!errorDetails.data?.message,
          hasError: !!errorDetails.data?.error,
          hasCode: !!errorDetails.data?.code,
          message: errorDetails.data?.message,
          error: errorDetails.data?.error,
          code: errorDetails.data?.code,
        });
      }
    }
    
    // Log SDK-specific errors
    if (error?.code) {
      console.error("\n🔑 Error Code:", error.code);
    }
    if (error?.config) {
      console.error("\n📤 Request Config:");
      console.error("  URL:", error.config.url || error.config.baseURL);
      console.error("  Method:", error.config.method);
    }
    
    console.error("=".repeat(80));
    
    if (Object.keys(errorDetails).length > 0) {
      try {
      console.error("Error details:", JSON.stringify(errorDetails, null, 2));
      } catch (stringifyError) {
        // Avoid circular reference errors
        console.error("Error details (could not stringify):", {
          status: errorDetails.status,
          statusText: errorDetails.statusText,
          code: errorDetails.code,
          dataType: typeof errorDetails.data,
        });
      }
    }
    
    // Add helpful error code and type for better client-side handling
    let errorCode = "TRANSACTION_FAILED";
    let errorType = "UNKNOWN_ERROR";
    
    if (errorMessage.includes("Missing required") || errorMessage.includes("Invalid")) {
      errorCode = "VALIDATION_ERROR";
      errorType = "VALIDATION_ERROR";
    } else if (errorMessage.includes("403") || errorMessage.includes("Forbidden") || errorMessage.includes("userToken")) {
      // Check errorDetails for Circle error code (more reliable than parsing message)
      const circleErrorCode = errorDetails?.data?.code || errorDetails?.code;
      const isExpired = circleErrorCode === 155104;
      const isInvalid = circleErrorCode === 155105;
      
      // Also check error message as fallback
      const messageIndicatesExpired = errorMessage.includes("expired") || errorMessage.includes("155104");
      const messageIndicatesInvalid = errorMessage.includes("invalid") || errorMessage.includes("155105");
      
      if (isExpired || messageIndicatesExpired) {
        errorCode = "TOKEN_EXPIRED";
        errorType = "AUTHENTICATION_ERROR";
      } else if (isInvalid || messageIndicatesInvalid) {
        errorCode = "TOKEN_INVALID";
        errorType = "AUTHENTICATION_ERROR";
      } else {
        errorCode = "AUTHENTICATION_FAILED";
        errorType = "AUTHENTICATION_ERROR";
      }
      statusCode = 403;
    } else if (errorMessage.includes("401") || errorMessage.includes("Authentication") || errorMessage.includes("user token")) {
      errorCode = "AUTHENTICATION_FAILED";
      errorType = "AUTHENTICATION_ERROR";
    } else if (errorMessage.includes("404") || errorMessage.includes("not found") || errorMessage.includes("Wallet not found")) {
      errorCode = "WALLET_NOT_FOUND";
      errorType = "NOT_FOUND_ERROR";
    } else if (errorMessage.includes("balance") || errorMessage.includes("insufficient")) {
      errorCode = "INSUFFICIENT_BALANCE";
      errorType = "BALANCE_ERROR";
    } else if (errorMessage.includes("challenge")) {
      errorCode = "CHALLENGE_REQUIRED";
      errorType = "CHALLENGE_ERROR";
    }
    
    // Safely serialize error details for response (avoid circular references)
    let safeErrorDetails: any = undefined;
    if (Object.keys(errorDetails).length > 0) {
      try {
        // Test if we can stringify it
        JSON.stringify(errorDetails);
        safeErrorDetails = errorDetails;
      } catch (stringifyError) {
        // Extract only safe, serializable properties
        safeErrorDetails = {
          status: errorDetails.status,
          statusText: errorDetails.statusText,
          code: errorDetails.code,
          message: errorDetails.data?.message || errorDetails.data?.error,
        };
      }
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        errorCode,
        errorType,
        details: safeErrorDetails,
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
    const userId = searchParams.get("userId");
    const userToken = searchParams.get("userToken");
    const limit = searchParams.get("limit") || "50";

    if (!transactionId && !walletId) {
      return NextResponse.json(
        { success: false, error: "transactionId or walletId is required" },
        { status: 400 }
      );
    }

    // For User-Controlled Wallets: Use SDK if we have userId/userToken
    if ((transactionId || walletId) && userId && userToken) {
      try {
        const userClient = getUserCircleClient();
        
        if (transactionId) {
          // Get single transaction using SDK
          console.log(`[GET Transaction] Using SDK for User-Controlled Wallet: ${transactionId}`);
          
          // Try getTransaction method (if available)
          let response: any;
          if (typeof (userClient as any).getTransaction === 'function') {
            response = await (userClient as any).getTransaction({
              userToken,
              id: transactionId,
            });
          } else {
            // Fallback: Try to get transaction by querying wallet transactions
            console.log(`[GET Transaction] getTransaction method not available, trying listTransactions...`);
            throw new Error("getTransaction method not available, falling back to REST API");
          }
          
          if (response?.data) {
            const txData = response.data;
            const blockchainHash = txData.txHash || txData.transactionHash || txData.hash || null;
            
            // Map to our format
            const mappedTransaction = {
              id: txData.id || transactionId,
              walletId: txData.walletId || walletId || "",
              status: (txData.state === "COMPLETED" || 
                      txData.state === "COMPLETE" ||
                      txData.state === "CONFIRMED" || 
                      txData.state === "SENT" ? "confirmed" :
                      txData.state === "FAILED" ? "failed" : "pending") as "pending" | "confirmed" | "failed",
              hash: blockchainHash || "",
              from: txData.sourceAddress || "",
              to: txData.destinationAddress || "",
              amount: txData.amounts?.[0] || txData.amount?.amount || "0",
              token: "USDC",
              timestamp: txData.createDate ? new Date(txData.createDate) : new Date(),
            };
            
            return NextResponse.json({
              success: true,
              data: {
                data: mappedTransaction,
              },
            });
          }
        } else if (walletId) {
          // List transactions for wallet using SDK
          console.log(`[GET Transactions] Using SDK for User-Controlled Wallet: ${walletId}`);
          
          // Try listTransactions method (if available)
          let response: any;
          if (typeof (userClient as any).listTransactions === 'function') {
            response = await (userClient as any).listTransactions({
              userToken,
              walletIds: [walletId],
            });
          } else {
            // Fallback: Method not available
            console.log(`[GET Transactions] listTransactions method not available, falling back to REST API...`);
            throw new Error("listTransactions method not available, falling back to REST API");
          }
          
          if (response?.data?.transactions) {
            const transactions = response.data.transactions
              .slice(0, parseInt(limit))
              .map((tx: any) => {
              const blockchainHash = tx.txHash || tx.transactionHash || tx.hash || null;
              return {
                id: tx.id,
                walletId: tx.walletId || walletId,
                status: (tx.state === "COMPLETED" || 
                        tx.state === "COMPLETE" ||
                        tx.state === "CONFIRMED" || 
                        tx.state === "SENT" ? "confirmed" :
                        tx.state === "FAILED" ? "failed" : "pending") as "pending" | "confirmed" | "failed",
                hash: blockchainHash || "",
                from: tx.sourceAddress || "",
                to: tx.destinationAddress || "",
                amount: tx.amounts?.[0] || tx.amount?.amount || "0",
                token: "USDC",
                timestamp: tx.createDate ? new Date(tx.createDate) : new Date(),
              };
            });
            
            return NextResponse.json({
              success: true,
              data: {
                data: transactions,
              },
            });
          }
        }
      } catch (sdkError: any) {
        console.error("[GET Transaction] SDK error:", sdkError);
        
        // Handle 404 errors gracefully - transaction might not be indexed yet
        const is404 = sdkError.response?.status === 404 || sdkError.status === 404 || 
                     sdkError.response?.data?.code === 156003;
        
        if (is404 && transactionId) {
          // Transaction not found yet - return pending status
          console.log(`[GET Transaction] Transaction ${transactionId} not found yet, returning pending status`);
          return NextResponse.json({
            success: true,
            data: {
              data: {
                id: transactionId,
                walletId: walletId || "",
                status: "pending" as const,
                hash: "",
                from: "",
                to: "",
                amount: "0",
                token: "USDC",
                timestamp: new Date(),
              },
            },
          });
        }
        
        // For other SDK errors, bubble up the status instead of falling back to developer endpoints
        const sdkStatus = sdkError.response?.status || sdkError.status || 500;
        const rawData = sdkError.response?.data;
        const rawString = typeof rawData === "string" ? rawData : "";
        const isRateLimited =
          sdkStatus === 429 ||
          rawString.includes("rate limited") ||
          rawString.includes("Error 1015");
        const derivedStatus = isRateLimited ? 429 : sdkStatus;
        // Check for specific error codes
        const circleErrorCode = sdkError.response?.data?.code;
        const isTokenExpired = circleErrorCode === 155104;
        const isTokenInvalid = circleErrorCode === 155105;
        
        let sdkMessage: string;
        let hint: string | undefined;
        
        if (isRateLimited) {
          sdkMessage = "Circle rate limit exceeded. Please reduce polling frequency and try again.";
          hint = "Circle temporarily blocked requests due to high frequency. Wait and retry with a longer polling interval.";
        } else if (isTokenExpired) {
          sdkMessage = "Your authentication token has expired. Tokens expire after 60 minutes for security.";
          hint = "Please refresh your token or create a new user session. Refresh using: REFRESH_USER_ID=your-user-id npm run refresh:user-token";
        } else if (isTokenInvalid) {
          sdkMessage = "Your authentication token is invalid.";
          hint = "Please create a new user session via /api/circle/users";
        } else if (sdkStatus === 401 || sdkStatus === 403) {
          sdkMessage = sdkError.response?.data?.message || "User token is invalid or expired.";
          hint = "Please recreate the user and rerun the PIN challenge, or refresh your token.";
        } else {
          sdkMessage = sdkError.response?.data?.message ||
            sdkError.message ||
            "Failed to fetch transactions from Circle SDK";
        }
        
        return NextResponse.json(
          {
            success: false,
            error: sdkMessage,
            errorCode: isTokenExpired ? "TOKEN_EXPIRED" : isTokenInvalid ? "TOKEN_INVALID" : "AUTHENTICATION_FAILED",
            errorType: "AUTHENTICATION_ERROR",
            details: {
              code: circleErrorCode,
              data: sdkError.response?.data,
              hint,
              isExpired: isTokenExpired,
              isInvalid: isTokenInvalid,
            },
          },
          { status: derivedStatus }
        );
      }
    }

    // Fallback to REST API for Developer-Controlled Wallets or if SDK fails
    let endpoint = "";
    if (transactionId) {
      endpoint = `/v1/w3s/transactions/${transactionId}`;
    } else if (walletId) {
      // Try multiple endpoints for compatibility
      // Try legacy endpoints first, then fallback to regular wallets endpoint
      // Add blockchain parameter to filter transactions on Arc Testnet
      // Try without blockchain filter first, then with filter if needed
      // Some transactions might not be immediately indexed with blockchain filter
      endpoint = `/v1/w3s/developer/wallets/${walletId}/transactions?limit=${limit}`;
    }

    try {
      let transactions: any;
      
      // For wallet transactions, try multiple endpoints if the first one fails
      if (walletId && !transactionId) {
        console.log(`[GET Transactions] Fetching transactions for walletId: ${walletId}, limit: ${limit}`);
        try {
          // Try 1: Developer-controlled wallets endpoint
          transactions = await circleApiRequest(endpoint, {
            method: "GET",
          });
          console.log(`[GET Transactions] ✅ Developer wallets endpoint - found ${transactions.data?.data?.length || 0} transactions`);
        } catch (devError: any) {
          console.log(`[GET Transactions] ⚠️ Developer wallets endpoint failed, trying regular wallets endpoint...`);
          // Try 2: Regular wallets endpoint
          try {
            endpoint = `/v1/w3s/wallets/${walletId}/transactions?limit=${limit}`;
            transactions = await circleApiRequest(endpoint, {
              method: "GET",
            });
            console.log(`[GET Transactions] ✅ Regular wallets endpoint - found ${transactions.data?.data?.length || 0} transactions`);
          } catch (regularError: any) {
            // Try 3: Developer transactions endpoint (all transactions for entity)
            console.log(`[GET Transactions] ⚠️ Regular wallets endpoint failed, trying developer transactions endpoint...`);
            try {
              endpoint = `/v1/w3s/developer/transactions?limit=${limit}`;
              transactions = await circleApiRequest(endpoint, {
                method: "GET",
              });
              console.log(`[GET Transactions] ✅ Developer transactions endpoint - found ${transactions.data?.data?.length || 0} transactions`);
              
              // Filter transactions by walletId if we got all developer transactions
              // Also filter by ARC-TESTNET blockchain if available, but include all if blockchain not specified
              if (transactions.data?.data) {
                const allTxs = Array.isArray(transactions.data.data) ? transactions.data.data : [transactions.data.data];
                console.log(`[GET Transactions] Filtering ${allTxs.length} transactions for wallet ${walletId}`);
                const filteredTxs = allTxs.filter((tx: any) => {
                  const actualTx = tx.transaction || tx;
                  const matchesWallet = actualTx.walletId === walletId;
                  // If blockchain field exists, prefer ARC-TESTNET, but include all if not specified
                  const blockchain = actualTx.blockchain || actualTx.chain || tx.blockchain || tx.chain;
                  const matchesBlockchain = !blockchain || blockchain === "ARC-TESTNET" || blockchain === "ARC";
                  
                  if (matchesWallet && matchesBlockchain) {
                    console.log(`[GET Transactions] ✓ Match: tx ${actualTx.id} for wallet ${actualTx.walletId}`);
                  }
                  
                  return matchesWallet && matchesBlockchain;
                });
                console.log(`[GET Transactions] Filtered down to ${filteredTxs.length} transactions`);
                transactions.data.data = filteredTxs;
              }
            } catch (devTxError: any) {
              console.error(`[GET Transactions] All endpoints failed:`, {
                developerWallets: devError.message,
                regularWallets: regularError.message,
                developerTransactions: devTxError.message,
              });
              throw devTxError; // Throw the last error
            }
          }
        }
      } else {
        // For single transaction lookup, use the endpoint directly
        try {
          transactions = await circleApiRequest(endpoint, {
            method: "GET",
          });
        } catch (txError: any) {
          // Handle 404 gracefully - transaction might not be indexed yet
          const is404 = txError.response?.status === 404 || 
                       txError.status === 404 ||
                       txError.message?.includes("Cannot find target transaction") ||
                       txError.message?.includes("Resource not found") ||
                       txError.response?.data?.code === 156003 ||
                       (txError.response?.data && typeof txError.response.data === 'object' && txError.response.data.code === 156003);
          
          if (is404 && transactionId) {
            // Transaction not found yet - return pending status
            console.log(`[GET Transaction] Transaction ${transactionId} not found via REST API, returning pending status`);
            return NextResponse.json({
              success: true,
              data: {
                data: {
                  id: transactionId,
                  walletId: walletId || "",
                  status: "pending" as const,
                  hash: "",
                  from: "",
                  to: "",
                  amount: "0",
                  token: "USDC",
                  timestamp: new Date(),
                },
              },
            });
          }
          throw txError; // Re-throw if not a 404
        }
      }

      // Extract blockchain hash and map Circle states to our status format
      const transactionsData = transactions as any;
      
      // Handle both single transaction and array of transactions
      // Circle API response structure: 
      // - Single: { data: { data: { transaction: {...} } } }
      // - List: { data: { data: [{ transaction: {...} }] } } or { data: [{ transaction: {...} }] }
      if (transactionsData.data) {
        // Check if data.data exists (nested structure)
        let innerData = transactionsData.data.data || transactionsData.data;
        
        // If innerData is an array, use it directly
        // If it's an object, check if it has a transaction field or is the transaction itself
        if (!Array.isArray(innerData) && innerData.transaction) {
          // Single transaction wrapped in transaction field
          innerData = [innerData];
        } else if (!Array.isArray(innerData) && innerData.id) {
          // Single transaction object (not wrapped)
          innerData = [innerData];
        }
        
        const txList = Array.isArray(innerData) ? innerData : [innerData];
        
        txList.forEach((txData: any) => {
          if (!txData) return;
          
          // Handle nested transaction object (Circle API wraps transaction in a transaction field)
          const actualTx = txData.transaction || txData;
          
          // Log raw transaction data for debugging
          console.log(`[GET Transaction] Raw transaction data:`, {
            id: actualTx.id || txData.id,
            state: actualTx.state || txData.state,
            status: actualTx.status || txData.status,
            txHash: actualTx.txHash || txData.txHash,
            transactionHash: actualTx.transactionHash || txData.transactionHash,
            onChainTxHash: actualTx.onChainTxHash || txData.onChainTxHash,
            hash: actualTx.hash || txData.hash,
          });
          
          // Extract blockchain hash from various possible fields
          // Circle API uses txHash field for the blockchain transaction hash
          const blockchainHash = actualTx.txHash ||
                                actualTx.transactionHash || 
                                actualTx.onChainTxHash || 
                                actualTx.hash ||
                                null;
          
          if (blockchainHash) {
            console.log(`[GET Transaction] Found blockchain hash: ${blockchainHash}`);
            // Add hash to response for easier access
            actualTx.transactionHash = blockchainHash;
            actualTx.txHash = blockchainHash;
            // Also add to outer object if it exists
            if (txData !== actualTx) {
              txData.transactionHash = blockchainHash;
            }
          }
          
          // Map Circle transaction state to our status format
          // Circle states: INITIATED, QUEUED, SENT, CONFIRMED, COMPLETE, COMPLETED, FAILED, etc.
          const circleState = actualTx.state || txData.state || actualTx.status || txData.status;
          let mappedStatus: "pending" | "confirmed" | "failed" = "pending";
          
          if (circleState === "COMPLETE" || circleState === "COMPLETED" || circleState === "CONFIRMED" || circleState === "SENT") {
            mappedStatus = "confirmed";
          } else if (circleState === "FAILED" || circleState === "DENIED" || circleState === "CANCELLED") {
            mappedStatus = "failed";
          } else {
            mappedStatus = "pending"; // INITIATED, QUEUED, etc.
          }
          
          // Add mapped status to response
          actualTx.status = mappedStatus;
          if (txData !== actualTx) {
            txData.status = mappedStatus;
          }
          
          // Ensure source and destination addresses are properly set for incoming transaction detection
          // Circle API may return these in different formats
          if (!actualTx.sourceAddress) {
            actualTx.sourceAddress = actualTx.source?.address || 
                                    actualTx.from?.address ||
                                    actualTx.from ||
                                    txData.sourceAddress ||
                                    txData.source?.address ||
                                    txData.from?.address ||
                                    txData.from ||
                                    "";
          }
          if (!actualTx.destinationAddress) {
            actualTx.destinationAddress = actualTx.destination?.address || 
                                         actualTx.to?.address ||
                                         actualTx.to ||
                                         txData.destinationAddress ||
                                         txData.destination?.address ||
                                         txData.to?.address ||
                                         txData.to ||
                                         "";
          }
          
          // Log transaction details for debugging
          console.log(`[GET Transactions] TX ${actualTx.id}:`, {
            from: actualTx.sourceAddress,
            to: actualTx.destinationAddress,
            amount: actualTx.amount?.amount || actualTx.amounts?.[0],
            status: mappedStatus,
            walletId: actualTx.walletId,
            blockchain: actualTx.blockchain || actualTx.chain,
          });
          
          // Also ensure amounts and token info are accessible
          if (actualTx.amounts && actualTx.amounts.length > 0 && !actualTx.amount) {
            actualTx.amount = { amount: actualTx.amounts[0], currency: actualTx.amount?.currency || "USDC" };
          }
          
          // Log transaction details for debugging
          console.log(`[GET Transaction] ${actualTx.id || txData.id} - Circle state: ${circleState} -> Mapped status: ${mappedStatus}`);
          console.log(`[GET Transaction] Hash: ${blockchainHash || 'none'}`);
          console.log(`[GET Transaction] Source: ${actualTx.sourceAddress || 'none'}`);
          console.log(`[GET Transaction] Destination: ${actualTx.destinationAddress || 'none'}`);
          console.log(`[GET Transaction] Amount: ${actualTx.amounts?.[0] || actualTx.amount?.amount || 'none'}`);
        });
      }

      return NextResponse.json({
        success: true,
        data: transactions,
      });
    } catch (apiError: any) {
      // Handle 404 gracefully - transaction might not be indexed yet
      const is404 = apiError.response?.status === 404 || apiError.status === 404 ||
                   apiError.message?.includes("Resource not found") ||
                   apiError.message?.includes("Cannot find target transaction") ||
                   apiError.response?.data?.code === 156003;
      
      if (is404) {
        if (transactionId) {
          // Single transaction not found - return pending status
          console.log(`[GET Transaction] Transaction ${transactionId} not found, returning pending status`);
          return NextResponse.json({
            success: true,
            data: {
              data: {
                id: transactionId,
                walletId: walletId || "",
                status: "pending" as const,
                hash: "",
                from: "",
                to: "",
                amount: "0",
                token: "USDC",
                timestamp: new Date(),
              },
            },
          });
        } else {
          // Wallet transactions not found - return empty array
          console.log(`[GET Transactions] No transactions found for wallet ${walletId}`);
          return NextResponse.json({
            success: true,
            data: {
              data: [],
            },
          });
        }
      }
      
      // Log other errors for debugging
      console.error("[GET Transaction] API error:", {
        status: apiError.response?.status || apiError.status,
        message: apiError.message,
        code: apiError.response?.data?.code,
      });
      
      throw apiError; // Re-throw other errors
    }
  } catch (error: any) {
    console.error("Error fetching transactions:", error);
    
    // Get transactionId and walletId from searchParams for error handling
    const { searchParams } = new URL(request.url);
    const errorTransactionId = searchParams.get("transactionId");
    const errorWalletId = searchParams.get("walletId");
    
    // Handle 404 errors gracefully - transaction might not be indexed yet
    const is404 = error.response?.status === 404 || 
                 error.status === 404 ||
                 error.message?.includes("Cannot find target transaction") ||
                 error.message?.includes("Resource not found") ||
                 error.response?.data?.code === 156003;
    
    if (is404) {
      if (errorTransactionId) {
        // Single transaction not found - return pending status
        console.log(`[GET Transaction] Transaction ${errorTransactionId} not found (outer catch), returning pending status`);
        return NextResponse.json({
          success: true,
          data: {
            data: {
              id: errorTransactionId,
              walletId: errorWalletId || "",
              status: "pending" as const,
              hash: "",
              from: "",
              to: "",
              amount: "0",
              token: "USDC",
              timestamp: new Date(),
            },
          },
        });
      } else {
        // Wallet transactions not found - return empty array
        return NextResponse.json({
          success: true,
          data: {
            data: [],
          },
        });
      }
    }
    
    // For other errors, return 500
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch transactions",
        details: error.response?.data || error,
      },
      { status: 500 }
    );
  }
}
