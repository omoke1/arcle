/**
 * Secure Savings Management Service
 * 
 * Manages savings accounts with competitive APYs
 */

export interface SavingsAccount {
  id: string;
  name: string;
  balance: string;
  apy: number;
  interestEarned: string;
  createdAt: Date;
  chain: string;
  protocol: string;
  riskLevel: "low" | "medium" | "high";
  autoCompound: boolean;
}

export interface SavingsDeposit {
  accountId: string;
  amount: string;
  timestamp: Date;
}

/**
 * Create savings account
 */
export async function createSavingsAccount(
  name: string,
  initialDeposit: string,
  riskTolerance: "low" | "medium" | "high" = "low"
): Promise<SavingsAccount> {
  // Determine APY based on risk tolerance
  const apyMap = {
    low: 4.5,
    medium: 6.2,
    high: 8.5,
  };
  
  const account: SavingsAccount = {
    id: crypto.randomUUID(),
    name,
    balance: initialDeposit,
    apy: apyMap[riskTolerance],
    interestEarned: "0",
    createdAt: new Date(),
    chain: "ARC",
    protocol: "Arc Savings",
    riskLevel: riskTolerance,
    autoCompound: true,
  };
  
  // Store account
  if (typeof window !== "undefined") {
    const accounts = getStoredAccounts();
    accounts.push(account);
    localStorage.setItem("arcle_savings_accounts", JSON.stringify(accounts));
  }
  
  return account;
}

/**
 * Deposit to savings account
 */
export async function depositToSavings(
  accountId: string,
  amount: string
): Promise<{ success: boolean; message: string; newBalance?: string }> {
  const accounts = getStoredAccounts();
  const account = accounts.find(a => a.id === accountId);
  
  if (!account) {
    return { success: false, message: "Savings account not found" };
  }
  
  const currentBalance = parseFloat(account.balance);
  const depositAmount = parseFloat(amount);
  account.balance = (currentBalance + depositAmount).toFixed(6);
  
  if (typeof window !== "undefined") {
    localStorage.setItem("arcle_savings_accounts", JSON.stringify(accounts));
  }
  
  return {
    success: true,
    message: `Deposited ${amount} USDC to ${account.name}`,
    newBalance: account.balance,
  };
}

/**
 * Calculate interest earned
 */
export function calculateInterest(account: SavingsAccount): string {
  const daysSinceCreation = Math.floor(
    (Date.now() - account.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const balance = parseFloat(account.balance);
  const dailyRate = account.apy / 365 / 100;
  const interest = balance * dailyRate * daysSinceCreation;
  return interest.toFixed(6);
}

/**
 * Get all savings accounts
 */
export function getSavingsAccounts(): SavingsAccount[] {
  return getStoredAccounts();
}

/**
 * Get stored accounts from localStorage
 */
function getStoredAccounts(): SavingsAccount[] {
  if (typeof window === "undefined") {
    return [];
  }
  
  try {
    const stored = localStorage.getItem("arcle_savings_accounts");
    if (stored) {
      const accounts = JSON.parse(stored) as any[];
      return accounts.map(a => ({
        ...a,
        createdAt: new Date(a.createdAt),
      }));
    }
  } catch (error) {
    console.error("Error loading savings accounts:", error);
  }
  
  return [];
}

