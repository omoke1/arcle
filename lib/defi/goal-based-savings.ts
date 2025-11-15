/**
 * Goal-Based Savings Implementation
 * 
 * Disciplined savings with lock periods and penalties for early withdrawal.
 * Inspired by PiggyVest, Cowrywise - helps users achieve financial goals.
 */

export type SavingsGoalStatus = "active" | "matured" | "broken";
export type SavingsFrequency = "daily" | "weekly" | "monthly" | "one-time";

export interface SavingsGoal {
  id: string;
  userId: string;
  walletId: string;
  goalName: string;
  goalCategory: "house" | "car" | "vacation" | "wedding" | "emergency" | "education" | "custom";
  targetAmount: string;
  currentAmount: string;
  contributionAmount?: string;
  contributionFrequency?: SavingsFrequency;
  lockPeriod: number; // days
  penaltyRate: number; // percentage (5-10%)
  bonusAPY: number; // higher APY for locked funds
  createdAt: number;
  maturityDate: number;
  lastContributionAt?: number;
  nextContributionAt?: number;
  status: SavingsGoalStatus;
  autoDeduct: boolean;
  reminderEnabled: boolean;
}

export interface SavingsBreakdown {
  principal: string;
  yieldEarned: string;
  penalty: string;
  netAmount: string;
  daysLocked: number;
  daysRemaining: number;
  progressPercentage: number;
}

export interface SavingsTransaction {
  id: string;
  goalId: string;
  type: "deposit" | "withdrawal" | "maturity" | "penalty";
  amount: string;
  timestamp: number;
  balanceAfter: string;
}

// In-memory storage (in production, use database)
let savingsGoals: Map<string, SavingsGoal> = new Map();
let savingsTransactions: Map<string, SavingsTransaction[]> = new Map();

/**
 * Create a new savings goal
 */
export function createSavingsGoal(params: {
  userId: string;
  walletId: string;
  goalName: string;
  goalCategory?: string;
  targetAmount: string;
  initialDeposit: string;
  lockPeriod: number;
  contributionAmount?: string;
  contributionFrequency?: SavingsFrequency;
  autoDeduct?: boolean;
  reminderEnabled?: boolean;
}): SavingsGoal {
  const {
    userId,
    walletId,
    goalName,
    goalCategory = "custom",
    targetAmount,
    initialDeposit,
    lockPeriod,
    contributionAmount,
    contributionFrequency = "monthly",
    autoDeduct = false,
    reminderEnabled = true,
  } = params;

  // Calculate APY and penalty based on lock period
  const { bonusAPY, penaltyRate } = calculateRatesForLockPeriod(lockPeriod);

  const now = Date.now();
  const maturityDate = now + (lockPeriod * 24 * 60 * 60 * 1000);

  const goal: SavingsGoal = {
    id: crypto.randomUUID(),
    userId,
    walletId,
    goalName,
    goalCategory: goalCategory as any,
    targetAmount,
    currentAmount: initialDeposit,
    contributionAmount,
    contributionFrequency,
    lockPeriod,
    penaltyRate,
    bonusAPY,
    createdAt: now,
    maturityDate,
    lastContributionAt: now,
    nextContributionAt: contributionAmount ? calculateNextContribution(now, contributionFrequency) : undefined,
    status: "active",
    autoDeduct,
    reminderEnabled,
  };

  savingsGoals.set(goal.id, goal);

  // Record initial deposit transaction
  recordTransaction({
    goalId: goal.id,
    type: "deposit",
    amount: initialDeposit,
    timestamp: now,
    balanceAfter: initialDeposit,
  });

  console.log(`[Savings] Created goal: ${goalName} - $${targetAmount} over ${lockPeriod} days`);

  return goal;
}

/**
 * Add contribution to savings goal
 */
export function addContribution(
  goalId: string,
  amount: string
): { success: boolean; newBalance: string; error?: string } {
  const goal = savingsGoals.get(goalId);

  if (!goal) {
    return { success: false, newBalance: "0", error: "Savings goal not found" };
  }

  if (goal.status !== "active") {
    return { success: false, newBalance: goal.currentAmount, error: `Goal is ${goal.status}` };
  }

  const newBalance = (parseFloat(goal.currentAmount) + parseFloat(amount)).toFixed(2);
  goal.currentAmount = newBalance;
  goal.lastContributionAt = Date.now();

  if (goal.contributionFrequency) {
    goal.nextContributionAt = calculateNextContribution(Date.now(), goal.contributionFrequency);
  }

  savingsGoals.set(goalId, goal);

  // Record transaction
  recordTransaction({
    goalId,
    type: "deposit",
    amount,
    timestamp: Date.now(),
    balanceAfter: newBalance,
  });

  console.log(`[Savings] Added $${amount} to goal ${goalId}. New balance: $${newBalance}`);

  return { success: true, newBalance };
}

/**
 * Break savings goal early (with penalty)
 */
