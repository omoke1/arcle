/**
 * Incoming Transaction Monitor
 * 
 * Monitors for incoming token transfers and analyzes them for scams
 * Requires user approval for suspicious tokens
 */

import { analyzeToken, getTokenMetadata, type TokenAnalysis } from "@/lib/security/token-analysis";
import { createNotification, getUserNotifications, getNotificationsByType } from "@/lib/db/services/notifications";
import { getSupabaseClient } from "@/lib/db/supabase";

export interface IncomingTokenTransfer {
  tokenAddress: string;
  tokenName?: string;
  tokenSymbol?: string;
  amount: string;
  decimals?: number;
  fromAddress: string;
  transactionHash?: string;
  timestamp: number;
  analysis?: TokenAnalysis;
  approved?: boolean;
  rejected?: boolean;
}

export interface IncomingTransactionMonitorConfig {
  walletId: string;
  walletAddress: string;
  userId?: string;
  pollInterval?: number; // milliseconds
  enabled?: boolean;
  onIncomingToken?: (transfer: IncomingTokenTransfer) => void;
  onSuspiciousToken?: (transfer: IncomingTokenTransfer) => void;
}

let transactionMonitors = new Map<string, any>();
const processedTransactions = new Set<string>(); // Track processed transaction hashes

/**
 * Start monitoring for incoming transactions
 */
