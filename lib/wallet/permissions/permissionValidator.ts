/**
 * Permission Validator
 * 
 * Validates actions against Circle session key permissions
 * Circle MSCAs enforce permissions on-chain, this validates before execution
 */

import type { CircleSessionKey, WalletAction } from '../sessionKeys/sessionPermissions';
import { isActionAllowed, wouldExceedSpendingLimit, isSessionExpired } from '../sessionKeys/sessionPermissions';

export interface PermissionValidationResult {
  allowed: boolean;
  reason?: string;
  requiresUserApproval: boolean;
}

/**
 * Validate if an action is allowed with the current session key
 */
export function validatePermission(
  action: WalletAction,
  amount: string | undefined,
  sessionKey: CircleSessionKey | null
): PermissionValidationResult {
  // No session key - requires user approval
  if (!sessionKey) {
    return {
      allowed: false,
      reason: 'No active session',
      requiresUserApproval: true,
    };
  }

  // Session expired - requires user approval
  if (isSessionExpired(sessionKey)) {
    return {
      allowed: false,
      reason: 'Session expired',
      requiresUserApproval: true,
    };
  }

  // Check if action is allowed
  if (!isActionAllowed(action, sessionKey.permissions)) {
    return {
      allowed: false,
      reason: `Action '${action}' not allowed in session permissions`,
      requiresUserApproval: true,
    };
  }

  // Check spending limit if amount is provided
  if (amount && wouldExceedSpendingLimit(amount, sessionKey.permissions)) {
    return {
      allowed: false,
      reason: 'Spending limit would be exceeded',
      requiresUserApproval: true,
    };
  }

  // Check per-transaction limit
  if (
    sessionKey.permissions.maxAmountPerTransaction &&
    amount &&
    BigInt(amount) > BigInt(sessionKey.permissions.maxAmountPerTransaction)
  ) {
    return {
      allowed: false,
      reason: 'Per-transaction limit exceeded',
      requiresUserApproval: true,
    };
  }

  // Check chain restrictions
  if (
    sessionKey.permissions.allowedChains &&
    sessionKey.permissions.allowedChains.length > 0
  ) {
    // This would need to be checked against the actual chain being used
    // For now, we'll allow it and let Circle enforce on-chain
  }

  // Check token restrictions
  if (
    sessionKey.permissions.allowedTokens &&
    sessionKey.permissions.allowedTokens.length > 0
  ) {
    // This would need to be checked against the actual token being used
    // For now, we'll allow it and let Circle enforce on-chain
  }

  // All checks passed
  return {
    allowed: true,
    requiresUserApproval: false,
  };
}

/**
 * Validate multiple actions in sequence (for multi-step flows)
 */
export function validateMultiStepPermissions(
  actions: Array<{ action: WalletAction; amount?: string }>,
  sessionKey: CircleSessionKey | null
): PermissionValidationResult {
  if (!sessionKey) {
    return {
      allowed: false,
      reason: 'No active session',
      requiresUserApproval: true,
    };
  }

  // Validate each action
  for (const { action, amount } of actions) {
    const result = validatePermission(action, amount, sessionKey);
    if (!result.allowed) {
      return result;
    }
  }

  // Check total spending across all steps
  const totalAmount = actions
    .map(a => a.amount || '0')
    .reduce((sum, amt) => (BigInt(sum) + BigInt(amt)).toString(), '0');

  if (totalAmount !== '0') {
    const totalResult = validatePermission('transfer', totalAmount, sessionKey);
    if (!totalResult.allowed) {
      return {
        allowed: false,
        reason: 'Total spending across steps would exceed limit',
        requiresUserApproval: true,
      };
    }
  }

  return {
    allowed: true,
    requiresUserApproval: false,
  };
}

