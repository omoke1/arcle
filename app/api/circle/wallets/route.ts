/**
 * Circle Wallets API Routes
 * 
 * Aligned with Circle API: https://developers.circle.com/wallets/docs
 * 
 * NETWORK: Arc Testnet (ARC-TESTNET) by default
 * - RPC: https://rpc.testnet.arc.network
 * - Explorer: https://testnet.arcscan.app
 * - Chain ID: 5042002
 * 
 * User-Controlled Wallets (ONLY OPTION)
 * - Uses App ID and userToken
 * - Users own and control their wallets via MPC
 * - Requires user creation first via /api/circle/users
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserCircleClient } from "@/lib/circle-user-sdk";
import { circleConfig, circleApiRequest } from "@/lib/circle";

export interface CreateWalletRequest {
  idempotencyKey?: string;
  blockchains?: string[]; // e.g., ["ARC"] for Arc network
  userId: string; // Required: User ID from Circle
  userToken: string; // Required: User token from Circle (get via /api/circle/users)
  forceNew?: boolean; // Not used for User-Controlled (each user has their own wallets)
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
 * User-Controlled Wallets Flow:
 * 1. Create user via /api/circle/users (returns userId and userToken)
 * 2. Create wallet with userId and userToken (this endpoint)
 * 
 * Based on Circle API docs:
 * https://developers.circle.com/w3s/reference/createuser
 * https://developers.circle.com/w3s/reference/createwallets
 */
