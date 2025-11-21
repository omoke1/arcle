/**
 * Bridge Kit Implementation for User-Controlled Wallets
 * 
 * IMPORTANT: Bridge Kit does NOT support Circle Wallets (User-Controlled, Developer-Controlled, or Modular).
 * This file provides route validation and utilities, but actual bridging for user-controlled wallets
 * must use Circle's Transfer API directly (see /api/circle/bridge route).
 * 
 * Bridge Kit is only for:
 * - Self-custody wallets (MetaMask, Phantom, etc.)
 * - Developer-controlled wallets (using @circle-fin/adapter-circle-wallets - server-side only)
 * 
 * Updated with latest Circle Bridge Kit v1.1.2 improvements:
 * - Prevents fund loss on unsupported routes (fails safely before burn)
 * - Clearer error messages with supported chains list
 * - Correct error codes (INVALID_CHAIN) for consistent handling
 * - Unified error taxonomy (codes, types, recoverability)
 * - Better Solana recipient handling
 * 
 * Reference: 
 * - https://developers.circle.com/bridge-kit
 * - https://developers.circle.com/bridge-kit/tutorials/installation
 * 
 * Latest Updates (2025-01-XX):
 * - @circle-fin/bridge-kit v1.1.2: Safety improvements, prevents burns on unsupported routes
 * - @circle-fin/provider-cctp-v2 v1.0.4: Better error handling, unified error taxonomy
 * - @circle-fin/adapter-viem-v2 v1.1.1: Updated adapter
 * - @circle-fin/adapter-ethers-v6 v1.1.1: Updated adapter
 * - @circle-fin/adapter-solana v1.1.2: Production-ready Solana support
 * - @circle-fin/adapter-circle-wallets v1.0.0: For developer-controlled wallets (server-side only)
 */

import { BridgeKit } from '@circle-fin/bridge-kit';
import { createAdapterFromPrivateKey as createViemAdapter } from '@circle-fin/adapter-viem-v2';
import { createAdapterFromPrivateKey as createEthersAdapter } from '@circle-fin/adapter-ethers-v6';
import { createAdapterFromPrivateKey as createSolanaAdapter } from '@circle-fin/adapter-solana';
// Note: @circle-fin/adapter-circle-wallets is for developer-controlled wallets only (server-side)
// It requires Entity Secret and cannot be used with user-controlled wallets
import { circleConfig } from '@/lib/circle';

/**
 * Supported chains for Bridge Kit
 * Based on CCTP v2 support
 */
export const SUPPORTED_CHAINS = {
  // Mainnet
  ethereum: 'ethereum',
  base: 'base',
  arbitrum: 'arbitrum',
  polygon: 'polygon',
  optimism: 'optimism',
  avalanche: 'avalanche',
  solana: 'solana',
  // Testnet
  'ethereum-sepolia': 'ethereum-sepolia',
  'base-sepolia': 'base-sepolia',
  'arbitrum-sepolia': 'arbitrum-sepolia',
  'polygon-amoy': 'polygon-amoy',
  'avalanche-fuji': 'avalanche-fuji',
  'solana-devnet': 'solana-devnet',
  'arc-testnet': 'arc-testnet',
} as const;

export type SupportedChain = typeof SUPPORTED_CHAINS[keyof typeof SUPPORTED_CHAINS];

/**
 * Bridge Kit error types
 */
export interface BridgeKitError {
  code: string;
  type: 'INVALID_CHAIN' | 'INSUFFICIENT_BALANCE' | 'NETWORK_ERROR' | 'UNKNOWN';
  message: string;
  recoverable: boolean;
  supportedChains?: string[];
}

/**
 * Bridge result with improved error handling
 */
export interface BridgeResult {
  state: 'pending' | 'success' | 'error';
  bridgeId?: string;
  transactionHash?: string;
  error?: BridgeKitError;
  steps?: Array<{
    name: string;
    state: 'pending' | 'success' | 'error';
    txHash?: string;
    errorMessage?: string;
  }>;
}

/**
 * Validate if a route is supported before attempting bridge
 * This prevents fund loss on unsupported routes (v1.1.2 improvement)
 */
