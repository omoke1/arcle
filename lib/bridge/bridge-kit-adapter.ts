/**
 * Bridge Kit Integration
 * 
 * Circle's Bridge Kit SDK provides simplified cross-chain transfers
 * Reference: https://developers.circle.com/bridge-kit
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

/**
 * Bridge USDC using Circle's Transfer API (Bridge Kit compatible interface)
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
  bridgeId: string;
  status: string;
  transactionHash?: string;
  estimatedTime?: string;
  progress?: number;
}> {
  // Use Circle's Transfer API which Bridge Kit uses under the hood
  // This is the recommended approach for developer-controlled wallets
  const { initiateBridge } = await import("./cctp-bridge");
  
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
}

/**
 * Get supported chains (Bridge Kit compatible)
 * 
 * Bridge Kit supports hundreds of bridge routes via CCTP
 * Reference: https://developers.circle.com/bridge-kit
 */
export function getSupportedChains(): string[] {
  // Bridge Kit supports hundreds of routes through CCTP
  // Common EVM chains:
  return [
    "Ethereum",
    "Base",
    "Arbitrum",
    "Polygon",
    "Avalanche",
    "Optimism",
    "Arc",
    // Non-EVM chains supported by Bridge Kit:
    "Solana",
  ];
}

/**
 * Check if a bridge route is supported
 */
export function isRouteSupported(fromChain: string, toChain: string): boolean {
  const supported = getSupportedChains();
  return supported.includes(fromChain) && supported.includes(toChain);
}

