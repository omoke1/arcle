/**
 * Agent-Specific Session Key Management
 * 
 * Manages session keys with agent-specific permissions
 */

import { createSession } from '@/lib/wallet/sessionKeys/sessionManager';
import { getAgentPermissions, getAgentDisplayName, getAgentDescription } from '@/core/permissions/agentPermissions';
import type { AgentPermissionScope } from '@/core/permissions/agentPermissions';
import { storeSessionKey } from '@/lib/wallet/sessionKeys/sessionStorage';
import type { CircleSessionKey } from '@/lib/wallet/sessionKeys/sessionPermissions';
import { isSessionExpired } from '@/lib/wallet/sessionKeys/sessionPermissions';

export interface AgentSessionKeyConfig {
  walletId: string;
  userId: string;
  userToken: string;
  agent: string;
  duration?: number; // Duration in seconds, default 7 days
  spendingLimit?: string; // Override default spending limit
  autoRenew?: boolean;
}

/**
 * Create a session key for a specific agent
 */
export async function createAgentSessionKey(
  config: AgentSessionKeyConfig
): Promise<{ success: boolean; sessionKeyId?: string; challengeId?: string; error?: string }> {
  try {
    // Get agent permissions
    const agentPermissions = getAgentPermissions(config.agent);
    if (!agentPermissions) {
      return {
        success: false,
        error: `Unknown agent: ${config.agent}`,
      };
    }

    // Use agent-specific permissions
    const spendingLimit = config.spendingLimit || agentPermissions.defaultSpendingLimit;
    const duration = config.duration || 7 * 24 * 60 * 60; // Default 7 days

    // Create session with agent-specific scope
    const result = await createSession({
      walletId: config.walletId,
      userId: config.userId,
      userToken: config.userToken,
      allowedActions: agentPermissions.allowedActions,
      spendingLimit,
      duration, // Duration in seconds
      autoRenew: config.autoRenew || false,
      allowedChains: agentPermissions.allowedChains,
      allowedTokens: agentPermissions.allowedTokens,
      maxAmountPerTransaction: agentPermissions.maxAmountPerTransaction,
    });

    if (result.success && result.sessionKey) {
      // Store agent metadata in session key
      result.sessionKey.agentId = config.agent;
      result.sessionKey.agentName = getAgentDisplayName(config.agent);
      result.sessionKey.agentDescription = getAgentDescription(config.agent);
      
      // Update stored session key with agent info
      await storeSessionKey(result.sessionKey.sessionKeyId, result.sessionKey);
      
      return {
        success: true,
        sessionKeyId: result.sessionKey.sessionKeyId,
        challengeId: result.challengeId,
      };
    }

    return {
      success: false,
      error: result.error || 'Failed to create agent session key',
      challengeId: result.challengeId,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to create agent session key',
    };
  }
}

/**
 * Get session key for a specific agent
 * 
 * This function can be called from both client and server.
 * On the client, it uses the API route to avoid KV/SDK issues.
 */
export async function getAgentSessionKey(
  walletId: string,
  userId: string,
  userToken: string,
  agentId: string
): Promise<CircleSessionKey | null> {
  try {
    // If running on client, use API route
    if (typeof window !== 'undefined') {
      try {
        const response = await fetch(
          `/api/session-keys/wallet?walletId=${encodeURIComponent(walletId)}&agentId=${encodeURIComponent(agentId)}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.sessionKeys && data.sessionKeys.length > 0) {
            return data.sessionKeys[0]; // Return first matching session key
          }
        }
      } catch (apiError) {
        console.warn('[Agent Session Keys] API route failed, falling back to direct call:', apiError);
      }
    }

    // Server-side or fallback: direct call
    const { getWalletSessionKeys, getSessionKey } = await import('@/lib/wallet/sessionKeys/sessionStorage');
    const sessionKeyIds = await getWalletSessionKeys(walletId);
    
    // Find session key for this specific agent
    for (const sessionKeyId of sessionKeyIds) {
      const sessionKey = await getSessionKey(sessionKeyId);
      if (sessionKey && sessionKey.agentId === agentId && !isSessionExpired(sessionKey)) {
        return sessionKey;
      }
    }
    
    return null;
  } catch (error) {
    console.error('[Agent Session Keys] Error getting agent session key:', error);
    return null;
  }
}

/**
 * Revoke session key for a specific agent
 */
export async function revokeAgentSessionKey(
  agentId: string,
  sessionKeyId: string,
  walletId: string,
  userId: string,
  userToken: string
): Promise<boolean> {
  try {
    const { revokeSession } = await import('@/lib/wallet/sessionKeys/sessionManager');
    const result = await revokeSession(sessionKeyId, userToken, walletId, userId);
    return result.success;
  } catch (error) {
    console.error(`[Agent Session Keys] Error revoking session for agent ${agentId}:`, error);
    return false;
  }
}

/**
 * Check if agent has valid session key
 */
export async function hasAgentSessionKey(
  walletId: string,
  userId: string,
  userToken: string,
  agent: string
): Promise<boolean> {
  try {
    const sessionKey = await getAgentSessionKey(walletId, userId, userToken, agent);
    return sessionKey !== null;
  } catch {
    return false;
  }
}

