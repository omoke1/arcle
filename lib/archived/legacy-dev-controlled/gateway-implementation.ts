/**
 * Gateway Implementation
 * 
 * Implements Circle Gateway for cross-chain transfers
 * Reference: https://developers.circle.com/gateway/concepts/technical-guide
 */

import { encodeFunctionData, createWalletClient, http, zeroAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getCircleClient } from "@/lib/archived/circle-sdk-developer-controlled";
import { circleApiRequest } from "@/lib/circle";
import { 
  getGatewayAddresses, 
  getGatewayDestinationDomain,
  GATEWAY_API_V1_BALANCES,
  GATEWAY_API_V1_TRANSFER,
  GATEWAY_WALLET_ABI,
  GATEWAY_MINTER_ABI,
  USDC_ABI,
} from "../../gateway/gateway-contracts";
import { generateUUID } from "@/lib/utils/uuid";
import {
  createTransferSpec,
  createBurnIntent,
  createBurnIntentTypedData,
  maxUint256,
} from "../../gateway/gateway-typed-data";

export interface GatewayTransferParams {
  walletId: string;
  walletAddress: string;
  amount: string; // USDC amount in decimal format
  fromChain: string;
  toChain: string;
  destinationAddress: string;
  // Optional: EOA address to sign burn intent (required for SCAs)
  signerAddress?: string;
  // Optional: Private key for signing (required for EIP-712 signing)
  // If not provided, will try to use wallet's signing capability
  privateKey?: string;
}

export interface GatewayTransferResult {
  depositTxHash?: string;
  attestation?: string;
  signature?: string;
  mintTxHash?: string;
  status: "depositing" | "transferring" | "minting" | "completed" | "failed";
  error?: string;
}

/**
 * Step 1: Check Gateway balance
 * 
 * Checks if user has sufficient balance in Gateway Wallet
 */
export async function checkGatewayBalance(
  address: string,
  chain: string
): Promise<number> {
  try {
    // Gateway API expects POST with domain numbers
    // Reference: https://developers.circle.com/gateway/quickstarts/unified-balance
    const domain = getGatewayDestinationDomain(chain);
    
    const response = await fetch(GATEWAY_API_V1_BALANCES, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
    // Gateway API returns balances array
    const balanceEntry = data.balances?.find((b: any) => b.domain === domain);
    if (!balanceEntry) {
      return 0;
    }
    // Gateway API returns balance as string in smallest unit (6 decimals for USDC)
    const balance = parseFloat(balanceEntry.balance || "0") / 1_000_000;
    return balance;
  } catch (error: any) {
    console.error("[Gateway] Error checking balance:", error);
    return 0;
  }
}

/**
 * Step 2: Deposit USDC into Gateway Wallet
 * 
 * Deposits USDC into the Gateway Wallet contract on the source chain
 */
export async function depositToGateway(
  walletId: string,
  walletAddress: string,
  chain: string,
  amount: string
): Promise<string> {
  const addresses = getGatewayAddresses(chain);
  const amountInSmallestUnit = BigInt(Math.floor(parseFloat(amount) * 1_000_000));
  
  console.log(`[Gateway] Depositing ${amount} USDC to Gateway Wallet on ${chain}`);
  console.log(`[Gateway] Gateway Wallet: ${addresses.gatewayWallet}`);
  
  // First, approve USDC spending if needed
  const { circleApiRequest } = await import("@/lib/circle");
  
  try {
    // Check allowance
    const allowanceCallData = encodeFunctionData({
      abi: USDC_ABI,
      functionName: "allowance",
      args: [
        walletAddress as `0x${string}`,
        addresses.gatewayWallet as `0x${string}`,
      ],
    });
    
    // For now, we'll assume approval is needed and try to approve
    // In production, you'd check allowance first
    const approveCallData = encodeFunctionData({
      abi: USDC_ABI,
      functionName: "approve",
      args: [
        addresses.gatewayWallet as `0x${string}`,
        amountInSmallestUnit,
      ],
    });
    
    // Try to approve via Circle API
    try {
      const approveResponse = await circleApiRequest<any>(
        `/v1/w3s/developer/transactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idempotencyKey: generateUUID(),
            walletId: walletId,
            destinationAddress: addresses.usdc,
            data: approveCallData,
            fee: {
              type: "level",
              config: { feeLevel: "MEDIUM" },
            },
            blockchain: chain,
          }),
        }
      );
      console.log("[Gateway] Approval transaction created");
    } catch (approveError: any) {
      console.warn("[Gateway] Approval may have failed or not needed:", approveError.message);
    }
    
    // Now deposit to Gateway Wallet
    const depositCallData = encodeFunctionData({
      abi: GATEWAY_WALLET_ABI,
      functionName: "deposit",
      args: [
        addresses.usdc as `0x${string}`,
        amountInSmallestUnit,
      ],
    });
    
    // Create deposit transaction via Circle API
    const depositResponse = await circleApiRequest<any>(
      `/v1/w3s/developer/transactions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: generateUUID(),
          walletId: walletId,
          destinationAddress: addresses.gatewayWallet,
          data: depositCallData,
          fee: {
            type: "level",
            config: { feeLevel: "MEDIUM" },
          },
          blockchain: chain,
        }),
      }
    );
    
    if (!depositResponse.data) {
      throw new Error("No transaction data returned from deposit");
    }
    
    const txHash = depositResponse.data.txHash || depositResponse.data.transactionHash || depositResponse.data.id;
    console.log(`[Gateway] ✅ Deposit transaction: ${txHash}`);
    
    return txHash;
  } catch (error: any) {
    throw new Error(
      `Failed to deposit to Gateway Wallet. ` +
      `Circle API may not support contract calls via 'data' field. ` +
      `Error: ${error.message || "Unknown error"}`
    );
  }
}

