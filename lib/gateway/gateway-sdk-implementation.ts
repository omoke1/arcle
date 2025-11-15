/**
 * Gateway Implementation using Circle SDK Signing
 * 
 * Implements Circle Gateway for cross-chain transfers using developer-controlled wallets
 * Uses Circle SDK's signTypedData() instead of requiring private keys
 * 
 * Reference: https://developers.circle.com/gateway/concepts/technical-guide
 */

import { getCircleClient } from "@/lib/circle-sdk";
import {
  getGatewayAddresses,
  getGatewayDestinationDomain,
  GATEWAY_API_V1_BALANCES,
  GATEWAY_API_V1_TRANSFER,
} from "./gateway-contracts";
import { generateUUID } from "@/lib/utils/uuid";
import { createTransferSpec, createBurnIntent, createBurnIntentTypedData, maxUint256 } from "./gateway-typed-data";
import { zeroAddress } from "viem";

export interface GatewaySDKTransferParams {
  walletId: string;
  walletAddress: string;
  amount: string; // USDC amount in decimal format
  fromChain: string;
  toChain: string;
  destinationAddress: string;
}

export interface GatewaySDKTransferResult {
  burnIntent?: any;
  signature?: string;
  attestation?: string;
  status: "depositing" | "signing" | "transferring" | "completed" | "failed";
  error?: string;
}

/**
 * Check Gateway balance using public API
 */
