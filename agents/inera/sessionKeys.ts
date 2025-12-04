/**
 * INERA Session Key Delegation
 * 
 * Manages session key operations for INERA agent execution
 */

import { delegateExecution } from '@/lib/wallet/sessionKeys/delegateExecution';
import { getActiveSession, isSessionValid } from '@/lib/wallet/sessionKeys/sessionManager';
import type { WalletActionParams, ExecutionResult } from '@/lib/wallet/sessionKeys/delegateExecution';
import type { CircleSessionKey } from '@/lib/wallet/sessionKeys/sessionPermissions';

/**
 * Execute action via session key delegation
 * This is the primary method INERA uses to execute operations
 * 
 * If agentId is provided, it will use the agent-specific session key
 */
export async function executeViaSessionKey(
  params: WalletActionParams
): Promise<ExecutionResult> {
  try {
    // Delegate execution (will use agent-specific session key if agentId provided, otherwise general session key)
    // delegateExecution will handle checking for agent-specific session keys
    return await delegateExecution(params);
  } catch (error: any) {
    return {
      success: false,
      executedViaSessionKey: false,
      error: error.message || 'Session key execution failed',
    };
  }
}

/**
 * Check if session key can execute a specific action
 */
export async function canExecuteWithSessionKey(
  walletId: string,
  userId: string,
  userToken: string,
  action: string,
  amount?: string
): Promise<{ canExecute: boolean; reason?: string; sessionKey?: CircleSessionKey }> {
  try {
    const sessionKey = await getActiveSession(walletId, userId, userToken);

    if (!sessionKey) {
      return {
        canExecute: false,
        reason: 'No active session key',
      };
    }

    const isValid = await isSessionValid(sessionKey.sessionKeyId, userToken, walletId);
    if (!isValid) {
      return {
        canExecute: false,
        reason: 'Session key expired or revoked',
      };
    }

    // Check if action is allowed
    const { isActionAllowed, wouldExceedSpendingLimit } = await import(
      '@/lib/wallet/sessionKeys/sessionPermissions'
    );

    if (!isActionAllowed(action as any, sessionKey.permissions)) {
      return {
        canExecute: false,
        reason: `Action '${action}' not allowed in session permissions`,
        sessionKey,
      };
    }

    // Check spending limit if amount provided
    if (amount && wouldExceedSpendingLimit(amount, sessionKey.permissions)) {
      return {
        canExecute: false,
        reason: 'Spending limit would be exceeded',
        sessionKey,
      };
    }

    return {
      canExecute: true,
      sessionKey,
    };
  } catch (error: any) {
    return {
      canExecute: false,
      reason: error.message || 'Session key check failed',
    };
  }
}

/**
 * Get session key status for INERA operations
 */
export async function getSessionKeyStatus(
  walletId: string,
  userId: string,
  userToken: string
): Promise<{
  hasActiveSession: boolean;
  sessionKey?: CircleSessionKey;
  canAutoExecute: boolean;
  reason?: string;
}> {
  try {
    const sessionKey = await getActiveSession(walletId, userId, userToken);

    if (!sessionKey) {
      return {
        hasActiveSession: false,
        canAutoExecute: false,
        reason: 'No active session key',
      };
    }

    const isValid = await isSessionValid(sessionKey.sessionKeyId, userToken, walletId);

    return {
      hasActiveSession: true,
      sessionKey,
      canAutoExecute: isValid && sessionKey.status === 'active',
      reason: isValid ? undefined : 'Session key expired or revoked',
    };
  } catch (error: any) {
    return {
      hasActiveSession: false,
      canAutoExecute: false,
      reason: error.message || 'Failed to check session key status',
    };
  }
}