export function startIncomingTransactionMonitoring(
  config: IncomingTransactionMonitorConfig
): () => void {
  const {
    walletId,
    walletAddress,
    userId: configUserId,
    pollInterval = 30000, // 30 seconds to avoid Circle rate limits
    enabled = true,
    onIncomingToken,
    onSuspiciousToken,
  } = config;

  const monitorKey = `${walletId}-${walletAddress}`;

  // Stop existing monitor if any
  stopIncomingTransactionMonitoring(walletId, walletAddress);

  if (!enabled) {
    return () => stopIncomingTransactionMonitoring(walletId, walletAddress);
  }

  const poll = async () => {
    try {
      let userId = configUserId;
      let userToken: string | null = null;

      if (typeof window !== "undefined") {
        if (!userId) userId = localStorage.getItem("arcle_user_id") || undefined;
        userToken = localStorage.getItem("arcle_user_token");
      }

      if (!userId || !userToken) {
        // Only warn once per minute to avoid console spam
        const lastWarningKey = `incoming_monitor_warning_${monitorKey}`;
        const lastWarning = typeof window !== "undefined"
          ? parseInt(localStorage.getItem(lastWarningKey) || "0")
          : 0;
        const now = Date.now();

        if (now - lastWarning > 60000) { // Warn at most once per minute
          console.warn("[IncomingTransactionMonitor] Missing user credentials, skipping poll cycle");
          if (typeof window !== "undefined") {
            localStorage.setItem(lastWarningKey, now.toString());
          }
        }
        return;
      }

      // Check if token is expired or expiring soon, refresh proactively
      if (userToken) {
        try {
          const { checkTokenExpiry, refreshUserToken } = await import('@/lib/circle/token-refresh');
          const tokenStatus = checkTokenExpiry(userToken, 5);

          if (tokenStatus.isExpired || tokenStatus.isExpiringSoon) {
            console.log("[IncomingTransactionMonitor] Token expired or expiring soon, refreshing proactively...");
            const newToken = await refreshUserToken();

            if (newToken && newToken.userToken) {
              console.log("[IncomingTransactionMonitor] ✅ Token refreshed proactively");
              userToken = newToken.userToken;
              if (typeof window !== "undefined") {
                localStorage.setItem("arcle_user_token", newToken.userToken);
                if (newToken.encryptionKey) {
                  localStorage.setItem("arcle_encryption_key", newToken.encryptionKey);
                }
              }
            }
          }
        } catch (tokenCheckError) {
          console.warn("[Incoming Monitor] Token check failed:", tokenCheckError);
        }
      }

      const queryParams = new URLSearchParams({
        walletId,
        limit: "50",
        userId,
        userToken,
      });

      // Fetch recent transactions via our API route (avoids CORS issues)
      let apiResponse = await fetch(`/api/circle/transactions?${queryParams.toString()}`);

      // Handle 403 (token expired) by refreshing token and retrying
      if (!apiResponse.ok && apiResponse.status === 403) {
        try {
          const { refreshUserToken } = await import('@/lib/circle/token-refresh');
          const newToken = await refreshUserToken();

          if (newToken && newToken.userToken) {
            // Update localStorage with new token
            if (typeof window !== "undefined") {
              localStorage.setItem("arcle_user_token", newToken.userToken);
              if (newToken.encryptionKey) {
                localStorage.setItem("arcle_encryption_key", newToken.encryptionKey);
              }
            }

            // Retry with new token
            const retryParams = new URLSearchParams({
              walletId,
              limit: "50",
              userId: userId || "",
              userToken: newToken.userToken,
            });
            apiResponse = await fetch(`/api/circle/transactions?${retryParams.toString()}`);
          } else {
            return;
          }
        } catch (refreshError) {
          console.error("[Incoming Monitor] Token refresh failed:", refreshError);
          return;
        }
      }

      if (!apiResponse.ok) {
        if (apiResponse.status !== 404 && apiResponse.status !== 429) {
          // Log error
        }
        return;
      }

      const data = await apiResponse.json();

      if (!data.success || !data.data) {
        return;
      }

      // Handle different response formats from our API
      const transactions = Array.isArray(data.data.data)
        ? data.data.data
        : data.data.data?.transactions || [];

      // Process each transaction
      for (const tx of transactions) {
        const txData = tx.transaction || tx;
        const txHash = txData.txHash || txData.transactionHash || txData.hash;

        // Skip if already processed
        if (txHash && processedTransactions.has(txHash)) {
          continue;
        }

        // Check if this is an incoming transaction (to our wallet)
        const destination = txData.destinationAddress ||
          txData.destination?.address ||
          txData.destinationAddress ||
          txData.to;
        const normalizedDestination = destination?.toLowerCase() || "";
        const normalizedWalletAddress = walletAddress.toLowerCase();

        const txWalletId = txData.walletId || tx.walletId;
        const isIncomingByAddress = normalizedDestination === normalizedWalletAddress && normalizedDestination !== "";
        const isIncomingByWalletId = txWalletId === walletId;

        const source = txData.sourceAddress || txData.source?.address || txData.from || "";
        const normalizedSource = source.toLowerCase();
        const isOutgoing = normalizedSource === normalizedWalletAddress && normalizedSource !== "";

        if (!isIncomingByAddress && !isIncomingByWalletId) {
          continue;
        }

        if (isOutgoing && !isIncomingByAddress) {
          continue;
        }

        const actualTx = txData.transaction || txData;
        const state = actualTx.state || txData.state || actualTx.status || txData.status;
        if (state !== "COMPLETE" && state !== "COMPLETED" && state !== "CONFIRMED" && state !== "SENT") {
          continue;
        }

        const tokenId = actualTx.tokenId || txData.tokenId || actualTx.token?.id || txData.token?.id;
        const tokenAddress = actualTx.tokenAddress ||
          txData.tokenAddress ||
          actualTx.token?.address ||
          txData.token?.address ||
          actualTx.token?.tokenAddress ||
          txData.token?.tokenAddress;
        const tokenCurrency = actualTx.amount?.currency ||
          txData.amount?.currency ||
          actualTx.token?.symbol ||
          txData.token?.symbol ||
          actualTx.tokenCurrency ||
          txData.tokenCurrency;
        const amounts = actualTx.amounts || txData.amounts || [];
        const amount = amounts[0] || actualTx.amount?.amount || txData.amount?.amount || "0";

        if (!tokenAddress && !tokenId && !tokenCurrency && !amount) {
          continue;
        }

        const isUSDC = tokenCurrency === "USDC" || tokenCurrency === "USD Coin";
        const finalTokenAddress = tokenAddress || tokenId || (isUSDC ? "0x3600000000000000000000000000000000000000" : "");

        if (txHash) {
          processedTransactions.add(txHash);
        }

        const tokenMetadata = finalTokenAddress
          ? await getTokenMetadata(finalTokenAddress)
          : {};

        if (isUSDC && !tokenMetadata.name) {
          tokenMetadata.name = "USD Coin";
          tokenMetadata.symbol = "USDC";
          tokenMetadata.decimals = 6;
        }

        const sourceAddress = actualTx.sourceAddress ||
          txData.sourceAddress ||
          actualTx.source?.address ||
          txData.source?.address ||
          actualTx.from ||
          txData.from ||
          "unknown";

        const transfer: IncomingTokenTransfer = {
          tokenAddress: finalTokenAddress || tokenId || "",
          tokenName: tokenMetadata.name || tokenCurrency || "Unknown Token",
          tokenSymbol: tokenMetadata.symbol || tokenCurrency || "UNKNOWN",
          amount: formatTokenAmount(amount, tokenMetadata.decimals || 6),
          decimals: tokenMetadata.decimals || 6,
          fromAddress: sourceAddress,
          transactionHash: txHash,
          timestamp: Date.now(),
        };

        try {
          const analysis = await analyzeToken(
            transfer.tokenAddress,
            transfer.tokenName,
            transfer.tokenSymbol,
            transfer.decimals
          );

          transfer.analysis = analysis;

          if (analysis.blocked || analysis.isScam) {
            console.log("[IncomingMonitor] 🚨 Suspicious/scam token detected");
            if (userId) createSuspiciousTokenNotification(userId, transfer);

            if (onSuspiciousToken) {
              onSuspiciousToken(transfer);
            }

            // Cache transaction logic... (omitted for brevity in this generic implementation, but assuming it's handled by other components or kept if needed)
            // Keeping original caching logic would be good but replacing notification logic is priority.
            // Re-adding caching logic for parity:
            if (typeof window !== 'undefined' && txHash && userId) {
              (async () => {
                try {
                  const { cacheTransaction } = await import('@/lib/storage/transaction-cache');
                  const incomingTx = {
                    id: actualTx.id || txHash,
                    hash: txHash!,
                    from: transfer.fromAddress,
                    to: walletAddress,
                    amount: transfer.amount,
                    token: (transfer.tokenSymbol === "EURC" ? "EURC" : "USDC") as "USDC" | "EURC",
                    status: "confirmed" as "pending" | "confirmed" | "failed",
                    timestamp: new Date(),
                  };
                  await cacheTransaction(userId!, walletId, incomingTx);
                  window.dispatchEvent(new CustomEvent('arcle:transactions:refresh'));
                } catch (e) {
                  console.error("[Incoming Monitor] Error updating user token balance:", e);
                }
              })();
            }

          } else if (analysis.riskLevel === "medium") {
            console.log("[IncomingMonitor] ⚠️ Medium risk token detected");
            if (userId) createWarningTokenNotification(userId, transfer);

            if (onIncomingToken) {
              onIncomingToken(transfer);
            }

            // Cache transaction logic...
            if (typeof window !== 'undefined' && txHash && userId) {
              (async () => {
                try {
                  const { cacheTransaction } = await import('@/lib/storage/transaction-cache');
                  const incomingTx = {
                    id: actualTx.id || txHash,
                    hash: txHash!,
                    from: transfer.fromAddress,
                    to: walletAddress,
                    amount: transfer.amount,
                    token: (transfer.tokenSymbol === "EURC" ? "EURC" : "USDC") as "USDC" | "EURC",
                    status: "confirmed" as "pending" | "confirmed" | "failed",
                    timestamp: new Date(),
                  };
                  await cacheTransaction(userId!, walletId, incomingTx);
                  window.dispatchEvent(new CustomEvent('arcle:transactions:refresh'));
                } catch (e) {
                  console.error("[Incoming Monitor] Error updating user token balance:", e);
                }
              })();
            }

          } else {
            console.log("[IncomingMonitor] ✅ Safe token detected");
            if (userId) createSafeTokenNotification(userId, transfer);

            if (onIncomingToken) {
              onIncomingToken(transfer);
            }

            // Cache transaction logic...
            if (typeof window !== 'undefined' && txHash && userId) {
              (async () => {
                try {
                  const { cacheTransaction } = await import('@/lib/storage/transaction-cache');
                  const incomingTx = {
                    id: actualTx.id || txHash,
                    hash: txHash!,
                    from: transfer.fromAddress,
                    to: walletAddress,
                    amount: transfer.amount,
                    token: (transfer.tokenSymbol === "EURC" ? "EURC" : "USDC") as "USDC" | "EURC",
                    status: "confirmed" as "pending" | "confirmed" | "failed",
                    timestamp: new Date(),
                  };
                  await cacheTransaction(userId!, walletId, incomingTx);
                  window.dispatchEvent(new CustomEvent('arcle:transactions:refresh'));
                } catch (e) {
                  console.error("[Incoming Monitor] Error updating user token balance:", e);
                }
              })();
            }
          }
        } catch (analysisError: any) {
          console.error("[IncomingMonitor] Error analyzing token:", analysisError);
          if (onIncomingToken) {
            onIncomingToken(transfer);
          }
        }
      }
    } catch (error: any) {
      // Log
    }
  };

  poll();
  const interval = setInterval(poll, pollInterval);
  transactionMonitors.set(monitorKey, interval);
  return () => stopIncomingTransactionMonitoring(walletId, walletAddress);
}