/**
 * Step 3: Request transfer attestation from Gateway API
 * 
 * Creates a burn intent and requests an attestation from Gateway API
 */
export async function requestGatewayTransfer(
  params: GatewayTransferParams
): Promise<{ attestation: string; signature: string }> {
  const { walletAddress, amount, fromChain, toChain, destinationAddress, signerAddress } = params;
  
  const sourceAddresses = getGatewayAddresses(fromChain);
  const destAddresses = getGatewayAddresses(toChain);
  const sourceDomain = getGatewayDestinationDomain(fromChain);
  const destDomain = getGatewayDestinationDomain(toChain);
  
  const amountInSmallestUnit = BigInt(Math.floor(parseFloat(amount) * 1_000_000));
  
  // Generate salt (32 bytes = 64 hex chars)
  const salt = `0x${generateUUID().replace(/-/g, "").substring(0, 64).padStart(64, "0")}`;
  
  // Construct TransferSpec with proper bytes32 encoding
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
    sourceSigner: signerAddress || walletAddress, // Use signer if provided, otherwise wallet
    destinationCaller: zeroAddress, // 0 = any caller
    value: amountInSmallestUnit,
    salt: salt,
    hookData: "0x",
  });
  
  // Construct BurnIntent
  // Reference: https://developers.circle.com/gateway/concepts/technical-guide#burn-intent
  // Using maxUint256 for maxBlockHeight (from quickstart example)
  // maxFee: 2.01 USDC (2010000 in smallest unit) to cover fees
  const burnIntent = createBurnIntent({
    maxBlockHeight: maxUint256,
    maxFee: BigInt(2_010_000), // 2.01 USDC
    spec: transferSpec,
  });
  
  console.log(`[Gateway] Requesting transfer attestation from API...`);
  console.log(`[Gateway] From: ${fromChain} (${sourceDomain})`);
  console.log(`[Gateway] To: ${toChain} (${destDomain})`);
  console.log(`[Gateway] Amount: ${amount} USDC`);
  
  // Sign burn intent with EIP-712
  let signature: string;
  const signerAddr = signerAddress || walletAddress;
  
  try {
    if (params.privateKey) {
      // Sign with provided private key (EOA)
      console.log(`[Gateway] Signing burn intent with private key...`);
      const account = privateKeyToAccount(params.privateKey as `0x${string}`);
      
      // Create typed data for signing
      const typedData = createBurnIntentTypedData(burnIntent);
      
      // Sign with viem wallet client
      const walletClient = createWalletClient({
        account,
        chain: undefined, // Not needed for signing
        transport: http(),
      });
      
      signature = await walletClient.signTypedData(typedData);
      console.log(`[Gateway] ✅ Burn intent signed`);
    } else {
      // Try to sign using Circle SDK or wallet capabilities
      // For SCAs, this won't work - need delegate mechanism
      throw new Error(
        "Private key required for signing burn intent. " +
        "Gateway requires EOA signatures. " +
        "For Smart Contract Accounts, use delegate mechanism or provide private key."
      );
    }
  } catch (signError: any) {
    throw new Error(
      `Failed to sign burn intent: ${signError.message}. ` +
      `Gateway requires EIP-712 signed burn intents from an EOA (or delegate for SCAs).`
    );
  }
  
  try {
    // Gateway API expects array of { burnIntent, signature }
    // Reference: https://developers.circle.com/gateway/quickstarts/unified-balance
    const response = await fetch(GATEWAY_API_V1_TRANSFER, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Gateway testnet API doesn't require Bearer token
      },
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
    
    console.log(`[Gateway] ✅ Attestation received`);
    
    return {
      attestation: data.attestation,
      signature: data.signature,
    };
  } catch (error: any) {
    throw new Error(
      `Failed to request Gateway transfer. ` +
      `Error: ${error.message || "Unknown error"}. ` +
      `Note: Burn intent must be signed by an EOA (or delegate for SCAs).`
    );
  }
}

