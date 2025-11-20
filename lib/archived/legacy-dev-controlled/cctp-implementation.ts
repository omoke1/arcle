/**
 * CCTP Implementation using Smart Contracts
 * 
 * This implements the full CCTP flow:
 * 1. Burn USDC on source chain
 * 2. Poll for attestation
 * 3. Mint USDC on destination chain
 * 
 * Reference: https://github.com/circlefin/evm-cctp-contracts
 */

import { encodeFunctionData } from "viem";
import { getCircleClient } from "@/lib/archived/circle-sdk-developer-controlled";
import { 
  getCCTPAddresses, 
  getDestinationDomain, 
  CCTP_V2_MESSAGES_ENDPOINT,
  TOKEN_MESSENGER_ABI,
  MESSAGE_TRANSMITTER_ABI,
  USDC_ABI,
} from "../../cctp/cctp-contracts";
import { generateUUID } from "@/lib/utils/uuid";

export interface CCTPTransferParams {
  walletId: string;
  walletAddress: string;
  amount: string; // USDC amount in decimal format
  fromChain: string;
  toChain: string;
  destinationAddress: string;
  fastTransfer?: boolean; // Enable Fast Transfer mode (seconds vs 13-19 minutes)
}

export interface CCTPTransferResult {
  burnTxHash: string;
  messageHash: string;
  attestation?: string;
  mintTxHash?: string;
  status: "burning" | "attesting" | "minting" | "completed" | "failed";
  error?: string;
}

/**
 * Step 1: Approve USDC spending (if needed)
 */
async function approveUSDC(
  walletId: string,
  walletAddress: string,
  chain: string,
  tokenMessengerAddress: string,
  amount: bigint
): Promise<void> {
  const sourceAddresses = getCCTPAddresses(chain);
  const client = getCircleClient();
  
  // Check current allowance
  // Note: Circle SDK doesn't directly support contract calls, so we'd need to
  // use a different approach or assume approval is already done
  
  // For now, we'll assume the wallet has already approved or will approve
  // In a full implementation, you'd check allowance and approve if needed
  console.log(`[CCTP] Assuming USDC approval for TokenMessenger: ${tokenMessengerAddress}`);
}

/**
 * Step 2: Burn USDC on source chain
 * 
 * This creates a transaction that calls the TokenMessenger contract's
 * depositForBurn function to burn USDC and generate a message.
 */
