/**
 * ERC-4337 UserOperation Builder
 * 
 * Builds UserOperations for account abstraction integration
 */

import { buildMSCACallData } from '@/lib/wallet/msca/userOpBuilder';
import type { WalletActionParams } from '@/lib/wallet/sessionKeys/delegateExecution';

/**
 * Build UserOperation callData for agent actions
 */
export function buildAgentUserOpCallData(
  agent: string,
  action: string,
  params: WalletActionParams
): string {
  // Use existing MSCA call data builder
  return buildMSCACallData(action, params);
}

/**
 * Build batch UserOperation for multiple agent actions
 */
export function buildBatchAgentUserOp(
  operations: Array<{ agent: string; action: string; params: WalletActionParams }>
): string {
  const { buildBatchMSCACallData } = require('@/lib/wallet/msca/userOpBuilder');
  
  return buildBatchMSCACallData(
    operations.map((op) => ({
      action: op.action,
      params: op.params,
    }))
  );
}

