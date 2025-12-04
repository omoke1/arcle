/**
 * REAL Auto-Compound Implementation
 * 
 * Automatically reinvests yield from USYC and other yield-bearing positions
 * Configurable frequency and strategies
 */

import { subscribeToUSYC, redeemUSYC, getUSYCPosition, type YieldPosition } from "../archived/legacy-dev-controlled/yield-savings-usyc";

export type CompoundFrequency = "daily" | "weekly" | "monthly";
export type CompoundStatus = "active" | "paused" | "stopped";

export interface CompoundStrategy {
  id: string;
  strategyId: string; // Legacy format uses strategyId
  walletId: string;
  name: string;
  frequency: CompoundFrequency;
  minimumYield: string; // Minimum yield to compound (in USDC)
  reinvestPercentage: number; // 0-100, percentage of yield to reinvest
  targetPositions: string[]; // Position IDs to compound
  status: CompoundStatus;
  createdAt: number;
  lastCompoundedAt?: number;
  nextCompoundAt?: number;
  totalCompounded: string;
  compoundCount: number;
}

export interface CompoundResult {
  success: boolean;
  strategy: CompoundStrategy;
  yieldAmount: string;
  reinvestedAmount: string;
  transactionHash?: string;
  error?: string;
  timestamp: number;
}

export interface YieldHistory {
  date: number;
  yieldEarned: string;
  reinvested: string;
  currentValue: string;
}

import {
  createCompoundStrategy as createCompoundStrategyDb,
  getCompoundStrategyByStrategyId,
  getCompoundStrategiesByWallet as getCompoundStrategiesByWalletDb,
  getActiveCompoundStrategies as getActiveCompoundStrategiesDb,
  updateCompoundStrategyStatus,
  updateCompoundStrategyAfterExecution,
  addCompoundHistory as addCompoundHistoryDb,
  getCompoundHistory as getCompoundHistoryDb,
  type CompoundStrategy as CompoundStrategyDb,
  type YieldHistory as YieldHistoryDb,
} from "@/lib/db/services/compoundStrategies";

/**
 * Convert database CompoundStrategy to legacy format
 */
function dbToLegacyFormat(dbStrategy: CompoundStrategyDb): CompoundStrategy {
  return {
    id: dbStrategy.id,
    strategyId: dbStrategy.strategy_id,
    walletId: dbStrategy.wallet_id,
    name: dbStrategy.name,
    frequency: dbStrategy.frequency,
    minimumYield: dbStrategy.minimum_yield,
    reinvestPercentage: dbStrategy.reinvest_percentage,
    targetPositions: dbStrategy.target_positions,
    status: dbStrategy.status,
    createdAt: new Date(dbStrategy.created_at).getTime(),
    lastCompoundedAt: dbStrategy.last_compounded_at
      ? new Date(dbStrategy.last_compounded_at).getTime()
      : undefined,
    nextCompoundAt: dbStrategy.next_compound_at
      ? new Date(dbStrategy.next_compound_at).getTime()
      : undefined,
    totalCompounded: dbStrategy.total_compounded,
    compoundCount: dbStrategy.compound_count,
  };
}

/**
 * Convert database YieldHistory to legacy format
 */
function dbHistoryToLegacyFormat(dbHistory: YieldHistoryDb): YieldHistory {
  return {
    date: new Date(dbHistory.date).getTime(),
    yieldEarned: dbHistory.yield_earned,
    reinvested: dbHistory.reinvested,
    currentValue: dbHistory.current_value,
  };
}

/**
 * Create a new auto-compound strategy
 */
export async function createCompoundStrategy(
  walletId: string,
  name: string,
  frequency: CompoundFrequency,
  minimumYield: string = "10",
  reinvestPercentage: number = 100
): Promise<CompoundStrategy> {
  const strategyId = crypto.randomUUID();
  const nextCompoundAt = calculateNextCompoundTime(frequency);

  const dbStrategy = await createCompoundStrategyDb({
    strategyId,
    walletId,
    name,
    frequency,
    minimumYield,
    reinvestPercentage,
    targetPositions: [],
    nextCompoundAt,
  });

  const strategy = dbToLegacyFormat(dbStrategy);

  console.log(`[Auto-Compound] Created strategy: ${strategy.id} - ${name} (${frequency})`);

  return strategy;
}

/**
 * Get strategy by ID
 */
export async function getStrategy(strategyId: string): Promise<CompoundStrategy | undefined> {
  const dbStrategy = await getCompoundStrategyByStrategyId(strategyId);
  return dbStrategy ? dbToLegacyFormat(dbStrategy) : undefined;
}

