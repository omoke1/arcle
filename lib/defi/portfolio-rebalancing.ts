/**
 * Portfolio Rebalancing Service
 * 
 * Automatically rebalances portfolios across chains for optimal allocation
 */

import { aggregateBalances, consolidateToArc } from "@/lib/balances/cross-chain-balances";
import { initiateBridge } from "@/lib/bridge/cctp-bridge";

export interface RebalanceStrategy {
  id: string;
  name: string;
  targetAllocation: Record<string, number>; // Chain -> percentage
  threshold: number; // Rebalance when deviation exceeds this percentage
  autoExecute: boolean;
}

export interface RebalanceAction {
  fromChain: string;
  toChain: string;
  amount: string;
  reason: string;
}

export interface RebalanceResult {
  success: boolean;
  actions: RebalanceAction[];
  bridgeIds: string[];
  message: string;
}

/**
 * Analyze portfolio and determine rebalancing needs
 */
export async function analyzePortfolio(
  walletAddress: string,
  strategy: RebalanceStrategy
): Promise<RebalanceAction[]> {
  const balances = await aggregateBalances(walletAddress);
  const total = parseFloat(balances.total);
  
  if (total === 0) {
    return [];
  }
  
  const actions: RebalanceAction[] = [];
  
  // Calculate current allocation
  const currentAllocation: Record<string, number> = {};
  balances.chains.forEach(chain => {
    const chainBalance = parseFloat(chain.balance);
    currentAllocation[chain.chain] = (chainBalance / total) * 100;
  });
  
  // Compare with target allocation
  for (const [chain, targetPercent] of Object.entries(strategy.targetAllocation)) {
    const currentPercent = currentAllocation[chain] || 0;
    const deviation = Math.abs(currentPercent - targetPercent);
    
    if (deviation > strategy.threshold) {
      const targetAmount = total * (targetPercent / 100);
      const currentAmount = (currentAllocation[chain] || 0) / 100 * total;
      const difference = targetAmount - currentAmount;
      
      if (difference > 0) {
        // Need to move funds TO this chain
        // Find chains with excess
        for (const [excessChain, excessPercent] of Object.entries(currentAllocation)) {
          if (excessChain !== chain && excessPercent > strategy.targetAllocation[excessChain] || 0) {
            const excessAmount = Math.min(
              difference,
              (excessPercent - (strategy.targetAllocation[excessChain] || 0)) / 100 * total
            );
            
            if (excessAmount > 1) { // Only if > $1
              actions.push({
                fromChain: excessChain,
                toChain: chain,
                amount: excessAmount.toFixed(6),
                reason: `Rebalance: ${excessChain} (${excessPercent.toFixed(1)}%) → ${chain} (${targetPercent}%)`,
              });
            }
          }
        }
      }
    }
  }
  
  return actions;
}

/**
 * Execute rebalancing
 */
export async function executeRebalancing(
  walletId: string,
  walletAddress: string,
  strategy: RebalanceStrategy
): Promise<RebalanceResult> {
  try {
    const actions = await analyzePortfolio(walletAddress, strategy);
    
    if (actions.length === 0) {
      return {
        success: true,
        actions: [],
        bridgeIds: [],
        message: "Portfolio is already balanced",
      };
    }
    
    const bridgeIds: string[] = [];
    
    // Execute each rebalancing action
    for (const action of actions) {
      try {
        const bridge = await initiateBridge({
          walletId,
          amount: action.amount,
          fromChain: action.fromChain as any,
          toChain: action.toChain as any,
          destinationAddress: walletAddress,
        });
        
        bridgeIds.push(bridge.bridgeId);
      } catch (error: any) {
        console.error(`Failed to execute rebalance action ${action.fromChain} → ${action.toChain}:`, error);
      }
    }
    
    return {
      success: true,
      actions,
      bridgeIds,
      message: `Rebalanced portfolio: ${actions.length} transfers initiated`,
    };
  } catch (error: any) {
    return {
      success: false,
      actions: [],
      bridgeIds: [],
      message: error.message || "Rebalancing failed",
    };
  }
}

/**
 * Create default rebalancing strategy
 */
export function createDefaultStrategy(): RebalanceStrategy {
  return {
    id: crypto.randomUUID(),
    name: "Equal Distribution",
    targetAllocation: {
      ARC: 40,
      BASE: 20,
      ARBITRUM: 20,
      ETH: 20,
    },
    threshold: 5, // Rebalance when deviation > 5%
    autoExecute: false,
  };
}