export async function checkGatewayBalanceSDK(
  address: string,
  chain: string
): Promise<number> {
  try {
    const domain = getGatewayDestinationDomain(chain);
    
    const response = await fetch(GATEWAY_API_V1_BALANCES, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: "USDC",
        sources: [
          {
            depositor: address,
            domain: domain,
          },
        ],
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Gateway API returned ${response.status}`);
    }
    
    const data = await response.json();
    const balanceEntry = data.balances?.find((b: any) => b.domain === domain);
    if (!balanceEntry) return 0;
    
    const balance = parseFloat(balanceEntry.balance || "0") / 1_000_000;
    return balance;
  } catch (error: any) {
    console.error("[Gateway SDK] Error checking balance:", error);
    return 0;
  }
}

/**
 * Deposit USDC to Gateway Wallet using Circle SDK
 * 
 * This enables instant cross-chain transfers for future bridging
 * Requires 2 transactions: Approve + Deposit
 */
export async function depositToGatewaySDK(
  params: GatewaySDKTransferParams
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const { walletId, walletAddress, amount, fromChain } = params;
    
    console.log(`[Gateway SDK] Depositing ${amount} USDC to Gateway on ${fromChain}...`);
    
    const addresses = getGatewayAddresses(fromChain);
    const amountInSmallestUnit = Math.floor(parseFloat(amount) * 1_000_000).toString();
    
    const client = getCircleClient();
    
    // Step 1: Approve Gateway Wallet to spend USDC
    console.log(`[Gateway SDK] Step 1: Approving Gateway Wallet...`);
    
    const approveResponse = await client.createContractExecutionTransaction({
      walletId,
      contractAddress: addresses.usdc,
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [addresses.gatewayWallet, amountInSmallestUnit],
      fee: {
        type: "level",
        config: {
          feeLevel: "MEDIUM" as const,
        },
      },
    });
    
    if (!approveResponse.data) {
      throw new Error("Failed to create approval transaction");
    }
    
    console.log(`[Gateway SDK] ✅ Approval transaction created: ${(approveResponse.data as any).id}`);
    
    // Wait a moment for approval to be indexed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: Deposit to Gateway Wallet
    console.log(`[Gateway SDK] Step 2: Depositing to Gateway Wallet...`);
    
    const depositResponse = await client.createContractExecutionTransaction({
      walletId,
      contractAddress: addresses.gatewayWallet,
      abiFunctionSignature: "deposit(address,uint256)",
      abiParameters: [addresses.usdc, amountInSmallestUnit],
      fee: {
        type: "level",
        config: {
          feeLevel: "MEDIUM" as const,
        },
      },
    });
    
    if (!depositResponse.data) {
      throw new Error("Failed to create deposit transaction");
    }
    
    const depositData = depositResponse.data as any;
    console.log(`[Gateway SDK] ✅ Deposit transaction created: ${depositData.id}`);
    console.log(`[Gateway SDK] ✅ ${amount} USDC deposited to Gateway!`);
    
    return {
      success: true,
      txHash: depositData.txHash || depositData.transactionHash,
    };
  } catch (error: any) {
    console.error(`[Gateway SDK] Deposit failed:`, error);
    return {
      success: false,
      error: error.message || "Failed to deposit to Gateway",
    };
  }
}

/**
 * Request Gateway transfer using Circle SDK for signing
 * 
 * This is the key improvement: uses Circle SDK's signTypedData()
 * instead of requiring a private key
 */
export async function requestGatewayTransferSDK(
  params: GatewaySDKTransferParams
): Promise<{ attestation: string; signature: string }> {
  const { walletId, walletAddress, amount, fromChain, toChain, destinationAddress } = params;
  
  const sourceAddresses = getGatewayAddresses(fromChain);
  const destAddresses = getGatewayAddresses(toChain);
  const sourceDomain = getGatewayDestinationDomain(fromChain);
  const destDomain = getGatewayDestinationDomain(toChain);
  
  const amountInSmallestUnit = BigInt(Math.floor(parseFloat(amount) * 1_000_000));
  
  // Generate salt (32 bytes)
  const salt = `0x${generateUUID().replace(/-/g, "").substring(0, 64).padStart(64, "0")}`;
  
  console.log(`[Gateway SDK] Creating transfer spec...`);
  console.log(`[Gateway SDK] From: ${fromChain} (domain ${sourceDomain})`);
  console.log(`[Gateway SDK] To: ${toChain} (domain ${destDomain})`);
  console.log(`[Gateway SDK] Amount: ${amount} USDC`);
  
  // Construct TransferSpec
  const transferSpec = createTransferSpec({
    version: 1,
    sourceDomain: sourceDomain,
    destinationDomain: destDomain,
    sourceContract: sourceAddresses.gatewayWallet,
    destinationContract: destAddresses.gatewayMinter,
    sourceToken: sourceAddresses.usdc,
    destinationToken: destAddresses.usdc,
    sourceDepositor: walletAddress,
    destinationRecipient: destinationAddress,
    sourceSigner: walletAddress, // Use wallet address as signer
    destinationCaller: zeroAddress, // 0 = any caller can mint
    value: amountInSmallestUnit,
    salt: salt,
    hookData: "0x",
  });
  
  // Construct BurnIntent
  const burnIntent = createBurnIntent({
    maxBlockHeight: maxUint256,
    maxFee: BigInt(2_010_000), // 2.01 USDC
    spec: transferSpec,
  });
  
  console.log(`[Gateway SDK] Signing burn intent with Circle SDK...`);
  
  // **KEY IMPROVEMENT**: Use Circle SDK to sign instead of requiring private key
  const client = getCircleClient();
  
  try {
    // Create EIP-712 typed data
    const typedData = createBurnIntentTypedData(burnIntent);
    
    // Convert typed data to string format required by Circle SDK
    const typedDataString = JSON.stringify({
      types: typedData.types,
      domain: typedData.domain,
      primaryType: typedData.primaryType,
      message: typedData.message,
    });
    
    // Sign with Circle SDK
    const signResponse = await client.signTypedData({
      walletId: walletId,
      data: typedDataString,
      memo: `Gateway transfer: ${amount} USDC from ${fromChain} to ${toChain}`,
    });
    
    if (!signResponse.data?.signature) {
      throw new Error("Failed to get signature from Circle SDK");
    }
    
    const signature = signResponse.data.signature;
    console.log(`[Gateway SDK] ✅ Burn intent signed successfully`);
    
    // Request attestation from Gateway API
    console.log(`[Gateway SDK] Requesting attestation from Gateway API...`);
    
    const response = await fetch(GATEWAY_API_V1_TRANSFER, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        {
          burnIntent: burnIntent,
          signature: signature,
        },
      ]),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Gateway API returned ${response.status}: ${errorData.message || "Unknown error"}`);
    }
    
    const data = await response.json();
    
    if (!data.attestation || !data.signature) {
      throw new Error("Gateway API did not return attestation and signature");
    }
    
    console.log(`[Gateway SDK] ✅ Attestation received`);
    
    return {
      attestation: data.attestation,
      signature: data.signature,
    };
  } catch (error: any) {
    console.error("[Gateway SDK] Error signing or requesting transfer:", error);
    throw new Error(
      `Failed to request Gateway transfer: ${error.message}. ` +
      `Note: Smart Contract Accounts (SCA) may have limitations. ` +
      `Check https://eip1271.io/ for SCA compatibility.`
    );
  }
}

