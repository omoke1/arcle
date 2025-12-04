/**
 * Delegate Execution
 * 
 * Routes transactions through Circle session keys or falls back to user approval
 * This is the core abstraction layer that enables automatic AI agent execution
 */

import { getActiveSession, isSessionValid } from './sessionManager';
import { isActionAllowed, wouldExceedSpendingLimit, isSessionExpired } from './sessionPermissions';
import type { CircleSessionKey } from './sessionPermissions';
import type { WalletAction } from './sessionPermissions';

// Re-export for convenience
export type { WalletAction } from './sessionPermissions';
import { executeContract } from '@/lib/circle-user-sdk-advanced';

export interface WalletActionParams {
  walletId: string;
  userId: string;
  userToken: string;
  action: WalletAction;
  // Action-specific parameters
  amount?: string;
  destinationAddress?: string;
  contractAddress?: string;
  abiFunctionSignature?: string;
  abiParameters?: any[];
  fromChain?: string;
  toChain?: string;
  // Agent context (for per-agent session keys)
  agentId?: string; // Which agent is requesting this action
  // Other params
  [key: string]: any;
}

export interface ExecutionResult {
  success: boolean;
  executedViaSessionKey: boolean;
  challengeId?: string; // If user approval required
  transactionId?: string;
  transactionHash?: string;
  error?: string;
}

/**
 * Delegate execution to session key or fallback to user approval
 * 
 * This is the main function that routes all wallet operations:
 * 1. Check if valid session key exists
 * 2. Validate action against permissions
 * 3. Check spending limits
 * 4. Execute via Circle MSCA if valid, otherwise fallback to user approval
 */
export async function delegateExecution(
  params: WalletActionParams
): Promise<ExecutionResult> {
  try {
    const { walletId, userId, userToken, action, agentId } = params;

    // Step 1: Get session key for THIS specific agent (if agentId provided)
    let sessionKey: CircleSessionKey | null = null;
    
    if (agentId) {
      // Get agent-specific session key
      const { getAgentSessionKey } = await import('@/core/sessionKeys/agentSessionKeys');
      sessionKey = await getAgentSessionKey(walletId, userId, userToken, agentId);
      
      if (sessionKey && sessionKey.agentId !== agentId) {
        // This session key belongs to a different agent
        console.log(`[Delegate Execution] Session key belongs to different agent (${sessionKey.agentId}), falling back to user approval`);
        return await executeWithUserApproval(params);
      }
    } else {
      // Fallback to general active session (for backward compatibility)
      sessionKey = await getActiveSession(walletId, userId, userToken);
    }

    // Step 2: If no session or expired, fallback to user approval
    if (!sessionKey || isSessionExpired(sessionKey)) {
      console.log('[Delegate Execution] No active session, falling back to user approval');
      return await executeWithUserApproval(params);
    }
    
    // Step 2.5: Verify agent ownership if agentId is specified
    if (agentId && sessionKey.agentId && sessionKey.agentId !== agentId) {
      console.log(`[Delegate Execution] Session key agent mismatch (expected ${agentId}, got ${sessionKey.agentId}), falling back to user approval`);
      return await executeWithUserApproval(params);
    }

    // Step 3: Validate action is allowed
    if (!isActionAllowed(action, sessionKey.permissions)) {
      console.log('[Delegate Execution] Action not allowed in session permissions, falling back to user approval');
      return await executeWithUserApproval(params);
    }

    // Step 4: Check spending limit
    if (params.amount && wouldExceedSpendingLimit(params.amount, sessionKey.permissions)) {
      console.log('[Delegate Execution] Spending limit would be exceeded, falling back to user approval');
      return await executeWithUserApproval(params);
    }

    // Step 5: Check per-transaction limit if set
    if (
      sessionKey.permissions.maxAmountPerTransaction &&
      params.amount &&
      BigInt(params.amount) > BigInt(sessionKey.permissions.maxAmountPerTransaction)
    ) {
      console.log('[Delegate Execution] Per-transaction limit exceeded, falling back to user approval');
      return await executeWithUserApproval(params);
    }

    // Step 6: Execute via Circle MSCA session key
    console.log('[Delegate Execution] Executing via Circle MSCA session key:', sessionKey.sessionKeyId);
    return await executeWithSessionKey(params, sessionKey);
  } catch (error: any) {
    console.error('[Delegate Execution] Error:', error);
    // On error, fallback to user approval for safety
    return await executeWithUserApproval(params);
  }
}

/**
 * Execute transaction using Circle MSCA session key
 * 
 * Uses our deployed SessionKeyModule and ERC-4337 UserOps
 */