export async function burnUSDC(params: CCTPTransferParams): Promise<{ txHash: string; messageHash: string }> {
  const { walletId, walletAddress, amount, fromChain, toChain, destinationAddress } = params;
  
  const sourceAddresses = getCCTPAddresses(fromChain);
  const destinationDomain = getDestinationDomain(toChain);
  
  // Convert amount to smallest unit (USDC has 6 decimals)
  const amountInSmallestUnit = BigInt(Math.floor(parseFloat(amount) * 1_000_000));
  
  // Convert destination address to bytes32 format
  // For EVM chains, this is the address padded to 32 bytes (remove 0x, pad to 64 chars, add 0x)
  const destinationAddressBytes = destinationAddress.toLowerCase().startsWith("0x")
    ? destinationAddress.slice(2).toLowerCase()
    : destinationAddress.toLowerCase();
  const mintRecipient = "0x" + destinationAddressBytes.padStart(64, "0");
  
  // Encode the depositForBurn V2 function call
  // V2 requires additional parameters: destinationCaller, maxFee, minFinalityThreshold
  // Reference: https://developers.circle.com/cctp/migration-from-v1-to-v2
  const destinationCaller = "0x0000000000000000000000000000000000000000000000000000000000000000"; // Zero address = no caller restriction
  
  // Fast Transfer vs Standard Transfer configuration
  // Fast Transfer: maxFee > 0, minFinalityThreshold = 1000 (confirmed level)
  // Standard Transfer: maxFee = 0, minFinalityThreshold = 2000 (finalized level)
  const fastTransfer = params.fastTransfer ?? false;
  const maxFee = fastTransfer ? BigInt(1_000_000) : BigInt(0); // 1 USDC max fee for Fast Transfer, 0 for Standard
  const minFinalityThreshold = fastTransfer ? 1000 : 2000; // 1000 = Fast (confirmed), 2000 = Standard (finalized)
  
  if (fastTransfer) {
    console.log(`[CCTP] ⚡ Fast Transfer mode enabled - will settle in seconds`);
  } else {
    console.log(`[CCTP] 🐢 Standard Transfer mode - will settle in 13-19 minutes`);
  }
  
  const burnCallData = encodeFunctionData({
    abi: TOKEN_MESSENGER_ABI,
    functionName: "depositForBurn",
    args: [
      amountInSmallestUnit,           // uint256: amount to burn
      destinationDomain,               // uint32: destination domain
      mintRecipient as `0x${string}`,  // bytes32: recipient address on destination
      sourceAddresses.usdc as `0x${string}`, // address: USDC token address
      destinationCaller as `0x${string}`, // bytes32: V2: destination caller (zero = no restriction)
      maxFee,                          // uint256: V2: max fee (0 = Standard, >0 = Fast)
      minFinalityThreshold,            // uint32: V2: 2000 = Standard, 1000 = Fast
    ],
  });
  
  console.log(`[CCTP] Burning ${amount} USDC on ${fromChain}`);
  console.log(`[CCTP] Destination domain: ${destinationDomain}`);
  console.log(`[CCTP] Mint recipient: ${mintRecipient}`);
  console.log(`[CCTP] Call data: ${burnCallData}`);
  
  // Use Circle's contract execution method for developer-controlled wallets
  // Reference: Circle team confirmed we can use createContractExecutionTransaction
  const client = getCircleClient();
  const { circleApiRequest } = await import("@/lib/circle");
  
  try {
    // Prepare ABI function signature and parameters for depositForBurn V2
    // Function signature: depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)
    const abiFunctionSignature = "depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)";
    
    // Convert parameters to strings/numbers as required by Circle API
    const abiParameters = [
      amountInSmallestUnit.toString(),           // uint256: amount
      destinationDomain.toString(),               // uint32: destination domain
      mintRecipient,                              // bytes32: recipient (already formatted)
      sourceAddresses.usdc,                      // address: USDC token address
      destinationCaller,                          // bytes32: destination caller
      maxFee.toString(),                          // uint256: max fee
      minFinalityThreshold.toString(),           // uint32: min finality threshold
    ];
    
    console.log(`[CCTP] Using contract execution method`);
    console.log(`[CCTP] Contract: ${sourceAddresses.tokenMessenger}`);
    console.log(`[CCTP] Function: ${abiFunctionSignature}`);
    console.log(`[CCTP] Parameters:`, abiParameters);
    
    // Try SDK's createContractExecutionTransaction method first
    let response: any;
    try {
      // Check if the method exists on the client
      if (typeof (client as any).createContractExecutionTransaction === 'function') {
        console.log(`[CCTP] Using SDK createContractExecutionTransaction`);
        const sdkResponse = await (client as any).createContractExecutionTransaction({
          walletId: walletId,
          contractAddress: sourceAddresses.tokenMessenger,
          abiFunctionSignature: abiFunctionSignature,
          abiParameters: abiParameters,
          fee: {
            type: "level",
            config: {
              feeLevel: "MEDIUM" as const,
            },
          },
          idempotencyKey: generateUUID(),
        });
        response = { data: sdkResponse.data };
      } else {
        throw new Error("createContractExecutionTransaction not available in SDK");
      }
    } catch (sdkError: any) {
      // Fallback to REST API contract execution endpoint
      console.log(`[CCTP] SDK method not available, trying REST API: ${sdkError.message}`);
      console.error(`[CCTP] SDK error details:`, {
        message: sdkError.message,
        code: sdkError.code,
        response: sdkError.response?.data,
      });
      try {
        response = await circleApiRequest<any>(
          `/v1/w3s/developer/transactions/contract-execution`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              idempotencyKey: generateUUID(),
              walletId: walletId,
              contractAddress: sourceAddresses.tokenMessenger,
              abiFunctionSignature: abiFunctionSignature,
              abiParameters: abiParameters,
              fee: {
                type: "level",
                config: {
                  feeLevel: "MEDIUM",
                },
              },
            }),
          }
        );
      } catch (restError: any) {
        console.error(`[CCTP] REST API error details:`, {
          message: restError.message,
          status: restError.response?.status,
          statusText: restError.response?.statusText,
          data: restError.response?.data,
          url: restError.config?.url,
        });
        throw new Error(`Both SDK and REST API failed: SDK: ${sdkError.message}, REST: ${restError.message || JSON.stringify(restError.response?.data || {})}`);
      }
    }
    
    if (!response.data) {
      console.error(`[CCTP] No data in response:`, response);
      throw new Error("No transaction data returned");
    }
    
    const txData = response.data as any;
    const txHash = txData.txHash || txData.transactionHash || txData.id;
    
    if (!txHash) {
      console.error(`[CCTP] No transaction hash in response:`, txData);
      throw new Error("No transaction hash returned from Circle API");
    }
    
    console.log(`[CCTP] ✅ Burn transaction created: ${txHash}`);
    
    // Extract message hash from transaction
    // The message hash is typically emitted in a BurnMessage event
    // For now, we'll use the transaction hash as a placeholder
    // In production, you'd need to parse the transaction receipt for the event
    const messageHash = txHash; // TODO: Extract actual message hash from event logs
    
    return {
      txHash,
      messageHash,
    };
  } catch (error: any) {
    console.error(`[CCTP] Burn transaction error:`, error);
    // Provide detailed error message
    throw new Error(
      `Failed to create burn transaction. ` +
      `Error: ${error.message || "Unknown error"}. ` +
      `Check server logs for details.`
    );
  }
}

