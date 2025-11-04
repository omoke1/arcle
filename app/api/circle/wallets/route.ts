/**
 * Circle Wallets API Routes
 * 
 * Aligned with Circle API: https://developers.circle.com/wallets/docs
 * 
 * For User-Controlled Wallets (ERC-4337 Modular Wallets):
 * - Uses App ID and userToken
 * - Managed by users via UserController
 * 
 * For Developer-Controlled Wallets:
 * - Uses Entity Secret
 * - Managed by developers via DeveloperController
 */

import { NextRequest, NextResponse } from "next/server";
import { getCircleClient, getOrCreateWalletSet } from "@/lib/circle-sdk";

export interface CreateWalletRequest {
  idempotencyKey?: string;
  blockchains?: string[]; // e.g., ["ARC"] for Arc network
  userId?: string; // For user-controlled wallets
}

export interface CircleWalletResponse {
  data: {
    walletId: string;
    entityId: string;
    type: "EndUserWallet" | "DeveloperWallet";
    state: "LIVE" | "ARCHIVED";
    custodialWalletSetId?: string;
    userId?: string;
    createdAt: string;
  };
}

/**
 * POST /api/circle/wallets
 * Create a new wallet via Circle Programmable Wallets
 * 
 * Following Circle API documentation:
 * - User-Controlled Wallets: Create user first, then initialize, then create wallet
 * - Developer-Controlled Wallets: Create WalletSet first, then create wallets
 * 
 * Based on Circle API docs:
 * https://developers.circle.com/w3s/reference/createuser
 * https://developers.circle.com/w3s/reference/createwalletset
 * https://developers.circle.com/w3s/reference/createwallets
 */