export function breakSavingsEarly(goalId: string): SavingsBreakdown | null {
  const goal = savingsGoals.get(goalId);

  if (!goal) {
    console.error(`[Savings] Goal ${goalId} not found`);
    return null;
  }

  if (goal.status !== "active") {
    console.error(`[Savings] Goal ${goalId} is ${goal.status}, cannot break`);
    return null;
  }

  const breakdown = calculateSavingsBreakdown(goal);

  // Update goal status
  goal.status = "broken";
  savingsGoals.set(goalId, goal);

  // Record penalty transaction
  recordTransaction({
    goalId,
    type: "penalty",
    amount: breakdown.penalty,
    timestamp: Date.now(),
    balanceAfter: breakdown.netAmount,
  });

  // Record withdrawal
  recordTransaction({
    goalId,
    type: "withdrawal",
    amount: breakdown.netAmount,
    timestamp: Date.now(),
    balanceAfter: "0",
  });

  console.log(`[Savings] Broke goal ${goalId} early. Penalty: $${breakdown.penalty}, Net: $${breakdown.netAmount}`);

  return breakdown;
}

/**
 * Mature savings goal (no penalty)
 */
export function matureSavingsGoal(goalId: string): SavingsBreakdown | null {
  const goal = savingsGoals.get(goalId);

  if (!goal) {
    return null;
  }

  const now = Date.now();

  if (now < goal.maturityDate) {
    console.warn(`[Savings] Goal ${goalId} not yet matured. Use breakSavingsEarly() instead.`);
    return null;
  }

  // Calculate final amount with full yield, no penalty
  const daysLocked = Math.floor((now - goal.createdAt) / (24 * 60 * 60 * 1000));
  const yieldEarned = calculateYield(goal.currentAmount, goal.bonusAPY, daysLocked);
  const totalAmount = (parseFloat(goal.currentAmount) + parseFloat(yieldEarned)).toFixed(2);

  const breakdown: SavingsBreakdown = {
    principal: goal.currentAmount,
    yieldEarned,
    penalty: "0",
    netAmount: totalAmount,
    daysLocked,
    daysRemaining: 0,
    progressPercentage: 100,
  };

  // Update goal status
  goal.status = "matured";
  savingsGoals.set(goalId, goal);

  // Record maturity
  recordTransaction({
    goalId,
    type: "maturity",
    amount: totalAmount,
    timestamp: now,
    balanceAfter: "0",
  });

  console.log(`[Savings] Matured goal ${goalId}. Total: $${totalAmount} (Principal: $${goal.currentAmount} + Yield: $${yieldEarned})`);

  return breakdown;
}

/**
 * Calculate savings breakdown (for display or early withdrawal)
 */
export function calculateSavingsBreakdown(goal: SavingsGoal): SavingsBreakdown {
  const now = Date.now();
  const daysLocked = Math.floor((now - goal.createdAt) / (24 * 60 * 60 * 1000));
  const totalDays = goal.lockPeriod;
  const daysRemaining = Math.max(0, totalDays - daysLocked);

  // Calculate yield earned so far
  const yieldEarned = calculateYield(goal.currentAmount, goal.bonusAPY, daysLocked);

  // Calculate progressive penalty based on how early the withdrawal is
  const progressPercentage = (daysLocked / totalDays) * 100;
  const penaltyRate = calculateProgressivePenalty(goal.penaltyRate, progressPercentage);

  // Penalty is on principal only, not on yield
  const penaltyAmount = (parseFloat(goal.currentAmount) * (penaltyRate / 100)).toFixed(2);

  // Net amount = principal - penalty + yield (you keep earned yield!)
  const netAmount = (
    parseFloat(goal.currentAmount) -
    parseFloat(penaltyAmount) +
    parseFloat(yieldEarned)
  ).toFixed(2);

  return {
    principal: goal.currentAmount,
    yieldEarned,
    penalty: penaltyAmount,
    netAmount,
    daysLocked,
    daysRemaining,
    progressPercentage: Math.min(100, progressPercentage),
  };
}

/**
 * Calculate progressive penalty (decreases as you get closer to maturity)
 */
function calculateProgressivePenalty(basePenaltyRate: number, progressPercentage: number): number {
  if (progressPercentage >= 100) return 0; // Fully matured

  // Progressive reduction
  if (progressPercentage < 16.67) return basePenaltyRate; // 0-30 days: full penalty
  if (progressPercentage < 33.33) return basePenaltyRate * 0.7; // 30-60 days: 70%
  if (progressPercentage < 50) return basePenaltyRate * 0.5; // 60-90 days: 50%
  if (progressPercentage < 66.67) return basePenaltyRate * 0.3; // 90-120 days: 30%
  if (progressPercentage < 83.33) return basePenaltyRate * 0.2; // 120-150 days: 20%
  return basePenaltyRate * 0.1; // 150+ days: 10% (almost there!)
}

/**
 * Calculate rates based on lock period
 */
