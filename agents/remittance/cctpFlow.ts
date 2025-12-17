/**
 * CCTP Cross-Border Payment Flow
 * 
 * Handles cross-chain transfers via Circle's CCTP (Cross-Chain Transfer Protocol)
 */

import { INERAAgent } from '@/agents/inera';
import type { ExecutionResult } from '@/lib/wallet/sessionKeys/delegateExecution';

export interface CCTPTransferParams {
  walletId: string;
  userId: string;
  userToken: string;
  amount: string;
  fromChain: string;
  toChain: string;
  destinationAddress: string;
  fastTransfer?: boolean;
}

/**
 * Execute CCTP transfer
 */
export async function executeCCTPTransfer(params: CCTPTransferParams): Promise<ExecutionResult> {
  const inera = new INERAAgent();
  
  return await inera.executeBridge({
    walletId: params.walletId,
    userId: params.userId,
    userToken: params.userToken,
    amount: params.amount,
    fromChain: params.fromChain,
    toChain: params.toChain,
    destinationAddress: params.destinationAddress,
  });
}

/**
 * Track CCTP transfer status
 * 
 * Uses Circle's Transfer API to check CCTP transfer status
 */
export async function trackCCTPTransfer(transferIdOrHash: string): Promise<{
  status: 'pending' | 'attesting' | 'completed' | 'failed';
  fromChain: string;
  toChain: string;
  amount: string;
  transactionHash: string;
  progress?: number;
  estimatedTime?: string;
  error?: string;
}> {
  try {
    // Import bridge status tracking (CCTP uses same API as bridge)
    const { getBridgeStatus } = await import('@/lib/bridge/cctp-bridge');
    
    // Try to get status using transfer ID or transaction hash
    const bridgeStatus = await getBridgeStatus(transferIdOrHash);
    
    // Map bridge status to CCTP status
    const cctpStatus = bridgeStatus.status === 'completed' ? 'completed' :
                      bridgeStatus.status === 'attesting' ? 'attesting' :
                      bridgeStatus.status === 'failed' ? 'failed' :
                      'pending';
    
    return {
      status: cctpStatus,
      fromChain: bridgeStatus.fromChain,
      toChain: bridgeStatus.toChain,
      amount: bridgeStatus.amount,
      transactionHash: bridgeStatus.transactionHash || transferIdOrHash,
      progress: bridgeStatus.progress,
      estimatedTime: bridgeStatus.estimatedTime,
      error: bridgeStatus.error,
    };
  } catch (error: any) {
    // If transfer ID lookup fails, try alternative approach
    // Check if it's a transaction hash and try to get status from Circle API directly
    try {
      const { circleApiRequest } = await import('@/lib/circle');
      
      // Try to get transfer by transaction hash
      const response = await circleApiRequest<any>(
        `/v1/w3s/transfers`,
        {
          method: 'GET',
          // Note: Circle API might need transfer ID, not hash
          // For now, return pending status if lookup fails
        }
      );
      
      // If we find the transfer, return its status
      if (response.data && Array.isArray(response.data)) {
        const transfer = response.data.find((t: any) => 
          t.transactionHash === transferIdOrHash || t.id === transferIdOrHash
        );
        
        if (transfer) {
          const status = transfer.status === 'complete' ? 'completed' :
                        transfer.status === 'pending' ? 'pending' :
                        transfer.status === 'failed' ? 'failed' :
                        'attesting';
          
          return {
            status,
            fromChain: transfer.source?.chain?.replace('-TESTNET', '').replace('-SEPOLIA', '') || '',
            toChain: transfer.destination?.chain?.replace('-TESTNET', '').replace('-SEPOLIA', '') || '',
            amount: transfer.amount?.amount ? (BigInt(transfer.amount.amount) / 1_000_000n).toString() : '0',
            transactionHash: transfer.transactionHash || transferIdOrHash,
          };
        }
      }
    } catch (apiError) {
      console.warn('[CCTP Tracking] Could not fetch transfer status:', apiError);
    }
    
    // Fallback: Return pending status if we can't determine actual status
    return {
      status: 'pending',
      fromChain: '',
      toChain: '',
      amount: '0',
      transactionHash: transferIdOrHash,
      error: 'Could not fetch transfer status. Transfer may still be processing.',
    };
  }
}