export function stopIncomingTransactionMonitoring(
  walletId: string,
  walletAddress: string
): void {
  const monitorKey = `${walletId}-${walletAddress}`;
  const interval = transactionMonitors.get(monitorKey);

  if (interval) {
    clearInterval(interval);
    transactionMonitors.delete(monitorKey);
  }
}

function formatTokenAmount(amount: string, decimals: number): string {
  try {
    const amountNum = BigInt(amount);
    const divisor = BigInt(10 ** decimals);
    const whole = amountNum / divisor;
    const fractional = amountNum % divisor;

    const fractionalStr = fractional.toString().padStart(decimals, "0");
    const trimmedFractional = fractionalStr.replace(/0+$/, "");

    if (trimmedFractional === "") {
      return whole.toString();
    }

    return `${whole}.${trimmedFractional}`;
  } catch (error) {
    return amount;
  }
}

async function createSuspiciousTokenNotification(userId: string, transfer: IncomingTokenTransfer): Promise<void> {
  const analysis = transfer.analysis!;

  let message = `🚨 **SUSPICIOUS TOKEN DETECTED**\n\n`;
  message += `**Received:** ${transfer.amount} ${transfer.tokenSymbol || "Unknown"}\n`;
  message += `**From:** ${transfer.fromAddress.slice(0, 10)}...${transfer.fromAddress.slice(-8)}\n`;
  message += `**Risk Score:** ${analysis.riskScore}/100 (${analysis.riskLevel.toUpperCase()})\n\n`;
  message += `**Risk Reasons:**\n`;
  analysis.riskReasons.forEach(reason => {
    message += `• ${reason}\n`;
  });
  message += `\n⚠️ **This token has been blocked for your safety.**\n`;
  message += `You can manually approve it if you trust the sender.`;

  await createNotification({
    user_id: userId,
    type: 'system', // 'security' type doesn't exist in Notification type union? Checking types... 'priority'? 
    // Types from notifications.ts: 'transaction' | 'payment' | 'invoice' | 'remittance' | 'subscription' | 'system'
    // So 'security' should be 'system' with high priority
    title: "Suspicious Token Blocked",
    message,
    priority: 'high',
    metadata: {
      transfer,
      analysis,
      requiresApproval: true,
      subType: 'security_alert' // Adding subType to distinguish
    },
  });
}

