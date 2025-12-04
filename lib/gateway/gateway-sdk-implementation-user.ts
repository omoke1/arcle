/**
 * Gateway Implementation for User-Controlled Wallets
 * 
 * Circle Gateway enables instant cross-chain USDC transfers
 * Uses User-Controlled Wallets SDK with EIP-712 signing
 * 
 * Flow:
 * 1. Deposit USDC to Gateway (one-time setup)
 * 2. Create burn intent for transfer
 * 3. Sign burn intent with EIP-712
 * 4. Submit to Gateway API for instant transfer
 */

import { signTypedData, executeContract, ContractExecutionResult } from '@/lib/circle-user-sdk-advanced';
import {
  getGatewayAddresses,
  getGatewayDestinationDomain,
  GATEWAY_API_V1_BALANCES,
  GATEWAY_API_V1_TRANSFER,
} from "./gateway-contracts";
import { createTransferSpec, createBurnIntent, createBurnIntentTypedData } from "./gateway-typed-data";
import { generateUUID } from "@/lib/utils/uuid";

export interface GatewayUserTransferParams {
  userId: string;
  userToken: string;
  walletId: string;
  walletAddress: string;
  amount: string; // USDC amount in decimal format
  fromChain: string;
  toChain: string;
  destinationAddress: string;
}

export interface GatewayUserTransferResult {
  success: boolean;
  challengeId?: string;
  signature?: string;
  burnIntent?: any;
  attestation?: string;
  status: "signing" | "transferring" | "completed" | "failed";
  error?: string;
}

/**
 * Check Gateway balance using public API
 */
export async function checkGatewayBalanceUser(
  address: string,
  chain: string
): Promise<number> {
  try {
    const domain = getGatewayDestinationDomain(chain);
    
    const response = await fetch(GATEWAY_API_V1_BALANCES, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner: address.toLowerCase(),
        domain,
      }),
    });

    if (!response.ok) {
      console.error(`[Gateway User] Balance check failed: ${response.statusText}`);
      return 0;
    }

    const data = await response.json();
    const balanceInSmallestUnit = data.balance || "0";
    const balanceInUSDC = parseFloat(balanceInSmallestUnit) / 1_000_000;

    console.log(`[Gateway User] Gateway balance: ${balanceInUSDC} USDC`);
    return balanceInUSDC;
  } catch (error: any) {
    console.error(`[Gateway User] Error checking balance:`, error);
    return 0;
  }
}

/**
 * Deposit USDC to Gateway (one-time setup)
 * 
 * @param sessionKey Optional session key to use for approval (reduces PIN prompts)
 */