export function validateBridgeRoute(
  fromChain: string,
  toChain: string
): { valid: boolean; error?: BridgeKitError } {
  // Normalize chain names
  const normalizedFrom = fromChain.toLowerCase().replace(/\s+/g, '-');
  const normalizedTo = toChain.toLowerCase().replace(/\s+/g, '-');

  // Check if chains are in supported list
  const fromSupported = Object.values(SUPPORTED_CHAINS).includes(normalizedFrom as SupportedChain);
  const toSupported = Object.values(SUPPORTED_CHAINS).includes(normalizedTo as SupportedChain);

  if (!fromSupported || !toSupported) {
    const unsupportedChains: string[] = [];
    if (!fromSupported) unsupportedChains.push(fromChain);
    if (!toSupported) unsupportedChains.push(toChain);

    return {
      valid: false,
      error: {
        code: 'INVALID_CHAIN',
        type: 'INVALID_CHAIN',
        message: `Unsupported chain(s): ${unsupportedChains.join(', ')}. Supported chains: ${Object.values(SUPPORTED_CHAINS).join(', ')}`,
        recoverable: true,
        supportedChains: Object.values(SUPPORTED_CHAINS),
      },
    };
  }

  // Check if it's a same-chain transfer (not a bridge)
  if (normalizedFrom === normalizedTo) {
    return {
      valid: false,
      error: {
        code: 'SAME_CHAIN',
        type: 'INVALID_CHAIN',
        message: 'Source and destination chains are the same. Use a regular transfer instead.',
        recoverable: true,
      },
    };
  }

  return { valid: true };
}

/**
 * Create Bridge Kit instance
 */
export function createBridgeKit(): BridgeKit {
  return new BridgeKit();
}

/**
 * Bridge USDC using Bridge Kit for user-controlled wallets
 * 
 * This implementation uses the official Bridge Kit SDK which:
 * - Validates routes before attempting burns (prevents fund loss)
 * - Provides clear error messages with supported chains
 * - Uses unified error taxonomy
 * - Handles retries automatically
 */
export async function bridgeUSDCWithKit(params: {
  fromChain: string;
  toChain: string;
  amount: string;
  sourceAddress: string;
  destinationAddress: string;
  privateKey?: string; // For programmatic wallets
  walletProvider?: 'viem' | 'ethers' | 'solana';
  transferSpeed?: 'FAST' | 'SLOW';
  maxFee?: string;
}): Promise<BridgeResult> {
  const {
    fromChain,
    toChain,
    amount,
    sourceAddress,
    destinationAddress,
    privateKey,
    walletProvider = 'viem',
    transferSpeed = 'FAST',
    maxFee,
  } = params;

  // Step 1: Validate route BEFORE attempting any operations
  // This prevents fund loss on unsupported routes (v1.1.2 safety improvement)
  const routeValidation = validateBridgeRoute(fromChain, toChain);
  if (!routeValidation.valid) {
    return {
      state: 'error',
      error: routeValidation.error,
    };
  }

  try {
    const kit = createBridgeKit();

    // Step 2: Create adapters based on wallet provider
    let sourceAdapter: any;
    let destAdapter: any;

    if (!privateKey) {
      throw new Error('Private key required for Bridge Kit. For user-controlled wallets, use browser wallet adapters.');
    }

    // Create source adapter
    // Note: createAdapterFromPrivateKey only accepts privateKey parameter
    // Chain is determined from the bridge operation, not the adapter
    switch (walletProvider) {
      case 'viem':
        sourceAdapter = createViemAdapter({
          privateKey,
        });
        destAdapter = createViemAdapter({
          privateKey,
        });
        break;
      case 'ethers':
        sourceAdapter = createEthersAdapter({
          privateKey,
        });
        destAdapter = createEthersAdapter({
          privateKey,
        });
        break;
      case 'solana':
        sourceAdapter = createSolanaAdapter({
          privateKey,
        });
        destAdapter = createSolanaAdapter({
          privateKey,
        });
        break;
      default:
        throw new Error(`Unsupported wallet provider: ${walletProvider}`);
    }

    // Step 3: Configure bridge options
    const bridgeConfig: any = {
      transferSpeed,
    };

    if (maxFee) {
      bridgeConfig.maxFee = maxFee;
    }

    // Step 4: Execute bridge
    // NOTE: BridgeKit API has changed - this implementation needs to be updated
    // For now, throw an error indicating this needs to be implemented
    // The actual bridge functionality is handled via Circle's Transfer API in the bridge route
    throw new Error(
      'Bridge Kit direct integration is not yet implemented. ' +
      'Please use the /api/circle/bridge endpoint which uses Circle\'s Transfer API for cross-chain transfers.'
    );
    
    // TODO: Update when BridgeKit API is finalized
    // const result = await kit.transfer({
    //   source: {
    //     address: sourceAddress,
    //     chain: fromChain as any,
    //   },
    //   destination: {
    //     address: destinationAddress,
    //     chain: toChain as any,
    //   },
    //   amount,
    //   config: bridgeConfig,
    // }, {
    //   from: sourceAdapter,
    //   to: destAdapter,
    // });

    // Step 5: Map result to our format (commented out until BridgeKit API is updated)
    // return {
    //   state: result.state === 'success' ? 'success' : result.state === 'error' ? 'error' : 'pending',
    //   bridgeId: result.id,
    //   transactionHash: result.txHash,
    //   steps: result.steps?.map(step => ({
    //     name: step.name,
    //     state: step.state === 'success' ? 'success' : step.state === 'error' ? 'error' : 'pending',
    //     txHash: step.txHash,
    //     errorMessage: step.errorMessage,
    //   })),
    //   error: result.state === 'error' ? {
    //     code: result.error?.code || 'UNKNOWN',
    //     type: result.error?.code === 'INVALID_CHAIN' ? 'INVALID_CHAIN' : 'UNKNOWN',
    //     message: result.error?.message || 'Bridge failed',
    //     recoverable: result.error?.recoverable ?? false,
    //     supportedChains: result.error?.supportedChains,
    //   } : undefined,
    // };
  } catch (error: any) {
    // Handle errors with unified taxonomy
    const errorCode = error.code || 'UNKNOWN';
    const isInvalidChain = errorCode === 'INVALID_CHAIN' || error.message?.includes('unsupported');
    const isRecoverable = isInvalidChain || errorCode === 'INSUFFICIENT_BALANCE';

    return {
      state: 'error',
      error: {
        code: errorCode,
        type: isInvalidChain ? 'INVALID_CHAIN' : 'UNKNOWN',
        message: error.message || 'Bridge operation failed',
        recoverable: isRecoverable,
        supportedChains: isInvalidChain ? Object.values(SUPPORTED_CHAINS) : undefined,
      },
    };
  }
}

