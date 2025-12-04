/**
 * Session Key Helper for AI Service
 * 
 * Helper functions to check session key status and determine if actions can be auto-executed
 */

// Dynamic imports to avoid SSR issues with Circle SDK
import { isSessionKeysEnabled } from '@/lib/config/featureFlags';
import type { WalletAction } from '@/lib/wallet/sessionKeys/sessionPermissions';

export interface SessionKeyStatus {
  hasActiveSession: boolean;
  canAutoExecute: boolean;
  requiresUserApproval: boolean;
  sessionKeyId?: string;
  reason?: string;
}

/**
 * Check if an action can be auto-executed with session keys
 */
export async function checkSessionKeyStatus(
  walletId: string,
  userId: string,
  userToken: string,
  action: WalletAction,
  amount?: string
): Promise<SessionKeyStatus> {
  // Check if session keys are enabled
  if (!isSessionKeysEnabled()) {
    return {
      hasActiveSession: false,
      canAutoExecute: false,
      requiresUserApproval: true,
      reason: 'Session keys not enabled',
    };
  }

  // Only run on client side
  if (typeof window === 'undefined') {
    return {
      hasActiveSession: false,
      canAutoExecute: false,
      requiresUserApproval: true,
      reason: 'Server-side rendering',
    };
  }

  try {
    // Dynamically import to avoid SSR issues
    const { getActiveSession } = await import('@/lib/wallet/sessionKeys/sessionManager');
    const sessionKey = await getActiveSession(walletId, userId, userToken);

    if (!sessionKey) {
      return {
        hasActiveSession: false,
        canAutoExecute: false,
        requiresUserApproval: true,
        reason: 'No active session',
      };
    }

    // Validate permission
    const { validatePermission } = await import('@/lib/wallet/permissions/permissionValidator');
    const validation = validatePermission(action, amount, sessionKey);

    return {
      hasActiveSession: true,
      canAutoExecute: validation.allowed,
      requiresUserApproval: validation.requiresUserApproval,
      sessionKeyId: sessionKey.sessionKeyId,
      reason: validation.reason,
    };
  } catch (error: any) {
    console.error('[Session Key Helper] Error checking session status:', error);
    return {
      hasActiveSession: false,
      canAutoExecute: false,
      requiresUserApproval: true,
      reason: error.message || 'Error checking session status',
    };
  }
}

/**
 * Check if session needs renewal
 */
export async function shouldRenewSession(
  walletId: string,
  userId: string,
  userToken: string
): Promise<boolean> {
  if (!isSessionKeysEnabled()) {
    return false;
  }

  // Only run on client side
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const { getActiveSession } = await import('@/lib/wallet/sessionKeys/sessionManager');
    const sessionKey = await getActiveSession(walletId, userId, userToken);
    if (!sessionKey) return false;

    // Check if session expires in less than 5 minutes
    const expiresIn = sessionKey.expiresAt * 1000 - Date.now();
    return expiresIn < 5 * 60 * 1000 && sessionKey.permissions.autoRenew;
  } catch {
    return false;
  }
}

