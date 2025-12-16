/**
 * Transaction Monitor
 * 
 * Polls for transaction status changes and generates notifications
 */

import { createNotification } from "@/lib/db/services/notifications";

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
): Promise<"confirmed" | "failed" | "timeout" | "error"> {
  const {
    walletId,
    transactionId,
    pollInterval = 2000, // 2 seconds
    maxAttempts = 30, // 60 seconds total
    onStatusChange,
  } = config;

  let attempts = 0;
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 5;
  let lastStatus: "pending" | "confirmed" | "failed" | null = null;
  let userId: string | null = null;

  return new Promise((resolve) => {
    const poll = async () => {
      attempts++;

      try {
        // Get userId and userToken from Supabase (with localStorage migration fallback)
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
              const currentUserPref = await loadPreference({ userId: "current", key: "current_user_id" }).catch((e) => {
                console.warn("[Transaction Monitor] Failed to load user preference:", e);
                return null;
              });
              if (currentUserPref?.value) {
                const credentials = await loadUserCredentials(currentUserPref.value);
                if (credentials.userToken) {
                  userId = currentUserPref.value;
                  userToken = credentials.userToken;
                }
              }
            } catch (error) {
              console.warn("[Transaction Monitor] Credential fallback failed:", error);
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
          consecutiveFailures++;
          console.error(`[Transaction Monitor] API Error ${response.status}: ${response.statusText}`);

          // Fail fast on Auth errors or 500s persisting
          if (response.status === 401 || response.status === 403 || consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.error("[Transaction Monitor] Aborting due to critical or persistent API error.");
            resolve("error");
            return;
          }

          if (attempts >= maxAttempts) {
            resolve("timeout");
            return;
          }
          setTimeout(poll, pollInterval);
          return;
        }

        // Reset consecutive failures on success
        consecutiveFailures = 0;

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
            if (userId && (status === "confirmed" || status === "failed")) {
              try {
                await createNotification({
                  user_id: userId,
                  type: 'transaction',
                  title: status === "confirmed" ? 'Transaction Confirmed' : 'Transaction Failed',
                  message: status === "confirmed"
                    ? `Your transaction of ${amount} to ${to.slice(0, 6)}... has been confirmed.`
                    : `Your transaction of ${amount} to ${to.slice(0, 6)}... failed.`,
                  priority: status === "failed" ? 'high' : 'normal',
                  metadata: {
                    transactionId,
                    txHash,
                    amount,
                    to
                  }
                });
              } catch (notifyError) {
                console.error("[Transaction Monitor] Failed to create notification (non-blocking):", notifyError);
              }
            }

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
        consecutiveFailures++;
        console.error("[Transaction Monitor] Polling error:", error);

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.error("[Transaction Monitor] Aborting due to persistent network errors.");
          resolve("error");
          return;
        }

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

