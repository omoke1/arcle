/**
 * CCTP Bridge Service
 * 
 * Handles cross-chain USDC transfers via Circle's Cross-Chain Transfer Protocol
 * Supports: Arc ↔ Base, Arc ↔ Arbitrum, Arc ↔ Ethereum
 */

import { circleApiRequest } from "@/lib/circle";

export interface BridgeRequest {
  walletId: string;
  amount: string; // USDC amount
  fromChain: "ARC" | "BASE" | "ARBITRUM" | "ETH";
  toChain: "ARC" | "BASE" | "ARBITRUM" | "ETH";
  destinationAddress: string;
}

export interface BridgeStatus {
  bridgeId: string;
  status: "pending" | "attesting" | "completed" | "failed";
  fromChain: string;
  toChain: string;
  amount: string;
  progress: number; // 0-100
  estimatedTime?: string;
  transactionHash?: string;
  error?: string;
}

/**
 * Initiate CCTP bridge transaction
 * 
 * Uses Circle's Transfer API for cross-chain USDC transfers
 * Reference: https://developers.circle.com/w3s/reference/createtransfer
 */
export async function initiateBridge(request: BridgeRequest): Promise<BridgeStatus> {
  try {
    // Map chain names to Circle blockchain identifiers
    const chainMap: Record<string, string> = {
      "ARC": "ARC-TESTNET",
      "BASE": "BASE-SEPOLIA",
      "ARBITRUM": "ARBITRUM-SEPOLIA",
      "ETH": "ETH-SEPOLIA",
    };

    const fromBlockchain = chainMap[request.fromChain] || request.fromChain;
    const toBlockchain = chainMap[request.toChain] || request.toChain;

    // Convert amount to smallest unit (USDC has 6 decimals)
    const amountInSmallestUnit = Math.floor(parseFloat(request.amount) * 1_000_000).toString();

    // Use Circle's Transfer API for cross-chain transfers
    // This creates a transfer that Circle will execute via CCTP
    const response = await circleApiRequest<any>(
      `/v1/w3s/developer/transfers/create`,
      {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: crypto.randomUUID(),
          source: {
            type: "wallet",
            id: request.walletId,
          },
          destination: {
            type: "blockchain",
            address: request.destinationAddress,
            chain: toBlockchain,
          },
          amount: {
            amount: amountInSmallestUnit,
            currency: "USDC",
          },
        }),
      }
    );

    return {
      bridgeId: response.data?.id || crypto.randomUUID(),
      status: response.data?.status === "pending" ? "pending" : "attesting",
      fromChain: request.fromChain,
      toChain: request.toChain,
      amount: request.amount,
      progress: 10,
      estimatedTime: "2-5 minutes",
      transactionHash: response.data?.transactionHash,
    };
  } catch (error: any) {
    console.error("Error initiating bridge:", error);
    throw new Error(error.message || "Failed to initiate bridge");
  }
}

/**
 * Poll bridge status
 * Uses Circle's Transfer API to check transfer status
 */
export async function getBridgeStatus(bridgeId: string): Promise<BridgeStatus> {
  try {
    const response = await circleApiRequest<any>(
      `/v1/w3s/transfers/${bridgeId}`,
      {
        method: "GET",
      }
    );

    const status = response.data?.status || "pending";
    const transferStatus = status === "complete" ? "completed" : 
                          status === "pending" ? "pending" :
                          status === "failed" ? "failed" : "attesting";

    return {
      bridgeId,
      status: transferStatus,
      fromChain: response.data?.source?.chain?.replace("-TESTNET", "").replace("-SEPOLIA", "") || "",
      toChain: response.data?.destination?.chain?.replace("-TESTNET", "").replace("-SEPOLIA", "") || "",
      amount: response.data?.amount?.amount ? (BigInt(response.data.amount.amount) / 1_000_000n).toString() : "0",
      progress: calculateProgress(transferStatus),
      estimatedTime: transferStatus === "completed" ? undefined : "2-5 minutes",
      transactionHash: response.data?.transactionHash,
      error: transferStatus === "failed" ? response.data?.error?.message : undefined,
    };
  } catch (error: any) {
    console.error("Error checking bridge status:", error);
    return {
      bridgeId,
      status: "failed",
      fromChain: "",
      toChain: "",
      amount: "0",
      progress: 0,
      error: error.message || "Failed to check bridge status",
    };
  }
}

/**
 * Calculate progress percentage based on status
 */
function calculateProgress(status: string): number {
  switch (status) {
    case "pending":
      return 10;
    case "attesting":
      return 50;
    case "completed":
      return 100;
    case "failed":
      return 0;
    default:
      return 0;
  }
}

/**
 * Poll bridge status until complete or failed
 */
export async function pollBridgeStatus(
  bridgeId: string,
  onUpdate?: (status: BridgeStatus) => void,
  maxAttempts: number = 60,
  intervalMs: number = 5000
): Promise<BridgeStatus> {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const status = await getBridgeStatus(bridgeId);
    
    if (onUpdate) {
      onUpdate(status);
    }
    
    if (status.status === "completed" || status.status === "failed") {
      return status;
    }
    
    attempts++;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  // Timeout
  return {
    bridgeId,
    status: "failed",
    fromChain: "",
    toChain: "",
    amount: "0",
    progress: 0,
    error: "Bridge timeout - transaction took too long",
  };
}