/**
 * Execute complete Gateway transfer flow
 * 
 * Simplified flow:
 * 1. Check balance (assumes already deposited for now)
 * 2. Request transfer (sign + get attestation)
 * 3. Return attestation for minting
 * 
 * Note: Deposit and mint steps are handled separately for better control
 */
export async function executeGatewayTransferSDK(
  params: GatewaySDKTransferParams
): Promise<GatewaySDKTransferResult> {
  try {
    const { walletId, walletAddress, amount, fromChain } = params;
    
    console.log(`[Gateway SDK] Starting transfer: ${amount} USDC from ${fromChain}`);
    
    // Step 1: Check Gateway balance
    console.log(`[Gateway SDK] Step 1: Checking Gateway balance...`);
    const balance = await checkGatewayBalanceSDK(walletAddress, fromChain);
    const requiredAmount = parseFloat(amount);
    
    console.log(`[Gateway SDK] Current Gateway balance: ${balance} USDC`);
    console.log(`[Gateway SDK] Required amount: ${requiredAmount} USDC`);
    
    // Step 2: Auto-deposit if insufficient balance
    if (balance < requiredAmount) {
      const depositAmount = requiredAmount - balance;
      console.log(`[Gateway SDK] 💡 Insufficient balance. Auto-depositing ${depositAmount} USDC...`);
      
      const depositResult = await depositToGatewaySDK({
        ...params,
        amount: depositAmount.toString(),
      });
      
      if (!depositResult.success) {
        return {
          status: "failed",
          error: `Failed to auto-deposit to Gateway: ${depositResult.error}. ` +
                 `Current balance: ${balance} USDC, needed: ${requiredAmount} USDC.`,
        };
      }
      
      console.log(`[Gateway SDK] ✅ Auto-deposit successful! Deposited ${depositAmount} USDC`);
      
      // Wait a moment for deposit to be indexed by Gateway
      console.log(`[Gateway SDK] Waiting for Gateway to index deposit...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Verify new balance
      const newBalance = await checkGatewayBalanceSDK(walletAddress, fromChain);
      console.log(`[Gateway SDK] New Gateway balance: ${newBalance} USDC`);
      
      if (newBalance < requiredAmount) {
        console.warn(`[Gateway SDK] ⚠️ Balance still insufficient after deposit. Proceeding anyway...`);
      }
    } else {
      console.log(`[Gateway SDK] ✅ Sufficient balance: ${balance} USDC`);
    }
    
    // Step 3: Request transfer (sign + get attestation)
    console.log(`[Gateway SDK] Step 3: Requesting transfer attestation...`);
    const { attestation, signature } = await requestGatewayTransferSDK(params);
    
    return {
      attestation,
      signature,
      status: "completed",
    };
  } catch (error: any) {
    console.error(`[Gateway SDK] Transfer failed:`, error);
    return {
      status: "failed",
      error: error.message || "Gateway transfer failed",
    };
  }
}

