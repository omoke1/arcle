"use client";

import { useState, useEffect } from "react";
import { ArrowUpRight, ArrowDownLeft, Loader2, ExternalLink } from "lucide-react";
import type { Transaction } from "@/types";
import { cn } from "@/lib/utils";

interface TransactionHistoryProps {
  walletId: string;
  limit?: number;
  className?: string;
}

export function TransactionHistory({ walletId, limit = 10, className }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!walletId) {
        setTransactions([]);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(
          `/api/circle/transactions?walletId=${walletId}&limit=${limit}`
        );
        
        const data = await response.json();
        console.log(`[TransactionHistory] API response for wallet ${walletId}:`, data);
        
        if (data.success && data.data?.data) {
          // Map API response to Transaction type
          const txList = Array.isArray(data.data.data) ? data.data.data : [data.data.data];
          const mappedTransactions: Transaction[] = txList
            .filter((tx: any) => tx) // Filter out null/undefined
            .map((tx: any) => {
              // Extract blockchain hash from various fields
              const blockchainHash = tx.transactionHash || 
                                   tx.onChainTxHash || 
                                   tx.hash ||
                                   (tx.transaction && tx.transaction.hash) ||
                                   "";
              
              // Use mapped status from API, or fallback to state mapping
              const status = tx.status || 
                            (tx.state === "COMPLETED" || tx.state === "CONFIRMED" || tx.state === "SENT" ? "confirmed" :
                             tx.state === "FAILED" || tx.state === "DENIED" || tx.state === "CANCELLED" ? "failed" : "pending");
              
              return {
                id: tx.id || tx.transactionHash || "",
                hash: blockchainHash || tx.id || "",
                from: tx.sourceAddress || tx.walletId || tx.from || "",
                to: tx.destination?.address || tx.destinationAddress || tx.to || "",
                amount: tx.amount?.amount || tx.amount || "0",
                token: tx.amount?.currency || tx.token || "USDC",
                status: (status || "pending") as "pending" | "confirmed" | "failed",
                timestamp: tx.createDate ? new Date(tx.createDate) : (tx.createdAt ? new Date(tx.createdAt) : new Date()),
              };
            });
          
          console.log(`[TransactionHistory] Loaded ${mappedTransactions.length} transactions`);
          setTransactions(mappedTransactions);
        } else {
          setTransactions([]);
        }
      } catch (err) {
        console.error("Error fetching transactions:", err);
        setError("Failed to load transaction history");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTransactions();
  }, [walletId, limit]);

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
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                {tx.status === "confirmed" ? (
                  <ArrowUpRight className="w-5 h-5 text-white" />
                ) : (
                  <ArrowDownLeft className="w-5 h-5 text-casper" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">
                    {formatAmount(tx.amount)} {tx.token}
                  </span>
                  <span className={cn("text-xs", getStatusColor(tx.status))}>
                    {tx.status}
                  </span>
                </div>
                <div className="text-sm text-casper mt-1">
                  To: {formatAddress(tx.to)}
                </div>
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

