/**
 * Incoming Transaction Monitor
 * 
 * Monitors for incoming token transfers and analyzes them for scams
 * Requires user approval for suspicious tokens
 */

import { analyzeToken, getTokenMetadata, type TokenAnalysis } from "@/lib/security/token-analysis";
import { addNotification, getAllNotifications } from "./notification-service";

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
  pollInterval?: number; // milliseconds
  enabled?: boolean;
  onIncomingToken?: (transfer: IncomingTokenTransfer) => void;
  onSuspiciousToken?: (transfer: IncomingTokenTransfer) => void;
}

let transactionMonitors = new Map<string, NodeJS.Timeout | null>();
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
      let userId: string | null = null;
      let userToken: string | null = null;

      if (typeof window !== "undefined") {
        userId = localStorage.getItem("arcle_user_id");
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
          console.warn("[IncomingTransactionMonitor] To fix: Ensure userId and userToken are stored in localStorage");
          console.warn("[IncomingTransactionMonitor] Keys: arcle_user_id, arcle_user_token");
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
            } else {
              console.warn("[IncomingTransactionMonitor] Proactive token refresh failed, will try on next 403");
            }
          }
        } catch (tokenCheckError) {
          console.warn("[IncomingTransactionMonitor] Error checking token expiry:", tokenCheckError);
          // Continue with existing token
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
        console.log("[IncomingTransactionMonitor] Token expired (403), attempting refresh...");
        try {
          const { refreshUserToken } = await import('@/lib/circle/token-refresh');
          const newToken = await refreshUserToken();
          
          if (newToken && newToken.userToken) {
            console.log("[IncomingTransactionMonitor] ✅ Token refreshed, retrying transaction fetch...");
            
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
            
            // If retry also fails, log and return
            if (!apiResponse.ok && apiResponse.status !== 404) {
              console.warn(`[IncomingTransactionMonitor] Retry after token refresh failed: ${apiResponse.status}`);
              return;
            }
          } else {
            console.warn("[IncomingTransactionMonitor] Token refresh failed, skipping this poll cycle");
            return;
          }
        } catch (refreshError) {
          console.error("[IncomingTransactionMonitor] Error refreshing token:", refreshError);
          return;
        }
      }

      if (!apiResponse.ok) {
        // If 404, wallet might not have transactions yet - this is expected
        if (apiResponse.status === 404) {
          return; // Silently return, no need to log
        }
        if (apiResponse.status === 429) {
          console.warn("[IncomingTransactionMonitor] Circle rate limited transaction polling. Skipping this cycle.");
          return;
        }
        // Don't throw for other errors, just log and return
        console.warn(`[IncomingTransactionMonitor] Failed to fetch transactions: ${apiResponse.status} ${apiResponse.statusText}`);
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
        // Circle API can return destination in multiple formats
        const destination = txData.destinationAddress || 
                           txData.destination?.address || 
                           txData.destinationAddress ||
                           txData.to;
        const normalizedDestination = destination?.toLowerCase() || "";
        const normalizedWalletAddress = walletAddress.toLowerCase();

        // Also check if walletId matches (for developer-controlled wallets)
        const txWalletId = txData.walletId || tx.walletId;
        const isIncomingByAddress = normalizedDestination === normalizedWalletAddress && normalizedDestination !== "";
        const isIncomingByWalletId = txWalletId === walletId;

        // Transaction is incoming if destination matches wallet address OR walletId matches
        // But we need to ensure it's actually incoming (not outgoing)
        // For outgoing, source would be our wallet, for incoming, destination is our wallet
        const source = txData.sourceAddress || txData.source?.address || txData.from || "";
        const normalizedSource = source.toLowerCase();
        const isOutgoing = normalizedSource === normalizedWalletAddress && normalizedSource !== "";
        
        // Only process if it's incoming (destination is our wallet) and not outgoing (source is not our wallet)
        if (!isIncomingByAddress && !isIncomingByWalletId) {
          continue; // Not an incoming transaction
        }
        
        if (isOutgoing && !isIncomingByAddress) {
          continue; // This is an outgoing transaction, skip
        }

        // Check transaction state (only process completed transactions)
        // Also check nested transaction object
        const actualTx = txData.transaction || txData;
        const state = actualTx.state || txData.state || actualTx.status || txData.status;
        if (state !== "COMPLETE" && state !== "COMPLETED" && state !== "CONFIRMED" && state !== "SENT") {
          continue; // Transaction not yet confirmed
        }

        // Extract token information - Circle API can return token info in multiple formats
        // Check both txData and nested transaction object
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
                             txData.tokenCurrency; // USDC, EURC, etc.
        const amounts = actualTx.amounts || txData.amounts || [];
        const amount = amounts[0] || actualTx.amount?.amount || txData.amount?.amount || "0";

        // For USDC transactions, tokenCurrency might be "USDC" even if tokenAddress is missing
        // Also check if amount exists (transactions with amounts are valid even without explicit token info)
        if (!tokenAddress && !tokenId && !tokenCurrency && !amount) {
          continue; // No token or amount information
        }
        
        // If we have USDC currency but no address, use the USDC address
        const isUSDC = tokenCurrency === "USDC" || tokenCurrency === "USD Coin";
        const finalTokenAddress = tokenAddress || tokenId || (isUSDC ? "0x3600000000000000000000000000000000000000" : "");

        // Mark as processed
        if (txHash) {
          processedTransactions.add(txHash);
        }

        // Get token metadata
        const tokenMetadata = finalTokenAddress
          ? await getTokenMetadata(finalTokenAddress)
          : {};

        // For USDC, set default metadata if not found
        if (isUSDC && !tokenMetadata.name) {
          tokenMetadata.name = "USD Coin";
          tokenMetadata.symbol = "USDC";
          tokenMetadata.decimals = 6;
        }

        // Create incoming transfer object
        // Extract source address from multiple possible locations
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

        // Analyze token for scams
        try {
          const analysis = await analyzeToken(
            transfer.tokenAddress,
            transfer.tokenName,
            transfer.tokenSymbol,
            transfer.decimals
          );

          transfer.analysis = analysis;

          // Create notification - ALWAYS notify, even for suspicious tokens
          if (analysis.blocked || analysis.isScam) {
            // Suspicious/scam token - requires approval
            // IMPORTANT: Always call onSuspiciousToken callback to ensure user is notified
            console.log("[IncomingMonitor] 🚨 Suspicious/scam token detected:", {
              tokenSymbol: transfer.tokenSymbol,
              tokenName: transfer.tokenName,
              tokenAddress: transfer.tokenAddress,
              riskScore: analysis.riskScore,
              riskLevel: analysis.riskLevel,
              blocked: analysis.blocked,
              isScam: analysis.isScam,
            });
            
            createSuspiciousTokenNotification(transfer);
            
            // Call callback to show notification in chat - CRITICAL for user notification
            if (onSuspiciousToken) {
              console.log("[IncomingMonitor] Calling onSuspiciousToken callback");
              onSuspiciousToken(transfer);
            } else {
              console.error("[IncomingMonitor] ⚠️ Suspicious token detected but onSuspiciousToken callback not provided!");
            }
            
            // 🔥 CRITICAL: Cache suspicious incoming transaction so receiver sees it in history immediately
            if (typeof window !== 'undefined' && txHash) {
              (async () => {
                try {
                  const { cacheTransaction } = await import('@/lib/storage/transaction-cache');
                  const incomingTx = {
                    id: actualTx.id || txHash,
                    hash: txHash,
                    from: transfer.fromAddress,
                    to: walletAddress,
                    amount: transfer.amount,
                    token: (transfer.tokenSymbol === "EURC" ? "EURC" : "USDC") as "USDC" | "EURC",
                    status: (actualTx.state === "COMPLETED" ? "confirmed" : "pending") as "pending" | "confirmed" | "failed",
                    timestamp: new Date(actualTx.createDate || actualTx.createdAt || Date.now()),
                  };
                  if (userId) {
                    await cacheTransaction(userId, walletId, incomingTx);
                    console.log(`[IncomingTxMonitor] 💾 Cached suspicious incoming tx for receiver: ${txHash.substring(0, 10)}...`);
                  }
                  
                  // Also trigger transaction history refresh immediately
                  window.dispatchEvent(new CustomEvent('arcle:transactions:refresh'));
                  console.log(`[IncomingTxMonitor] 🔄 Triggered transaction history refresh`);
                } catch (error) {
                  console.error('[IncomingTxMonitor] Error caching suspicious transaction:', error);
                }
              })();
            }
          } else if (analysis.riskLevel === "medium") {
            // Medium risk - warn but don't block
            console.log("[IncomingMonitor] ⚠️ Medium risk token detected:", transfer.tokenSymbol);
            createWarningTokenNotification(transfer);
            
            if (onIncomingToken) {
              console.log("[IncomingMonitor] Calling onIncomingToken callback for medium risk token");
              onIncomingToken(transfer);
            }
            
            // 🔥 CRITICAL: Cache medium-risk incoming transaction so receiver sees it in history immediately
            if (typeof window !== 'undefined' && txHash) {
              (async () => {
                try {
                  const { cacheTransaction } = await import('@/lib/storage/transaction-cache');
                  const incomingTx = {
                    id: actualTx.id || txHash,
                    hash: txHash,
                    from: transfer.fromAddress,
                    to: walletAddress,
                    amount: transfer.amount,
                    token: (transfer.tokenSymbol === "EURC" ? "EURC" : "USDC") as "USDC" | "EURC",
                    status: (actualTx.state === "COMPLETED" ? "confirmed" : "pending") as "pending" | "confirmed" | "failed",
                    timestamp: new Date(actualTx.createDate || actualTx.createdAt || Date.now()),
                  };
                  if (userId) {
                    await cacheTransaction(userId, walletId, incomingTx);
                    console.log(`[IncomingTxMonitor] 💾 Cached medium-risk incoming tx for receiver: ${txHash.substring(0, 10)}...`);
                  }
                  
                  // Also trigger transaction history refresh immediately
                  window.dispatchEvent(new CustomEvent('arcle:transactions:refresh'));
                  console.log(`[IncomingTxMonitor] 🔄 Triggered transaction history refresh`);
                } catch (error) {
                  console.error('[IncomingTxMonitor] Error caching medium-risk transaction:', error);
                }
              })();
            }
          } else {
            // Low risk - safe token
            console.log("[IncomingMonitor] ✅ Safe token detected:", transfer.tokenSymbol);
            createSafeTokenNotification(transfer);
            
            if (onIncomingToken) {
              console.log("[IncomingMonitor] Calling onIncomingToken callback for safe token");
              onIncomingToken(transfer);
            }
            
            // 🔥 CRITICAL: Cache safe incoming transaction so receiver sees it in history immediately
            if (typeof window !== 'undefined' && txHash) {
              (async () => {
                try {
                  const { cacheTransaction } = await import('@/lib/storage/transaction-cache');
                  const incomingTx = {
                    id: actualTx.id || txHash,
                    hash: txHash,
                    from: transfer.fromAddress,
                    to: walletAddress,
                    amount: transfer.amount,
                    token: (transfer.tokenSymbol === "EURC" ? "EURC" : "USDC") as "USDC" | "EURC",
                    status: (actualTx.state === "COMPLETED" ? "confirmed" : "pending") as "pending" | "confirmed" | "failed",
                    timestamp: new Date(actualTx.createDate || actualTx.createdAt || Date.now()),
                  };
                  if (userId) {
                    await cacheTransaction(userId, walletId, incomingTx);
                    console.log(`[IncomingTxMonitor] 💾 Cached safe incoming tx for receiver: ${txHash.substring(0, 10)}...`);
                  }
                  
                  // Also trigger transaction history refresh immediately
                  window.dispatchEvent(new CustomEvent('arcle:transactions:refresh'));
                  console.log(`[IncomingTxMonitor] 🔄 Triggered transaction history refresh`);
                } catch (error) {
                  console.error('[IncomingTxMonitor] Error caching safe transaction:', error);
                }
              })();
            }
          }
        } catch (analysisError: any) {
          console.error("[IncomingMonitor] Error analyzing token:", analysisError);
          // Even if analysis fails, still notify about the incoming token
          if (onIncomingToken) {
            onIncomingToken(transfer);
          }
        }
      }
    } catch (error: any) {
      // Only log unexpected errors (404s and network errors are expected for new wallets)
      // Don't log if it's a 404 or network error (CORS, fetch failed, etc.)
      const isExpectedError = 
        error.response?.status === 404 ||
        error.message?.includes("Failed to fetch") ||
        error.message?.includes("CORS") ||
        error.name === "TypeError";
      
      if (!isExpectedError) {
        console.error("Error monitoring incoming transactions:", error);
      }
    }
  };

  // Start polling immediately
  poll();

  // Set up interval
  const interval = setInterval(poll, pollInterval);
  transactionMonitors.set(monitorKey, interval);

  // Return stop function
  return () => stopIncomingTransactionMonitoring(walletId, walletAddress);
}