/**
 * Step 3: Get Message and Attestation from CCTP V2 API
 * 
 * V2 simplifies the workflow: single API call gets message + attestation
 * Reference: https://developers.circle.com/cctp/migration-from-v1-to-v2
 * 
 * V2 endpoint: GET /v2/messages/{sourceDomainId}?transactionHash={hash}
 * Returns: message, attestation, and decoded data in one response
 * 
 * Fast Transfer: Checks for "confirmed" status (soft finality) - seconds
 * Standard Transfer: Checks for "finalized" status (hard finality) - 13-19 minutes
 */
async function pollForAttestation(
  transactionHash: string,
  sourceDomainId: number,
  fastTransfer: boolean = false,
  maxAttempts: number = fastTransfer ? 30 : 60 // Faster polling for Fast Transfer
): Promise<{ message: string; attestation: string; decodedMessage?: any }> {
  // V2 API: Single endpoint for message + attestation
  const url = `${CCTP_V2_MESSAGES_ENDPOINT}/${sourceDomainId}?transactionHash=${transactionHash}`;
  
  const transferType = fastTransfer ? "⚡ Fast Transfer" : "🐢 Standard Transfer";
  console.log(`[CCTP V2] ${transferType} - Fetching message and attestation: ${url}`);
  
  // Fast Transfer: Poll more aggressively (every 1-2 seconds)
  // Standard Transfer: Poll less frequently (every 5-10 seconds)
  const baseDelay = fastTransfer ? 1000 : 5000; // 1 second for Fast, 5 seconds for Standard
  const maxDelay = fastTransfer ? 3000 : 10000; // Max 3 seconds for Fast, 10 seconds for Standard
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        
        // V2 API returns messages array
        // Reference: https://developers.circle.com/cctp/migration-from-v1-to-v2
        if (data.messages && data.messages.length > 0) {
          const messageData = data.messages[0];
          
          // Fast Transfer: Check for "confirmed" status (soft finality)
          // Standard Transfer: Check for "finalized" or "complete" status (hard finality)
          const isReady = fastTransfer
            ? (messageData.status === "confirmed" || messageData.status === "complete") && messageData.attestation && messageData.message
            : messageData.status === "complete" && messageData.attestation && messageData.message;
          
          if (isReady) {
            const timeElapsed = (attempt + 1) * (fastTransfer ? 1 : 5);
            console.log(`[CCTP V2] ${transferType} - Message and attestation received after ${attempt + 1} attempts (~${timeElapsed}s)`);
            return {
              message: messageData.message,
              attestation: messageData.attestation,
              decodedMessage: messageData.decodedMessage,
            };
          } else if (messageData.status === "pending" || messageData.status === "confirmed") {
            const statusInfo = fastTransfer && messageData.status === "confirmed" 
              ? "confirmed (Fast Transfer ready)" 
              : messageData.status;
            console.log(`[CCTP V2] ${transferType} - Message status: ${statusInfo} (attempt ${attempt + 1}/${maxAttempts})`);
          }
        } else {
          console.log(`[CCTP V2] ${transferType} - No messages found yet (attempt ${attempt + 1}/${maxAttempts})`);
        }
      } else if (response.status === 404) {
        // Message not found yet, keep polling
        console.log(`[CCTP V2] ${transferType} - Message not found yet (attempt ${attempt + 1}/${maxAttempts})`);
      } else {
        console.warn(`[CCTP V2] ${transferType} - API returned status ${response.status}`);
      }
      
      // Wait before next attempt (exponential backoff, but faster for Fast Transfer)
      const delay = Math.min(baseDelay * Math.pow(1.2, attempt), maxDelay);
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      console.warn(`[CCTP V2] ${transferType} - Poll attempt ${attempt + 1} failed:`, error);
      await new Promise(resolve => setTimeout(resolve, fastTransfer ? 1000 : 2000));
    }
  }
  
  const timeoutMessage = fastTransfer
    ? "Fast Transfer attestation timeout - Circle validators did not attest the burn within ~30 seconds"
    : "Attestation timeout - Circle validators did not attest the burn within the timeout period (~13-19 minutes)";
  throw new Error(timeoutMessage);
}

