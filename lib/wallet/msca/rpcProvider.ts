/**
 * RPC Provider for Arc Network
 * 
 * Provides ethers.js providers for interacting with Arc Testnet/Mainnet
 */

import { ethers } from 'ethers';

// Arc Testnet configuration
const ARC_TESTNET_RPC = 'https://rpc.testnet.arc.network';
const ARC_TESTNET_CHAIN_ID = 5042002;

let providerCache: Map<string, ethers.JsonRpcProvider> = new Map();

/**
 * Get RPC provider for Arc network
 */
export function getArcRPCProvider(): ethers.JsonRpcProvider {
  const cacheKey = ARC_TESTNET_RPC;

  if (providerCache.has(cacheKey)) {
    return providerCache.get(cacheKey)!;
  }

  const provider = new ethers.JsonRpcProvider(ARC_TESTNET_RPC);
  providerCache.set(cacheKey, provider);
  return provider;
}

/**
 * Get nonce for an address
 */
export async function getNonce(address: string): Promise<bigint> {
  const provider = getArcRPCProvider();
  const nonce = await provider.getTransactionCount(address, 'pending');
  return BigInt(nonce);
}

/**
 * Get current gas prices
 */
export async function getGasPrices(): Promise<{
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}> {
  const provider = getArcRPCProvider();
  const feeData = await provider.getFeeData();

  if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
    // Fallback to legacy gas price
    const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
    return {
      maxFeePerGas: gasPrice,
      maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
    };
  }

  return {
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
  };
}

/**
 * Estimate gas for a transaction
 */
export async function estimateGas(
  from: string,
  to: string,
  data: string,
  value: bigint = 0n
): Promise<bigint> {
  const provider = getArcRPCProvider();
  
  try {
    const estimatedGas = await provider.estimateGas({
      from,
      to,
      data,
      value,
    });
    return estimatedGas;
  } catch (error) {
    console.error('[RPC Provider] Gas estimation failed:', error);
    // Return a safe default
    return 100000n;
  }
}