function calculateRatesForLockPeriod(lockPeriod: number): { bonusAPY: number; penaltyRate: number } {
  if (lockPeriod >= 365) {
    return { bonusAPY: 15, penaltyRate: 10 }; // 1 year: 15% APY, 10% penalty
  } else if (lockPeriod >= 180) {
    return { bonusAPY: 12, penaltyRate: 7 }; // 6 months: 12% APY, 7% penalty
  } else if (lockPeriod >= 90) {
    return { bonusAPY: 10, penaltyRate: 5 }; // 3 months: 10% APY, 5% penalty
  } else if (lockPeriod >= 60) {
    return { bonusAPY: 9, penaltyRate: 5 }; // 2 months: 9% APY, 5% penalty
  } else if (lockPeriod >= 30) {
    return { bonusAPY: 8, penaltyRate: 5 }; // 1 month: 8% APY, 5% penalty
  } else {
    return { bonusAPY: 7, penaltyRate: 3 }; // < 1 month: 7% APY, 3% penalty
  }
}

/**
 * Calculate yield earned
 */
function calculateYield(principal: string, apy: number, daysLocked: number): string {
  const principalNum = parseFloat(principal);
  const dailyRate = apy / 365 / 100;
  const yield_ = principalNum * dailyRate * daysLocked;
  return yield_.toFixed(2);
}

/**
 * Calculate next contribution date
 */
function calculateNextContribution(from: number, frequency: SavingsFrequency): number {
  const intervals = {
    daily: 1 * 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
    "one-time": 0,
  };

  return from + intervals[frequency];
}

/**
 * Get all savings goals for a user
 */
export function getSavingsGoalsByUser(userId: string): SavingsGoal[] {
  return Array.from(savingsGoals.values()).filter(g => g.userId === userId);
}

/**
 * Get single savings goal
 */
export function getSavingsGoal(goalId: string): SavingsGoal | undefined {
  return savingsGoals.get(goalId);
}

/**
 * Get transactions for a goal
 */
export function getSavingsTransactions(goalId: string): SavingsTransaction[] {
  return savingsTransactions.get(goalId) || [];
}

/**
 * Record transaction
 */
function recordTransaction(tx: Omit<SavingsTransaction, "id">): void {
  const transaction: SavingsTransaction = {
    id: crypto.randomUUID(),
    ...tx,
  };

  const existing = savingsTransactions.get(tx.goalId) || [];
  existing.push(transaction);
  savingsTransactions.set(tx.goalId, existing);
}

/**
 * Check for goals due for contribution reminder
 */
export function getGoalsDueForContribution(): SavingsGoal[] {
  const now = Date.now();
  return Array.from(savingsGoals.values()).filter(
    g => g.status === "active" &&
         g.reminderEnabled &&
         g.nextContributionAt &&
         now >= g.nextContributionAt
  );
}

/**
 * Check for matured goals
 */
export function getMaturedGoals(): SavingsGoal[] {
  const now = Date.now();
  return Array.from(savingsGoals.values()).filter(
    g => g.status === "active" && now >= g.maturityDate
  );
}

/**
 * Format goal for display
 */
export function formatSavingsGoal(goal: SavingsGoal): string {
  const breakdown = calculateSavingsBreakdown(goal);
  const maturityDate = new Date(goal.maturityDate).toLocaleDateString();

  let message = `🎯 ${goal.goalName}\n\n`;
  message += `Target: $${goal.targetAmount}\n`;
  message += `Current: $${goal.currentAmount}\n`;
  message += `Progress: ${breakdown.progressPercentage.toFixed(1)}%\n`;
  message += `Yield Earned: $${breakdown.yieldEarned}\n`;
  message += `APY: ${goal.bonusAPY}%\n`;
  message += `Maturity: ${maturityDate}\n`;
  message += `Days Remaining: ${breakdown.daysRemaining}\n`;
  message += `Status: ${goal.status}\n\n`;

  if (goal.status === "active") {
    message += `⚠️ Early withdrawal penalty: $${breakdown.penalty} (${goal.penaltyRate}% base)\n`;
    message += `Net if broken now: $${breakdown.netAmount}`;
  }

  return message;
}

/**
 * Format all goals for a user
 */
export function formatAllSavingsGoals(goals: SavingsGoal[]): string {
  if (goals.length === 0) {
    return "You don't have any savings goals yet. Create one to start saving!";
  }

  const active = goals.filter(g => g.status === "active");
  const matured = goals.filter(g => g.status === "matured");
  const broken = goals.filter(g => g.status === "broken");

  let message = `💰 Your Savings Goals (${goals.length})\n\n`;

  if (active.length > 0) {
    message += `📊 Active (${active.length}):\n`;
    active.forEach((goal, i) => {
      const breakdown = calculateSavingsBreakdown(goal);
      message += `${i + 1}. ${goal.goalName}: $${goal.currentAmount}/$${goal.targetAmount} (${breakdown.progressPercentage.toFixed(0)}%)\n`;
    });
    message += `\n`;
  }

  if (matured.length > 0) {
    message += `✅ Matured (${matured.length})\n`;
  }

  if (broken.length > 0) {
    message += `❌ Broken (${broken.length})\n`;
  }

  return message;
}



