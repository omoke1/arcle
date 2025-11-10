/**
 * Yield Farming Service
 * 
 * Automated yield optimization across multiple DeFi protocols
 * Supports: Lending, Staking, Liquidity Provision
 */

import { getArcClient } from "@/lib/arc";
import { circleApiRequest } from "@/lib/circle";

export interface YieldStrategy {
  id: string;
  name: string;
  protocol: string;
  chain: "ARC" | "BASE" | "ARBITRUM" | "ETH" | "POLYGON" | "AVALANCHE";
  apy: number; // Annual Percentage Yield
  riskLevel: "low" | "medium" | "high";
  minAmount: string;
  lockPeriod?: number; // Days
  autoCompound: boolean;
}

export interface YieldPosition {
  id: string;
  strategyId: string;
  amount: string;
  apy: number;
  earned: string;
  startDate: Date;
  chain: string;
  protocol: string;
  status: "active" | "pending" | "completed" | "withdrawn";
}

export interface YieldFarmingResult {
  success: boolean;
  positionId?: string;
  estimatedAPY: number;
  message: string;
}

/**
 * Available yield strategies (in production, this would query DeFi protocols)
 */
const YIELD_STRATEGIES: YieldStrategy[] = [
  {
    id: "usdc-lending-arc",
    name: "USDC Lending on Arc",
    protocol: "Arc Lending",
    chain: "ARC",
    apy: 4.5,
    riskLevel: "low",
    minAmount: "100",
    autoCompound: true,
  },
  {
    id: "usdc-lending-base",
    name: "USDC Lending on Base",
    protocol: "Aave Base",
    chain: "BASE",
    apy: 5.2,
    riskLevel: "low",
    minAmount: "100",
    autoCompound: true,
  },
  {
    id: "usdc-lending-arbitrum",
    name: "USDC Lending on Arbitrum",
    protocol: "Aave Arbitrum",
    chain: "ARBITRUM",
    apy: 5.8,
    riskLevel: "low",
    minAmount: "100",
    autoCompound: true,
  },
  {
    id: "usdc-staking-arc",
    name: "USDC Staking on Arc",
    protocol: "Arc Staking",
    chain: "ARC",
    apy: 3.2,
    riskLevel: "low",
    minAmount: "50",
    lockPeriod: 30,
    autoCompound: true,
  },
];

/**
 * Get available yield strategies
 */
export async function getAvailableStrategies(
  chain?: "ARC" | "BASE" | "ARBITRUM" | "ETH" | "POLYGON" | "AVALANCHE"
): Promise<YieldStrategy[]> {
  // In production, this would query real DeFi protocols
  // For now, return mock strategies
  if (chain) {
    return YIELD_STRATEGIES.filter(s => s.chain === chain);
  }
  return YIELD_STRATEGIES;
}

/**
 * Get best yield strategy for amount and risk tolerance
 */
export async function getBestYieldStrategy(
  amount: string,
  riskTolerance: "low" | "medium" | "high" = "low",
  chain?: string
): Promise<YieldStrategy | null> {
  const strategies = await getAvailableStrategies(chain as any);
  
  // Filter by minimum amount and risk level
  const amountNum = parseFloat(amount);
  const available = strategies.filter(s => {
    const minAmount = parseFloat(s.minAmount);
    return amountNum >= minAmount && s.riskLevel === riskTolerance;
  });
  
  if (available.length === 0) {
    return null;
  }
  
  // Return strategy with highest APY
  return available.reduce((best, current) => 
    current.apy > best.apy ? current : best
  );
}

/**
 * Start yield farming position
 */
export async function startYieldFarming(
  walletId: string,
  walletAddress: string,
  strategyId: string,
  amount: string
): Promise<YieldFarmingResult> {
  try {
    const strategy = YIELD_STRATEGIES.find(s => s.id === strategyId);
    if (!strategy) {
      return {
        success: false,
        estimatedAPY: 0,
        message: "Yield strategy not found",
      };
    }
    
    // Check minimum amount
    const amountNum = parseFloat(amount);
    const minAmount = parseFloat(strategy.minAmount);
    if (amountNum < minAmount) {
      return {
        success: false,
        estimatedAPY: strategy.apy,
        message: `Minimum amount is ${strategy.minAmount} USDC`,
      };
    }
    
    // In production, this would:
    // 1. Approve USDC spending to protocol
    // 2. Deposit to lending/staking protocol
    // 3. Track position
    
    // For now, create a mock position
    const positionId = crypto.randomUUID();
    
    // Store position (in production, this would be in a database)
    const position: YieldPosition = {
      id: positionId,
      strategyId,
      amount,
      apy: strategy.apy,
      earned: "0",
      startDate: new Date(),
      chain: strategy.chain,
      protocol: strategy.protocol,
      status: "active",
    };
    
    // Save to localStorage (in production, use database)
    if (typeof window !== "undefined") {
      const positions = getStoredPositions();
      positions.push(position);
      localStorage.setItem("arcle_yield_positions", JSON.stringify(positions));
    }
    
    return {
      success: true,
      positionId,
      estimatedAPY: strategy.apy,
      message: `Started yield farming ${amount} USDC on ${strategy.protocol} (${strategy.apy}% APY)`,
    };
  } catch (error: any) {
    return {
      success: false,
      estimatedAPY: 0,
      message: error.message || "Failed to start yield farming",
    };
  }
}

/**
 * Get active yield positions
 */
export function getActivePositions(walletAddress: string): YieldPosition[] {
  if (typeof window === "undefined") {
    return [];
  }
  
  const positions = getStoredPositions();
  return positions.filter(p => p.status === "active");
}

/**
 * Calculate earned yield for a position
 */
export function calculateEarnedYield(position: YieldPosition): string {
  const daysSinceStart = Math.floor(
    (Date.now() - position.startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const amount = parseFloat(position.amount);
  const dailyRate = position.apy / 365 / 100;
  const earned = amount * dailyRate * daysSinceStart;
  return earned.toFixed(6);
}

/**
 * Withdraw from yield position
 */
export async function withdrawYield(
  positionId: string,
  walletId: string
): Promise<{ success: boolean; message: string; amount?: string }> {
  try {
    const positions = getStoredPositions();
    const position = positions.find(p => p.id === positionId);
    
    if (!position) {
      return { success: false, message: "Position not found" };
    }
    
    if (position.status !== "active") {
      return { success: false, message: "Position is not active" };
    }
    
    // Calculate total (principal + earned)
    const earned = parseFloat(calculateEarnedYield(position));
    const total = parseFloat(position.amount) + earned;
    
    // In production, this would:
    // 1. Withdraw from protocol
    // 2. Transfer back to wallet
    
    // Update position status
    position.status = "withdrawn";
    if (typeof window !== "undefined") {
      localStorage.setItem("arcle_yield_positions", JSON.stringify(positions));
    }
    
    return {
      success: true,
      message: `Withdrew ${total.toFixed(6)} USDC (${position.amount} principal + ${earned.toFixed(6)} earned)`,
      amount: total.toFixed(6),
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to withdraw yield",
    };
  }
}

/**
 * Get stored yield positions from localStorage
 */
function getStoredPositions(): YieldPosition[] {
  if (typeof window === "undefined") {
    return [];
  }
  
  try {
    const stored = localStorage.getItem("arcle_yield_positions");
    if (stored) {
      const positions = JSON.parse(stored) as any[];
      return positions.map(p => ({
        ...p,
        startDate: new Date(p.startDate),
      }));
    }
  } catch (error) {
    console.error("Error loading yield positions:", error);
  }
  
  return [];
}

