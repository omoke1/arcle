/**
 * Circle Bridge API Route
 * 
 * Handles cross-chain USDC transfers via CCTP for User-Controlled Wallets
 * 
 * IMPORTANT: Bridge Kit does NOT support Circle Wallets (User-Controlled, Developer-Controlled, or Modular).
 * For User-Controlled Wallets, we use Circle's Transfer API directly.
 * 
 * Updated with Bridge Kit v1.1.2 safety improvements:
 * - Route validation before attempting transfers (prevents fund loss)
 * - Clearer error messages with supported chains
 * - Unified error taxonomy
 * 
 * CCTP (Cross-Chain Transfer Protocol) works by:
 * 1. Burning USDC on the source chain
 * 2. Getting attestation from Circle's Attestation Service
 * 3. Minting USDC on the destination chain using the attestation
 * 
 * Reference: 
 * - https://developers.circle.com/cctp
 * - https://developers.circle.com/bridge-kit (Bridge Kit SDK - for self-custody wallets only)
 * - https://developers.circle.com/bridge-kit/tutorials/installation
 * 
 * Note: Bridge Kit is only for self-custody wallets (MetaMask, Phantom) or developer-controlled wallets.
 * For user-controlled wallets, Circle's Transfer API is used instead.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserCircleClient } from "@/lib/circle-user-sdk";
import { circleApiRequest, circleConfig } from "@/lib/circle";
import { generateUUID } from "@/lib/utils/uuid";
import { validateBridgeRoute, getSupportedChainsList } from "@/lib/bridge/bridge-kit-user-wallets";
import type { CCTPTransferResult } from "@/lib/archived/legacy-dev-controlled/cctp-implementation";
import { delegateExecution } from "@/lib/wallet/sessionKeys/delegateExecution";
import { isSessionKeysEnabled } from "@/lib/config/featureFlags";
import { checkSessionKeyStatus } from "@/lib/ai/sessionKeyHelper";
import { rateLimit } from "@/lib/api/rate-limit";

/**
 * Server-side token expiration check
 */
function checkTokenExpiryServer(token: string | null | undefined): {
  isExpired: boolean;
  isExpiringSoon: boolean;
  expiresAt: number | null;
} {
  if (!token) {
    return { isExpired: true, isExpiringSoon: true, expiresAt: null };
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { isExpired: true, isExpiringSoon: true, expiresAt: null };
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    const expiresAt = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    const bufferMs = 5 * 60 * 1000; // 5 minutes buffer

    return {
      isExpired: timeUntilExpiry <= 0,
      isExpiringSoon: timeUntilExpiry < bufferMs,
      expiresAt,
    };
  } catch (error) {
    console.error('[Bridge] Error parsing token:', error);
    return { isExpired: true, isExpiringSoon: true, expiresAt: null };
  }
}

/**
 * Refresh token server-side
 */
async function refreshTokenServer(userId: string): Promise<string | null> {
  try {
    const client = getUserCircleClient();
    const response = await client.createUserToken({ userId });

    if (!response.data?.userToken) {
      console.error('[Bridge] Failed to refresh token: No userToken in response');
      return null;
    }

    console.log('[Bridge] ✅ Token refreshed successfully');
    return response.data.userToken;
  } catch (error: any) {
    console.error('[Bridge] Token refresh failed:', error.message);
    return null;
  }
}

interface BridgeRequest {
  walletId: string;
  amount: string;
  fromChain: string;
  toChain: string;
  destinationAddress: string;
  idempotencyKey?: string;
  fastTransfer?: boolean; // Enable Fast Transfer mode (seconds vs 13-19 minutes)
  userId?: string; // Required for User-Controlled Wallets
  userToken?: string; // Required for User-Controlled Wallets
  agentId?: string; // Optional agent ID for session key lookup
}

const TESTNET_CHAIN_ALIAS_MAP: Record<string, string> = {
  BASE: "BASE-SEPOLIA",
  ETHEREUM: "ETHEREUM-SEPOLIA",
  ARBITRUM: "ARBITRUM-SEPOLIA",
  POLYGON: "POLYGON-AMOY",
  AVALANCHE: "AVALANCHE-FUJI",
};

