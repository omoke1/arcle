/**
 * Goal-Based Savings Implementation (Supabase Version)
 * 
 * This is the production-ready version that uses Supabase for persistence.
 */

import { getSupabaseAdmin } from "@/lib/supabase";

export type SavingsGoalStatus = "active" | "matured" | "broken";
export type SavingsFrequency = "daily" | "weekly" | "monthly" | "one-time";

export interface SavingsGoal {
  id: string;
  user_id: string;
  wallet_id: string;
  goal_name: string;
  goal_category: string;
  target_amount: string;
  current_amount: string;
  contribution_amount?: string;
  contribution_frequency?: SavingsFrequency;
  lock_period: number;
  penalty_rate: string;
  bonus_apy: string;
  status: SavingsGoalStatus;
  maturity_date: string;
  last_contribution_at?: string;
  next_contribution_at?: string;
  auto_deduct: boolean;
  reminder_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SavingsTransaction {
  id: string;
  goal_id: string;
  type: "deposit" | "withdrawal" | "penalty" | "maturity";
  amount: string;
  balance_after: string;
  timestamp: string;
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

/**
 * Create a new savings goal
 */
export async function createSavingsGoal(params: {
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
}): Promise<SavingsGoal> {
  const supabase = getSupabaseAdmin();

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

  const now = new Date();
  const maturityDate = new Date(now.getTime() + lockPeriod * 24 * 60 * 60 * 1000);

  const { data: goal, error } = await supabase
    .from('savings_goals')
    .insert({
      user_id: userId,
      wallet_id: walletId,
      goal_name: goalName,
      goal_category: goalCategory,
      target_amount: targetAmount,
      current_amount: initialDeposit,
      contribution_amount: contributionAmount,
      contribution_frequency: contributionFrequency,
      lock_period: lockPeriod,
      penalty_rate: penaltyRate.toString(),
      bonus_apy: bonusAPY.toString(),
      maturity_date: maturityDate.toISOString(),
      last_contribution_at: now.toISOString(),
      next_contribution_at: contributionAmount
        ? calculateNextContribution(now, contributionFrequency).toISOString()
        : null,
      auto_deduct: autoDeduct,
      reminder_enabled: reminderEnabled,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create savings goal: ${error.message}`);
  }

  // Record initial deposit transaction
  await supabase
    .from('savings_transactions')
    .insert({
      goal_id: goal.id,
      type: 'deposit',
      amount: initialDeposit,
      balance_after: initialDeposit,
    });

  console.log(`[Savings DB] Created goal: ${goalName} - ${targetAmount} over ${lockPeriod} days`);

  return goal;
}

/**
 * Add contribution to savings goal
 */
export async function addContribution(
  goalId: string,
  amount: string
): Promise<{ success: boolean; newBalance: string; error?: string }> {
  const supabase = getSupabaseAdmin();

  const { data: goal, error: fetchError } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('id', goalId)
    .single();

  if (fetchError || !goal) {
    return { success: false, newBalance: "0", error: "Savings goal not found" };
  }

  if (goal.status !== "active") {
    return { success: false, newBalance: goal.current_amount, error: `Goal is ${goal.status}` };
  }

  const newBalance = (parseFloat(goal.current_amount) + parseFloat(amount)).toFixed(2);
  const now = new Date();

  const { error: updateError } = await supabase
    .from('savings_goals')
    .update({
      current_amount: newBalance,
      last_contribution_at: now.toISOString(),
      next_contribution_at: goal.contribution_frequency
        ? calculateNextContribution(now, goal.contribution_frequency as SavingsFrequency).toISOString()
        : null,
    })
    .eq('id', goalId);

  if (updateError) {
    return { success: false, newBalance: goal.current_amount, error: updateError.message };
  }

  // Record transaction
  await supabase
    .from('savings_transactions')
    .insert({
      goal_id: goalId,
      type: 'deposit',
      amount,
      balance_after: newBalance,
    });

  console.log(`[Savings DB] Added ${amount} to goal ${goalId}. New balance: ${newBalance}`);

  return { success: true, newBalance };
}

/**
 * Break savings goal early (with penalty)
 */
export async function breakSavingsEarly(goalId: string): Promise<SavingsBreakdown | null> {
  const supabase = getSupabaseAdmin();

  const { data: goal, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('id', goalId)
    .single();

  if (error || !goal) {
    console.error(`[Savings DB] Goal ${goalId} not found`);
    return null;
  }

  if (goal.status !== "active") {
    console.error(`[Savings DB] Goal ${goalId} is ${goal.status}, cannot break`);
    return null;
  }

  const breakdown = calculateSavingsBreakdown(goal);

  // Update goal status
  await supabase
    .from('savings_goals')
    .update({ status: 'broken' })
    .eq('id', goalId);

  // Record penalty transaction
  await supabase
    .from('savings_transactions')
    .insert({
      goal_id: goalId,
      type: 'penalty',
      amount: breakdown.penalty,
      balance_after: breakdown.netAmount,
    });

  // Record withdrawal
  await supabase
    .from('savings_transactions')
    .insert({
      goal_id: goalId,
      type: 'withdrawal',
      amount: breakdown.netAmount,
      balance_after: '0',
    });

  console.log(`[Savings DB] Broke goal ${goalId} early. Penalty: ${breakdown.penalty}, Net: ${breakdown.netAmount}`);

  return breakdown;
}

/**
 * Mature savings goal (no penalty)
 */
export async function matureSavingsGoal(goalId: string): Promise<SavingsBreakdown | null> {
  const supabase = getSupabaseAdmin();

  const { data: goal, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('id', goalId)
    .single();

  if (error || !goal) {
    return null;
  }

  const now = new Date();
  const maturityDate = new Date(goal.maturity_date);

  if (now < maturityDate) {
    console.warn(`[Savings DB] Goal ${goalId} not yet matured. Use breakSavingsEarly() instead.`);
    return null;
  }

  // Calculate final amount with full yield, no penalty
  const createdAt = new Date(goal.created_at);
  const daysLocked = Math.floor((now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000));
  const yieldEarned = calculateYield(goal.current_amount, parseFloat(goal.bonus_apy), daysLocked);
  const totalAmount = (parseFloat(goal.current_amount) + parseFloat(yieldEarned)).toFixed(2);

  const breakdown: SavingsBreakdown = {
    principal: goal.current_amount,
    yieldEarned,
    penalty: "0",
    netAmount: totalAmount,
    daysLocked,
    daysRemaining: 0,
    progressPercentage: 100,
  };

  // Update goal status
  await supabase
    .from('savings_goals')
    .update({ status: 'matured' })
    .eq('id', goalId);

  // Record maturity
  await supabase
    .from('savings_transactions')
    .insert({
      goal_id: goalId,
      type: 'maturity',
      amount: totalAmount,
      balance_after: '0',
    });

  console.log(`[Savings DB] Matured goal ${goalId}. Total: ${totalAmount} (Principal: ${goal.current_amount} + Yield: ${yieldEarned})`);

  return breakdown;
}

/**
 * Calculate savings breakdown (for display or early withdrawal)
 */
export function calculateSavingsBreakdown(goal: SavingsGoal): SavingsBreakdown {
  const now = Date.now();
  const createdAt = new Date(goal.created_at).getTime();
  const daysLocked = Math.floor((now - createdAt) / (24 * 60 * 60 * 1000));
  const totalDays = goal.lock_period;
  const daysRemaining = Math.max(0, totalDays - daysLocked);

  // Calculate yield earned so far
  const yieldEarned = calculateYield(
    goal.current_amount,
    parseFloat(goal.bonus_apy),
    daysLocked
  );

  // Calculate progressive penalty based on how early the withdrawal is
  const progressPercentage = (daysLocked / totalDays) * 100;
  const penaltyRate = calculateProgressivePenalty(parseFloat(goal.penalty_rate), progressPercentage);

  // Penalty is on principal only, not on yield
  const penaltyAmount = (parseFloat(goal.current_amount) * (penaltyRate / 100)).toFixed(2);

  // Net amount = principal - penalty + yield (you keep earned yield!)
  const netAmount = (
    parseFloat(goal.current_amount) -
    parseFloat(penaltyAmount) +
    parseFloat(yieldEarned)
  ).toFixed(2);

  return {
    principal: goal.current_amount,
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
function calculateNextContribution(from: Date, frequency: SavingsFrequency): Date {
  const intervals = {
    daily: 1 * 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
    "one-time": 0,
  };

  return new Date(from.getTime() + intervals[frequency]);
}

/**
 * Get all savings goals for a user
 */
export async function getSavingsGoalsByUser(userId: string): Promise<SavingsGoal[]> {
  const supabase = getSupabaseAdmin();
  // Fixed: Ensure data is not null in return
  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

/**
 * Get single savings goal
 */
export async function getSavingsGoal(goalId: string): Promise<SavingsGoal | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('id', goalId)
    .single();

  if (error) return null;
  return data;
}

/**
 * Get transactions for a goal
 */
export async function getSavingsTransactions(goalId: string): Promise<SavingsTransaction[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('savings_transactions')
    .select('*')
    .eq('goal_id', goalId)
    .order('timestamp', { ascending: false });

  if (error) return [];
  return data || [];
}

/**
 * Check for goals due for contribution reminder
 */
export async function getGoalsDueForContribution(): Promise<SavingsGoal[]> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('status', 'active')
    .eq('reminder_enabled', true)
    .lte('next_contribution_at', now);

  if (error) return [];
  return data || [];
}

/**
 * Check for matured goals
 */
export async function getMaturedGoals(): Promise<SavingsGoal[]> {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('status', 'active')
    .lte('maturity_date', now);

  if (error) return [];
  return data || [];
}

/**
 * Format goal for display
 */
export function formatSavingsGoal(goal: SavingsGoal): string {
  const breakdown = calculateSavingsBreakdown(goal);
  const maturityDate = new Date(goal.maturity_date).toLocaleDateString();

  let message = `🎯 ${goal.goal_name}\n\n`;
  message += `Target: $${goal.target_amount}\n`;
  message += `Current: $${goal.current_amount}\n`;
  message += `Progress: ${breakdown.progressPercentage.toFixed(1)}%\n`;
  message += `Yield Earned: $${breakdown.yieldEarned}\n`;
  message += `APY: ${goal.bonus_apy}%\n`;
  message += `Maturity: ${maturityDate}\n`;
  message += `Days Remaining: ${breakdown.daysRemaining}\n`;
  message += `Status: ${goal.status}\n\n`;

  if (goal.status === "active") {
    message += `⚠️ Early withdrawal penalty: $${breakdown.penalty} (${goal.penalty_rate}% base)\n`;
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
      message += `${i + 1}. ${goal.goal_name}: $${goal.current_amount}/$${goal.target_amount} (${breakdown.progressPercentage.toFixed(0)}%)\n`;
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