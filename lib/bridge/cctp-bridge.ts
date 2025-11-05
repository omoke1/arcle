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
 */
export async function initiateBridge(request: BridgeRequest): Promise<BridgeStatus> {
  try {
    // Call Circle CCTP API
    // Reference: https://developers.circle.com/cctp/docs
    
    const response = await circleApiRequest<any>(
      `/v1/cctp/bridge`,
      {
        method: "POST",
        body: JSON.stringify({
          walletId: request.walletId,
          amount: request.amount,
          fromChain: request.fromChain,
          toChain: request.toChain,
          destinationAddress: request.destinationAddress,
        }),
      }
    );

    return {
      bridgeId: response.bridgeId || crypto.randomUUID(),
      status: "pending",
      fromChain: request.fromChain,
      toChain: request.toChain,
      amount: request.amount,
      progress: 0,
      estimatedTime: "2-5 minutes",
    };
  } catch (error: any) {
    console.error("Error initiating bridge:", error);
    throw new Error(error.message || "Failed to initiate bridge");
  }
}

/**
 * Poll bridge status
 */
export async function getBridgeStatus(bridgeId: string): Promise<BridgeStatus> {
  try {
    const response = await circleApiRequest<any>(
      `/v1/cctp/bridge/${bridgeId}`,
      {
        method: "GET",
      }
    );

    return {
      bridgeId,
      status: response.status || "pending",
      fromChain: response.fromChain || "",
      toChain: response.toChain || "",
      amount: response.amount || "0",
      progress: calculateProgress(response.status),
      estimatedTime: response.estimatedTime,
      transactionHash: response.transactionHash,
      error: response.error,
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