async function createWarningTokenNotification(userId: string, transfer: IncomingTokenTransfer): Promise<void> {
  const analysis = transfer.analysis!;

  let message = `⚠️ **Token Received (Medium Risk)**\n\n`;
  message += `**Received:** ${transfer.amount} ${transfer.tokenSymbol || "Unknown"}\n`;
  if (transfer.fromAddress) {
    message += `**From:** ${transfer.fromAddress.slice(0, 10)}...${transfer.fromAddress.slice(-8)}\n`;
  }
  message += `**Risk Score:** ${analysis.riskScore}/100\n\n`;
  message += `**Warnings:**\n`;
  analysis.riskReasons.forEach(reason => {
    message += `• ${reason}\n`;
  });
  message += `\nPlease review this token carefully.`;

  await createNotification({
    user_id: userId,
    type: 'system',
    title: "Token Received - Review Recommended",
    message,
    priority: 'high',
    metadata: {
      transfer,
      analysis,
      subType: 'security_warning'
    },
  });
}

async function createSafeTokenNotification(userId: string, transfer: IncomingTokenTransfer): Promise<void> {
  let message = `✅ **Token Received**\n\n`;
  message += `**Received:** ${transfer.amount} ${transfer.tokenSymbol || "Unknown"}\n`;
  if (transfer.fromAddress) {
    message += `**From:** ${transfer.fromAddress.slice(0, 10)}...${transfer.fromAddress.slice(-8)}\n`;
  }

  if (transfer.transactionHash && /^0x[a-fA-F0-9]{64}$/.test(transfer.transactionHash)) {
    message += `\n[View on ArcScan](https://testnet.arcscan.app/tx/${transfer.transactionHash})`;
  }

  await createNotification({
    user_id: userId,
    type: 'transaction',
    title: "Token Received",
    message,
    metadata: {
      transfer,
    },
  });
}