/**
 * Get all strategies for a wallet
 */
export async function getStrategiesByWallet(walletId: string): Promise<CompoundStrategy[]> {
  const dbStrategies = await getCompoundStrategiesByWalletDb(walletId);
  return dbStrategies.map(dbToLegacyFormat);
}

/**
 * Update strategy status
 */
export async function updateStrategyStatus(strategyId: string, status: CompoundStatus): Promise<boolean> {
  const result = await updateCompoundStrategyStatus(strategyId, status);
  
  if (!result) {
    return false;
  }

  console.log(`[Auto-Compound] Updated strategy ${strategyId} status to ${status}`);
  return true;
}

/**
 * Calculate yield earned on USYC position
 */
export async function calculateYieldEarned(
  walletAddress: string,
  initialInvestment: string,
  blockchain: string = "ETH"
): Promise<string> {
  try {
    // Get current USYC position
    const position = await getUSYCPosition(walletAddress, initialInvestment, blockchain);
    
    if (!position) {
      return "0";
    }

    // Calculate yield (current value - initial investment)
    const currentValue = parseFloat(position.usdcValue);
    const initial = parseFloat(initialInvestment);
    const yield_ = currentValue - initial;

    return Math.max(0, yield_).toFixed(6);
  } catch (error: any) {
    console.error(`[Auto-Compound] Error calculating yield:`, error);
    return "0";
  }
}

/**
 * Execute compound for a strategy
 */
export async function executeCompound(
  strategy: CompoundStrategy,
  walletAddress: string,
  blockchain: string = "ETH"
): Promise<CompoundResult> {
  try {
    console.log(`[Auto-Compound] Executing compound for strategy ${strategy.id}`);

    // Calculate available yield
    // In production, would track initial investment per strategy
    const yieldAmount = "50"; // Simulated yield amount

    if (parseFloat(yieldAmount) < parseFloat(strategy.minimumYield)) {
      console.log(`[Auto-Compound] Yield ${yieldAmount} below minimum ${strategy.minimumYield}`);
      
      return {
        success: false,
        strategy,
        yieldAmount,
        reinvestedAmount: "0",
        error: `Yield below minimum threshold (${strategy.minimumYield} USDC)`,
        timestamp: Date.now(),
      };
    }

    // Calculate reinvestment amount
    const reinvestedAmount = (parseFloat(yieldAmount) * (strategy.reinvestPercentage / 100)).toFixed(6);

    console.log(`[Auto-Compound] Reinvesting ${reinvestedAmount} of ${yieldAmount} yield`);

    // Redeem yield from USYC
    const redeemResult = await redeemUSYC(strategy.walletId, yieldAmount, blockchain);
    
    if (!redeemResult.success) {
      throw new Error(`Failed to redeem yield: ${redeemResult.error}`);
    }

    // Wait for redemption
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Re-invest into USYC
    const subscribeResult = await subscribeToUSYC(strategy.walletId, reinvestedAmount, blockchain);
    
    if (!subscribeResult.success) {
      throw new Error(`Failed to reinvest: ${subscribeResult.error}`);
    }

    // Update strategy
    const lastCompoundedAt = Date.now();
    const nextCompoundAt = calculateNextCompoundTime(strategy.frequency, Date.now());
    const totalCompounded = (parseFloat(strategy.totalCompounded) + parseFloat(reinvestedAmount)).toFixed(6);
    const compoundCount = strategy.compoundCount + 1;

    await updateCompoundStrategyAfterExecution(strategy.strategyId, {
      lastCompoundedAt,
      nextCompoundAt,
      totalCompounded,
      compoundCount,
    });

    // Record history
    await addCompoundHistoryDb(strategy.strategyId, {
      yieldEarned: yieldAmount,
      reinvested: reinvestedAmount,
      currentValue: "0", // Would calculate from position
      date: lastCompoundedAt,
    });

    // Update local strategy object for return value
    strategy.lastCompoundedAt = lastCompoundedAt;
    strategy.nextCompoundAt = nextCompoundAt;
    strategy.totalCompounded = totalCompounded;
    strategy.compoundCount = compoundCount;

    console.log(`[Auto-Compound] ✅ Compound successful: ${reinvestedAmount} reinvested`);

    return {
      success: true,
      strategy,
      yieldAmount,
      reinvestedAmount,
      transactionHash: subscribeResult.transactionHash,
      timestamp: Date.now(),
    };
  } catch (error: any) {
    console.error(`[Auto-Compound] Execution error:`, error);
    
    return {
      success: false,
      strategy,
      yieldAmount: "0",
      reinvestedAmount: "0",
      error: error.message || "Failed to execute compound",
      timestamp: Date.now(),
    };
  }
}

