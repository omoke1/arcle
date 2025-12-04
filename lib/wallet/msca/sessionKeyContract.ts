/**
 * Session Key Contract Interaction
 * 
 * Interacts with deployed SessionKeyModule smart contract
 * Handles session key creation, validation, and revocation on-chain
 */

import { ethers } from 'ethers';
import { executeContract } from '@/lib/circle-user-sdk-advanced';
import type { CircleSessionKeyConfig } from '../sessionKeys/sessionPermissions';
import { getSessionKeyModuleAddress } from './moduleIntegration';

// SessionKeyModule ABI (minimal interface for our needs)
const SESSION_KEY_MODULE_ABI = [
  "function createSessionKey(address sessionKey, uint256 spendingLimit, uint256 expiryTime, bytes32 allowedActions) external",
  "function revokeSessionKey(address sessionKey) external",
  "function validateSessionKey(address sessionKey, uint256 amount, bytes32 actionHash) external view returns (bool)",
  "function getSessionKeyConfig(address sessionKey) external view returns (tuple(address sessionKey, uint256 spendingLimit, uint256 spendingUsed, uint256 expiryTime, bytes32 allowedActions, bool isActive))",
  "function isSessionKeyActive(address sessionKey) external view returns (bool)",
  "event SessionKeyCreated(address indexed sessionKey, address indexed owner, uint256 spendingLimit, uint256 expiryTime, bytes32 allowedActions)",
  "event SessionKeyRevoked(address indexed sessionKey, address indexed owner)",
];

/**
 * Encode action types into bytes32 bitmap
 */
export function encodeAllowedActions(actions: string[]): string {
  // Action type mapping
  const actionMap: Record<string, number> = {
    transfer: 0,
    approve: 1,
    swap: 2,
    bridge: 3,
    cctp: 4,
    gateway: 5,
  };

  let bitmap = BigInt(0);
  for (const action of actions) {
    const bit = actionMap[action.toLowerCase()];
    if (bit !== undefined) {
      bitmap |= BigInt(1) << BigInt(bit);
    }
  }

  return '0x' + bitmap.toString(16).padStart(64, '0');
}

/**
 * Generate a session key address (EOA)
 * In production, this would generate a new wallet or use a deterministic address
 */
export function generateSessionKeyAddress(): string {
  // For now, generate a random address
  // In production, you might want to use a deterministic method or create an actual wallet
  const randomBytes = ethers.randomBytes(20);
  return ethers.getAddress(ethers.hexlify(randomBytes));
}

/**
 * Create a session key on-chain via the SessionKeyModule contract
 */
export async function createSessionKeyOnChain(
  walletId: string,
  userId: string,
  userToken: string,
  walletAddress: string,
  config: CircleSessionKeyConfig,
  chainId: string
): Promise<{ success: boolean; challengeId?: string; sessionKeyAddress?: string; error?: string }> {
  try {
    const moduleAddress = getSessionKeyModuleAddress(chainId);
    if (!moduleAddress) {
      return {
        success: false,
        error: 'SessionKeyModule not deployed on this chain. Please deploy the module first.',
      };
    }

    // Generate session key address
    const sessionKeyAddress = generateSessionKeyAddress();

    // Encode allowed actions
    const allowedActions = encodeAllowedActions(config.allowedActions);

    // Prepare contract call
    const iface = new ethers.Interface(SESSION_KEY_MODULE_ABI);
    const functionData = iface.encodeFunctionData('createSessionKey', [
      sessionKeyAddress,
      config.spendingLimit,
      config.expiryTime,
      allowedActions,
    ]);

    // Execute contract call via Circle's API
    const result = await executeContract({
      userId,
      userToken,
      walletId,
      contractAddress: moduleAddress,
      abiFunctionSignature: 'createSessionKey(address,uint256,uint256,bytes32)',
      abiParameters: [
        sessionKeyAddress,
        config.spendingLimit,
        config.expiryTime,
        allowedActions,
      ],
    });

    if (result.success) {
      return {
        success: true,
        challengeId: result.challengeId,
        sessionKeyAddress,
      };
    }

    return {
      success: false,
      error: result.error || 'Failed to create session key',
    };
  } catch (error: any) {
    console.error('[Session Key Contract] Error creating session key:', error);
    return {
      success: false,
      error: error.message || 'Failed to create session key on-chain',
    };
  }
}

/**
 * Revoke a session key on-chain
 */
export async function revokeSessionKeyOnChain(
  walletId: string,
  userId: string,
  userToken: string,
  sessionKeyAddress: string,
  chainId: string
): Promise<{ success: boolean; challengeId?: string; error?: string }> {
  try {
    const moduleAddress = getSessionKeyModuleAddress(chainId);
    if (!moduleAddress) {
      return {
        success: false,
        error: 'SessionKeyModule not deployed on this chain',
      };
    }

    const iface = new ethers.Interface(SESSION_KEY_MODULE_ABI);
    const functionData = iface.encodeFunctionData('revokeSessionKey', [sessionKeyAddress]);

    const result = await executeContract({
      userId,
      userToken,
      walletId,
      contractAddress: moduleAddress,
      abiFunctionSignature: 'revokeSessionKey(address)',
      abiParameters: [sessionKeyAddress],
    });

    if (result.success) {
      return {
        success: true,
        challengeId: result.challengeId,
      };
    }

    return {
      success: false,
      error: result.error || 'Failed to revoke session key',
    };
  } catch (error: any) {
    console.error('[Session Key Contract] Error revoking session key:', error);
    return {
      success: false,
      error: error.message || 'Failed to revoke session key on-chain',
    };
  }
}

