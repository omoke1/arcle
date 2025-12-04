/**
 * UserOp Builder for Circle MSCA
 * 
 * Builds ERC-4337 UserOperations compatible with Circle's MSCA infrastructure
 */

import { ethers } from 'ethers';
import type { WalletActionParams } from '../sessionKeys/delegateExecution';

/**
 * Build UserOp callData for MSCA wallet execute() function
 * 
 * Circle MSCA wallets use a standard execute() function for all operations
 */
export function buildMSCACallData(
  action: string,
  params: WalletActionParams
): string {
  // MSCA execute function signature
  const mscaIface = new ethers.Interface([
    'function execute(address target, uint256 value, bytes calldata data) external',
    'function executeBatch(tuple(address target, uint256 value, bytes data)[] calldata calls) external',
  ]);

  // Build target call data based on action
  const targetCallData = buildTargetCallData(action, params);

  // Wrap in MSCA execute() call
  return mscaIface.encodeFunctionData('execute', [
    params.contractAddress || params.destinationAddress || ethers.ZeroAddress,
    params.amount ? BigInt(params.amount) : 0n,
    targetCallData,
  ]);
}

/**
 * Build target contract call data
 */
function buildTargetCallData(
  action: string,
  params: WalletActionParams
): string {
  switch (action) {
    case 'transfer':
      // USDC transfer
      const usdcIface = new ethers.Interface([
        'function transfer(address to, uint256 amount) external returns (bool)',
      ]);
      if (!params.destinationAddress || !params.amount) {
        throw new Error('Transfer requires destinationAddress and amount');
      }
      return usdcIface.encodeFunctionData('transfer', [
        params.destinationAddress,
        BigInt(params.amount),
      ]);

    case 'approve':
      const approveIface = new ethers.Interface([
        'function approve(address spender, uint256 amount) external returns (bool)',
      ]);
      if (!params.contractAddress || !params.amount) {
        throw new Error('Approve requires contractAddress and amount');
      }
      return approveIface.encodeFunctionData('approve', [
        params.destinationAddress || params.contractAddress,
        BigInt(params.amount),
      ]);

    case 'swap':
    case 'bridge':
    case 'cctp':
    case 'gateway':
      // Use provided ABI function signature
      if (params.abiFunctionSignature && params.abiParameters) {
        const contractIface = new ethers.Interface([
          `function ${params.abiFunctionSignature}`,
        ]);
        return contractIface.encodeFunctionData(
          params.abiFunctionSignature,
          params.abiParameters
        );
      }
      throw new Error(`Action ${action} requires abiFunctionSignature and abiParameters`);

    default:
      throw new Error(`Unsupported action: ${action}`);
  }
}

/**
 * Build batch UserOp for multiple operations
 */
export function buildBatchMSCACallData(
  operations: Array<{ action: string; params: WalletActionParams }>
): string {
  const mscaIface = new ethers.Interface([
    'function executeBatch(tuple(address target, uint256 value, bytes data)[] calldata calls) external',
  ]);

  const calls = operations.map(({ action, params }) => ({
    target: params.contractAddress || params.destinationAddress || ethers.ZeroAddress,
    value: params.amount ? BigInt(params.amount) : 0n,
    data: buildTargetCallData(action, params),
  }));

  return mscaIface.encodeFunctionData('executeBatch', [calls]);
}