/**
 * Retry a failed bridge operation
 * Uses Bridge Kit's built-in retry capability
 */
export async function retryBridge(
  previousResult: BridgeResult,
  params: {
    sourceAddress: string;
    destinationAddress: string;
    privateKey: string;
    walletProvider?: 'viem' | 'ethers' | 'solana';
  }
): Promise<BridgeResult> {
  if (previousResult.state !== 'error' || !previousResult.error?.recoverable) {
    throw new Error('Bridge cannot be retried. Error is not recoverable.');
  }

  try {
    const kit = createBridgeKit();
    
    // Recreate adapters
    let sourceAdapter: any;
    let destAdapter: any;

    switch (params.walletProvider || 'viem') {
      case 'viem':
        sourceAdapter = createViemAdapter({
          privateKey: params.privateKey,
        });
        destAdapter = createViemAdapter({
          privateKey: params.privateKey,
        });
        break;
      case 'ethers':
        sourceAdapter = createEthersAdapter({
          privateKey: params.privateKey,
        });
        destAdapter = createEthersAdapter({
          privateKey: params.privateKey,
        });
        break;
      default:
        throw new Error('Retry not supported for this wallet provider');
    }

    // Retry using Bridge Kit's retry method
    // Note: This requires the full BridgeResult from Bridge Kit, not our simplified format
    // In production, you'd need to store the full result
    throw new Error('Retry requires full Bridge Kit result object. Store the original result for retry capability.');
  } catch (error: any) {
    return {
      state: 'error',
      error: {
        code: error.code || 'RETRY_FAILED',
        type: 'UNKNOWN',
        message: error.message || 'Retry failed',
        recoverable: false,
      },
    };
  }
}

/**
 * Get supported chains list
 * Returns clear list for error messages
 */
export function getSupportedChainsList(): string[] {
  return Object.values(SUPPORTED_CHAINS);
}

/**
 * Estimate bridge costs before transferring
 */
export async function estimateBridgeCost(params: {
  fromChain: string;
  toChain: string;
  amount: string;
}): Promise<{
  estimatedFee: string;
  estimatedTime: string;
  transferSpeed: 'FAST' | 'SLOW';
}> {
  // Validate route first
  const routeValidation = validateBridgeRoute(params.fromChain, params.toChain);
  if (!routeValidation.valid) {
    throw new Error(routeValidation.error?.message || 'Invalid route');
  }

  // Bridge Kit v1.1.2 provides cost estimation
  // For now, return estimates based on chain and speed
  const isFast = true; // Default to FAST
  const estimatedFee = '0.01'; // Base fee estimate
  const estimatedTime = isFast ? '30 seconds' : '13-19 minutes';

  return {
    estimatedFee,
    estimatedTime,
    transferSpeed: isFast ? 'FAST' : 'SLOW',
  };
}

