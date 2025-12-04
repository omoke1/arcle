/**
 * Transaction Monitor
 * 
 * Polls for transaction status changes and generates notifications
 */

import { createTransactionNotification } from "./notification-service";

export interface TransactionMonitorConfig {
  walletId: string;
  transactionId: string;
  pollInterval?: number; // milliseconds
  maxAttempts?: number;
  onStatusChange?: (status: "pending" | "confirmed" | "failed", hash?: string) => void;
}

/**
 * Monitor a transaction until it's confirmed or failed
 */
export async function monitorTransaction(
  config: TransactionMonitorConfig
): Promise<"confirmed" | "failed" | "timeout"> {
  const {
    walletId,
    transactionId,
    pollInterval = 2000, // 2 seconds
    maxAttempts = 30, // 60 seconds total
    onStatusChange,
  } = config;

  let attempts = 0;
  let lastStatus: "pending" | "confirmed" | "failed" | null = null;

  return new Promise((resolve) => {
    const poll = async () => {
      attempts++;

      try {
        // Get userId and userToken from Supabase (with localStorage migration fallback)
        let userId: string | null = null;
        let userToken: string | null = null;
        
        if (typeof window !== 'undefined') {
          // Migration: Try localStorage first, then Supabase
          const legacyUserId = localStorage.getItem('arcle_user_id');
          const legacyUserToken = localStorage.getItem('arcle_user_token');
          
          if (legacyUserId && legacyUserToken) {
            userId = legacyUserId;
            userToken = legacyUserToken;
          } else {
            // Try to load from Supabase
            try {
              const { loadUserCredentials, loadPreference } = await import("@/lib/supabase-data");
              // Try to get current user ID from a preference (if set)
              const currentUserPref = await loadPreference({ userId: "current", key: "current_user_id" }).catch(() => null);
              if (currentUserPref?.value) {
                const credentials = await loadUserCredentials(currentUserPref.value);
                if (credentials.userToken) {
                  userId = currentUserPref.value;
                  userToken = credentials.userToken;
                }
              }
            } catch (error) {
              // Ignore - will use null values
            }
          }
        }
        
        // Build query string with optional userId/userToken
        let queryString = `walletId=${walletId}&transactionId=${transactionId}`;
        if (userId && userToken) {
          queryString += `&userId=${encodeURIComponent(userId)}&userToken=${encodeURIComponent(userToken)}`;
        }
        
        const response = await fetch(
          `/api/circle/transactions?${queryString}`
        );

        if (!response.ok) {
          if (attempts >= maxAttempts) {
            resolve("timeout");
            return;
          }
          setTimeout(poll, pollInterval);
          return;
        }

        const data = await response.json();

        if (data.success && data.data) {
          // Handle both single transaction and list responses
          const txData = Array.isArray(data.data.data)
            ? data.data.data[0]?.transaction || data.data.data[0]
            : data.data.data?.transaction || data.data.data;

          if (!txData) {
            if (attempts >= maxAttempts) {
              resolve("timeout");
              return;
            }
            setTimeout(poll, pollInterval);
            return;
          }

          const circleState = txData.state || txData.status;
          const txHash = txData.txHash || txData.transactionHash || txData.hash;
          
          // Map Circle states to our status
          let status: "pending" | "confirmed" | "failed" = "pending";
          if (circleState === "COMPLETE" || circleState === "COMPLETED" || circleState === "CONFIRMED" || circleState === "SENT") {
            status = "confirmed";
          } else if (circleState === "FAILED" || circleState === "DENIED" || circleState === "CANCELLED") {
            status = "failed";
          }

          // Only notify on status change
          if (status !== lastStatus) {
            lastStatus = status;

            // Extract amount and destination
            const amount = txData.amounts?.[0] || txData.amount?.amount || "0";
            const to = txData.destinationAddress || txData.destination?.address || "";

            // Create notification
            createTransactionNotification(
              transactionId,
              status,
              amount,
              to,
              txHash
            );

            // Call callback if provided
            if (onStatusChange) {
              onStatusChange(status, txHash);
            }

            // If confirmed or failed, stop polling
            if (status === "confirmed" || status === "failed") {
              resolve(status);
              return;
            }
          }
        }

        // Continue polling if still pending
        if (attempts < maxAttempts) {
          setTimeout(poll, pollInterval);
        } else {
          resolve("timeout");
        }
      } catch (error) {
        console.error("Error polling transaction status:", error);
        if (attempts >= maxAttempts) {
          resolve("timeout");
        } else {
          setTimeout(poll, pollInterval);
        }
      }
    };

    // Start polling
    poll();
  });
}

