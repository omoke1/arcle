/**
 * Sub-Account Management
 * 
 * Manages AI agent-controlled sub-accounts with budget limits
 */

export interface SubAccount {
  id: string;
  walletId: string; // Circle wallet ID
  address: string; // Wallet address on Arc
  masterWalletId: string; // Parent wallet ID
  masterAddress: string; // Parent wallet address
  dailySpendLimit: string; // Daily spending limit in USDC (e.g., "100.00")
  perTransactionLimit: string; // Per-transaction limit in USDC (e.g., "20.00")
  totalSpentToday: string; // Total spent today in USDC
  lastResetDate: number; // Timestamp of last daily reset
  createdAt: number;
  isActive: boolean;
  gasSponsored: boolean; // Whether gas is sponsored via Paymaster
}

const STORAGE_KEY = 'arcle_sub_accounts';
const SPENT_TODAY_KEY = 'arcle_sub_account_spent_';

function readAll(): SubAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeAll(items: SubAccount[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
}

export function listSubAccounts(masterWalletId?: string): SubAccount[] {
  const all = readAll();
  if (masterWalletId) {
    return all.filter(sa => sa.masterWalletId === masterWalletId);
  }
  return all;
}

export function getSubAccount(id: string): SubAccount | null {
  const all = readAll();
  return all.find(sa => sa.id === id) || null;
}

export function addSubAccount(subAccount: Omit<SubAccount, 'id' | 'createdAt' | 'totalSpentToday' | 'lastResetDate'>): SubAccount {
  const all = readAll();
  const now = Date.now();
  const newSubAccount: SubAccount = {
    ...subAccount,
    id: crypto.randomUUID(),
    createdAt: now,
    totalSpentToday: '0.00',
    lastResetDate: now,
  };
  all.push(newSubAccount);
  writeAll(all);
  return newSubAccount;
}

export function updateSubAccount(id: string, patch: Partial<SubAccount>): SubAccount | null {
  const all = readAll();
  const idx = all.findIndex(sa => sa.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch };
  writeAll(all);
  return all[idx];
}

export function removeSubAccount(id: string): boolean {
  const all = readAll();
  const initialLength = all.length;
  const filtered = all.filter(sa => sa.id !== id);
  writeAll(filtered);
  return filtered.length < initialLength;
}

/**
 * Check if a transaction amount is within budget limits
 */
export function checkBudgetLimits(subAccountId: string, amount: string): { allowed: boolean; reason?: string } {
  const subAccount = getSubAccount(subAccountId);
  if (!subAccount || !subAccount.isActive) {
    return { allowed: false, reason: 'Sub-account not found or inactive' };
  }

  // Reset daily spending if it's a new day
  const now = Date.now();
  const lastReset = subAccount.lastResetDate;
  const oneDay = 24 * 60 * 60 * 1000;
  if (now - lastReset >= oneDay) {
    updateSubAccount(subAccountId, {
      totalSpentToday: '0.00',
      lastResetDate: now,
    });
    subAccount.totalSpentToday = '0.00';
  }

  // Check per-transaction limit
  const amountNum = parseFloat(amount);
  const perTxLimit = parseFloat(subAccount.perTransactionLimit);
  if (amountNum > perTxLimit) {
    return { allowed: false, reason: `Amount exceeds per-transaction limit of ${subAccount.perTransactionLimit} USDC` };
  }

  // Check daily limit
  const spentToday = parseFloat(subAccount.totalSpentToday);
  const dailyLimit = parseFloat(subAccount.dailySpendLimit);
  if (spentToday + amountNum > dailyLimit) {
    return { allowed: false, reason: `Transaction would exceed daily limit of ${subAccount.dailySpendLimit} USDC` };
  }

  return { allowed: true };
}

/**
 * Record a transaction to update daily spending
 */
export function recordTransaction(subAccountId: string, amount: string): boolean {
  const subAccount = getSubAccount(subAccountId);
  if (!subAccount) return false;

  // Reset if new day
  const now = Date.now();
  const lastReset = subAccount.lastResetDate;
  const oneDay = 24 * 60 * 60 * 1000;
  if (now - lastReset >= oneDay) {
    updateSubAccount(subAccountId, {
      totalSpentToday: '0.00',
      lastResetDate: now,
    });
    subAccount.totalSpentToday = '0.00';
  }

  const currentSpent = parseFloat(subAccount.totalSpentToday);
  const newSpent = currentSpent + parseFloat(amount);
  updateSubAccount(subAccountId, {
    totalSpentToday: newSpent.toFixed(2),
  });

  return true;
}