/**
 * Step 4: Mint USDC on destination chain
 * 
 * Calls Gateway Minter contract to mint USDC using the attestation
 */
export async function mintFromGateway(
  attestation: string,
  signature: string,
  toChain: string,
  walletId: string
): Promise<string> {
  // For destination chains, we only need Gateway Minter (not Wallet)
  let destAddresses;
  try {
    destAddresses = getGatewayAddresses(toChain);
  } catch (error: any) {
    // If Gateway addresses not found, try to get just the minter
    // Gateway Minter can be deployed on chains without Gateway Wallet
    throw new Error(
      `Gateway Minter not found for destination chain: ${toChain}. ` +
      `Gateway Minter must be deployed on destination chain. ` +
      `Error: ${error.message}`
    );
  }
  
  if (destAddresses.gatewayMinter === "0x0000000000000000000000000000000000000000") {
    throw new Error(`Gateway Minter not deployed on destination chain: ${toChain}`);
  }
  
  console.log(`[Gateway] Minting USDC on ${toChain}`);
  console.log(`[Gateway] Gateway Minter: ${destAddresses.gatewayMinter}`);
  
  // Encode gatewayMint function call
  // Note: Function is called "gatewayMint" not "mint", and parameter is "attestationPayload"
  const mintCallData = encodeFunctionData({
    abi: GATEWAY_MINTER_ABI,
    functionName: "gatewayMint",
    args: [
      attestation as `0x${string}`, // attestationPayload
      signature as `0x${string}`,
    ],
  });
  
  // Create mint transaction via Circle API
  const { circleApiRequest } = await import("@/lib/circle");
  
  try {
    const mintResponse = await circleApiRequest<any>(
      `/v1/w3s/developer/transactions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: generateUUID(),
          walletId: walletId,
          destinationAddress: destAddresses.gatewayMinter,
          data: mintCallData,
          fee: {
            type: "level",
            config: { feeLevel: "MEDIUM" },
          },
          blockchain: toChain,
        }),
      }
    );
    
    if (!mintResponse.data) {
      throw new Error("No transaction data returned from mint");
    }
    
    const txHash = mintResponse.data.txHash || mintResponse.data.transactionHash || mintResponse.data.id;
    console.log(`[Gateway] ✅ Mint transaction: ${txHash}`);
    
    return txHash;
  } catch (error: any) {
    throw new Error(
      `Failed to mint from Gateway. ` +
      `Circle API may not support contract calls via 'data' field. ` +
      `Error: ${error.message || "Unknown error"}`
    );
  }
}

/**
 * Execute Gateway Transfer
 * 
 * Full flow: Check balance -> Deposit (if needed) -> Request transfer -> Mint
 */
export async function executeGatewayTransfer(
  params: GatewayTransferParams
): Promise<GatewayTransferResult> {
  try {
    const { walletAddress, amount, fromChain, toChain } = params;
    
    // Step 1: Check Gateway balance
    console.log(`[Gateway] Step 1: Checking Gateway balance...`);
    const balance = await checkGatewayBalance(walletAddress, fromChain);
    const requiredAmount = parseFloat(amount);
    
    if (balance < requiredAmount) {
      // Need to deposit
      console.log(`[Gateway] Insufficient balance (${balance} < ${requiredAmount}). Depositing...`);
      const depositTxHash = await depositToGateway(
        params.walletId,
        walletAddress,
        fromChain,
        (requiredAmount - balance).toString()
      );
      
      // Wait for deposit to finalize (in production, poll for finality)
      console.log(`[Gateway] Waiting for deposit to finalize...`);
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30s (placeholder)
    }
    
    // Step 2: Request transfer attestation
    console.log(`[Gateway] Step 2: Requesting transfer attestation...`);
    const { attestation, signature } = await requestGatewayTransfer(params);
    
    // Step 3: Mint on destination
    console.log(`[Gateway] Step 3: Minting on destination chain...`);
    const mintTxHash = await mintFromGateway(
      attestation,
      signature,
      toChain,
      params.walletId
    );
    
    return {
      attestation,
      signature,
      mintTxHash,
      status: "completed",
    };
  } catch (error: any) {
    console.error(`[Gateway] Transfer failed:`, error);
    return {
      status: "failed",
      error: error.message || "Gateway transfer failed",
    };
  }
}