/**
 * Stop monitoring incoming transactions
 */
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

/**
 * Format token amount with decimals
 */
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

/**
 * Create notification for suspicious/scam token
 */
function createSuspiciousTokenNotification(transfer: IncomingTokenTransfer): void {
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

  addNotification({
    type: "security",
    title: "Suspicious Token Blocked",
    message,
    data: {
      transfer,
      analysis,
      requiresApproval: true,
    },
  });
}

/**
 * Create notification for warning token (medium risk)
 */
function createWarningTokenNotification(transfer: IncomingTokenTransfer): void {
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

  addNotification({
    type: "security",
    title: "Token Received - Review Recommended",
    message,
    data: {
      transfer,
      analysis,
    },
  });
}

/**
 * Create notification for safe token
 */
function createSafeTokenNotification(transfer: IncomingTokenTransfer): void {
  let message = `✅ **Token Received**\n\n`;
  message += `**Received:** ${transfer.amount} ${transfer.tokenSymbol || "Unknown"}\n`;
  if (transfer.fromAddress) {
    message += `**From:** ${transfer.fromAddress.slice(0, 10)}...${transfer.fromAddress.slice(-8)}\n`;
  }
  
  // Only add explorer link if transactionHash is a valid blockchain hash (0x followed by 64 hex chars)
  // Circle transaction IDs are UUIDs, not blockchain hashes
  if (transfer.transactionHash && /^0x[a-fA-F0-9]{64}$/.test(transfer.transactionHash)) {
    message += `\n[View on ArcScan](https://testnet.arcscan.app/tx/${transfer.transactionHash})`;
  }

  addNotification({
    type: "transaction",
    title: "Token Received",
    message,
    data: {
      transfer,
    },
  });
}

