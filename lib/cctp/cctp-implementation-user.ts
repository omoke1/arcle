/**
 * CCTP Implementation for User-Controlled Wallets
 * 
 * Cross-Chain Transfer Protocol (CCTP) for bridging USDC across chains
 * Uses User-Controlled Wallets SDK with challenge-based flow
 * 
 * Flow:
 * 1. Burn USDC on source chain
 * 2. Wait for attestation from Circle
 * 3. Mint USDC on destination chain
 */

import { executeContract, ContractExecutionResult } from '@/lib/circle-user-sdk-advanced';
import { 
  getCCTPAddresses, 
  getDestinationDomain, 
  CCTP_V2_MESSAGES_ENDPOINT,
} from "./cctp-contracts";
import { generateUUID } from "@/lib/utils/uuid";

export interface CCTPUserTransferParams {
  userId: string;
  userToken: string;
  walletId: string;
  walletAddress: string;
  amount: string; // USDC amount in decimal format
  fromChain: string;
  toChain: string;
  destinationAddress: string;
  fastTransfer?: boolean;
}

export interface CCTPUserTransferResult {
  success: boolean;
  burnChallengeId?: string;
  mintChallengeId?: string;
  burnTxHash?: string;
  mintTxHash?: string;
  messageHash?: string;
  attestation?: string;
  status: "burning" | "attesting" | "minting" | "completed" | "failed";
  error?: string;
}

/**
 * Step 1: Approve USDC spending (if needed)
 */
async function approveUSDC(
  userId: string,
  userToken: string,
  walletId: string,
  chain: string,
  tokenMessengerAddress: string,
  amount: string
): Promise<ContractExecutionResult> {
  const addresses = getCCTPAddresses(chain);
  if (!addresses) {
    throw new Error(`CCTP not supported on ${chain}`);
  }

  const amountInSmallestUnit = Math.floor(parseFloat(amount) * 1_000_000).toString();

  console.log(`[CCTP User] Approving TokenMessenger to spend ${amount} USDC`);

  return executeContract({
    userId,
    userToken,
    walletId,
    contractAddress: addresses.usdc,
    abiFunctionSignature: "approve(address,uint256)",
    abiParameters: [tokenMessengerAddress, amountInSmallestUnit],
    feeLevel: "HIGH",
    refId: `cctp-approve-${Date.now()}`,
  });
}

/**
 * Step 2: Burn USDC on source chain
 */
async function burnUSDC(
  userId: string,
  userToken: string,
  walletId: string,
  fromChain: string,
  toChain: string,
  amount: string,
  destinationAddress: string
): Promise<ContractExecutionResult & { messageHash?: string }> {
  const addresses = getCCTPAddresses(fromChain);
  if (!addresses) {
    throw new Error(`CCTP not supported on ${fromChain}`);
  }

  const amountInSmallestUnit = Math.floor(parseFloat(amount) * 1_000_000).toString();
  const destinationDomain = getDestinationDomain(toChain);

  if (destinationDomain === null) {
    throw new Error(`Destination domain not found for ${toChain}`);
  }

  // Remove 0x prefix from destination address
  const mintRecipient = destinationAddress.startsWith("0x") 
    ? destinationAddress.slice(2).toLowerCase().padStart(64, "0")
    : destinationAddress.toLowerCase().padStart(64, "0");

  console.log(`[CCTP User] Burning ${amount} USDC on ${fromChain}`);
  console.log(`[CCTP User] Destination: ${toChain} (domain ${destinationDomain})`);

  const result = await executeContract({
    userId,
    userToken,
    walletId,
    contractAddress: addresses.tokenMessenger,
    abiFunctionSignature: "depositForBurn(uint256,uint32,bytes32,address)",
    abiParameters: [
      amountInSmallestUnit,
      destinationDomain,
      `0x${mintRecipient}`,
      addresses.usdc,
    ],
    feeLevel: "HIGH",
    refId: `cctp-burn-${Date.now()}`,
  });

  return {
    ...result,
    messageHash: result.transactionHash, // Will need to extract from logs
  };
}

/**
 * Step 3: Get attestation from Circle
 */
async function getAttestation(
  messageHash: string,
  maxAttempts: number = 30,
  intervalMs: number = 6000
): Promise<string | null> {
  console.log(`[CCTP User] Waiting for attestation...`);

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${CCTP_V2_MESSAGES_ENDPOINT}/${messageHash}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.attestation && data.attestation !== "PENDING") {
          console.log(`[CCTP User] ✅ Attestation received`);
          return data.attestation;
        }
      }

      console.log(`[CCTP User] Attempt ${i + 1}/${maxAttempts}: Still waiting...`);
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    } catch (error) {
      console.error(`[CCTP User] Error fetching attestation:`, error);
    }
  }

  return null;
}

/**
 * Step 4: Mint USDC on destination chain
 */
