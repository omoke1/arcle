/**
 * INERA Utilities
 * 
 * Shared utility functions for INERA agent
 */

import type { ExecutionResult } from '@/lib/wallet/sessionKeys/delegateExecution';

/**
 * Format execution result for user-facing messages
 */
export function formatExecutionResult(result: ExecutionResult): string {
  if (result.success) {
    if (result.executedViaSessionKey) {
      return `✅ Executed automatically via session key${result.transactionHash ? ` (${result.transactionHash.substring(0, 10)}...)` : ''}`;
    } else {
      return `✅ Transaction initiated${result.challengeId ? ' - please complete the PIN challenge' : ''}`;
    }
  } else {
    return `❌ Failed: ${result.error || 'Unknown error'}`;
  }
}

/**
 * Check if result requires user action
 */
export function requiresUserAction(result: ExecutionResult): boolean {
  return !result.success || (result.challengeId !== undefined && !result.executedViaSessionKey);
}

/**
 * Extract challenge ID from result
 */
export function getChallengeId(result: ExecutionResult): string | undefined {
  return result.challengeId;
}

/**
 * Validate wallet action parameters
 */
export function validateWalletActionParams(params: any): {
  valid: boolean;
  error?: string;
} {
  if (!params.walletId) {
    return { valid: false, error: 'walletId is required' };
  }
  if (!params.userId) {
    return { valid: false, error: 'userId is required' };
  }
  if (!params.userToken) {
    return { valid: false, error: 'userToken is required' };
  }
  if (!params.action) {
    return { valid: false, error: 'action is required' };
  }

  return { valid: true };
}

/**
 * Convert amount to smallest unit (USDC: 6 decimals)
 */
export function toSmallestUnit(amount: string, decimals: number = 6): string {
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum)) {
    throw new Error('Invalid amount');
  }
  return (amountNum * Math.pow(10, decimals)).toString();
}

/**
 * Convert from smallest unit to decimal
 */
export function fromSmallestUnit(amount: string, decimals: number = 6): string {
  const amountNum = BigInt(amount);
  return (Number(amountNum) / Math.pow(10, decimals)).toFixed(decimals);
}

/**
 * Generate unique workflow ID
 */
export function generateWorkflowId(): string {
  return `workflow-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Log INERA operation
 */
export function logINERAOperation(
  operation: string,
  params: Record<string, any>,
  result?: ExecutionResult
): void {
  console.log(`[INERA] ${operation}`, {
    walletId: params.walletId,
    action: params.action,
    executedViaSessionKey: result?.executedViaSessionKey,
    success: result?.success,
    timestamp: new Date().toISOString(),
  });
}

