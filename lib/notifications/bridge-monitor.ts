/**
 * Bridge Status Monitor
 * 
 * Monitors bridge transactions and notifies users when they complete
 */

import { getBridgeStatus } from "@/lib/bridge/cctp-bridge";
import type { BridgeStatus } from "@/lib/bridge/cctp-bridge";
import { getChainBalance } from "@/lib/balances/cross-chain-balances";

export interface BridgeMonitorConfig {
  bridgeId: string;
  transactionHash?: string;
  amount: string;
  fromChain: string;
  toChain: string;
  destinationAddress: string;
  onComplete?: (status: BridgeStatus) => void;
  onError?: (error: string) => void;
  onUpdate?: (status: BridgeStatus) => void;
  pollInterval?: number;
  maxAttempts?: number;
}

let activeMonitors: Map<string, any> = new Map();

/**
 * Start monitoring a bridge transaction
 */
export function startBridgeMonitoring(config: BridgeMonitorConfig): () => void {
  const {
    bridgeId,
    onComplete,
    onError,
    onUpdate,
    pollInterval = 10000,
    maxAttempts = 60,
  } = config;

  stopBridgeMonitoring(bridgeId);

  let attempts = 0;
  let isStopped = false;
  let initialBalance: number | null = null;

  const checkBalance = async (): Promise<boolean> => {
    try {
      if (!config.destinationAddress || !config.toChain) return false;

      const balanceChain = mapToBalanceChain(config.toChain);
      if (!balanceChain) return false;

      const balanceData = await getChainBalance(balanceChain, config.destinationAddress);
      const currentBalance = parseFloat(balanceData.balance);

      if (initialBalance === null) {
        initialBalance = currentBalance;
        console.log(`[Bridge Monitor] Initial balance on ${balanceChain}: ${initialBalance} USDC`);
        return false;
      }

      const diff = currentBalance - initialBalance;
      const expected = parseFloat(config.amount);

      // Check if balance increased by approximately the expected amount
      if (diff >= expected * 0.99) {
        console.log(`[Bridge Monitor] 💰 Balance increased by ${diff} USDC. Bridge verified!`);
        return true;
      }

      return false;
    } catch (e) {
      console.warn("[Bridge Monitor] Failed to check balance:", e);
      return false;
    }
  };

  const checkStatus = async () => {
    if (isStopped) return;

    // 1. Check balance first (Verification)
    const isBalanceVerified = await checkBalance();
    if (isBalanceVerified && mapToBalanceChain(config.toChain)) {
      console.log(`[Bridge Monitor] ✅ Bridge ${bridgeId} verified via balance change`);
      stopBridgeMonitoring(bridgeId);
      if (onComplete) {
        onComplete({
          bridgeId,
          status: "completed",
          fromChain: config.fromChain,
          toChain: config.toChain,
          amount: config.amount,
          progress: 100,
          transactionHash: config.transactionHash
        });
      }
      return;
    }

    // 2. Default check logic
    try {
      attempts++;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bridgeId);
      let status: BridgeStatus;

      if (isUUID) {
        // Fallback monitoring
        // If this is called, it means balance check didn't pass yet.
        status = {
          bridgeId,
          status: "pending",
          fromChain: config.fromChain,
          toChain: config.toChain,
          amount: config.amount,
          progress: attempts < 10 ? 30 : attempts < 30 ? 60 : 80,
          transactionHash: config.transactionHash
        };

        if (attempts === 1) {
          console.log(`[Bridge Monitor] Bridge ID is a UUID. Monitoring via destination balance changes.`);
        }

        if (onUpdate) onUpdate(status);

        // Timeout check
        if (attempts >= maxAttempts) {
          console.error(`[Bridge Monitor] ❌ Bridge ${bridgeId} timed out without verification`);
          stopBridgeMonitoring(bridgeId);
          if (onError) onError("Bridge verification timed out - check explorer");
          else if (onComplete) onComplete({ ...status, status: "failed", error: "Timeout", progress: 0 });
          return;
        }

      } else {
        // Real Circle ID check logic
        try {
          status = await getBridgeStatus(bridgeId);
          if (onUpdate) onUpdate(status);

          if (status.status === "completed") {
            console.log(`[Bridge Monitor] ✅ Bridge ${bridgeId} completed successfully`);
            stopBridgeMonitoring(bridgeId);
            if (onComplete) onComplete(status);
            return;
          }
          if (status.status === "failed") {
            stopBridgeMonitoring(bridgeId);
            if (onError) onError(status.error || "Bridge transaction failed");
            return;
          }
        } catch (error: any) {
          // Treat 404 as fallback/pending
          if (error.message?.includes("Resource not found") || error.message?.includes("404")) {
            status = {
              bridgeId,
              status: "pending",
              fromChain: config.fromChain,
              toChain: config.toChain,
              amount: config.amount,
              progress: 50,
            };
            if (onUpdate) onUpdate(status);
          } else {
            console.warn(`[Bridge Monitor] Error checking bridge status: ${error.message}`);
          }
        }

        // Timeout check
        if (attempts >= maxAttempts) {
          console.log(`[Bridge Monitor] ⏱️ Bridge ${bridgeId} monitoring timeout`);
          stopBridgeMonitoring(bridgeId);
          if (onError) onError("Bridge monitoring timeout");
          return;
        }
      }

      // Schedule next check
      const timeoutId = setTimeout(checkStatus, pollInterval);
      activeMonitors.set(bridgeId, timeoutId);

    } catch (error: any) {
      console.warn(`[Bridge Monitor] Unexpected error:`, error);
      if (attempts < maxAttempts) {
        const timeoutId = setTimeout(checkStatus, pollInterval);
        activeMonitors.set(bridgeId, timeoutId);
      } else {
        stopBridgeMonitoring(bridgeId);
        if (onError) onError("Bridge monitoring failed");
      }
    }
  };

  console.log(`[Bridge Monitor] 🚀 Starting monitoring for bridge ${bridgeId}`);
  const timeoutId = setTimeout(checkStatus, pollInterval);
  activeMonitors.set(bridgeId, timeoutId);

  return () => stopBridgeMonitoring(bridgeId);
}

function mapToBalanceChain(chain: string): "ARC" | "BASE" | "ARBITRUM" | "ETH" | null {
  const c = chain.toUpperCase();
  if (c.includes("ARC")) return "ARC";
  if (c.includes("BASE")) return "BASE";
  if (c.includes("ARB")) return "ARBITRUM";
  if (c.includes("ETH")) return "ETH";
  return null;
}

/**
 * Stop monitoring a specific bridge
 */
export function stopBridgeMonitoring(bridgeId: string): void {
  const timeoutId = activeMonitors.get(bridgeId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    activeMonitors.delete(bridgeId);
    console.log(`[Bridge Monitor] 🛑 Stopped monitoring bridge ${bridgeId}`);
  }
}

/**
 * Stop all active bridge monitors
 */
export function stopAllBridgeMonitoring(): void {
  activeMonitors.forEach((timeoutId, bridgeId) => {
    clearTimeout(timeoutId);
    console.log(`[Bridge Monitor] 🛑 Stopped monitoring bridge ${bridgeId}`);
  });
  activeMonitors.clear();
}

/**
 * Get active bridge monitors
 */
export function getActiveBridgeMonitors(): string[] {
  return Array.from(activeMonitors.keys());
}