/**
 * Approve a suspicious token (user manually approved)
 */
export function approveSuspiciousToken(transfer: IncomingTokenTransfer): void {
  transfer.approved = true;
  transfer.rejected = false;
  
  // Add to safe tokens if user approves
  // Note: This is a user decision, so we trust their judgment
  // In production, you might want to add additional checks
  
  // Update notification data
  const notifications = getAllNotifications();
  const notification = notifications.find(
    n => n.type === "security" && n.data?.transfer?.tokenAddress === transfer.tokenAddress && !n.data?.transfer?.approved
  );
  
  if (notification) {
    notification.data = {
      ...notification.data,
      transfer: {
        ...notification.data.transfer,
        approved: true,
        rejected: false,
      },
    };
    // Save updated notifications
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("arcle_notifications");
        if (stored) {
          const allNotifications = JSON.parse(stored);
          const index = allNotifications.findIndex((n: any) => n.id === notification.id);
          if (index !== -1) {
            allNotifications[index] = notification;
            localStorage.setItem("arcle_notifications", JSON.stringify(allNotifications));
          }
        }
      } catch (error) {
        console.error("Error updating notification:", error);
      }
    }
  }
  
  // Add confirmation notification
  addNotification({
    type: "system",
    title: "Token Approved",
    message: `You've approved the token ${transfer.tokenSymbol || transfer.tokenAddress}. It has been added to your wallet.`,
    data: {
      transfer,
    },
  });
}

