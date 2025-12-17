/**
 * Yield Farming Service
 * 
 * REAL IMPLEMENTATIONS ONLY - No mock or demo strategies
 * 
 * Uses Circle's USYC (yield-bearing token) for actual on-chain yield
 * Available on: Ethereum, Arbitrum
 * 
 * All strategies require userId and userToken for authentication
 * All positions are tracked on-chain via Circle USYC
 */

import { getArcClient } from "@/lib/arc";
import { circleApiRequest } from "@/lib/circle";
import { 
  subscribeToUSYC, 
  redeemUSYC, 
  getUSYCPosition,
  isUSYCAvailable,
  getAvailableBlockchains,
  type YieldPosition as USYCPosition
} from "@/lib/defi/yield-savings-usyc-user";

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
 * Available yield strategies
 * 
 * REAL IMPLEMENTATIONS ONLY:
 * - USYC: Circle's yield-bearing token (real on-chain implementation)
 * 
 * All strategies use real DeFi protocols and earn actual yield.
 */
const YIELD_STRATEGIES: YieldStrategy[] = [
  // USYC on Ethereum
  {
    id: "usyc-ethereum",
    name: "USYC on Ethereum",
    protocol: "Circle USYC",
    chain: "ETH",
    apy: 5.25, // Overnight federal funds rate (approximate)
    riskLevel: "low",
    minAmount: "1",
    autoCompound: true,
  },
  // USYC on Arbitrum
  {
    id: "usyc-arbitrum",
    name: "USYC on Arbitrum",
    protocol: "Circle USYC",
    chain: "ARBITRUM",
    apy: 5.25,
    riskLevel: "low",
    minAmount: "1",
    autoCompound: true,
  },
];

/**
 * Get available yield strategies
 * Returns only real implementations (USYC)
 */
