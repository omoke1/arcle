/**
 * Balance Monitor
 * 
 * Monitors wallet balance changes and generates notifications
 */

import { createNotification } from "@/lib/db/services/notifications";

export interface BalanceMonitorConfig {
  walletId: string;
  walletAddress: string;
  userId?: string; // Added userId for notifications
  pollInterval?: number; // milliseconds
  enabled?: boolean;
  onBalanceChange?: (oldBalance: string, newBalance: string, change: string) => void;
}

let balanceMonitors = new Map<string, any>();

/**
 * Start monitoring balance for a wallet
 */
export function startBalanceMonitoring(
  config: BalanceMonitorConfig
): () => void {
  const {
    walletId,
    walletAddress,
    userId,
    pollInterval = 5000, // 5 seconds for faster balance updates
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
        // Only trigger notifications for significant changes (not tiny fluctuations)
        // This prevents spam from minor balance adjustments or rounding differences
        if (lastBalance !== null && lastBalance !== currentBalance) {
          const oldBalanceNum = parseFloat(lastBalance);
          const newBalanceNum = parseFloat(currentBalance);
          const change = (newBalanceNum - oldBalanceNum).toFixed(6);
          const changeNum = Math.abs(parseFloat(change));

          // Only trigger notification if change is significant (>= 0.000001 USDC)
          // This filters out tiny rounding differences and only shows real transactions
          if (changeNum >= 0.000001) {
            // Create notification if userId is provided
            if (userId) {
              const changeType = newBalanceNum > oldBalanceNum ? "received" : "sent";
              createNotification({
                user_id: userId,
                type: 'transaction',
                title: 'Balance Updated',
                message: `You ${changeType} ${Math.abs(parseFloat(change))} USDC. New balance: ${currentBalance} USDC`,
                priority: 'low',
                metadata: {
                  oldBalance: lastBalance,
                  newBalance: currentBalance,
                  change
                }
              }).catch(err => console.error("Error creating balance notification:", err));
            }

            // Call callback if provided
            if (onBalanceChange) {
              onBalanceChange(lastBalance, currentBalance, change);
            }
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