export async function depositToGatewayUser(
  userId: string,
  userToken: string,
  walletId: string,
  chain: string,
  amount: string,
  sessionKey?: any // CircleSessionKey - optional for PIN-less approval
): Promise<ContractExecutionResult> {
  try {
    const addresses = getGatewayAddresses(chain);
    if (!addresses) {
      throw new Error(`Gateway not supported on ${chain}`);
    }

    const amountInSmallestUnit = Math.floor(parseFloat(amount) * 1_000_000).toString();

    console.log(`[Gateway User] Depositing ${amount} USDC to Gateway on ${chain}`);

    // Step 1: Approve Gateway to spend USDC
    // Try using session key first if available (reduces PIN prompts)
    console.log(`[Gateway User] Step 1: Creating approval challenge...`);
    
    let approveResult: ContractExecutionResult;
    
    if (sessionKey) {
      console.log(`[Gateway User] Attempting approval via session key (no PIN)...`);
      try {
        const { delegateExecution } = await import('@/lib/wallet/sessionKeys/delegateExecution');
        const delegateResult = await delegateExecution({
          walletId,
          userId,
          userToken,
          action: 'approve',
          contractAddress: addresses.usdc,
          abiFunctionSignature: "approve(address,uint256)",
          abiParameters: [addresses.gatewayWallet, amountInSmallestUnit],
          agentId: sessionKey.agentId || 'inera',
        });
        
        if (delegateResult.success && delegateResult.executedViaSessionKey) {
          console.log(`[Gateway User] ✅ Approval executed via session key (no PIN)`);
          approveResult = {
            success: true,
            challengeId: delegateResult.challengeId,
            transactionId: delegateResult.transactionId,
            transactionHash: delegateResult.transactionHash,
          };
        } else {
          // Fall through to regular approval
          console.log(`[Gateway User] Session key approval not available, using regular approval...`);
          approveResult = await executeContract({
            userId,
            userToken,
            walletId,
            contractAddress: addresses.usdc,
            abiFunctionSignature: "approve(address,uint256)",
            abiParameters: [addresses.gatewayWallet, amountInSmallestUnit],
            feeLevel: "MEDIUM",
            refId: `gateway-approve-${Date.now()}`,
          });
        }
      } catch (error: any) {
        console.warn(`[Gateway User] Session key approval failed, falling back to regular approval:`, error.message);
        approveResult = await executeContract({
          userId,
          userToken,
          walletId,
          contractAddress: addresses.usdc,
          abiFunctionSignature: "approve(address,uint256)",
          abiParameters: [addresses.gatewayWallet, amountInSmallestUnit],
          feeLevel: "MEDIUM",
          refId: `gateway-approve-${Date.now()}`,
        });
      }
    } else {
      approveResult = await executeContract({
        userId,
        userToken,
        walletId,
        contractAddress: addresses.usdc,
        abiFunctionSignature: "approve(address,uint256)",
        abiParameters: [addresses.gatewayWallet, amountInSmallestUnit],
        feeLevel: "MEDIUM",
        refId: `gateway-approve-${Date.now()}`,
      });
    }

    if (!approveResult.success) {
      throw new Error(`Failed to approve USDC: ${approveResult.error}`);
    }

    console.log(`[Gateway User] ✅ Approval challenge created: ${approveResult.challengeId}`);

    // Wait for approval
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 2: Deposit to Gateway
    console.log(`[Gateway User] Step 2: Creating deposit challenge...`);
    
    const depositResult = await executeContract({
      userId,
      userToken,
      walletId,
      contractAddress: addresses.gatewayWallet,
      abiFunctionSignature: "deposit(uint256,address)",
      abiParameters: [amountInSmallestUnit, addresses.usdc],
      feeLevel: "MEDIUM",
      refId: `gateway-deposit-${Date.now()}`,
    });

    console.log(`[Gateway User] ✅ Deposit challenge created: ${depositResult.challengeId}`);

    return depositResult;
  } catch (error: any) {
    console.error(`[Gateway User] Deposit error:`, error);
    return {
      success: false,
      error: error.message || "Failed to deposit to Gateway",
    };
  }
}

/**
 * Execute Gateway transfer (instant cross-chain)
 * 
 * This creates a burn intent and signs it with EIP-712
 * The signature is then submitted to Gateway API for instant transfer
 * 
 * If sessionKey is provided, signs with session key (no PIN required)
 * Otherwise, uses Circle's signTypedData API (requires PIN)
 */