export async function POST(request: NextRequest) {
  try {
    // Use circleConfig which has fallback to NEXT_PUBLIC_CIRCLE_API_KEY
    if (!circleConfig.apiKey) {
      console.error("Circle API key not configured");
      return NextResponse.json(
        {
          success: false,
          error: "Circle API key not configured. Set CIRCLE_API_KEY or NEXT_PUBLIC_CIRCLE_API_KEY in your .env file.",
        },
        { status: 500 }
      );
    }

    console.log("API Key found:", circleConfig.apiKey ? "Yes" : "No");
    console.log("Environment:", circleConfig.environment || "sandbox");
    console.log("App ID:", circleConfig.appId || "Not set");
    console.log("Entity Secret:", circleConfig.entitySecret ? "Set" : "Not set");

    const body: CreateWalletRequest = await request.json();
    console.log("Request body:", body);
    
    // Generate idempotency key if not provided
    const idempotencyKey = body.idempotencyKey || crypto.randomUUID();
    // DEFAULT TO ARC TESTNET - Only use mainnet if explicitly configured
    // Network: Arc Testnet (ARC-TESTNET)
    const blockchains = body.blockchains || ["ARC-TESTNET"];
    console.log(`🌐 Creating wallet on: ${blockchains.join(", ")} (default: ARC-TESTNET)`);

    // User-Controlled Wallets is now the ONLY option
    // Require userToken and userId
    if (!body.userToken || !body.userId) {
      return NextResponse.json(
        {
          success: false,
          error: "userToken and userId are required. Please create a user first via /api/circle/users",
        },
        { status: 400 }
      );
    }

    // ============================================
    // USER-CONTROLLED WALLETS (ONLY OPTION)
    // ============================================
    console.log("🌐 Creating User-Controlled Wallet");
    
    if (!circleConfig.appId) {
      return NextResponse.json(
        {
          success: false,
          error: "NEXT_PUBLIC_CIRCLE_APP_ID is required. Please set it in your .env file.",
        },
        { status: 400 }
      );
    }

    const userClient = getUserCircleClient();
    
    // Map blockchain names
    const blockchainMap: Record<string, string> = {
      "ARC": "ARC-TESTNET",
      "ARC-TESTNET": "ARC-TESTNET",
      "ETH-SEPOLIA": "ETH-SEPOLIA",
    };
    
    const mappedBlockchains = blockchains.map(b => blockchainMap[b] || b) as Array<"ARC-TESTNET" | "ETH-SEPOLIA">;
    
    // Create wallet challenge using User-Controlled SDK
    // For User-Controlled Wallets, this returns a challengeId that must be completed in the browser
    console.log("Creating User-Controlled wallet challenge with blockchains:", mappedBlockchains);
    
    try {
      // Check if user already has a PIN by checking their status
      let userHasPin = false;
      try {
        const userStatus = await (userClient as any).getUserStatus({
          userToken: body.userToken,
        });
        userHasPin = userStatus.data?.pinStatus === "ENABLED" || userStatus.data?.pinStatus === "LOCKED";
        console.log("User PIN status:", userStatus.data?.pinStatus);
      } catch (statusError) {
        console.log("Could not check user PIN status, assuming no PIN:", statusError);
      }

      // If user already has a PIN, check for existing wallets first
      if (userHasPin) {
        console.log("User already has PIN, checking for existing wallets...");
        
        // First, check if user already has wallets
        try {
          const existingWalletsResponse = await (userClient as any).listWallets({
            userToken: body.userToken,
            blockchain: mappedBlockchains[0], // Check for wallets on the requested blockchain
          });
          
          const existingWallets = existingWalletsResponse.data?.wallets || [];
          
          // If user already has a wallet on this blockchain, return it
          if (existingWallets.length > 0) {
            const wallet = existingWallets[0];
            console.log("User already has wallet, returning existing wallet:", {
              walletId: wallet.id,
              address: wallet.address,
            });
            
            return NextResponse.json(
              {
                success: true,
                data: {
                  wallet: {
                    id: wallet.id,
                    address: wallet.address,
                    state: wallet.state,
                    walletSetId: wallet.walletSetId,
                    custodyType: wallet.custodyType,
                    userId: body.userId,
                  },
                  userId: body.userId,
                  userToken: body.userToken,
                  blockchains: mappedBlockchains,
                },
              },
              { status: 200 }
            );
          }
        } catch (listError) {
          console.log("Error checking existing wallets, will create new one:", listError);
        }
        
        // User has PIN but no wallet - use createWallet (requires PIN verification challenge)
        console.log("User has PIN but no wallet, creating wallet challenge...");
        const walletChallengeResponse = await (userClient as any).createWallet({
          userToken: body.userToken,
          blockchains: mappedBlockchains,
          accountType: "SCA",
        });

        if (!walletChallengeResponse || !walletChallengeResponse.data) {
          throw new Error("Failed to create wallet challenge - no response from SDK");
        }

        const challengeId = walletChallengeResponse.data.challengeId;
        
        if (!challengeId) {
          throw new Error("Failed to create wallet challenge - no challengeId returned from SDK");
        }

        console.log("Wallet challenge created successfully (user has PIN):", {
          challengeId,
          userId: body.userId,
          blockchains: mappedBlockchains,
        });

        // Return challenge - user will need to verify PIN to complete wallet creation
        return NextResponse.json(
          {
            success: true,
            data: {
              challengeId,
              userId: body.userId,
              userToken: body.userToken,
              blockchains: mappedBlockchains,
              message: "Challenge created. Complete this challenge using Circle's W3sInitializeWidget to verify PIN and create wallet.",
              nextSteps: [
                "1. Use Circle's Web SDK (@circle-fin/w3s-pw-web-sdk)",
                "2. Initialize W3sInitializeWidget with this challengeId",
                "3. User verifies PIN in the widget",
                "4. Wallet is created automatically after PIN verification",
                "5. Retrieve wallet details using listWallets API"
              ]
            },
          },
          { status: 201 }
        );
      }

      // User doesn't have PIN yet - use createUserPinWithWallets to setup PIN and create wallet
      console.log("User doesn't have PIN, creating PIN + wallet challenge...");
      const challengeResponse = await (userClient as any).createUserPinWithWallets({
        userToken: body.userToken,
        blockchains: mappedBlockchains,
        accountType: "SCA", // Smart Contract Account
      });

      if (!challengeResponse || !challengeResponse.data) {
        throw new Error("Failed to create wallet challenge - no response from SDK");
      }

      const challengeId = challengeResponse.data.challengeId;
      
      if (!challengeId) {
        throw new Error("Failed to create wallet challenge - no challengeId returned from SDK");
      }

      console.log("Wallet challenge created successfully:", {
        challengeId,
        userId: body.userId,
        blockchains: mappedBlockchains,
      });

      // Return challenge information
      // Client must complete this challenge using Circle's Web SDK
      return NextResponse.json(
        {
          success: true,
          data: {
            challengeId,
            userId: body.userId,
            userToken: body.userToken,
            blockchains: mappedBlockchains,
            message: "Challenge created. Complete this challenge using Circle's W3sInitializeWidget to set up PIN and create wallet.",
            nextSteps: [
              "1. Use Circle's Web SDK (@circle-fin/w3s-pw-web-sdk)",
              "2. Initialize W3sInitializeWidget with this challengeId",
              "3. User completes PIN setup in the widget",
              "4. Wallet is created automatically after PIN setup",
              "5. Retrieve wallet details using listWallets API"
            ]
          },
        },
        { status: 201 }
      );
    } catch (error: any) {
      console.error("Error creating User-Controlled wallet challenge:", error);
      
      // Handle 409 error (user already initialized) gracefully
      const errorData = error.response?.data || error.data;
      if (errorData?.code === 155106 || errorData?.message?.includes("already been initialized")) {
        console.log("User already has PIN initialized, checking for existing wallets or creating new challenge...");
        
        try {
          // First check if user already has wallets
          const existingWalletsResponse = await (userClient as any).listWallets({
            userToken: body.userToken,
            blockchain: mappedBlockchains[0],
          });
          
          const existingWallets = existingWalletsResponse.data?.wallets || [];
          
          if (existingWallets.length > 0) {
            const wallet = existingWallets[0];
            return NextResponse.json(
              {
                success: true,
                data: {
                  wallet: {
                    id: wallet.id,
                    address: wallet.address,
                    state: wallet.state,
                    walletSetId: wallet.walletSetId,
                    custodyType: wallet.custodyType,
                    userId: body.userId,
                  },
                  userId: body.userId,
                  userToken: body.userToken,
                  blockchains: mappedBlockchains,
                },
              },
              { status: 200 }
            );
          }
          
          // User has PIN but no wallet - use createWallet (requires PIN verification)
          const walletChallengeResponse = await (userClient as any).createWallet({
            userToken: body.userToken,
            blockchains: mappedBlockchains,
            accountType: "SCA",
          });

          if (walletChallengeResponse?.data?.challengeId) {
            return NextResponse.json(
              {
                success: true,
                data: {
                  challengeId: walletChallengeResponse.data.challengeId,
                  userId: body.userId,
                  userToken: body.userToken,
                  blockchains: mappedBlockchains,
                  message: "Challenge created. Complete this challenge using Circle's W3sInitializeWidget to verify PIN and create wallet.",
                },
              },
              { status: 201 }
            );
          }
        } catch (fallbackError: any) {
          console.error("Error in fallback wallet creation:", fallbackError);
          // Fall through to return the original error
        }
      }
      
      return NextResponse.json(
        {
          success: false,
          error: error.message || "Failed to create User-Controlled wallet challenge",
          details: errorData || error,
        },
        { status: error.response?.status || 500 }
      );
    }
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
    
    // Provide helpful guidance for authentication errors
    if (errorMessage.includes("401") || errorMessage.includes("Invalid credentials") || errorMessage.includes("Unauthorized")) {
      const hasAppId = !!circleConfig.appId;
      
      let guidance = "Authentication failed. ";
      if (!hasAppId) {
        guidance += "NEXT_PUBLIC_CIRCLE_APP_ID is required for User-Controlled Wallets. Please set it in your .env file.";
      } else {
        guidance += "Check Circle Console to ensure your App ID is correctly configured and has User-Controlled Wallets permissions.";
      }
      
      return NextResponse.json(
        {
          success: false,
          error: guidance,
        },
        { status: 401 }
      );
    }
    
    if (errorMessage.includes("404") || errorMessage.includes("Resource not found")) {
      let guidance = "Endpoint not found (404). ";
      
      if (!circleConfig.appId) {
        guidance += "NEXT_PUBLIC_CIRCLE_APP_ID is required. Please set it in your .env file.";
      } else {
        guidance += "Your App ID might not be correctly configured in Circle Console. Verify it matches: " + circleConfig.appId.substring(0, 8) + "...";
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
    const userToken = searchParams.get("userToken"); // For user-controlled wallets
    const limit = searchParams.get("limit") || "10";
    const pageBefore = searchParams.get("pageBefore");
    const pageAfter = searchParams.get("pageAfter");

    // Use User-Controlled SDK if userToken provided
    if (userId && userToken) {
      const userClient = getUserCircleClient();
      const response = await (userClient as any).listWallets({
        userToken,
        pageSize: parseInt(limit),
        ...(pageBefore && { pageBefore }),
        ...(pageAfter && { pageAfter }),
      });

      return NextResponse.json({
        success: true,
        data: response.data || {},
      });
    }

    // Legacy: Use standard wallets endpoint for Developer-Controlled
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
