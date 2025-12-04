/**
 * Session Manager
 * 
 * Manages session lifecycle using Circle MSCA APIs
 * Handles creation, renewal, revocation, and status checking
 */

// Circle SDK imports are dynamically loaded to avoid SSR issues
// Import types only (these don't cause issues)
import type { CircleSessionKeyConfig } from './circleMSCASessionKeys';
import {
  storeSessionKey,
  getSessionKey,
  deleteSessionKey,
  updateSessionKey,
  getWalletSessionKeys,
} from './sessionStorage';
import type { CircleSessionKey, SessionPermissions } from './sessionPermissions';
import { isSessionExpired, canRenewSession } from './sessionPermissions';

export interface CreateSessionOptions {
  walletId: string;
  userId: string;
  userToken: string;
  allowedActions: string[];
  spendingLimit: string;
  duration: number; // Duration in seconds
  autoRenew?: boolean;
  allowedChains?: string[];
  allowedTokens?: string[];
  maxAmountPerTransaction?: string;
}

export interface SessionManagerResult {
  success: boolean;
  sessionKey?: CircleSessionKey;
  challengeId?: string; // If user approval required
  error?: string;
}

/**
 * Create a new session
 */
export async function createSession(
  options: CreateSessionOptions
): Promise<SessionManagerResult> {
  try {
    const expiryTime = Math.floor(Date.now() / 1000) + options.duration;

    const config: CircleSessionKeyConfig = {
      walletId: options.walletId,
      userId: options.userId,
      userToken: options.userToken,
      allowedActions: options.allowedActions as any,
      spendingLimit: options.spendingLimit,
      expiryTime,
      autoRenew: options.autoRenew ?? false,
      allowedChains: options.allowedChains,
      allowedTokens: options.allowedTokens,
      maxAmountPerTransaction: options.maxAmountPerTransaction,
    };

    // Dynamically import to avoid SSR issues
    const { createCircleSessionKey } = await import('./circleMSCASessionKeys');
    console.log('[Session Manager] Creating Circle session key with config:', {
      walletId: config.walletId,
      userId: config.userId,
      hasUserToken: !!config.userToken,
      expiryTime: config.expiryTime,
    });
    
    const result = await createCircleSessionKey(config);
    
    console.log('[Session Manager] Circle session key result:', {
      success: result.success,
      hasSessionKey: !!result.sessionKey,
      hasChallengeId: !!result.challengeId,
      error: result.error,
    });

    if (!result.success || !result.sessionKey) {
      console.error('[Session Manager] Session key creation failed:', result.error);
      return {
        success: false,
        challengeId: result.challengeId,
        error: result.error || 'Failed to create session key',
      };
    }

    // Store in cache
    await storeSessionKey(result.sessionKey.sessionKeyId, result.sessionKey);

    // Generate and store session key wallet private key
    const { generateSessionKeyWallet } = await import('./sessionKeyWallet');
    const { storeSessionKeyPrivateKey } = await import('./sessionKeyStorage');
    
    const wallet = generateSessionKeyWallet();
    await storeSessionKeyPrivateKey(result.sessionKey.sessionKeyId, wallet.privateKey);
    
    // Update session key with wallet address
    result.sessionKey.sessionKeyAddress = wallet.address;
    await storeSessionKey(result.sessionKey.sessionKeyId, result.sessionKey);

    return {
      success: true,
      sessionKey: result.sessionKey,
      challengeId: result.challengeId,
    };
  } catch (error: any) {
    console.error('[Session Manager] Exception creating session:', error);
    console.error('[Session Manager] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return {
      success: false,
      error: error.message || 'Failed to create session',
    };
  }
}

/**
 * Get active session for a wallet
 */
export async function getActiveSession(
  walletId: string,
  userId: string,
  userToken: string
): Promise<CircleSessionKey | null> {
  try {
    // First check cache
    const sessionKeyIds = await getWalletSessionKeys(walletId);
    
    for (const sessionKeyId of sessionKeyIds) {
      const cached = await getSessionKey(sessionKeyId);
      if (cached && !isSessionExpired(cached)) {
        // Verify with Circle API (dynamically imported)
        const { getCircleSessionKeyStatus } = await import('./circleMSCASessionKeys');
        const circleStatus = await getCircleSessionKeyStatus(
          sessionKeyId,
          userToken,
          walletId
        );
        
        if (circleStatus) {
          // Update cache with latest status
          await storeSessionKey(sessionKeyId, circleStatus);
          return circleStatus;
        }
        
        // If Circle API not available, use cached version
        return cached;
      }
    }

    return null;
  } catch (error) {
    console.error('[Session Manager] Error getting active session:', error);
    return null;
  }
}

/**
 * Renew a session
 */
export async function renewSession(
  sessionKeyId: string,
  userToken: string,
  walletId: string,
  newDuration: number
): Promise<SessionManagerResult> {
  try {
    const sessionKey = await getSessionKey(sessionKeyId);
    if (!sessionKey) {
      return {
        success: false,
        error: 'Session key not found',
      };
    }

    if (!canRenewSession(sessionKey)) {
      return {
        success: false,
        error: 'Session cannot be renewed',
      };
    }

    const newExpiryTime = Math.floor(Date.now() / 1000) + newDuration;
    const { renewCircleSessionKey } = await import('./circleMSCASessionKeys');
    const result = await renewCircleSessionKey(
      sessionKeyId,
      userToken,
      walletId,
      newExpiryTime
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to renew session',
      };
    }

    // Update cache
    const updated: CircleSessionKey = {
      ...sessionKey,
      expiresAt: newExpiryTime,
      permissions: {
        ...sessionKey.permissions,
        renewalsUsed: sessionKey.permissions.renewalsUsed + 1,
      },
    };

    await updateSessionKey(sessionKeyId, updated);

    return {
      success: true,
      sessionKey: updated,
    };
  } catch (error: any) {
    console.error('[Session Manager] Error renewing session:', error);
    return {
      success: false,
      error: error.message || 'Failed to renew session',
    };
  }
}

/**
 * Revoke a session
 */
export async function revokeSession(
  sessionKeyId: string,
  userToken: string,
  walletId: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
      const { revokeCircleSessionKey } = await import('./circleMSCASessionKeys');
      const result = await revokeCircleSessionKey(sessionKeyId, userToken, walletId, userId);

    if (!result.success) {
      return result;
    }

    // Update cache
    await updateSessionKey(sessionKeyId, { status: 'revoked' });

    return {
      success: true,
    };
  } catch (error: any) {
    console.error('[Session Manager] Error revoking session:', error);
    return {
      success: false,
      error: error.message || 'Failed to revoke session',
    };
  }
}

/**
 * Check if session is valid and active
 */
export async function isSessionValid(
  sessionKeyId: string,
  userToken: string,
  walletId: string
): Promise<boolean> {
  try {
    const sessionKey = await getSessionKey(sessionKeyId);
    if (!sessionKey) return false;

    if (isSessionExpired(sessionKey)) {
      return false;
    }

    // Verify with Circle API if available (dynamically imported)
    const { getCircleSessionKeyStatus } = await import('./circleMSCASessionKeys');
    const circleStatus = await getCircleSessionKeyStatus(
      sessionKeyId,
      userToken,
      walletId
    );

    if (circleStatus) {
      return circleStatus.status === 'active' && !isSessionExpired(circleStatus);
    }

    // Fallback to cached status
    return sessionKey.status === 'active';
  } catch (error) {
    console.error('[Session Manager] Error checking session validity:', error);
    return false;
  }
}