export async function transferViaGatewayUser(
  params: GatewayUserTransferParams,
  sessionKey?: any // CircleSessionKey - optional for PIN-less execution
): Promise<GatewayUserTransferResult> {
  try {
    const addresses = getGatewayAddresses(params.fromChain);
    if (!addresses) {
      return {
        success: false,
        error: `Gateway not supported on ${params.fromChain}`,
        status: "failed",
      };
    }

    // Check Gateway balance
    const balance = await checkGatewayBalanceUser(params.walletAddress, params.fromChain);
    const requiredAmount = parseFloat(params.amount);

    if (balance < requiredAmount) {
      return {
        success: false,
        error: `Insufficient Gateway balance. Have: ${balance} USDC, Need: ${requiredAmount} USDC. Please deposit first.`,
        status: "failed",
      };
    }

    const amountInBigInt = BigInt(Math.floor(requiredAmount * 1_000_000));
    
    const destAddresses = getGatewayAddresses(params.toChain);
    if (!destAddresses) {
      return {
        success: false,
        error: `Gateway not supported on ${params.toChain}`,
        status: "failed",
      };
    }

    // Generate salt (32 bytes)
    const salt = `0x${generateUUID().replace(/-/g, "").substring(0, 64).padStart(64, "0")}`;
    
    // Create transfer spec
    const transferSpec = createTransferSpec({
      version: 1,
      sourceDomain: getGatewayDestinationDomain(params.fromChain)!,
      destinationDomain: getGatewayDestinationDomain(params.toChain)!,
      sourceContract: addresses.gatewayWallet,
      destinationContract: destAddresses.gatewayMinter,
      sourceToken: addresses.usdc,
      destinationToken: destAddresses.usdc,
      sourceDepositor: params.walletAddress,
      destinationRecipient: params.destinationAddress,
      sourceSigner: params.walletAddress,
      destinationCaller: "0x0000000000000000000000000000000000000000",
      value: amountInBigInt,
      salt: salt,
      hookData: "0x",
    });

    // Create burn intent
    const burnIntent = createBurnIntent({
      maxBlockHeight: "999999999999",
      maxFee: "2010000", // 2.01 USDC
      spec: transferSpec,
    });

    // Create EIP-712 typed data for signing
    const typedData = createBurnIntentTypedData(burnIntent);

    // Check if session key is provided for PIN-less signing
    if (sessionKey) {
      console.log(`[Gateway User] Signing with session key (no PIN required)...`);
      
      try {
        const { signTypedDataWithSessionKey } = await import('@/lib/wallet/sessionKeys/sessionKeyWallet');
        const signature = await signTypedDataWithSessionKey(
          typedData.domain,
          typedData.types,
          typedData.message,
          sessionKey
        );

        console.log(`[Gateway User] ✅ Signed with session key, submitting to Gateway API...`);

        // Submit directly to Gateway API (no PIN required)
        const submitResult = await submitGatewayTransfer(burnIntent, signature);
        
        if (submitResult.success) {
          return {
            success: true,
            signature,
            burnIntent,
            attestation: submitResult.attestation,
            status: "completed",
          };
        } else {
          return {
            success: false,
            error: submitResult.error || "Failed to submit to Gateway API",
            status: "failed",
          };
        }
      } catch (error: any) {
        console.error(`[Gateway User] Session key signing error:`, error);
        return {
          success: false,
          error: `Session key signing failed: ${error.message}`,
          status: "failed",
        };
      }
    }

    // Fallback to Circle's signTypedData API (requires PIN)
    console.log(`[Gateway User] No session key provided, creating EIP-712 signing challenge (PIN required)...`);

    // Sign with User-Controlled Wallet
    const signResult = await signTypedData({
      userId: params.userId,
      userToken: params.userToken,
      walletId: params.walletId,
      domain: typedData.domain,
      types: typedData.types,
      value: typedData.message,
      memo: `Gateway transfer: ${params.amount} USDC from ${params.fromChain} to ${params.toChain}`,
    });

    if (!signResult.success) {
      return {
        success: false,
        error: `Failed to create signing challenge: ${signResult.error}`,
        status: "failed",
      };
    }

    console.log(`[Gateway User] ✅ Signing challenge created: ${signResult.challengeId}`);

    // Return early - user needs to complete signing challenge
    // After signing is complete, call Gateway API in a separate request
    return {
      success: true,
      challengeId: signResult.challengeId,
      burnIntent,
      status: "signing",
    };
  } catch (error: any) {
    console.error(`[Gateway User] Transfer error:`, error);
    return {
      success: false,
      error: error.message || "Failed to execute Gateway transfer",
      status: "failed",
    };
  }
}

/**
 * Submit signed burn intent to Gateway API
 * Call this after user completes the signing challenge
 */
export async function submitGatewayTransfer(
  burnIntent: any,
  signature: string
): Promise<{
  success: boolean;
  attestation?: string;
  error?: string;
}> {
  try {
    console.log(`[Gateway User] Submitting signed burn intent to Gateway API...`);

    const response = await fetch(GATEWAY_API_V1_TRANSFER, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        burnIntent,
        signature,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gateway API error: ${errorText}`);
    }

    const data = await response.json();

    console.log(`[Gateway User] ✅ Transfer submitted successfully`);

    return {
      success: true,
      attestation: data.attestation || data.messageHash,
    };
  } catch (error: any) {
    console.error(`[Gateway User] Submit error:`, error);
    return {
      success: false,
      error: error.message || "Failed to submit to Gateway API",
    };
  }
}

/**
 * Get supported chains for Gateway
 */
export function getSupportedGatewayChains(): string[] {
  return ["ETH", "ETH-SEPOLIA", "ARB", "ARB-SEPOLIA", "BASE", "BASE-SEPOLIA", "OP", "OP-SEPOLIA", "AVAX", "AVAX-FUJI", "MATIC", "MATIC-AMOY", "ARC-TESTNET"];
}

/**
 * Check if Gateway is available between two chains
 */
export function isGatewayAvailable(fromChain: string, toChain: string): boolean {
  const addresses1 = getGatewayAddresses(fromChain);
  const addresses2 = getGatewayAddresses(toChain);
  const domain1 = getGatewayDestinationDomain(fromChain);
  const domain2 = getGatewayDestinationDomain(toChain);
  
  return !!addresses1 && !!addresses2 && domain1 !== null && domain2 !== null;
}