export async function POST(request: NextRequest) {
  try {
    // Check if Circle API key is configured
    if (!process.env.NEXT_PUBLIC_CIRCLE_API_KEY) {
      console.error("Circle API key not configured");
      return NextResponse.json(
        {
          success: false,
          error: "Circle API key not configured. Please create a .env file with NEXT_PUBLIC_CIRCLE_API_KEY. See SETUP-ENV.md for instructions.",
        },
        { status: 500 }
      );
    }

    console.log("API Key found:", process.env.NEXT_PUBLIC_CIRCLE_API_KEY ? "Yes" : "No");
    console.log("Environment:", process.env.NEXT_PUBLIC_ENV || "sandbox");
    console.log("App ID:", process.env.NEXT_PUBLIC_CIRCLE_APP_ID || "Not set");
    console.log("Entity Secret:", process.env.CIRCLE_ENTITY_SECRET ? "Set" : "Not set");

    const body: CreateWalletRequest = await request.json();
    console.log("Request body:", body);
    
    // Generate idempotency key if not provided
    const idempotencyKey = body.idempotencyKey || crypto.randomUUID();
    const blockchains = body.blockchains || ["ETH-SEPOLIA"];

    // Use Circle SDK for developer-controlled wallets
    // This is more reliable than REST API for wallet creation
    
    if (!process.env.CIRCLE_ENTITY_SECRET) {
      return NextResponse.json(
        {
          success: false,
          error: "CIRCLE_ENTITY_SECRET is required for developer-controlled wallets. Run 'npm run generate-entity-secret' to generate one, then add it to your .env file.",
        },
        { status: 400 }
      );
    }

    // Note: Entity Secret registration is typically done via standalone script (npm run create-wallet)
    // We skip registration here and assume it's already registered
    // If registration is needed, it will fail during wallet set creation with error 156016
    console.log("Skipping Entity Secret registration - assuming already registered via standalone script");
    console.log("If you get error 156016, run: npm run create-wallet");

    const client = getCircleClient();
    
    // Step 2: Get or create a wallet set (AFTER Entity Secret registration)
    // Try to use existing wallet set from wallet-info.json first (from standalone script)
    let walletSetId: string;
    try {
      const fs = await import('fs');
      const path = await import('path');
      const walletInfoPath = path.join(process.cwd(), 'wallet-info.json');
      
      if (fs.existsSync(walletInfoPath)) {
        const walletInfo = JSON.parse(fs.readFileSync(walletInfoPath, 'utf-8'));
        if (walletInfo.walletSetId) {
          console.log(`Using existing wallet set from wallet-info.json: ${walletInfo.walletSetId}`);
          walletSetId = walletInfo.walletSetId;
        } else {
          throw new Error("No walletSetId in wallet-info.json");
        }
      } else {
        throw new Error("wallet-info.json not found");
      }
    } catch (error) {
      // Fallback: try to get or create wallet set via SDK
      console.log("wallet-info.json not found or invalid, trying to get/create wallet set via SDK...");
      console.log("Getting or creating wallet set...");
      try {
        const walletSet = await getOrCreateWalletSet();
        walletSetId = walletSet.id;
        console.log(`Using wallet set: ${walletSetId}`);
      } catch (sdkError: any) {
        // If SDK fails with 401, provide helpful error message
        if (sdkError?.status === 401 || sdkError?.response?.status === 401) {
          return NextResponse.json(
            {
              success: false,
              error: `Circle API authentication failed (401).\n\n` +
                `The API key is being rejected by Circle's sandbox API.\n\n` +
                `Possible solutions:\n` +
                `1. ✅ Verify your API key in Circle Console: https://console.circle.com/\n` +
                `   - Ensure it's active and not expired\n` +
                `   - Check it has "Developer-Controlled Wallets" permissions\n` +
                `2. ✅ Try creating a NEW API key in Circle Console\n` +
                `3. ✅ Use the existing wallet: Run 'npm run create-wallet' to use the standalone script\n` +
                `4. ✅ Check if wallet-info.json exists - it contains the wallet set ID\n\n` +
                `API Key ID: ${(process.env.CIRCLE_API_KEY || process.env.NEXT_PUBLIC_CIRCLE_API_KEY || '').split(':')[1] || 'unknown'}`,
              code: 401,
            },
            { status: 401 }
          );
        }
        throw sdkError;
      }
    }
    
    // Map blockchain names (we use "ARC-TESTNET" in SDK, but might receive "ARC" or "ETH-SEPOLIA")
    const blockchainMap: Record<string, string> = {
      "ARC": "ARC-TESTNET",
      "ARC-TESTNET": "ARC-TESTNET",
      "ETH-SEPOLIA": "ETH-SEPOLIA",
    };
    
    const mappedBlockchains = blockchains.map(b => blockchainMap[b] || b) as Array<"ARC-TESTNET" | "ETH-SEPOLIA">;
    
    // Create wallet using SDK
    console.log("Creating wallet with blockchains:", mappedBlockchains);
    
    let wallet: any;
    try {
      const walletResponse = await client.createWallets({
        blockchains: mappedBlockchains,
        count: 1,
        accountType: "SCA", // Smart Contract Account for programmability
        walletSetId: walletSetId,
        metadata: [
          {
            name: "ARCLE AI-Managed Wallet",
            refId: `arcle-wallet-${idempotencyKey.substring(0, 8)}`
          }
        ]
      });
      
      if (!walletResponse.data?.wallets || walletResponse.data.wallets.length === 0) {
        throw new Error("Failed to create wallet - no wallet returned from SDK");
      }
      
      wallet = walletResponse.data.wallets[0];
    } catch (createError: any) {
      // If wallet creation fails with 401, try to return existing wallet from wallet-info.json
      if (createError?.status === 401 || createError?.response?.status === 401) {
        console.log("Wallet creation failed with 401, trying to return existing wallet from wallet-info.json...");
        try {
          const fs = await import('fs');
          const path = await import('path');
          const walletInfoPath = path.join(process.cwd(), 'wallet-info.json');
          
          if (fs.existsSync(walletInfoPath)) {
            const walletInfo = JSON.parse(fs.readFileSync(walletInfoPath, 'utf-8'));
            if (walletInfo.walletId && walletInfo.address) {
              console.log(`Returning existing wallet from wallet-info.json: ${walletInfo.walletId}`);
              // Return existing wallet data
              const walletData = {
                data: {
                  walletId: walletInfo.walletId,
                  entityId: "",
                  type: "DeveloperWallet" as const,
                  state: "LIVE" as const,
                  custodialWalletSetId: walletInfo.walletSetId,
                  address: walletInfo.address,
                  blockchain: walletInfo.blockchain || "ARC-TESTNET",
                  createdAt: walletInfo.createdAt || new Date().toISOString(),
                }
              };

              return NextResponse.json(
                {
                  success: true,
                  data: walletData.data,
                  message: "Using existing wallet (wallet creation failed due to API authentication)",
                },
                { status: 200 }
              );
            }
          }
        } catch (fallbackError) {
          console.error("Fallback to existing wallet also failed:", fallbackError);
        }
      }
      
      // If fallback didn't work, throw the original error
      throw createError;
    }
    
    // Format response to match expected structure
    const walletData = {
      data: {
        walletId: wallet.id,
        entityId: wallet.entityId || "",
        type: "DeveloperWallet" as const,
        state: "LIVE" as const,
        custodialWalletSetId: walletSetId,
        address: wallet.address,
        blockchain: wallet.blockchain,
        createdAt: wallet.createDate || new Date().toISOString(),
      }
    };

    console.log("Wallet created successfully:", {
      walletId: walletData.data.walletId,
      address: walletData.data.address,
      blockchain: walletData.data.blockchain,
    });

    // Automatically request testnet tokens for new wallets on Arc testnet
    if (walletData.data.blockchain === "ARC-TESTNET" && walletData.data.address) {
      try {
        console.log("Requesting testnet tokens for new wallet...");
        await client.requestTestnetTokens({
          address: walletData.data.address,
          blockchain: "ARC-TESTNET",
          native: true,  // Request native tokens (for gas)
          usdc: true,    // Request USDC tokens
        });
        console.log("Testnet tokens requested successfully");
      } catch (tokenError: any) {
        // Log error but don't fail wallet creation if token request fails
        console.warn("Failed to request testnet tokens (non-critical):", tokenError?.message || tokenError);
        // Continue with wallet creation even if token request fails
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: walletData.data,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("=== ERROR CREATING WALLET ===");
    console.error("Error type:", error?.constructor?.name);
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    console.error("Full error:", error);
    
    // Extract error details from SDK response
    const errorData = (error as any)?.response?.data || (error as any)?.data;
    const errorCode = errorData?.code;
    const apiErrorMessage = errorData?.message;
    
    console.error("Error code:", errorCode);
    console.error("API error message:", apiErrorMessage);
    console.error("============================");

    const errorMessage = error instanceof Error ? error.message : "Failed to create wallet";
    
    // Handle Entity Secret registration error (code 156016) - must be first!
    if (errorCode === 156016 || 
        errorMessage.includes("156016") || 
        errorMessage.includes("entity secret has not been set yet") || 
        errorMessage.includes("provide encrypted ciphertext in the console") ||
        apiErrorMessage?.includes("entity secret has not been set yet")) {
      return NextResponse.json(
        {
          success: false,
          error: "Entity Secret not registered in Circle Console.\n\n" +
            "The Entity Secret must be registered before creating wallets:\n\n" +
            "1. Go to Circle Developer Console: https://console.circle.com/\n" +
            "2. Navigate to: Entity Settings → Security → Entity Secret\n" +
            "3. Register/upload the encrypted Entity Secret ciphertext\n\n" +
            "The SDK automatically encrypts your Entity Secret, but you need to register it in Console.\n\n" +
            "Alternatively, try the standalone script:\n" +
            "   npm run create-wallet\n\n" +
            "This may handle Entity Secret registration differently.",
          code: 156016,
        },
        { status: 403 }
      );
    }
    
    // Provide more helpful error messages
    if (errorMessage.includes("API key") || errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
      return NextResponse.json(
        {
          success: false,
          error: "Circle API key is invalid or missing. Please check your .env file and ensure the API key is correct.",
        },
        { status: 401 }
      );
    }
    
    if (errorMessage.includes("aborted") || errorMessage.includes("timeout") || errorMessage.includes("ERROR_USER_ABORTED")) {
      return NextResponse.json(
        {
          success: false,
          error: "Request timed out or was cancelled. This might be a temporary issue. Please try again in a moment.",
        },
        { status: 408 }
      );
    }
    
    // Handle Entity Secret registration error
    if (errorMessage.includes("156016") || errorMessage.includes("entity secret has not been set yet") || errorMessage.includes("provide encrypted ciphertext in the console")) {
      return NextResponse.json(
        {
          success: false,
          error: "Entity Secret not registered in Circle Console. You need to:\n\n1. Go to Circle Developer Console (https://console.circle.com/)\n2. Navigate to your Entity settings\n3. Register/upload your Entity Secret ciphertext\n4. The Entity Secret must be encrypted and registered before creating wallets.\n\nAlternatively, you can use the standalone script: `npm run create-wallet` which may handle this differently.",
        },
        { status: 403 }
      );
    }

    // Provide helpful guidance for authentication errors
    if (errorMessage.includes("401") || errorMessage.includes("Invalid credentials") || errorMessage.includes("Unauthorized")) {
      const hasAppId = !!process.env.NEXT_PUBLIC_CIRCLE_APP_ID;
      const hasEntitySecret = !!process.env.CIRCLE_ENTITY_SECRET;
      
      let guidance = "Authentication failed. ";
      if (!hasAppId && !hasEntitySecret) {
        guidance += "You need either an App ID (for user-controlled wallets) or Entity Secret (for developer-controlled wallets) from Circle Console.";
      } else if (hasAppId && !hasEntitySecret) {
        guidance += "User-controlled wallets may require additional setup. Check Circle Console to ensure your App is properly configured, or try using developer-controlled wallets with an Entity Secret.";
      } else if (!hasAppId && hasEntitySecret) {
        guidance += "Developer-controlled wallets require Entity Secret authentication. Ensure CIRCLE_ENTITY_SECRET is set correctly in your .env file.";
      }
      
      return NextResponse.json(
        {
          success: false,
          error: guidance + " See SETUP-ENV.md for instructions.",
        },
        { status: 401 }
      );
    }
    
    if (errorMessage.includes("404") || errorMessage.includes("Resource not found")) {
      const hasAppId = !!process.env.NEXT_PUBLIC_CIRCLE_APP_ID;
      let guidance = "Endpoint not found (404). ";
      
      if (hasAppId) {
        guidance += "For user-controlled wallets, this typically means:\n" +
          "1. Your App ID might not be correctly configured in Circle Console\n" +
          "2. User-controlled wallets may require client-side SDK initialization\n" +
          "3. The App might need additional setup in Circle Console\n\n" +
          "Consider:\n" +
          "- Verifying your App ID in Circle Console matches: " + process.env.NEXT_PUBLIC_CIRCLE_APP_ID + "\n" +
          "- Using developer-controlled wallets instead (requires Entity Secret)\n" +
          "- Implementing Circle's client SDK for user-controlled wallets";
      } else {
        guidance += "This endpoint requires either an App ID (for user-controlled wallets) or Entity Secret (for developer-controlled wallets).";
      }
      
      return NextResponse.json(
        {
          success: false,
          error: guidance,
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/circle/wallets
 * List wallets for the entity/user
 * 
 * Based on Circle API: GET /v1/w3s/wallets
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId"); // For user-controlled wallets
    const limit = searchParams.get("limit") || "10";
    const pageBefore = searchParams.get("pageBefore");
    const pageAfter = searchParams.get("pageAfter");

    // Use standard wallets endpoint for both types
    let endpoint = `/v1/w3s/wallets?limit=${limit}`;
    if (userId) {
      endpoint += `&userId=${userId}`;
    }
    if (pageBefore) {
      endpoint += `&pageBefore=${pageBefore}`;
    }
    if (pageAfter) {
      endpoint += `&pageAfter=${pageAfter}`;
    }

    const wallets = await circleApiRequest(endpoint, {
      method: "GET",
    });

    return NextResponse.json({
      success: true,
      data: wallets,
    });
  } catch (error) {
    console.error("Error fetching wallets:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch wallets",
      },
      { status: 500 }
    );
  }
}
