/**
 * Circle User-Controlled Wallets SDK - Advanced Operations
 * 
 * Provides contract execution and advanced features for User-Controlled Wallets
 * Includes support for:
 * - Smart contract execution
 * - USYC (Yield/Savings)
 * - CCTP (Cross-Chain Transfer Protocol)
 * - Gateway (Fast Cross-Chain Transfers)
 */

import { getUserCircleClient } from './circle-user-sdk';

export interface ContractExecutionParams {
  userId: string;
  userToken: string;
  walletId: string;
  contractAddress: string;
  abiFunctionSignature: string;
  abiParameters: any[];
  amount?: string; // Optional: native token amount to send
  feeLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  refId?: string;
}

export interface ContractExecutionResult {
  success: boolean;
  challengeId?: string;
  transactionId?: string;
  transactionHash?: string;
  error?: string;
}

/**
 * Execute a smart contract call with User-Controlled Wallets
 * 
 * This creates a challenge that the user must complete to execute the transaction.
 * The user will be prompted to approve the transaction via their authentication method.
 */
export async function executeContract(
  params: ContractExecutionParams
): Promise<ContractExecutionResult> {
  try {
    const client = getUserCircleClient();

    console.log(`[User SDK] Creating contract execution challenge...`);
    console.log(`[User SDK] Contract: ${params.contractAddress}`);
    console.log(`[User SDK] Function: ${params.abiFunctionSignature}`);

    // Create challenge for contract execution
    const response = await (client as any).createUserTransactionContractExecutionChallenge({
      userToken: params.userToken,
      walletId: params.walletId,
      contractAddress: params.contractAddress,
      abiFunctionSignature: params.abiFunctionSignature,
      abiParameters: params.abiParameters,
      ...(params.amount && { amount: params.amount }),
      fee: {
        type: 'level',
        config: {
          feeLevel: params.feeLevel || 'MEDIUM',
        },
      },
      ...(params.refId && { refId: params.refId }),
    });

    if (!response.data?.challengeId) {
      throw new Error('Failed to create contract execution challenge');
    }

    console.log(`[User SDK] ✅ Challenge created: ${response.data.challengeId}`);

    return {
      success: true,
      challengeId: response.data.challengeId,
    };
  } catch (error: any) {
    console.error(`[User SDK] Contract execution error:`, error);
    return {
      success: false,
      error: error.message || 'Failed to execute contract',
    };
  }
}

/**
 * Execute multiple contract calls in sequence
 * Useful for approve + call patterns (e.g., USYC subscription/redemption)
 */
export async function executeContractSequence(
  calls: ContractExecutionParams[]
): Promise<ContractExecutionResult[]> {
  const results: ContractExecutionResult[] = [];

  for (const call of calls) {
    const result = await executeContract(call);
    results.push(result);

    // If any call fails, stop the sequence
    if (!result.success) {
      console.error(`[User SDK] Sequence failed at call to ${call.contractAddress}`);
      break;
    }

    // Wait between calls for user to complete challenge
    console.log(`[User SDK] Waiting for user to complete challenge...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return results;
}

/**
 * Sign typed data (EIP-712) with User-Controlled Wallet
 * Used for Gateway and other DeFi protocols
 */
export interface SignTypedDataParams {
  userId: string;
  userToken: string;
  walletId: string;
  domain: any;
  types: any;
  value: any;
  memo?: string;
}

export interface SignTypedDataResult {
  success: boolean;
  challengeId?: string;
  signature?: string;
  error?: string;
}

export async function signTypedData(
  params: SignTypedDataParams
): Promise<SignTypedDataResult> {
  try {
    const client = getUserCircleClient();

    console.log(`[User SDK] Creating typed data signing challenge...`);

    // Create challenge for signing typed data
    const response = await (client as any).signTypedData({
      userToken: params.userToken,
      walletId: params.walletId,
      typedData: JSON.stringify({
        domain: params.domain,
        types: params.types,
        value: params.value,
      }),
      ...(params.memo && { memo: params.memo }),
    });

    if (!response.data?.challengeId) {
      throw new Error('Failed to create signing challenge');
    }

    console.log(`[User SDK] ✅ Signing challenge created: ${response.data.challengeId}`);

    return {
      success: true,
      challengeId: response.data.challengeId,
    };
  } catch (error: any) {
    console.error(`[User SDK] Signing error:`, error);
    return {
      success: false,
      error: error.message || 'Failed to sign typed data',
    };
  }
}

/**
 * Get challenge status
 * Polls the challenge to see if user has completed it
 */
export async function getChallengeStatus(
  userToken: string,
  challengeId: string
): Promise<{
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'FAILED' | 'EXPIRED';
  transactionId?: string;
  transactionHash?: string;
}> {
  try {
    const client = getUserCircleClient();

    const response = await (client as any).getChallenge({
      userToken,
      id: challengeId,
    });

    return {
      status: response.data?.status || 'PENDING',
      transactionId: response.data?.transactionId,
      transactionHash: response.data?.transactionHash,
    };
  } catch (error: any) {
    console.error(`[User SDK] Failed to get challenge status:`, error);
    return {
      status: 'FAILED',
    };
  }
}

/**
 * Wait for challenge completion
 * Polls until challenge is complete or times out
 */
export async function waitForChallengeCompletion(
  userToken: string,
  challengeId: string,
  maxAttempts: number = 60,
  intervalMs: number = 2000
): Promise<ContractExecutionResult> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getChallengeStatus(userToken, challengeId);

    if (status.status === 'COMPLETE') {
      return {
        success: true,
        challengeId,
        transactionId: status.transactionId,
        transactionHash: status.transactionHash,
      };
    }

    if (status.status === 'FAILED' || status.status === 'EXPIRED') {
      return {
        success: false,
        challengeId,
        error: `Challenge ${status.status.toLowerCase()}`,
      };
    }

    // Still pending or in progress, wait and retry
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return {
    success: false,
    challengeId,
    error: 'Challenge timeout',
  };
}

/**
 * Helper to execute contract and wait for completion
 */
export async function executeContractAndWait(
  params: ContractExecutionParams,
  waitForCompletion: boolean = false
): Promise<ContractExecutionResult> {
  const result = await executeContract(params);

  if (!result.success || !result.challengeId || !waitForCompletion) {
    return result;
  }

  console.log(`[User SDK] Waiting for challenge completion...`);
  return waitForChallengeCompletion(params.userToken, result.challengeId);
}