export async function getAvailableStrategies(
  chain?: "ARC" | "BASE" | "ARBITRUM" | "ETH" | "POLYGON" | "AVALANCHE"
): Promise<YieldStrategy[]> {
  let strategies = YIELD_STRATEGIES;
  
  if (chain) {
    // Map chain names to USYC blockchain format
    const chainMap: Record<string, string> = {
      "ETH": "ETH",
      "ARBITRUM": "ARB",
    };
    
    const usycChain = chainMap[chain];
    strategies = YIELD_STRATEGIES.filter(s => {
      if (s.chain === chain) return true;
      // Only return strategies where USYC is actually available
      if (usycChain && isUSYCAvailable(usycChain)) {
        return s.id.includes("usyc") && (s.chain === "ETH" || s.chain === "ARBITRUM");
      }
      return false;
    });
  }
  
  // Filter to only strategies where USYC is available on that chain
  return strategies.filter(s => {
    const chainMap: Record<string, string> = {
      "ETH": "ETH",
      "ARBITRUM": "ARB",
    };
    const usycChain = chainMap[s.chain];
    return usycChain ? isUSYCAvailable(usycChain) : false;
  });
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
 * 
 * REAL IMPLEMENTATION ONLY: Uses Circle USYC for actual on-chain yield
 */
export async function startYieldFarming(
  walletId: string,
  walletAddress: string,
  strategyId: string,
  amount: string,
  userId: string,
  userToken: string
): Promise<YieldFarmingResult> {
  try {
    const strategy = YIELD_STRATEGIES.find(s => s.id === strategyId);
    if (!strategy) {
      return {
        success: false,
        estimatedAPY: 0,
        message: "Yield strategy not found. Available strategies: " + YIELD_STRATEGIES.map(s => s.name).join(", "),
      };
    }
    
    // All strategies require authentication
    if (!userId || !userToken) {
      return {
        success: false,
        estimatedAPY: strategy.apy,
        message: "userId and userToken are required for yield farming",
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
    
    // All strategies use USYC
    if (!strategy.id.startsWith("usyc")) {
      return {
        success: false,
        estimatedAPY: 0,
        message: "Only USYC strategies are available. Strategy must start with 'usyc'",
      };
    }
    
    // Map chain to USYC blockchain format
    const chainMap: Record<string, string> = {
      "ETH": "ETH",
      "ARBITRUM": "ARB",
    };
    const blockchain = chainMap[strategy.chain] || strategy.chain;
    
    if (!isUSYCAvailable(blockchain)) {
      return {
        success: false,
        estimatedAPY: strategy.apy,
        message: `USYC not available on ${blockchain}. Available on: ${getAvailableBlockchains().join(', ')}`,
      };
    }
    
    // Use real USYC implementation
    const result = await subscribeToUSYC(userId, userToken, walletId, amount, blockchain);
    
    if (result.success) {
      return {
        success: true,
        positionId: result.challengeId || crypto.randomUUID(),
        estimatedAPY: strategy.apy,
        message: result.step === 'approve' 
          ? `Started USYC subscription. Please complete the approval challenge first.`
          : `Started yield farming ${amount} USDC on ${strategy.protocol} (${strategy.apy}% APY)`,
      };
    } else {
      return {
        success: false,
        estimatedAPY: strategy.apy,
        message: result.error || "Failed to subscribe to USYC",
      };
    }
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
 * REAL IMPLEMENTATION ONLY: Returns actual USYC positions from on-chain data
 */
export async function getActivePositions(
  walletAddress: string,
  walletId: string,
  blockchain: string = "ETH"
): Promise<YieldPosition[]> {
  const positions: YieldPosition[] = [];
  
  if (!walletId) {
    return positions;
  }
  
  // Get real USYC positions
  if (isUSYCAvailable(blockchain)) {
    try {
      const usycPosition = await getUSYCPosition(walletAddress, walletId, blockchain);
      if (usycPosition && parseFloat(usycPosition.usycBalance) > 0) {
        // Convert USYC position to YieldPosition format
        const strategy = YIELD_STRATEGIES.find(s => 
          s.id.includes("usyc") && 
          (blockchain === "ETH" ? s.chain === "ETH" : blockchain === "ARB" && s.chain === "ARBITRUM")
        );
        
        if (strategy) {
          positions.push({
            id: `usyc-${blockchain}-${walletId}`,
            strategyId: strategy.id,
            amount: usycPosition.initialInvestment || usycPosition.usdcValue,
            apy: parseFloat(usycPosition.apy || "5.25"),
            earned: usycPosition.currentYield || "0",
            startDate: new Date(), // USYC doesn't track start date, use current
            chain: strategy.chain,
            protocol: strategy.protocol,
            status: "active",
          });
        }
      }
    } catch (error) {
      console.error("[YieldFarming] Error fetching USYC position:", error);
    }
  }
  
  return positions;
}

/**
 * Withdraw from yield position
 * 
 * REAL IMPLEMENTATION ONLY: Uses actual Circle USYC redemption
 */
export async function withdrawYield(
  positionId: string,
  walletId: string,
  userId: string,
  userToken: string,
  blockchain: string = "ETH"
): Promise<{ success: boolean; message: string; amount?: string }> {
  try {
    if (!userId || !userToken) {
      return { 
        success: false, 
        message: "userId and userToken are required for yield withdrawals" 
      };
    }
    
    // All positions are USYC
    if (!positionId.startsWith("usyc-")) {
      return { 
        success: false, 
        message: "Invalid position. Only USYC positions are supported." 
      };
    }
    
    // Get current USYC position
    const usycPosition = await getUSYCPosition("", walletId, blockchain);
    if (!usycPosition || parseFloat(usycPosition.usycBalance) === 0) {
      return { success: false, message: "No active USYC position found" };
    }
    
    // Redeem all USYC
    const result = await redeemUSYC(
      userId,
      userToken,
      walletId,
      usycPosition.usycBalance,
      blockchain
    );
    
    if (result.success) {
      return {
        success: true,
        message: result.step === 'approve'
          ? "Please complete the approval challenge first, then the redemption will proceed."
          : `Redeeming ${usycPosition.usycBalance} USYC. Estimated USDC: ${result.estimatedUSDC}`,
        amount: result.estimatedUSDC,
      };
    } else {
      return {
        success: false,
        message: result.error || "Failed to redeem USYC",
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to withdraw yield",
    };
  }
}