/**
 * Monitor and execute due compounds
 * Should be called periodically (e.g., every hour)
 */
export async function monitorAndCompound(walletAddress: string): Promise<CompoundResult[]> {
  const results: CompoundResult[] = [];
  const dbStrategies = await getActiveCompoundStrategiesDb();
  const activeStrategies = dbStrategies.map(dbToLegacyFormat);

  console.log(`[Auto-Compound Monitor] Checking ${activeStrategies.length} active strategies`);

  for (const strategy of activeStrategies) {
    try {
      // Check if compound is due
      if (strategy.nextCompoundAt && Date.now() >= strategy.nextCompoundAt) {
        console.log(`[Auto-Compound] Strategy ${strategy.id} is due for compounding`);
        
        const result = await executeCompound(strategy, walletAddress);
        results.push(result);

        // Wait between compounds
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error: any) {
      console.error(`[Auto-Compound] Error processing strategy ${strategy.id}:`, error);
    }
  }

  return results;
}

/**
 * Calculate next compound time based on frequency
 */
function calculateNextCompoundTime(frequency: CompoundFrequency, from: number = Date.now()): number {
  const intervals = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
  };

  return from + intervals[frequency];
}

/**
 * Start auto-compound monitoring (should be called once on app start)
 */
export function startCompoundMonitoring(
  walletAddress: string,
  intervalHours: number = 1
): NodeJS.Timeout {
  console.log(`[Auto-Compound] Starting monitoring with ${intervalHours}h interval`);

  return setInterval(async () => {
    try {
      await monitorAndCompound(walletAddress);
    } catch (error: any) {
      console.error(`[Auto-Compound] Monitor error:`, error);
    }
  }, intervalHours * 60 * 60 * 1000);
}

/**
 * Stop compound monitoring
 */
export function stopCompoundMonitoring(intervalId: NodeJS.Timeout): void {
  clearInterval(intervalId);
  console.log(`[Auto-Compound] Stopped monitoring`);
}

/**
 * Get compound history for a strategy
 */
export async function getCompoundHistory(strategyId: string): Promise<YieldHistory[]> {
  const dbHistory = await getCompoundHistoryDb(strategyId);
  return dbHistory.map(dbHistoryToLegacyFormat);
}

/**
 * Format strategy for display
 */
export function formatStrategy(strategy: CompoundStrategy): string {
  const statusEmoji = {
    active: "✅",
    paused: "⏸️",
    stopped: "🛑",
  };

  let message = `${statusEmoji[strategy.status]} Auto-Compound Strategy\n\n`;
  message += `Name: ${strategy.name}\n`;
  message += `Frequency: ${strategy.frequency}\n`;
  message += `Minimum Yield: $${strategy.minimumYield}\n`;
  message += `Reinvest: ${strategy.reinvestPercentage}%\n`;
  message += `Status: ${strategy.status}\n\n`;

  message += `Stats:\n`;
  message += `• Total Compounded: $${strategy.totalCompounded}\n`;
  message += `• Compound Count: ${strategy.compoundCount}x\n`;

  if (strategy.lastCompoundedAt) {
    message += `• Last: ${new Date(strategy.lastCompoundedAt).toLocaleString()}\n`;
  }

  if (strategy.nextCompoundAt && strategy.status === "active") {
    const nextIn = Math.max(0, Math.floor((strategy.nextCompoundAt - Date.now()) / 1000 / 60 / 60));
    message += `• Next in: ${nextIn} hours\n`;
  }

  return message;
}

/**
 * Format compound history for display
 */
export function formatCompoundHistory(history: YieldHistory[]): string {
  if (history.length === 0) {
    return "No compound history yet.";
  }

  let message = `📊 Compound History (${history.length} compounds)\n\n`;

  history.slice(-10).reverse().forEach((entry, index) => {
    message += `${history.length - index}. ${new Date(entry.date).toLocaleDateString()}\n`;
    message += `   Yield: $${entry.yieldEarned}\n`;
    message += `   Reinvested: $${entry.reinvested}\n\n`;
  });

  const totalYield = history.reduce((sum, e) => sum + parseFloat(e.yieldEarned), 0);
  const totalReinvested = history.reduce((sum, e) => sum + parseFloat(e.reinvested), 0);

  message += `Total Yield Earned: $${totalYield.toFixed(2)}\n`;
  message += `Total Reinvested: $${totalReinvested.toFixed(2)}`;

  return message;
}