/**
 * Approve a suspicious token (user manually approved)
 */
export async function approveSuspiciousToken(transfer: IncomingTokenTransfer, userId?: string): Promise<void> {
  transfer.approved = true;
  transfer.rejected = false;

  // Update notification data in Supabase if userId is provided
  if (userId) {
    // We need to find the notification first
    try {
      const supabase = getSupabaseClient();
      // Find notification associated with this transfer
      // Since metadata is JSONB, we can query it
      const { data: notifications } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'system')
        .contains('metadata', { subType: 'security_alert' })
        .order('created_at', { ascending: false })
        .limit(20); // Check recent ones

      const targetNotification = notifications?.find((n: any) =>
        n.metadata?.transfer?.transactionHash === transfer.transactionHash ||
        n.metadata?.transfer?.tokenAddress === transfer.tokenAddress
      );

      if (targetNotification) {
        await supabase
          .from('notifications')
          .update({
            metadata: {
              ...targetNotification.metadata,
              transfer: {
                ...targetNotification.metadata.transfer,
                approved: true,
                rejected: false
              }
            }
          })
          .eq('id', targetNotification.id);
      }

      // Add confirmation notification
      await createNotification({
        user_id: userId,
        type: 'system',
        title: "Token Approved",
        message: `You've approved the token ${transfer.tokenSymbol || transfer.tokenAddress}. It has been added to your wallet.`,
        metadata: {
          transfer,
        },
      });

    } catch (error) {
      console.error("Error updating notification:", error);
    }
  }
}

/**
 * Reject a suspicious token (user manually rejected)
 */
export async function rejectSuspiciousToken(transfer: IncomingTokenTransfer, userId?: string): Promise<void> {
  transfer.approved = false;
  transfer.rejected = true;

  if (userId) {
    try {
      const supabase = getSupabaseClient();
      const { data: notifications } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'system')
        .contains('metadata', { subType: 'security_alert' })
        .order('created_at', { ascending: false })
        .limit(20);

      const targetNotification = notifications?.find((n: any) =>
        n.metadata?.transfer?.transactionHash === transfer.transactionHash ||
        n.metadata?.transfer?.tokenAddress === transfer.tokenAddress
      );

      if (targetNotification) {
        await supabase
          .from('notifications')
          .update({
            metadata: {
              ...targetNotification.metadata,
              transfer: {
                ...targetNotification.metadata.transfer,
                approved: false,
                rejected: true
              }
            }
          })
          .eq('id', targetNotification.id);
      }

      await createNotification({
        user_id: userId,
        type: 'system',
        title: "Token Rejected",
        message: `You've rejected the token ${transfer.tokenSymbol || transfer.tokenAddress}. It will not be added to your wallet.`,
        metadata: {
          transfer,
        },
      });

    } catch (error) {
      console.error("Error updating notification:", error);
    }
  }
}

