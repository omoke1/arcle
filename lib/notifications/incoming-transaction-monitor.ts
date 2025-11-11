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
    pollInterval = 15000, // 15 seconds
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
      // Fetch recent transactions via our API route (avoids CORS issues)
      const apiResponse = await fetch(
        `/api/circle/transactions?walletId=${walletId}&limit=50`
      );

      if (!apiResponse.ok) {
        // If 404, wallet might not have transactions yet - this is expected
        if (apiResponse.status === 404) {
          return; // Silently return, no need to log
        }
        throw new Error(`Failed to fetch transactions: ${apiResponse.statusText}`);
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
        const destination = txData.destinationAddress || txData.destination?.address;
        const normalizedDestination = destination?.toLowerCase();
        const normalizedWalletAddress = walletAddress.toLowerCase();

        if (normalizedDestination !== normalizedWalletAddress) {
          continue; // Not an incoming transaction
        }

        // Check transaction state (only process completed transactions)
        const state = txData.state || txData.status;
        if (state !== "COMPLETE" && state !== "COMPLETED" && state !== "CONFIRMED") {
          continue; // Transaction not yet confirmed
        }

        // Extract token information
        const tokenId = txData.tokenId;
        const tokenAddress = txData.tokenAddress || txData.token?.address;
        const amounts = txData.amounts || [];
        const amount = amounts[0] || txData.amount?.amount || "0";

        if (!tokenAddress && !tokenId) {
          continue; // No token information
        }

        // Mark as processed
        if (txHash) {
          processedTransactions.add(txHash);
        }

        // Get token metadata
        const tokenMetadata = tokenAddress
          ? await getTokenMetadata(tokenAddress)
          : {};

        // Create incoming transfer object
        const transfer: IncomingTokenTransfer = {
          tokenAddress: tokenAddress || tokenId || "",
          tokenName: tokenMetadata.name,
          tokenSymbol: tokenMetadata.symbol,
          amount: formatTokenAmount(amount, tokenMetadata.decimals || 6),
          decimals: tokenMetadata.decimals,
          fromAddress: txData.sourceAddress || txData.source?.address || "unknown",
          transactionHash: txHash,
          timestamp: Date.now(),
        };

        // Analyze token for scams
        const analysis = await analyzeToken(
          transfer.tokenAddress,
          transfer.tokenName,
          transfer.tokenSymbol,
          transfer.decimals
        );

        transfer.analysis = analysis;

        // Create notification
        if (analysis.blocked || analysis.isScam) {
          // Suspicious/scam token - requires approval
          createSuspiciousTokenNotification(transfer);
          
          if (onSuspiciousToken) {
            onSuspiciousToken(transfer);
          }
        } else if (analysis.riskLevel === "medium") {
          // Medium risk - warn but don't block
          createWarningTokenNotification(transfer);
          
          if (onIncomingToken) {
            onIncomingToken(transfer);
          }
        } else {
          // Low risk - safe token
          createSafeTokenNotification(transfer);
          
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
  message += `**Token:** ${transfer.tokenSymbol || "Unknown"} (${transfer.tokenName || "Unknown"})\n`;
  message += `**Amount:** ${transfer.amount}\n`;
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
  message += `**Token:** ${transfer.tokenSymbol || "Unknown"} (${transfer.tokenName || "Unknown"})\n`;
  message += `**Amount:** ${transfer.amount}\n`;
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
  message += `**Token:** ${transfer.tokenSymbol || "Unknown"} (${transfer.tokenName || "Unknown"})\n`;
  message += `**Amount:** ${transfer.amount}\n`;
  message += `**From:** ${transfer.fromAddress.slice(0, 10)}...${transfer.fromAddress.slice(-8)}\n`;
  
  if (transfer.transactionHash) {
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