async function executeWithSessionKey(
  params: WalletActionParams,
  sessionKey: CircleSessionKey
): Promise<ExecutionResult> {
  try {
    // Get MSCA wallet address
    const { getUserCircleClient } = await import('@/lib/circle-user-sdk');
    const client = getUserCircleClient();
    const walletResponse = await (client as any).getWallet({
      userToken: params.userToken,
      id: params.walletId, // Circle SDK expects 'id', not 'walletId'
    });

    if (!walletResponse.data?.addresses || walletResponse.data.addresses.length === 0) {
      return {
        success: false,
        executedViaSessionKey: true,
        error: 'Wallet address not found',
      };
    }

    const mscaAddress = sessionKey.mscaAddress || walletResponse.data.addresses[0].address;

    // Build and sign UserOperation
    const { buildUserOperation, signUserOperationWithSessionKey, submitUserOperation } = 
      await import('./sessionKeySigner');

    const userOp = await buildUserOperation(params, sessionKey, mscaAddress);
    const entryPointAddress = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'; // ERC-4337 EntryPoint
    const signedUserOp = await signUserOperationWithSessionKey(userOp, sessionKey, entryPointAddress);

    // Submit to bundler or Circle API
    const submitResult = await submitUserOperation(signedUserOp);

    if (submitResult.success && submitResult.userOpHash) {
      // Log audit entry
      const { logAuditEntry } = await import('./auditLogger');
      await logAuditEntry({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        sessionKeyId: sessionKey.sessionKeyId,
        walletId: params.walletId,
        userId: params.userId,
        action: params.action,
        amount: params.amount,
        success: true,
        executedViaSessionKey: true,
        transactionHash: submitResult.userOpHash,
      });

      // Update session spending used (approximate - actual will be on-chain)
      // TODO: Fetch actual spending from blockchain

      return {
        success: true,
        executedViaSessionKey: true,
        transactionHash: submitResult.userOpHash,
      };
    }

    // If bundler submission fails, fallback to Circle's contract execution
    // This still uses the session key but through Circle's API
    console.log('[Delegate Execution] Bundler submission failed, falling back to Circle API');
    
    // Handle bridge operations specially - they may need Gateway API
    if (params.action === 'bridge' || params.action === 'gateway' || params.action === 'cctp') {
      // For bridge operations, we need to use the Gateway/CCTP APIs
      // These operations are complex and may require multiple steps
      // We'll route through the bridge API which will handle the flow
      // The session key validation has already passed, so we can proceed
      console.log('[Delegate Execution] Bridge operation - routing through Gateway API');
      
      // Import bridge implementation
      const { transferViaGatewayUser } = await import('@/lib/gateway/gateway-sdk-implementation-user');
      
      try {
        // Get wallet address first
        const { getUserCircleClient } = await import('@/lib/circle-user-sdk');
        const client = getUserCircleClient();
        const walletResponse = await (client as any).getWallet({
          userToken: params.userToken,
          id: params.walletId, // Circle SDK expects 'id', not 'walletId'
        });
        
        const walletAddress = walletResponse.data?.addresses?.[0]?.address;
        if (!walletAddress) {
          throw new Error('Wallet address not found');
        }
        
        // Execute bridge via Gateway with session key (no PIN required!)
        // Session key will sign EIP-712 typed data directly
        const bridgeResult = await transferViaGatewayUser({
          walletId: params.walletId,
          userId: params.userId,
          userToken: params.userToken,
          walletAddress: walletAddress,
          amount: (parseFloat(params.amount || '0') / 1000000).toString(), // Convert to decimal
          destinationAddress: params.destinationAddress || '',
          toChain: params.toChain || 'ARC-TESTNET',
          fromChain: params.fromChain || 'ARC-TESTNET',
        }, sessionKey); // Pass session key for PIN-less signing

        if (bridgeResult.success) {
          // If status is "completed", the transfer was executed immediately (no PIN)
          if (bridgeResult.status === "completed") {
            return {
              success: true,
              executedViaSessionKey: true,
              transactionHash: bridgeResult.attestation, // Gateway returns attestation
              // Note: Gateway transfers don't have traditional transaction hashes
              // The attestation serves as the transfer identifier
            };
          }
          
          // If status is "signing", user still needs to complete challenge (deposit or PIN)
          return {
            success: true,
            executedViaSessionKey: false, // Still needs user approval
            challengeId: bridgeResult.challengeId,
            // Gateway transfers return challengeId when PIN/deposit is required
          };
        }
      } catch (error: any) {
        console.error('[Delegate Execution] Gateway bridge failed:', error);
        // Fall through to contract execution
      }
    }
    
    if (params.contractAddress && params.abiFunctionSignature) {
      const result = await executeContract({
        userId: params.userId,
        userToken: params.userToken,
        walletId: params.walletId,
        contractAddress: params.contractAddress,
        abiFunctionSignature: params.abiFunctionSignature,
        abiParameters: params.abiParameters || [],
        refId: `session-${sessionKey.sessionKeyId}-${Date.now()}`,
      });

      if (result.success) {
        return {
          success: true,
          executedViaSessionKey: true,
          challengeId: result.challengeId,
          transactionId: result.transactionId,
          transactionHash: result.transactionHash,
        };
      }
    }

    return {
      success: false,
      executedViaSessionKey: true,
      error: submitResult.error || 'Failed to execute with session key',
    };
  } catch (error: any) {
    console.error('[Delegate Execution] Error executing with session key:', error);
    return {
      success: false,
      executedViaSessionKey: true,
      error: error.message || 'Failed to execute with session key',
    };
  }
}

/**
 * Execute transaction with user approval (fallback)
 * 
 * This uses the existing Circle challenge flow
 */
async function executeWithUserApproval(
  params: WalletActionParams
): Promise<ExecutionResult> {
  try {
    // Use existing execution methods that require user approval
    if (params.contractAddress && params.abiFunctionSignature) {
      const result = await executeContract({
        userId: params.userId,
        userToken: params.userToken,
        walletId: params.walletId,
        contractAddress: params.contractAddress,
        abiFunctionSignature: params.abiFunctionSignature,
        abiParameters: params.abiParameters || [],
      });

      return {
        success: result.success,
        executedViaSessionKey: false,
        challengeId: result.challengeId,
        transactionId: result.transactionId,
        transactionHash: result.transactionHash,
        error: result.error,
      };
    }

    // For other actions, they will need to be handled by their respective APIs
    // (e.g., sendTransaction, bridgeTransaction, etc.)
    
    return {
      success: false,
      executedViaSessionKey: false,
      error: 'User approval required - action will be handled by existing flow',
    };
  } catch (error: any) {
    console.error('[Delegate Execution] Error executing with user approval:', error);
    return {
      success: false,
      executedViaSessionKey: false,
      error: error.message || 'Failed to execute with user approval',
    };
  }
}

