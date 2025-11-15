/**
 * Transaction History Component
 * 
 * Displays transaction history for a wallet
 * NETWORK: Arc Testnet (ARC-TESTNET)
 * - Explorer: https://testnet.arcscan.app
 */

"use client";

import { useState, useEffect } from "react";
import { ArrowUpRight, ArrowDownLeft, Loader2, ExternalLink } from "lucide-react";
import type { Transaction } from "@/types";
import { cn } from "@/lib/utils";

interface TransactionHistoryProps {
  walletId: string;
  walletAddress?: string; // Add wallet address to properly identify incoming transactions
  limit?: number;
  className?: string;
}

export function TransactionHistory({ walletId, walletAddress, limit = 50, className }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransactions = async (forceFresh = false) => {
      if (!walletId) {
        setTransactions([]);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Add cache-busting parameter to force fresh data when needed
        const cacheBuster = forceFresh ? `&_t=${Date.now()}` : '';
        const response = await fetch(
          `/api/circle/transactions?walletId=${walletId}&limit=${limit}${cacheBuster}`
        );
        
        const data = await response.json();
        console.log(`[TransactionHistory] API response for wallet ${walletId} (forceFresh: ${forceFresh}):`, data);
        console.log(`[TransactionHistory] Wallet address: ${walletAddress || 'not provided'}`);
        
        if (data.success && data.data?.data) {
          // Handle empty array case - but first check if we have cached transactions
          if (Array.isArray(data.data.data) && data.data.data.length === 0) {
            // API returned empty, but we might have cached transactions
            console.log('[TransactionHistory] API returned empty, checking cache...');
            if (typeof window !== 'undefined' && walletId) {
              const { getCachedTransactions } = await import('@/lib/storage/transaction-cache');
              const cached = getCachedTransactions(walletId);
              if (cached.length > 0) {
                console.log(`[TransactionHistory] 💾 Found ${cached.length} cached transactions`);
                setTransactions(cached);
              } else {
                setTransactions([]);
              }
            } else {
              setTransactions([]);
            }
            setIsLoading(false);
            return;
          }
          // Map API response to Transaction type
          // Circle API response structure: 
          // - List: { data: { data: [{ transaction: {...} }] } } or { data: [{ transaction: {...} }] }
          // - Single: { data: { data: { transaction: {...} } } }
          let innerData = data.data.data;
          
          // Handle different response structures
          if (!Array.isArray(innerData)) {
            // If it's a single transaction object, check if it's wrapped
            if (innerData.transaction) {
              innerData = [innerData];
            } else if (innerData.id) {
              // Single transaction object (not wrapped)
              innerData = [innerData];
            } else {
              // Empty or unexpected structure
              innerData = [];
            }
          }
          
          const txList = Array.isArray(innerData) ? innerData : [innerData];
          
          const mappedTransactions: Transaction[] = txList
            .filter((tx: any) => tx) // Filter out null/undefined
            .map((tx: any) => {
              // Handle nested transaction object (Circle API wraps transaction in a transaction field)
              const actualTx = tx.transaction || tx;
              
              // Extract blockchain hash from various fields
              // Circle API uses txHash field for the blockchain transaction hash
              const blockchainHash = actualTx.txHash ||
                                     actualTx.transactionHash || 
                                     actualTx.onChainTxHash || 
                                     actualTx.hash ||
                                     "";
              
              // Use mapped status from API, or fallback to state mapping
              const circleState = actualTx.state || tx.state;
              const status = actualTx.status || tx.status || 
                            (circleState === "COMPLETE" || circleState === "COMPLETED" || circleState === "CONFIRMED" || circleState === "SENT" ? "confirmed" :
                             circleState === "FAILED" || circleState === "DENIED" || circleState === "CANCELLED" ? "failed" : "pending");
              
              // Extract amount - Circle API uses amounts array or amount object
              // Amount is in smallest unit (6 decimals for USDC), need to format it
              const amountRaw = actualTx.amounts && actualTx.amounts.length > 0 
                ? actualTx.amounts[0] 
                : (actualTx.amount?.amount || actualTx.amount || "0");
              
              // Format amount from smallest unit to readable format (6 decimals for USDC)
              let txAmount = amountRaw;
              try {
                if (typeof amountRaw === "string" && amountRaw !== "0") {
                  const amountBigInt = BigInt(amountRaw);
                  const decimals = 6n; // USDC has 6 decimals
                  const divisor = 10n ** decimals;
                  const whole = amountBigInt / divisor;
                  const fraction = amountBigInt % divisor;
                  const fractionStr = fraction.toString().padStart(6, "0");
                  txAmount = `${whole.toString()}.${fractionStr}`;
                }
              } catch (e) {
                // If parsing fails, use raw value
                txAmount = amountRaw.toString();
              }
              
              // Extract all transaction details
              const txId = actualTx.id || tx.id || "";
              const txHash = blockchainHash || "";
              
              // Extract source and destination addresses - handle multiple possible field names
              const sourceAddress = actualTx.sourceAddress || 
                                   actualTx.source?.address || 
                                   tx.sourceAddress || 
                                   tx.source?.address ||
                                   actualTx.from || 
                                   tx.from || 
                                   "";
              
              const destinationAddress = actualTx.destinationAddress || 
                                        actualTx.destination?.address || 
                                        tx.destinationAddress || 
                                        tx.destination?.address || 
                                        actualTx.to || 
                                        tx.to || 
                                        "";
              
              // Determine if this is an incoming or outgoing transaction
              // Compare with walletAddress if provided, otherwise use walletId as fallback
              const normalizedWalletAddress = (walletAddress || "").toLowerCase();
              const normalizedDestination = destinationAddress.toLowerCase();
              const normalizedSource = sourceAddress.toLowerCase();
              
              // Transaction is incoming if destination matches wallet address
              // Transaction is outgoing if source matches wallet address
              const isIncoming = normalizedDestination === normalizedWalletAddress && normalizedDestination !== "";
              const isOutgoing = normalizedSource === normalizedWalletAddress && normalizedSource !== "";
              
              // For incoming transactions: from = source (who sent it), to = wallet (this wallet)
              // For outgoing transactions: from = wallet (this wallet), to = destination (where it went)
              const fromAddress = isIncoming ? sourceAddress : (isOutgoing ? (walletAddress || sourceAddress) : sourceAddress);
              const toAddress = isIncoming ? (walletAddress || destinationAddress) : destinationAddress;
              
              // Extract token information - check multiple possible locations
              const txToken = actualTx.amount?.currency || 
                             tx.amount?.currency || 
                             actualTx.token?.symbol ||
                             tx.token?.symbol ||
                             actualTx.tokenSymbol ||
                             tx.tokenSymbol ||
                             actualTx.token || 
                             tx.token || 
                             "USDC";
              
              const txStatus = (status || "pending") as "pending" | "confirmed" | "failed";
              
              return {
                id: txId,
                hash: txHash,
                from: fromAddress,
                to: toAddress,
                amount: txAmount,
                token: txToken,
                status: txStatus,
                timestamp: new Date(actualTx.createDate || actualTx.createdAt || tx.createdAt || Date.now()),
                isIncoming, // Add flag to track direction
              };
            });
          
          console.log(`[TransactionHistory] Mapped ${mappedTransactions.length} API transactions`);
          
          // Merge with cached transactions to ensure we never lose transactions
          if (typeof window !== 'undefined' && walletId) {
            const { mergeWithAPITransactions } = await import('@/lib/storage/transaction-cache');
            const merged = mergeWithAPITransactions(walletId, mappedTransactions);
            console.log(`[TransactionHistory] 💾 Merged result: ${merged.length} total transactions`);
            setTransactions(merged);
          } else {
            setTransactions(mappedTransactions);
          }
        } else {
          setTransactions([]);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load transactions");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTransactions(false); // Initial fetch

    // Listen for refresh events dispatched from the chat view
    const onRefresh = () => {
      console.log('[TransactionHistory] Refresh event received');
      fetchTransactions(true); // Force fresh data on manual refresh
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('arcle:transactions:refresh', onRefresh);
    }
    
    // Also poll periodically to catch new transactions (every 3 seconds for faster updates)
    const pollInterval = setInterval(() => {
      fetchTransactions(false); // Regular polling doesn't force fresh
    }, 3000); // Reduced from 5000ms to 3000ms for faster updates
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('arcle:transactions:refresh', onRefresh);
      }
      clearInterval(pollInterval);
    };
  }, [walletId, walletAddress, limit]);

  const formatAmount = (amount: string): string => {
    try {
      const num = parseFloat(amount);
      return num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      });
    } catch {
      return amount;
    }
  };

  const formatAddress = (address: string): string => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "confirmed":
        return "text-green-400";
      case "failed":
        return "text-red-400";
      default:
        return "text-casper";
    }
  };

  const getExplorerUrl = (hash: string): string | null => {
    // Only generate ArcScan URL if hash is a valid blockchain hash (0x followed by 64 hex chars)
    // Circle transaction IDs are UUIDs, not blockchain hashes
    if (hash && /^0x[a-fA-F0-9]{64}$/.test(hash)) {
      return `https://testnet.arcscan.app/tx/${hash}`;
    }
    return null; // Return null if not a valid blockchain hash
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <Loader2 className="w-6 h-6 animate-spin text-casper" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("text-center py-8 text-casper", className)}>
        <p>{error}</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className={cn("text-center py-8 text-casper", className)}>
        <p>No transactions yet</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {transactions.map((tx) => (
        <div
          key={tx.id}
          className="bg-dark-grey rounded-xl p-4 border border-casper/20 hover:border-casper/40 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                (tx as any).isIncoming 
                  ? "bg-green-500/20" 
                  : "bg-white/20"
              )}>
                {(tx as any).isIncoming ? (
                  <ArrowDownLeft className={cn(
                    "w-5 h-5",
                    tx.status === "confirmed" ? "text-green-400" : "text-casper"
                  )} />
                ) : (
                  <ArrowUpRight className={cn(
                    "w-5 h-5",
                    tx.status === "confirmed" ? "text-white" : "text-casper"
                  )} />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-white font-medium",
                    (tx as any).isIncoming ? "text-green-400" : "text-white"
                  )}>
                    {(tx as any).isIncoming ? "+" : "-"} {formatAmount(tx.amount)} {tx.token}
                  </span>
                  <span className={cn("text-xs", getStatusColor(tx.status))}>
                    {tx.status}
                  </span>
                </div>
                {(tx as any).isIncoming ? (
                  <div className="text-sm text-casper mt-1">
                    From: {formatAddress(tx.from || "")}
                  </div>
                ) : (
                  <div className="text-sm text-casper mt-1">
                    To: {formatAddress(tx.to || "")}
                  </div>
                )}
                <div className="text-xs text-casper mt-1">
                  {formatDate(tx.timestamp)}
                </div>
              </div>
            </div>
            
            {tx.hash && (
              <a
                href={getExplorerUrl(tx.hash) || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="text-casper hover:text-white transition-colors"
                style={{ pointerEvents: getExplorerUrl(tx.hash) ? 'auto' : 'none', opacity: getExplorerUrl(tx.hash) ? 1 : 0.5 }}
                title={getExplorerUrl(tx.hash) ? 'View on ArcScan' : 'Blockchain hash not available yet'}
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

