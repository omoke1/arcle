/**
 * Balance Monitor
 * 
 * Monitors wallet balance changes and generates notifications
 */

import { createBalanceChangeNotification } from "./notification-service";
import { getNotificationPreferences } from "./notification-service";

export interface BalanceMonitorConfig {
  walletId: string;
  walletAddress: string;
  pollInterval?: number; // milliseconds
  enabled?: boolean;
  onBalanceChange?: (oldBalance: string, newBalance: string, change: string) => void;
}

let balanceMonitors = new Map<string, NodeJS.Timeout | null>();

/**
 * Start monitoring balance for a wallet
 */
export function startBalanceMonitoring(
  config: BalanceMonitorConfig
): () => void {
  const {
    walletId,
    walletAddress,
    pollInterval = 10000, // 10 seconds
    enabled = true,
    onBalanceChange,
  } = config;

  const monitorKey = `${walletId}-${walletAddress}`;

  // Stop existing monitor if any
  stopBalanceMonitoring(walletId, walletAddress);

  if (!enabled) {
    return () => stopBalanceMonitoring(walletId, walletAddress);
  }

  let lastBalance: string | null = null;

  const poll = async () => {
    try {
      const response = await fetch(
        `/api/circle/balance?walletId=${walletId}&address=${walletAddress}`
      );

      if (!response.ok) {
        return; // Continue polling on error
      }

      const data = await response.json();

      if (data.success && data.data) {
        const currentBalance = data.data.balance || "0";

        // Check if balance changed
        if (lastBalance !== null && lastBalance !== currentBalance) {
          const oldBalanceNum = parseFloat(lastBalance);
          const newBalanceNum = parseFloat(currentBalance);
          const change = (newBalanceNum - oldBalanceNum).toFixed(6);

          // Create notification
          createBalanceChangeNotification(
            lastBalance,
            currentBalance,
            change
          );

          // Call callback if provided
          if (onBalanceChange) {
            onBalanceChange(lastBalance, currentBalance, change);
          }
        }

        lastBalance = currentBalance;
      }
    } catch (error) {
      console.error("Error polling balance:", error);
    }
  };

  // Start polling immediately
  poll();

  // Set up interval
  const interval = setInterval(poll, pollInterval);
  balanceMonitors.set(monitorKey, interval);

  // Return stop function
  return () => stopBalanceMonitoring(walletId, walletAddress);
}

/**
 * Stop monitoring balance for a wallet
 */
export function stopBalanceMonitoring(walletId: string, walletAddress: string): void {
  const monitorKey = `${walletId}-${walletAddress}`;
  const interval = balanceMonitors.get(monitorKey);

  if (interval) {
    clearInterval(interval);
    balanceMonitors.delete(monitorKey);
  }
}

/**
 * Stop all balance monitors
 */
export function stopAllBalanceMonitors(): void {
  balanceMonitors.forEach((interval) => {
    if (interval) {
      clearInterval(interval);
    }
  });
  balanceMonitors.clear();
}

