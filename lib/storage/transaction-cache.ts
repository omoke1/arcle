/**
 * Transaction Cache
 * 
 * Stores transactions locally to ensure they're never "lost" while waiting
 * for Circle API to index them.
 * 
 * Flow:
 * 1. Transaction sent → Store immediately in localStorage
 * 2. Display from cache (instant)
 * 3. Circle API confirms → Update cache with confirmed status
 * 4. Never lose transactions due to API indexing delays
 */

import type { Transaction } from "@/types";

const STORAGE_KEY = "arcle_transaction_cache";
const MAX_CACHE_SIZE = 100; // Keep last 100 transactions
const CACHE_EXPIRY_DAYS = 30; // Keep transactions for 30 days

export interface CachedTransaction extends Transaction {
  cachedAt: number; // Timestamp when cached
  confirmedByAPI: boolean; // Whether Circle API has confirmed this transaction
  walletId: string; // Track which wallet this belongs to
}

/**
 * Get all cached transactions for a wallet
 */
export function getCachedTransactions(walletId: string): Transaction[] {
  if (typeof window === "undefined") return [];

  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return [];

    const allTransactions: CachedTransaction[] = JSON.parse(cached);
    
    // Filter by wallet and remove expired transactions
    const now = Date.now();
    const expiryThreshold = now - (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    
    const walletTransactions = allTransactions
      .filter(tx => tx.walletId === walletId && tx.cachedAt > expiryThreshold)
      .map(tx => ({
        id: tx.id,
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        amount: tx.amount,
        token: tx.token,
        status: tx.status,
        timestamp: new Date(tx.timestamp),
      }));

    return walletTransactions;
  } catch (error) {
    console.error("[TransactionCache] Error reading cache:", error);
    return [];
  }
}

/**
 * Cache a transaction immediately when sent
 */
export function cacheTransaction(
  walletId: string,
  transaction: Transaction
): void {
  if (typeof window === "undefined") return;

  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    let allTransactions: CachedTransaction[] = cached ? JSON.parse(cached) : [];

    // Check if transaction already exists (avoid duplicates)
    const existingIndex = allTransactions.findIndex(
      tx => tx.id === transaction.id || tx.hash === transaction.hash
    );

    const cachedTx: CachedTransaction = {
      ...transaction,
      timestamp: transaction.timestamp instanceof Date 
        ? transaction.timestamp 
        : new Date(transaction.timestamp),
      cachedAt: Date.now(),
      confirmedByAPI: false,
      walletId,
    };

    if (existingIndex >= 0) {
      // Update existing transaction
      allTransactions[existingIndex] = cachedTx;
      console.log(`[TransactionCache] ✏️ Updated transaction ${transaction.id}`);
    } else {
      // Add new transaction
      allTransactions.push(cachedTx);
      console.log(`[TransactionCache] ✅ Cached new transaction ${transaction.id}`);
    }

    // Keep only the most recent transactions
    if (allTransactions.length > MAX_CACHE_SIZE) {
      allTransactions = allTransactions
        .sort((a, b) => b.cachedAt - a.cachedAt)
        .slice(0, MAX_CACHE_SIZE);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(allTransactions));
  } catch (error) {
    console.error("[TransactionCache] Error caching transaction:", error);
  }
}

/**
 * Update cached transaction status when Circle API confirms it
 */
export function updateTransactionStatus(
  transactionId: string,
  status: "pending" | "confirmed" | "failed",
  confirmedByAPI: boolean = true
): void {
  if (typeof window === "undefined") return;

  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return;

    const allTransactions: CachedTransaction[] = JSON.parse(cached);
    const txIndex = allTransactions.findIndex(
      tx => tx.id === transactionId || tx.hash === transactionId
    );

    if (txIndex >= 0) {
      allTransactions[txIndex].status = status;
      allTransactions[txIndex].confirmedByAPI = confirmedByAPI;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allTransactions));
      console.log(`[TransactionCache] ✏️ Updated status for ${transactionId}: ${status}`);
    }
  } catch (error) {
    console.error("[TransactionCache] Error updating status:", error);
  }
}

/**
 * Merge cached transactions with Circle API transactions
 * 
 * Strategy:
 * 1. Start with cached transactions (instant display)
 * 2. Merge with Circle API transactions (confirmed data)
 * 3. Update cache with Circle API confirmation
 * 4. Return deduplicated list
 */
export function mergeWithAPITransactions(
  walletId: string,
  apiTransactions: Transaction[]
): Transaction[] {
  const cached = getCachedTransactions(walletId);
  
  // Create a map of API transactions by ID and hash
  const apiMap = new Map<string, Transaction>();
  apiTransactions.forEach(tx => {
    apiMap.set(tx.id, tx);
    if (tx.hash) apiMap.set(tx.hash, tx);
  });

  // Mark cached transactions as confirmed if they're in API response
  cached.forEach(tx => {
    if (apiMap.has(tx.id) || (tx.hash && apiMap.has(tx.hash))) {
      updateTransactionStatus(tx.id, tx.status, true);
    }
  });

  // Merge: cached + API (deduplicated)
  const merged = [...cached];
  apiTransactions.forEach(apiTx => {
    // Check if this transaction already exists in cached
    const existsInCache = cached.some(
      cachedTx => cachedTx.id === apiTx.id || 
                  (cachedTx.hash && cachedTx.hash === apiTx.hash)
    );

    if (!existsInCache) {
      merged.push(apiTx);
    }
  });

  // Sort by timestamp (most recent first)
  merged.sort((a, b) => {
    const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
    const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
    return timeB - timeA;
  });

  console.log(`[TransactionCache] Merged: ${cached.length} cached + ${apiTransactions.length} API = ${merged.length} total`);
  return merged;
}

/**
 * Clear expired transactions from cache
 */
export function clearExpiredTransactions(): void {
  if (typeof window === "undefined") return;

  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return;

    const allTransactions: CachedTransaction[] = JSON.parse(cached);
    const now = Date.now();
    const expiryThreshold = now - (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const validTransactions = allTransactions.filter(
      tx => tx.cachedAt > expiryThreshold
    );

    if (validTransactions.length < allTransactions.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validTransactions));
      console.log(`[TransactionCache] 🧹 Cleared ${allTransactions.length - validTransactions.length} expired transactions`);
    }
  } catch (error) {
    console.error("[TransactionCache] Error clearing expired transactions:", error);
  }
}

/**
 * Clear all cached transactions (for testing/debugging)
 */
export function clearAllCache(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  console.log("[TransactionCache] 🗑️ Cleared all cached transactions");
}




