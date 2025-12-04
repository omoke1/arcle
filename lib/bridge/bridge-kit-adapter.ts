/**
 * Bridge Kit Integration
 * 
 * Circle's Bridge Kit SDK provides simplified cross-chain transfers
 * Reference: https://developers.circle.com/bridge-kit
 * 
 * Latest Updates (2025-01-XX):
 * - v1.1.2: Prevents fund loss on unsupported routes (fails safely before burn)
 * - Clearer error messages with supported chains list
 * - Correct error codes (INVALID_CHAIN) for consistent handling
 * - Unified error taxonomy (codes, types, recoverability)
 * 
 * IMPORTANT: Bridge Kit is designed for user-controlled wallets (MetaMask, Phantom, etc.)
 * For Developer-Controlled Wallets, we use Circle's Transfer API directly,
 * which Bridge Kit uses under the hood for CCTP transfers.
 * 
 * The Transfer API automatically handles:
 * - CCTP (Cross-Chain Transfer Protocol)
 * - Hundreds of bridge routes
 * - Zero-slippage 1:1 USDC transfers
 * 
 * This adapter provides a Bridge Kit-inspired interface while using
 * the Transfer API for developer-controlled wallets.
 */

import { circleConfig } from "@/lib/circle";
import { validateBridgeRoute, getSupportedChainsList } from "./bridge-kit-user-wallets";

/**
 * Bridge USDC using Circle's Transfer API (Bridge Kit compatible interface)
 * 
 * Updated with Bridge Kit v1.1.2 safety improvements:
 * - Route validation before attempting transfers
 * - Better error messages with supported chains
 * 
 * For developer-controlled wallets, we use Circle's Transfer API
 * which automatically handles CCTP - the same protocol Bridge Kit uses.
 * 
 * Reference: https://developers.circle.com/w3s/reference/createtransfer
 */
export async function bridgeWithKit(params: {
  fromChain: string;
  toChain: string;
  amount: string;
  destinationAddress: string;
  walletId: string;
}): Promise<{
  bridgeId?: string;
  status: string;
  transactionHash?: string;
  estimatedTime?: string;
  progress?: number;
  error?: {
    code: string;
    type: string;
    message: string;
    recoverable: boolean;
    supportedChains?: string[];
  };
}> {
  // SAFETY: Validate route BEFORE attempting any operations
  // This prevents fund loss on unsupported routes (Bridge Kit v1.1.2 improvement)
  const routeValidation = validateBridgeRoute(params.fromChain, params.toChain);
  if (!routeValidation.valid) {
    return {
      status: 'error',
      error: {
        code: routeValidation.error?.code || 'INVALID_CHAIN',
        type: 'INVALID_CHAIN',
        message: routeValidation.error?.message || 'Unsupported bridge route',
        recoverable: routeValidation.error?.recoverable ?? true,
        supportedChains: routeValidation.error?.supportedChains || getSupportedChainsList(),
      },
    };
  }

  // Use Circle's Transfer API which Bridge Kit uses under the hood
  // This is the recommended approach for developer-controlled wallets
  const { initiateBridge } = await import("./cctp-bridge");
  
  try {
  const result = await initiateBridge({
    walletId: params.walletId,
    amount: params.amount,
    fromChain: params.fromChain as any,
    toChain: params.toChain as any,
    destinationAddress: params.destinationAddress,
  });

  return {
    bridgeId: result.bridgeId,
    status: result.status,
    transactionHash: result.transactionHash,
    estimatedTime: result.estimatedTime,
    progress: result.progress,
  };
  } catch (error: any) {
    // Return error with unified taxonomy
    return {
      status: 'error',
      error: {
        code: error.code || 'BRIDGE_FAILED',
        type: 'NETWORK_ERROR',
        message: error.message || 'Bridge operation failed',
        recoverable: true,
        supportedChains: getSupportedChainsList(),
      },
    };
  }
}

/**
 * Get supported chains (Bridge Kit compatible)
 * 
 * Bridge Kit supports hundreds of bridge routes via CCTP
 * Updated with latest supported chains from Bridge Kit v1.1.2
 * Reference: https://developers.circle.com/bridge-kit
 */
export function getSupportedChains(): string[] {
  // Use the centralized list from bridge-kit-user-wallets
  return getSupportedChainsList();
}

/**
 * Check if a bridge route is supported
 * Uses the new validation function for consistency
 */
export function isRouteSupported(fromChain: string, toChain: string): boolean {
  const validation = validateBridgeRoute(fromChain, toChain);
  return validation.valid;
}