function normalizeBridgeChain(
  chain: string | undefined,
  sourceChain: string
): string {
  if (!chain) return chain ?? "";
  const upper = chain.toUpperCase();
  const isTestnetSource = sourceChain.toUpperCase().includes("TESTNET") || sourceChain.toUpperCase().includes("SEPOLIA");
  if (isTestnetSource && TESTNET_CHAIN_ALIAS_MAP[upper]) {
    return TESTNET_CHAIN_ALIAS_MAP[upper];
  }
  return upper;
}

export async function POST(request: NextRequest) {
  try {
    // Basic IP-based rate limiting for bridge operations
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rl = await rateLimit(`circle:bridge:${ip}`, 10, 60); // 10 bridge ops/min/IP
    if (!rl.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded for bridge operations. Please wait a bit and try again.",
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": String(rl.remaining),
          },
        }
      );
    }

    const body: BridgeRequest = await request.json();
    
    const { walletId, amount, fromChain, toChain, destinationAddress, idempotencyKey, fastTransfer, userId, userToken } = body;
    const sourceChain = (fromChain || "ARC-TESTNET").toUpperCase();
    const targetChain = normalizeBridgeChain(toChain, sourceChain);

    // Validate required fields
    if (!walletId || !amount || !targetChain || !destinationAddress) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: walletId, amount, toChain, destinationAddress",
          errorCode: "MISSING_FIELDS",
          errorType: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    // SAFETY: Validate route BEFORE attempting any operations
    // This prevents fund loss on unsupported routes (Bridge Kit v1.1.2 improvement)
    const routeValidation = validateBridgeRoute(sourceChain, targetChain);
    if (!routeValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: routeValidation.error?.message || "Unsupported bridge route",
          errorCode: routeValidation.error?.code || "INVALID_CHAIN",
          errorType: "INVALID_CHAIN",
          recoverable: routeValidation.error?.recoverable ?? true,
          supportedChains: routeValidation.error?.supportedChains || getSupportedChainsList(),
          details: {
            fromChain,
            toChain,
            message: "Route validation failed. This prevents accidental fund loss on unsupported routes.",
          },
        },
        { status: 400 }
      );
    }

    // ⚠️ TOKEN EXPIRATION CHECK & REFRESH
    // Check if token is expired or expiring soon, refresh if needed
    let activeUserToken = userToken;
    if (userId && userToken) {
      const tokenStatus = checkTokenExpiryServer(userToken);
      
      if (tokenStatus.isExpired || tokenStatus.isExpiringSoon) {
        console.log('[Bridge] Token expired or expiring soon, refreshing...', {
          isExpired: tokenStatus.isExpired,
          isExpiringSoon: tokenStatus.isExpiringSoon,
          expiresAt: tokenStatus.expiresAt ? new Date(tokenStatus.expiresAt).toISOString() : null,
        });
        
        const refreshedToken = await refreshTokenServer(userId);
        if (refreshedToken) {
          activeUserToken = refreshedToken;
          console.log('[Bridge] ✅ Token refreshed, using new token');
        } else {
          return NextResponse.json(
            {
              success: false,
              error: "User token expired and could not be refreshed. Please re-authenticate.",
              errorCode: "TOKEN_EXPIRED",
              errorType: "AUTH_ERROR",
              recoverable: true,
            },
            { status: 401 }
          );
        }
      }
    }

    // Convert amount to decimal string (SDK expects decimal format)
    const amountDecimal = parseFloat(amount).toFixed(6);
    
    // Convert amount to smallest unit for session key checks (1 USDC = 1000000)
    const amountInSmallestUnit = (parseFloat(amount) * 1000000).toString();

    // Check if session keys can handle this bridge operation
    // Session keys can sign Gateway EIP-712 messages for cross-chain transfers (no PIN required)
    // Same-chain transfers can also bypass PIN with session keys
    if (isSessionKeysEnabled() && userId && activeUserToken) {
      try {
        const { checkSessionKeyStatus } = await import("@/lib/ai/sessionKeyHelper");
        const sessionStatus = await checkSessionKeyStatus(
          walletId,
          userId,
          activeUserToken,
          'bridge',
          amountInSmallestUnit
        );

        // For same-chain transfers, session keys can bypass PIN
        if (sourceChain === targetChain && sessionStatus.hasActiveSession && sessionStatus.canAutoExecute) {
          console.log("[Bridge] ✅ Same-chain transfer with active session, executing via session key");
          
          const { delegateExecution } = await import("@/lib/wallet/sessionKeys/delegateExecution");
          const result = await delegateExecution({
            walletId,
            userId,
            userToken: activeUserToken,
            action: 'transfer', // Same-chain uses transfer, not bridge
            amount: amountInSmallestUnit,
            destinationAddress,
          });

          if (result.success && result.executedViaSessionKey) {
            return NextResponse.json({
              success: true,
              data: {
                transactionHash: result.transactionHash,
                transactionId: result.transactionId,
                executedViaSessionKey: true,
                fromChain: sourceChain,
                toChain: targetChain,
                amount,
                destinationAddress,
              },
              message: "Transfer executed automatically via session key (no PIN required)",
            });
          }
        }
        // For cross-chain: Check if we can use session key for Gateway signing
        if (sourceChain !== targetChain && sessionStatus.hasActiveSession && sessionStatus.canAutoExecute) {
          console.log("[Bridge] ✅ Cross-chain Gateway transfer with active session - attempting PIN-less execution");
          
          // Get the session key for Gateway signing
          const { getAgentSessionKey } = await import('@/core/sessionKeys/agentSessionKeys');
          const agentId = body.agentId || 'inera'; // Use body.agentId if available
          const agentSessionKey = await getAgentSessionKey(walletId, userId, activeUserToken, agentId);
          
          if (agentSessionKey) {
            // Route through delegateExecution which will use session key for Gateway signing
            const { delegateExecution } = await import("@/lib/wallet/sessionKeys/delegateExecution");
            const result = await delegateExecution({
              walletId,
              userId,
              userToken: activeUserToken,
              action: 'gateway',
              amount: amountInSmallestUnit,
              destinationAddress,
              fromChain: sourceChain,
              toChain: targetChain,
              agentId: agentId,
            });

            if (result.success && result.executedViaSessionKey) {
              return NextResponse.json({
                success: true,
                data: {
                  transactionHash: result.transactionHash,
                  transactionId: result.transactionId,
                  executedViaSessionKey: true,
                  fromChain: sourceChain,
                  toChain: targetChain,
                  amount,
                  destinationAddress,
                },
                message: "Cross-chain bridge executed automatically via session key (no PIN required)",
              });
            }
          }
        }
      } catch (error: any) {
        console.error("[Bridge] Error checking session status:", error);
        // Fall through to regular flow
      }
    }

    // Get User-Controlled Wallets SDK client
    const userClient = getUserCircleClient();

    // Check if this is a same-chain transfer
    if (sourceChain === targetChain) {
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

      const response = await userClient.createTransaction({
        ...transactionRequest,
        userId: userId!,
        userToken: activeUserToken!,
      });
      
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
          fromChain: sourceChain,
          toChain: targetChain,
          amount,
        },
      });
    }

    // Cross-chain transfer via Gateway
    // For User-Controlled Wallets, we use Gateway API (not Transfer API)
    // Gateway works with user-controlled wallets using SDK's signTypedData (EIP-712)
    // No Entity Secret required! Session keys can sign EIP-712 messages (no PIN required)
    
    console.log("[Bridge] 🔄 Using Gateway for user-controlled wallet cross-chain transfer...");
      
    try {
      // Import Gateway implementation for user-controlled wallets
      const { 
        transferViaGatewayUser, 
        checkGatewayBalanceUser,
        isGatewayAvailable 
      } = await import("@/lib/gateway/gateway-sdk-implementation-user");
      
      // Check if Gateway supports this route
      if (!isGatewayAvailable(sourceChain, targetChain)) {
        return NextResponse.json(
          {
            success: false,
            error: `Gateway not available between ${sourceChain} and ${targetChain}`,
            errorCode: "GATEWAY_NOT_AVAILABLE",
            errorType: "ROUTE_NOT_SUPPORTED",
            details: {
              fromChain: sourceChain,
              toChain: targetChain,
              message: "Gateway does not support this route. Check supported chains.",
            },
          },
          { status: 400 }
        );
      }
      
      // Get wallet address
      let walletAddress: string | undefined;
      try {
        const walletResponse = await circleApiRequest<any>(
          `/v1/w3s/wallets/${walletId}`,
          {
            method: "GET",
            headers: {
              "X-User-Token": activeUserToken!,
            },
          }
        );
        const walletData = walletResponse.data as any;
        walletAddress = walletData?.address || walletData?.wallet?.address || walletData?.data?.address;
        
        if (!walletAddress && walletData?.addresses && walletData.addresses.length > 0) {
          // Find address for source chain
          const chainAddress = walletData.addresses.find(
            (addr: any) =>
              addr.chain?.toUpperCase() === sourceChain ||
              addr.chain?.toUpperCase() === sourceChain.replace("-TESTNET", "")
          );
          walletAddress = chainAddress?.address || walletData.addresses[0]?.address;
        }
      } catch (walletError) {
        console.error("[Bridge] Error getting wallet address:", walletError);
        return NextResponse.json(
          {
            success: false,
            error: "Could not retrieve wallet address",
            errorCode: "WALLET_ADDRESS_NOT_FOUND",
          },
          { status: 400 }
        );
      }
      
      if (!walletAddress) {
        return NextResponse.json(
          {
            success: false,
            error: "Wallet address not found",
            errorCode: "WALLET_ADDRESS_NOT_FOUND",
          },
          { status: 400 }
        );
      }
        
        // Check Gateway balance
        console.log(`[Bridge] Checking Gateway balance for ${walletAddress} on ${sourceChain}...`);
        const gatewayBalance = await checkGatewayBalanceUser(walletAddress, sourceChain);
        const requiredAmount = parseFloat(amount);
        
        if (gatewayBalance < requiredAmount) {
          // Auto-deposit to Gateway if balance is insufficient
          // Gateway requires one-time deposit before transfers
          console.log(`[Bridge] Gateway balance insufficient (${gatewayBalance} < ${requiredAmount}). Initiating deposit...`);
          
          try {
            const { depositToGatewayUser } = await import("@/lib/gateway/gateway-sdk-implementation-user");
            
            // Deposit the required amount (with a small buffer for fees)
            const depositAmount = (requiredAmount * 1.1).toFixed(6); // 10% buffer
            
            console.log(`[Bridge] Depositing ${depositAmount} USDC to Gateway...`);
            
            // Try to get session key for deposit (reduces PIN prompts)
            let depositSessionKey: any = null;
            if (isSessionKeysEnabled() && userId && activeUserToken) {
              try {
                const { getAgentSessionKey } = await import('@/core/sessionKeys/agentSessionKeys');
                const agentId = body.agentId || 'inera';
                depositSessionKey = await getAgentSessionKey(walletId, userId, activeUserToken, agentId);
              } catch (error) {
                console.warn('[Bridge] Could not get session key for deposit, will use regular flow');
              }
            }
            
            const depositResult = await depositToGatewayUser(
              userId!,
              activeUserToken!,
              walletId,
              sourceChain,
              depositAmount,
              depositSessionKey // Pass session key to reduce PIN prompts
            );
            
            if (!depositResult.success) {
              return NextResponse.json(
                {
                  success: false,
                  error: `Failed to deposit to Gateway: ${depositResult.error}`,
                  errorCode: "GATEWAY_DEPOSIT_FAILED",
                  errorType: "DEPOSIT_ERROR",
                  details: {
                    fromChain: sourceChain,
                    toChain: targetChain,
                    walletAddress,
                    currentBalance: gatewayBalance,
                    requiredAmount,
                    depositAmount,
                    message: "Gateway deposit failed. Please try depositing manually using /api/circle/gateway-user with action=deposit",
                  },
                },
                { status: 400 }
              );
            }
            
            // Deposit initiated - requires user to complete approval and deposit challenges
            return NextResponse.json({
              success: true,
              data: {
                challengeId: depositResult.challengeId,
                requiresChallenge: true,
                requiresDeposit: true,
                status: "depositing",
                walletId: walletId,
                fromChain: sourceChain,
                toChain: targetChain,
                amount: amount,
                depositAmount,
                method: "gateway",
              },
              message: "Gateway deposit initiated. Please complete the approval and deposit challenges (PIN) to proceed. After deposit is complete, retry the bridge transfer.",
            });
          } catch (depositError: any) {
            console.error("[Bridge] Auto-deposit error:", depositError);
            return NextResponse.json(
              {
                success: false,
                error: `Insufficient Gateway balance and auto-deposit failed: ${depositError.message}`,
                errorCode: "INSUFFICIENT_GATEWAY_BALANCE",
                errorType: "BALANCE_ERROR",
                details: {
                  fromChain: sourceChain,
                  toChain: targetChain,
                  walletAddress,
                  currentBalance: gatewayBalance,
                  requiredAmount,
                  depositError: depositError.message,
                  message: "Please deposit USDC to Gateway first using /api/circle/gateway-user with action=deposit",
                  gatewayDepositEndpoint: "/api/circle/gateway-user",
                },
              },
              { status: 400 }
            );
          }
        }
        
      // Get session key for Gateway transfer (if available) to avoid PIN prompts
      let gatewaySessionKey: any = null;
      if (isSessionKeysEnabled() && userId && activeUserToken) {
        try {
          const { getAgentSessionKey } = await import('@/core/sessionKeys/agentSessionKeys');
          const agentId = body.agentId || 'inera';
          gatewaySessionKey = await getAgentSessionKey(walletId, userId, activeUserToken, agentId);
          if (gatewaySessionKey) {
            console.log(`[Bridge] ✅ Session key available for Gateway transfer (no PIN required)`);
          }
        } catch (error) {
          console.warn('[Bridge] Could not get session key for Gateway transfer, will use regular flow:', error);
        }
      }
      
      // Initiate Gateway transfer
      console.log(`[Bridge] Initiating Gateway transfer: ${amount} USDC from ${sourceChain} to ${targetChain}`);
        
      const gatewayResult = await transferViaGatewayUser({
        userId: userId!,
        userToken: activeUserToken!,
        walletId: walletId,
        walletAddress: walletAddress,
        amount: amount,
        fromChain: sourceChain,
        toChain: targetChain,
        destinationAddress: destinationAddress,
      }, gatewaySessionKey); // Pass session key for PIN-less execution
        
      if (!gatewayResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: gatewayResult.error || "Gateway transfer failed",
            errorCode: "GATEWAY_TRANSFER_FAILED",
            details: {
              fromChain: sourceChain,
              toChain: targetChain,
              walletAddress,
            },
          },
          { status: 400 }
        );
      }
      
      // Gateway transfer result
      if (gatewayResult.status === "completed") {
        // Transfer completed via session key (no PIN required)
        return NextResponse.json({
          success: true,
          data: {
            executedViaSessionKey: !!gatewaySessionKey,
            status: "completed",
            walletId: walletId,
            destinationAddress: destinationAddress,
            amount: amount,
            fromChain: sourceChain,
            toChain: targetChain,
            method: "gateway",
            attestation: gatewayResult.attestation,
          },
          message: gatewaySessionKey 
            ? "Gateway transfer completed automatically via session key (no PIN required)"
            : "Gateway transfer completed successfully",
        });
      } else {
        // Gateway transfer initiated - requires user to complete signing challenge (if no session key)
        return NextResponse.json({
          success: true,
          data: {
            challengeId: gatewayResult.challengeId,
            requiresChallenge: true,
            burnIntent: gatewayResult.burnIntent,
            status: "signing",
            walletId: walletId,
            destinationAddress: destinationAddress,
            amount: amount,
            fromChain: sourceChain,
            toChain: targetChain,
            method: "gateway",
          },
          message: gatewaySessionKey
            ? "Gateway transfer initiated with session key"
            : "Gateway transfer initiated. Please complete the signing challenge (PIN) to proceed. After signing, call /api/circle/gateway-user with action=submit to complete the transfer.",
        });
      }
    } catch (gatewayError: any) {
      console.error("[Bridge] Gateway error:", gatewayError);
      return NextResponse.json(
        {
          success: false,
          error: `Gateway transfer failed: ${gatewayError.message}`,
          errorCode: "GATEWAY_ERROR",
          errorType: "TRANSFER_FAILED",
          details: {
            fromChain: sourceChain,
            toChain: targetChain,
            walletId,
            gatewayError: gatewayError.message,
            message: "Gateway transfer failed. Gateway is the recommended approach for user-controlled wallets.",
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