/**
 * Step 4: Mint USDC on destination chain
 * 
 * Once we have the attestation, we can mint USDC on the destination chain
 * by calling MessageTransmitter.receiveMessage with the message and attestation.
 */
async function mintUSDC(
  message: string,
  attestation: string,
  toChain: string,
  walletId: string,
  walletAddress: string
): Promise<string> {
  const destAddresses = getCCTPAddresses(toChain);
  
  // Encode the receiveMessage function call
  const mintCallData = encodeFunctionData({
    abi: MESSAGE_TRANSMITTER_ABI,
    functionName: "receiveMessage",
    args: [
      message as `0x${string}`,      // bytes: message from burn
      attestation as `0x${string}`,   // bytes: attestation from Circle
    ],
  });
  
  console.log(`[CCTP] Minting USDC on ${toChain}`);
  console.log(`[CCTP] MessageTransmitter: ${destAddresses.messageTransmitter}`);
  console.log(`[CCTP] Call data: ${mintCallData}`);
  
  // Use Circle's contract execution method for minting
  const client = getCircleClient();
  const { circleApiRequest } = await import("@/lib/circle");
  
  try {
    // Prepare ABI function signature and parameters for receiveMessage
    // Function signature: receiveMessage(bytes,bytes)
    const abiFunctionSignature = "receiveMessage(bytes,bytes)";
    
    // Convert parameters to strings as required by Circle API
    const abiParameters = [
      message,      // bytes: message
      attestation,  // bytes: attestation
    ];
    
    console.log(`[CCTP] Using contract execution method for mint`);
    console.log(`[CCTP] Contract: ${destAddresses.messageTransmitter}`);
    console.log(`[CCTP] Function: ${abiFunctionSignature}`);
    
    // Try SDK's createContractExecutionTransaction method first
    let response: any;
    try {
      // Check if the method exists on the client
      if (typeof (client as any).createContractExecutionTransaction === 'function') {
        console.log(`[CCTP] Using SDK createContractExecutionTransaction for mint`);
        const sdkResponse = await (client as any).createContractExecutionTransaction({
          walletId: walletId,
          contractAddress: destAddresses.messageTransmitter,
          abiFunctionSignature: abiFunctionSignature,
          abiParameters: abiParameters,
          fee: {
            type: "level",
            config: {
              feeLevel: "MEDIUM" as const,
            },
          },
          idempotencyKey: generateUUID(),
          blockchain: toChain,
        });
        response = { data: sdkResponse.data };
      } else {
        throw new Error("createContractExecutionTransaction not available in SDK");
      }
    } catch (sdkError: any) {
      // Fallback to REST API contract execution endpoint
      console.log(`[CCTP] SDK method not available, trying REST API: ${sdkError.message}`);
      try {
        response = await circleApiRequest<any>(
          `/v1/w3s/developer/transactions/contract-execution`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              idempotencyKey: generateUUID(),
              walletId: walletId,
              contractAddress: destAddresses.messageTransmitter,
              abiFunctionSignature: abiFunctionSignature,
              abiParameters: abiParameters,
              fee: {
                type: "level",
                config: {
                  feeLevel: "MEDIUM",
                },
              },
              blockchain: toChain,
            }),
          }
        );
      } catch (restError: any) {
        throw new Error(`Both SDK and REST API failed: SDK: ${sdkError.message}, REST: ${restError.message}`);
      }
    }
    
    if (!response.data) {
      throw new Error("No transaction data returned");
    }
    
    const txData = response.data as any;
    return txData.txHash || txData.transactionHash || txData.id;
  } catch (error: any) {
    throw new Error(`Failed to mint USDC on destination chain: ${error.message}`);
  }
}

