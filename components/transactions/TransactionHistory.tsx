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

const ARC_USDC_DECIMALS = Number(process.env.NEXT_PUBLIC_ARC_USDC_DECIMALS ?? "6");
const ARC_USDC_DECIMALS_BIGINT = BigInt(ARC_USDC_DECIMALS);

interface TransactionHistoryProps {
  walletId: string;
  walletAddress?: string; // Add wallet address to properly identify incoming transactions
  limit?: number;
  className?: string;
  userId?: string;
  userToken?: string;
}

export function TransactionHistory({ walletId, walletAddress, limit = 50, className, userId: userIdProp, userToken: userTokenProp }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authParams, setAuthParams] = useState<{ userId?: string; userToken?: string; loaded: boolean }>({
    userId: userIdProp,
    userToken: userTokenProp,
    loaded: !!(userIdProp && userTokenProp),
  });

  useEffect(() => {
    // Load credentials from props or localStorage
    const storedUserId = typeof window !== 'undefined' ? localStorage.getItem('arcle_user_id') : null;
    const storedUserToken = typeof window !== 'undefined' ? localStorage.getItem('arcle_user_token') : null;
    
    // Prefer props, fallback to localStorage
    const finalUserId = userIdProp || storedUserId || undefined;
    const finalUserToken = userTokenProp || storedUserToken || undefined;
    
    setAuthParams({
      userId: finalUserId,
      userToken: finalUserToken,
      loaded: true,
    });
    
    // Log for debugging (only in dev)
    if (process.env.NODE_ENV === 'development') {
      if (!finalUserId) {
        console.warn("[TransactionHistory] No userId found in props or localStorage");
      }
      if (!finalUserToken) {
        console.warn("[TransactionHistory] No userToken found in props or localStorage");
      }
    }
  }, [userIdProp, userTokenProp]);

  useEffect(() => {
    const fetchTransactions = async (forceFresh = false, isBackgroundRefresh = false) => {
      if (!walletId) {
        setTransactions([]);
        return;
      }

      if (!authParams.loaded) {
        return;
      }

      if (!authParams.userId || !authParams.userToken) {
        setTransactions([]);
        setIsLoading(false);
        setError("Missing user authentication. Please refresh to continue.");
        return;
      }
      
      // Only show loading state for initial load or user-initiated refreshes, not background polling
      if (!isBackgroundRefresh) {
        setIsLoading(true);
      }
      // Don't clear error on background refresh to avoid flickering
      if (!isBackgroundRefresh) {
        setError(null);
      }
      
      try {
        // Add cache-busting parameter to force fresh data when needed
        const cacheBuster = forceFresh ? `&_t=${Date.now()}` : '';
        const queryParams = new URLSearchParams({
          walletId,
          limit: limit.toString(),
          userId: authParams.userId,
          userToken: authParams.userToken,
        });
        const url = `/api/circle/transactions?${queryParams.toString()}${cacheBuster}`;
        const response = await fetch(url);

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          
          if (response.status === 401 || response.status === 403) {
            // Try to refresh token automatically
            const { refreshUserToken } = await import('@/lib/circle/token-refresh');
            console.log('[TransactionHistory] Token expired (403), attempting refresh...');
            
            const newToken = await refreshUserToken();
            if (newToken && newToken.userToken) {
              console.log('[TransactionHistory] ✅ Token refreshed, updating auth params and retrying...');
              
              // Update auth params for future requests
              setAuthParams(prev => ({
                ...prev,
                userToken: newToken.userToken,
              }));
              
              // Retry the fetch with new token
              const retryParams = new URLSearchParams({
                walletId,
                limit: limit.toString(),
                userId: authParams.userId || '',
                userToken: newToken.userToken,
              });
              const retryUrl = `/api/circle/transactions?${retryParams.toString()}${cacheBuster}`;
              const retryResponse = await fetch(retryUrl);
              
              if (retryResponse.ok) {
                // Process the retry response normally (fall through to normal processing)
                const retryData = await retryResponse.json();
                const data = retryData;
                // Continue with normal processing below...
              } else {
                setError("Your Circle session expired. Please refresh the page to get a new token.");
                setTransactions([]);
                setIsLoading(false);
                return;
              }
            } else {
              // If refresh failed, show error
              setError("Your Circle session expired. Please refresh the page to get a new token.");
              setTransactions([]);
              setIsLoading(false);
              return;
            }
          }

          if (response.status === 429) {
            setError("Circle rate limited the request. Slowing down and will retry shortly.");
            setTransactions((prev) => prev); // keep existing transactions
            return;
          }

          const message = errorBody?.error || response.statusText || "Failed to load transactions";
          throw new Error(message);
        }

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
              
              // Extract amount - Circle API can return amounts in decimal format OR smallest unit
              // The amounts array from Circle API typically contains decimal strings (e.g., "1.000000")
              // But we need to handle both formats
              const amountRaw = actualTx.amounts && actualTx.amounts.length > 0 
                ? actualTx.amounts[0] 
                : (actualTx.amount?.amount || actualTx.amount || "0");
              
              // Format amount - Circle API returns amounts in decimal format in the amounts array
              // But we need to handle edge cases where it might be in smallest unit
              let txAmount = amountRaw;
              try {
                if (typeof amountRaw === "string" && amountRaw !== "0") {
                  // Check if amount is already in decimal format (contains a decimal point)
                  if (amountRaw.includes(".")) {
                    // Already in decimal format - parse and clean it up
                    const num = parseFloat(amountRaw);
                    // Format to remove unnecessary trailing zeros, but keep meaningful decimals
                    txAmount = num.toString();
                    // If it's a whole number, show as integer; otherwise show with decimals
                    if (num % 1 === 0) {
                      txAmount = num.toString();
                    } else {
                      // Remove trailing zeros but keep at least 2 decimal places for currency
                      txAmount = num.toFixed(6).replace(/\.?0+$/, '');
                    }
                  } else {
                    // No decimal point - need to determine if it's decimal or smallest unit
                    // Circle API's amounts array typically returns decimal format, so if it's in amounts array,
                    // it's likely already decimal. But if it's a large number, it might be smallest unit.
                    const numValue = parseFloat(amountRaw);
                    
                    // If the number is very large (>= 1 million), it's almost certainly in smallest unit
                    // For amounts < 1 million, if it's from amounts array, it's likely already decimal
                    // But to be safe, we'll check: if dividing by 10^6 gives a reasonable USDC amount (< 1000000), 
                    // then it's likely smallest unit
                    const asSmallestUnit = numValue >= 1000000;
                    
                    if (asSmallestUnit) {
                      // Amount is in smallest unit - convert from smallest unit to decimal format
                      const amountBigInt = BigInt(amountRaw);
                      const divisor = 10n ** ARC_USDC_DECIMALS_BIGINT;
                      const whole = amountBigInt / divisor;
                      const fraction = amountBigInt % divisor;
                      const fractionStr = fraction.toString().padStart(ARC_USDC_DECIMALS, "0");
                      // Remove trailing zeros for cleaner display
                      const decimalValue = `${whole.toString()}.${fractionStr}`.replace(/\.?0+$/, '');
                      txAmount = decimalValue;
                    } else {
                      // Small number without decimal point - treat as already in decimal format
                      // (e.g., "1" means 1 USDC, not 1 smallest unit which would be 0.000001 USDC)
                      txAmount = numValue.toString();
                    }
                  }
                }
              } catch (e) {
                // If parsing fails, use raw value
                console.warn("[TransactionHistory] Error formatting amount:", amountRaw, e);
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
          
          // Deduplicate transactions by ID to prevent duplicates
          const uniqueTransactions = new Map<string, Transaction>();
          mappedTransactions.forEach(tx => {
            if (tx.id && !uniqueTransactions.has(tx.id)) {
              uniqueTransactions.set(tx.id, tx);
            }
          });
          const deduplicated = Array.from(uniqueTransactions.values());
          
          // Merge with cached transactions to ensure we never lose transactions
          if (typeof window !== 'undefined' && walletId) {
            const { mergeWithAPITransactions } = await import('@/lib/storage/transaction-cache');
            const merged = mergeWithAPITransactions(walletId, deduplicated);
            // Deduplicate merged results as well
            const finalUnique = new Map<string, Transaction>();
            merged.forEach(tx => {
              if (tx.id && !finalUnique.has(tx.id)) {
                finalUnique.set(tx.id, tx);
              }
            });
            const finalTransactions = Array.from(finalUnique.values());
            // Sort by timestamp (newest first)
            finalTransactions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            
            // Only log in development to avoid console noise
            if (process.env.NODE_ENV === 'development') {
              console.log(`[TransactionHistory] 💾 Final deduplicated result: ${finalTransactions.length} unique transactions`);
            }
            
            // Silently update transactions - React will handle the diff and only update what changed
            setTransactions(prevTransactions => {
              // Only update if there are actual changes to avoid unnecessary re-renders
              const prevIds = new Set(prevTransactions.map(tx => tx.id));
              const newIds = new Set(finalTransactions.map(tx => tx.id));
              const idsChanged = prevIds.size !== newIds.size || 
                                !Array.from(prevIds).every(id => newIds.has(id));
              
              // Check if any transaction data changed
              const dataChanged = idsChanged || finalTransactions.some(newTx => {
                const prevTx = prevTransactions.find(tx => tx.id === newTx.id);
                if (!prevTx) return true; // New transaction
                // Check if status or hash changed
                return prevTx.status !== newTx.status || prevTx.hash !== newTx.hash;
              });
              
              // Only update if there are actual changes
              return dataChanged ? finalTransactions : prevTransactions;
            });
          } else {
            // Sort by timestamp (newest first)
            deduplicated.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            
            // Silently update transactions - only if there are changes
            setTransactions(prevTransactions => {
              const prevIds = new Set(prevTransactions.map(tx => tx.id));
              const newIds = new Set(deduplicated.map(tx => tx.id));
              const idsChanged = prevIds.size !== newIds.size || 
                                !Array.from(prevIds).every(id => newIds.has(id));
              
              const dataChanged = idsChanged || deduplicated.some(newTx => {
                const prevTx = prevTransactions.find(tx => tx.id === newTx.id);
                if (!prevTx) return true;
                return prevTx.status !== newTx.status || prevTx.hash !== newTx.hash;
              });
              
              return dataChanged ? deduplicated : prevTransactions;
            });
          }
        } else {
          setTransactions([]);
        }
      } catch (err: any) {
        // Only show errors for non-background fetches to avoid error flickering
        if (!isBackgroundRefresh) {
          setError(err.message || "Failed to load transactions");
        } else {
          // Log background errors but don't show them to user
          console.warn('[TransactionHistory] Background refresh error (silent):', err.message);
        }
      } finally {
        // Only clear loading state if we set it (non-background refresh)
        if (!isBackgroundRefresh) {
          setIsLoading(false);
        }
      }
    };
    
    fetchTransactions(false, false); // Initial fetch (not background)

    // Listen for refresh events dispatched from the chat view
    const onRefresh = () => {
      console.log('[TransactionHistory] Refresh event received (background)');
      fetchTransactions(true, true); // Force fresh data, but do it silently in background
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('arcle:transactions:refresh', onRefresh);
    }
    
    // Poll periodically to catch new transactions (every 15 seconds to avoid Circle rate limits)
    const pollInterval = setInterval(() => {
      fetchTransactions(false, true); // Regular polling - silent background refresh
    }, 15000);
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('arcle:transactions:refresh', onRefresh);
      }
      clearInterval(pollInterval);
    };
  }, [walletId, walletAddress, limit, authParams.userId, authParams.userToken, authParams.loaded]);

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
    <div className={cn("space-y-1.5", className)}>
      {transactions.map((tx) => (
        <div
          key={tx.id}
          className="bg-dark-grey rounded-lg p-2.5 border border-casper/20 hover:border-casper/40 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
                (tx as any).isIncoming 
                  ? "bg-green-500/20" 
                  : "bg-red-500/20"
              )}>
                {(tx as any).isIncoming ? (
                  <ArrowDownLeft className={cn(
                    "w-3.5 h-3.5",
                    tx.status === "confirmed" ? "text-green-400" : "text-casper"
                  )} />
                ) : (
                  <ArrowUpRight className={cn(
                    "w-3.5 h-3.5",
                    tx.status === "confirmed" ? "text-red-400" : "text-casper"
                  )} />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-sm font-medium",
                    (tx as any).isIncoming ? "text-green-400" : "text-red-400"
                  )}>
                    {(tx as any).isIncoming ? "Received" : "Sent"}: {formatAmount(tx.amount)} {tx.token}
                  </span>
                  <span className={cn("text-xs", getStatusColor(tx.status))}>
                    {tx.status}
                  </span>
                </div>
                {(tx as any).isIncoming ? (
                  <div className="text-xs text-casper mt-0.5">
                    From: {formatAddress(tx.from || "")}
                  </div>
                ) : (
                  <div className="text-xs text-casper mt-0.5">
                    To: {formatAddress(tx.to || "")}
                  </div>
                )}
                <div className="text-xs text-casper/70 mt-0.5">
                  {formatDate(tx.timestamp)}
                </div>
              </div>
            </div>
            
            {tx.hash && (
              <a
                href={getExplorerUrl(tx.hash) || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="text-casper hover:text-white transition-colors ml-2 flex-shrink-0"
                style={{ pointerEvents: getExplorerUrl(tx.hash) ? 'auto' : 'none', opacity: getExplorerUrl(tx.hash) ? 1 : 0.5 }}
                title={getExplorerUrl(tx.hash) ? 'View on ArcScan' : 'Blockchain hash not available yet'}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

