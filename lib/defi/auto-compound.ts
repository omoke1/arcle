/**
 * Auto-Compound Rewards Service
 * 
 * Automatically compounds rewards across different networks
 */

import { getActivePositions, calculateEarnedYield } from "./yield-farming";
import { startYieldFarming } from "./yield-farming";

export interface CompoundStrategy {
  id: string;
  positionIds: string[]; // Yield positions to compound
  frequency: "daily" | "weekly" | "monthly";
  minRewardAmount: string; // Minimum reward to compound (to avoid gas costs)
  autoExecute: boolean;
  lastCompounded?: Date;
}

export interface CompoundExecution {
  id: string;
  strategyId: string;
  positionsCompounded: string[];
  totalRewards: string;
  newPositions: string[];
  executedAt: Date;
  transactionHashes: string[];
}

/**
 * Create auto-compound strategy
 */
export function createCompoundStrategy(
  positionIds: string[],
  frequency: "daily" | "weekly" | "monthly" = "weekly",
  minRewardAmount: string = "1.0"
): CompoundStrategy {
  const strategy: CompoundStrategy = {
    id: crypto.randomUUID(),
    positionIds,
    frequency,
    minRewardAmount,
    autoExecute: true,
  };
  
  // Store strategy
  if (typeof window !== "undefined") {
    const strategies = getStoredStrategies();
    strategies.push(strategy);
    localStorage.setItem("arcle_compound_strategies", JSON.stringify(strategies));
  }
  
  return strategy;
}

/**
 * Execute auto-compounding
 */
export async function executeAutoCompound(
  walletId: string,
  walletAddress: string,
  strategy: CompoundStrategy
): Promise<CompoundExecution | null> {
  try {
    const positions = getActivePositions(walletAddress);
    const relevantPositions = positions.filter(p => 
      strategy.positionIds.includes(p.id)
    );
    
    if (relevantPositions.length === 0) {
      return null;
    }
    
    // Calculate total rewards
    let totalRewards = 0;
    const positionsToCompound: string[] = [];
    
    for (const position of relevantPositions) {
      const earned = parseFloat(calculateEarnedYield(position));
      if (earned >= parseFloat(strategy.minRewardAmount)) {
        totalRewards += earned;
        positionsToCompound.push(position.id);
      }
    }
    
    if (totalRewards < parseFloat(strategy.minRewardAmount)) {
      return null; // Not enough rewards to compound
    }
    
    // In production, this would:
    // 1. Withdraw rewards from positions
    // 2. Re-deposit to create new positions or add to existing
    // 3. Track new positions
    
    const newPositions: string[] = [];
    const transactionHashes: string[] = [];
    
    // For each position, compound rewards
    for (const positionId of positionsToCompound) {
      const position = relevantPositions.find(p => p.id === positionId);
      if (!position) continue;
      
      const earned = calculateEarnedYield(position);
      
      // Re-deposit earned amount (in production, would be actual transaction)
      const result = await startYieldFarming(
        walletId,
        walletAddress,
        position.strategyId,
        earned
      );
      
      if (result.success && result.positionId) {
        newPositions.push(result.positionId);
        transactionHashes.push(`0x${crypto.randomUUID().replace(/-/g, '')}`);
      }
    }
    
    const execution: CompoundExecution = {
      id: crypto.randomUUID(),
      strategyId: strategy.id,
      positionsCompounded: positionsToCompound,
      totalRewards: totalRewards.toFixed(6),
      newPositions,
      executedAt: new Date(),
      transactionHashes,
    };
    
    // Update strategy last compounded time
    strategy.lastCompounded = new Date();
    if (typeof window !== "undefined") {
      const strategies = getStoredStrategies();
      const index = strategies.findIndex(s => s.id === strategy.id);
      if (index >= 0) {
        strategies[index] = strategy;
        localStorage.setItem("arcle_compound_strategies", JSON.stringify(strategies));
      }
    }
    
    // Store execution
    if (typeof window !== "undefined") {
      const executions = getStoredExecutions();
      executions.push(execution);
      localStorage.setItem("arcle_compound_executions", JSON.stringify(executions));
    }
    
    return execution;
  } catch (error: any) {
    console.error("Error executing auto-compound:", error);
    return null;
  }
}

/**
 * Check and execute pending compound strategies
 */
export async function checkAndExecuteCompounds(
  walletId: string,
  walletAddress: string
): Promise<CompoundExecution[]> {
  const strategies = getStoredStrategies();
  const executions: CompoundExecution[] = [];
  
  for (const strategy of strategies) {
    if (!strategy.autoExecute) continue;
    
    // Check if it's time to compound based on frequency
    const shouldCompound = shouldExecuteCompound(strategy);
    if (!shouldCompound) continue;
    
    const execution = await executeAutoCompound(walletId, walletAddress, strategy);
    if (execution) {
      executions.push(execution);
    }
  }
  
  return executions;
}

/**
 * Check if compound strategy should execute
 */
function shouldExecuteCompound(strategy: CompoundStrategy): boolean {
  if (!strategy.lastCompounded) {
    return true; // Never compounded, execute now
  }
  
  const now = Date.now();
  const lastCompounded = strategy.lastCompounded.getTime();
  const daysSince = (now - lastCompounded) / (1000 * 60 * 60 * 24);
  
  switch (strategy.frequency) {
    case "daily":
      return daysSince >= 1;
    case "weekly":
      return daysSince >= 7;
    case "monthly":
      return daysSince >= 30;
    default:
      return false;
  }
}

/**
 * Get stored strategies
 */
function getStoredStrategies(): CompoundStrategy[] {
  if (typeof window === "undefined") {
    return [];
  }
  
  try {
    const stored = localStorage.getItem("arcle_compound_strategies");
    if (stored) {
      const strategies = JSON.parse(stored) as any[];
      return strategies.map(s => ({
        ...s,
        lastCompounded: s.lastCompounded ? new Date(s.lastCompounded) : undefined,
      }));
    }
  } catch (error) {
    console.error("Error loading compound strategies:", error);
  }
  
  return [];
}

/**
 * Get stored executions
 */
function getStoredExecutions(): CompoundExecution[] {
  if (typeof window === "undefined") {
    return [];
  }
  
  try {
    const stored = localStorage.getItem("arcle_compound_executions");
    if (stored) {
      const executions = JSON.parse(stored) as any[];
      return executions.map(e => ({
        ...e,
        executedAt: new Date(e.executedAt),
      }));
    }
  } catch (error) {
    console.error("Error loading compound executions:", error);
  }
  
  return [];
}