/**
 * Full CCTP transfer implementation
 * 
 * This orchestrates the complete CCTP flow:
 * 1. Burn on source chain
 * 2. Poll for attestation
 * 3. Mint on destination chain
 */
export async function executeCCTPTransfer(params: CCTPTransferParams): Promise<CCTPTransferResult> {
  try {
    // Step 1: Burn USDC on source chain
    console.log(`[CCTP] Step 1: Burning ${params.amount} USDC on ${params.fromChain}...`);
    const { txHash: burnTxHash, messageHash } = await burnUSDC(params);
    console.log(`[CCTP] ✅ Burn transaction: ${burnTxHash}`);
    console.log(`[CCTP] Message hash: ${messageHash}`);
    
    // Step 2: Get message and attestation using V2 API
    const transferType = params.fastTransfer ? "⚡ Fast Transfer" : "🐢 Standard Transfer";
    console.log(`[CCTP V2] Step 2: ${transferType} - Fetching message and attestation...`);
    const sourceDomainId = getDestinationDomain(params.fromChain);
    const attestationData = await pollForAttestation(burnTxHash, sourceDomainId, params.fastTransfer ?? false);
    
    const message = attestationData.message;
    const attestation = attestationData.attestation;
    console.log(`[CCTP V2] ✅ Message and attestation received`);
    
    // Step 3: Mint USDC on destination chain
    console.log(`[CCTP V2] Step 3: Minting USDC on ${params.toChain}...`);
    const mintTxHash = await mintUSDC(
      message, // V2: Use actual message from API response
      attestation,
      params.toChain,
      params.walletId,
      params.walletAddress
    );
    console.log(`[CCTP] ✅ Mint transaction: ${mintTxHash}`);
    
    return {
      burnTxHash,
      messageHash: message, // V2: Use message instead of messageHash
      attestation,
      mintTxHash,
      status: "completed",
    };
  } catch (error: any) {
    console.error(`[CCTP] Transfer failed:`, error);
    return {
      burnTxHash: "",
      messageHash: "",
      status: "failed",
      error: error.message || "CCTP transfer failed",
    };
  }
}

/**
 * Get CCTP transfer status
 */
/**
 * Get CCTP V2 transfer status using transaction hash
 * V2: Use /v2/messages/{sourceDomainId} endpoint
 */
export async function getCCTPStatus(
  transactionHash: string,
  sourceDomainId: number
): Promise<{
  status: "pending" | "attested" | "completed" | "failed";
  attestation?: string;
  message?: string;
}> {
  try {
    const url = `${CCTP_V2_MESSAGES_ENDPOINT}/${sourceDomainId}?transactionHash=${transactionHash}`;
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      if (data.messages && data.messages.length > 0) {
        const messageData = data.messages[0];
        return {
          status: messageData.status === "complete" ? "attested" : "pending",
          attestation: messageData.attestation,
          message: messageData.message,
        };
      }
    }
    
    return { status: "pending" };
  } catch (error) {
    return { status: "failed" };
  }
}
