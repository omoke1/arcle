/**
 * Agent Executor
 * 
 * Routes all AI agent blockchain actions through delegateExecution()
 * Handles multi-step pipelines using Circle MSCA batching
 */

import { delegateExecution } from '@/lib/wallet/sessionKeys/delegateExecution';
import type { WalletAction, WalletActionParams } from '@/lib/wallet/sessionKeys/delegateExecution';
import { executeBatch, canBatch } from '@/lib/wallet/msca/mscaBatchExecutor';
import { isSessionKeysEnabled } from '@/lib/config/featureFlags';

export interface AgentExecutionRequest {
  walletId: string;
  userId: string;
  userToken: string;
  actions: Array<{
    action: WalletAction;
    params: Omit<WalletActionParams, 'walletId' | 'userId' | 'userToken' | 'action'>;
  }>;
  useBatching?: boolean; // Whether to batch multiple actions
}

export interface AgentExecutionResult {
  success: boolean;
  results: Array<{
    action: WalletAction;
    success: boolean;
    executedViaSessionKey: boolean;
    challengeId?: string;
    transactionId?: string;
    transactionHash?: string;
    error?: string;
  }>;
  batched: boolean;
}

/**
 * Execute agent actions
 * 
 * Routes through delegateExecution() which handles:
 * - Session key validation
 * - Permission checking
 * - Spending limit validation
 * - Automatic execution or fallback to user approval
 */
export async function executeAgentActions(
  request: AgentExecutionRequest
): Promise<AgentExecutionResult> {
  const results: AgentExecutionResult['results'] = [];
  let batched = false;

  try {
    // Check if session keys are enabled
    if (!isSessionKeysEnabled()) {
      // Session keys disabled - execute individually with user approval
      for (const { action, params } of request.actions) {
        const result = await delegateExecution({
          walletId: request.walletId,
          userId: request.userId,
          userToken: request.userToken,
          action,
          ...params,
        });

        results.push({
          action,
          success: result.success,
          executedViaSessionKey: result.executedViaSessionKey,
          challengeId: result.challengeId,
          transactionId: result.transactionId,
          transactionHash: result.transactionHash,
          error: result.error,
        });
      }

      return {
        success: results.every(r => r.success),
        results,
        batched: false,
      };
    }

    // Session keys enabled - try batching if multiple actions
    if (request.useBatching !== false && request.actions.length > 1) {
      const batchOperations = request.actions.map(({ action, params }) => ({
        action,
        params,
      }));

      if (canBatch(batchOperations)) {
        // Try to batch
        const batchResult = await executeBatch(
          request.walletId,
          request.userId,
          request.userToken,
          null, // sessionKeyId - will be resolved by executeBatch
          batchOperations
        );

        if (batchResult.success) {
          // Batch succeeded
          results.push({
            action: request.actions[0].action, // Use first action as representative
            success: true,
            executedViaSessionKey: true,
            transactionHash: batchResult.transactionHash,
            challengeId: batchResult.challengeId,
          });

          return {
            success: true,
            results,
            batched: true,
          };
        }
        // Batch failed - fall through to individual execution
      }
    }

    // Execute individually
    for (const { action, params } of request.actions) {
      const result = await delegateExecution({
        walletId: request.walletId,
        userId: request.userId,
        userToken: request.userToken,
        action,
        ...params,
      });

      results.push({
        action,
        success: result.success,
        executedViaSessionKey: result.executedViaSessionKey,
        challengeId: result.challengeId,
        transactionId: result.transactionId,
        transactionHash: result.transactionHash,
        error: result.error,
      });
    }

    return {
      success: results.every(r => r.success),
      results,
      batched: false,
    };
  } catch (error: any) {
    console.error('[Agent Executor] Error executing actions:', error);
    return {
      success: false,
      results: request.actions.map(({ action }) => ({
        action,
        success: false,
        executedViaSessionKey: false,
        error: error.message || 'Failed to execute action',
      })),
      batched: false,
    };
  }
}

/**
 * Execute a single agent action
 */
export async function executeAgentAction(
  walletId: string,
  userId: string,
  userToken: string,
  action: WalletAction,
  params: Omit<WalletActionParams, 'walletId' | 'userId' | 'userToken' | 'action'>
): Promise<AgentExecutionResult> {
  return executeAgentActions({
    walletId,
    userId,
    userToken,
    actions: [{ action, params }],
    useBatching: false,
  });
}