/**
 * Reject a suspicious token (user manually rejected)
 */
export function rejectSuspiciousToken(transfer: IncomingTokenTransfer): void {
  transfer.approved = false;
  transfer.rejected = true;
  
  // Update notification data
  const notifications = getAllNotifications();
  const notification = notifications.find(
    n => n.type === "security" && n.data?.transfer?.tokenAddress === transfer.tokenAddress && !n.data?.transfer?.rejected
  );
  
  if (notification) {
    notification.data = {
      ...notification.data,
      transfer: {
        ...notification.data.transfer,
        approved: false,
        rejected: true,
      },
    };
    // Save updated notifications
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("arcle_notifications");
        if (stored) {
          const allNotifications = JSON.parse(stored);
          const index = allNotifications.findIndex((n: any) => n.id === notification.id);
          if (index !== -1) {
            allNotifications[index] = notification;
            localStorage.setItem("arcle_notifications", JSON.stringify(allNotifications));
          }
        }
      } catch (error) {
        console.error("Error updating notification:", error);
      }
    }
  }
  
  // Add confirmation notification
  addNotification({
    type: "system",
    title: "Token Rejected",
    message: `You've rejected the token ${transfer.tokenSymbol || transfer.tokenAddress}. It will not be added to your wallet.`,
    data: {
      transfer,
    },
  });
}