async function mintUSDC(
  userId: string,
  userToken: string,
  walletId: string,
  toChain: string,
  attestation: string,
  messageBytes: string
): Promise<ContractExecutionResult> {
  const addresses = getCCTPAddresses(toChain);
  if (!addresses) {
    throw new Error(`CCTP not supported on ${toChain}`);
  }

  console.log(`[CCTP User] Minting USDC on ${toChain}`);

  return executeContract({
    userId,
    userToken,
    walletId,
    contractAddress: addresses.messageTransmitter,
    abiFunctionSignature: "receiveMessage(bytes,bytes)",
    abiParameters: [messageBytes, attestation],
    feeLevel: "HIGH",
    refId: `cctp-mint-${Date.now()}`,
  });
}

/**
 * Execute full CCTP transfer flow
 * 
 * Note: This is a simplified implementation. In production, you would:
 * 1. Monitor challenge completion for each step
 * 2. Extract messageBytes from burn transaction logs
 * 3. Handle edge cases and retries
 */
export async function transferCCTPUser(
  params: CCTPUserTransferParams
): Promise<CCTPUserTransferResult> {
  try {
    const addresses = getCCTPAddresses(params.fromChain);
    if (!addresses) {
      return {
        success: false,
        error: `CCTP not supported on ${params.fromChain}`,
        status: "failed",
      };
    }

    // Step 1: Approve USDC
    console.log(`[CCTP User] Step 1: Approve USDC`);
    const approveResult = await approveUSDC(
      params.userId,
      params.userToken,
      params.walletId,
      params.fromChain,
      addresses.tokenMessenger,
      params.amount
    );

    if (!approveResult.success) {
      return {
        success: false,
        error: `Failed to approve USDC: ${approveResult.error}`,
        status: "failed",
      };
    }

    console.log(`[CCTP User] ✅ Approval challenge created`);

    // Wait for user to complete approval
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 2: Burn USDC on source chain
    console.log(`[CCTP User] Step 2: Burn USDC`);
    const burnResult = await burnUSDC(
      params.userId,
      params.userToken,
      params.walletId,
      params.fromChain,
      params.toChain,
      params.amount,
      params.destinationAddress
    );

    if (!burnResult.success) {
      return {
        success: false,
        error: `Failed to burn USDC: ${burnResult.error}`,
        status: "failed",
        burnChallengeId: burnResult.challengeId,
      };
    }

    console.log(`[CCTP User] ✅ Burn challenge created`);

    // Return early with challenge IDs
    // User needs to complete challenges, then call a separate endpoint to continue
    return {
      success: true,
      burnChallengeId: burnResult.challengeId,
      status: "burning",
    };

    // The following steps would be done after user completes challenges:
    // Step 3: Get attestation
    // Step 4: Mint on destination
    // These should be in a separate API endpoint that monitors burn completion
  } catch (error: any) {
    console.error(`[CCTP User] Transfer error:`, error);
    return {
      success: false,
      error: error.message || "Failed to execute CCTP transfer",
      status: "failed",
    };
  }
}

/**
 * Continue CCTP transfer after burn is complete
 * Call this after user has completed the burn challenge
 */
export async function continueCCTPTransfer(
  userId: string,
  userToken: string,
  walletId: string,
  toChain: string,
  burnTxHash: string,
  messageBytes: string
): Promise<CCTPUserTransferResult> {
  try {
    // Step 3: Get attestation
    console.log(`[CCTP User] Step 3: Get attestation`);
    const attestation = await getAttestation(burnTxHash);

    if (!attestation) {
      return {
        success: false,
        error: "Failed to get attestation from Circle",
        status: "failed",
      };
    }

    console.log(`[CCTP User] ✅ Attestation received`);

    // Step 4: Mint on destination chain
    console.log(`[CCTP User] Step 4: Mint USDC on ${toChain}`);
    const mintResult = await mintUSDC(
      userId,
      userToken,
      walletId,
      toChain,
      attestation,
      messageBytes
    );

    if (!mintResult.success) {
      return {
        success: false,
        error: `Failed to mint USDC: ${mintResult.error}`,
        status: "failed",
        mintChallengeId: mintResult.challengeId,
        attestation,
      };
    }

    console.log(`[CCTP User] ✅ Mint challenge created`);

    return {
      success: true,
      mintChallengeId: mintResult.challengeId,
      mintTxHash: mintResult.transactionHash,
      attestation,
      status: "completed",
    };
  } catch (error: any) {
    console.error(`[CCTP User] Continue transfer error:`, error);
    return {
      success: false,
      error: error.message || "Failed to continue CCTP transfer",
      status: "failed",
    };
  }
}

/**
 * Get supported chains for CCTP
 */
export function getSupportedChains(): string[] {
  return ["ETH", "ETH-SEPOLIA", "ARB", "ARB-SEPOLIA", "BASE", "BASE-SEPOLIA", "OP", "OP-SEPOLIA", "AVAX", "ARC-TESTNET"];
}

/**
 * Check if CCTP is available between two chains
 */
export function isCCTPAvailable(fromChain: string, toChain: string): boolean {
  const addresses1 = getCCTPAddresses(fromChain);
  const addresses2 = getCCTPAddresses(toChain);
  const domain = getDestinationDomain(toChain);
  
  return !!addresses1 && !!addresses2 && domain !== null;
}

















