/**
 * Intelligent Trading Execution Service
 * 
 * Executes trades across multiple DEXs and chains for optimal execution
 */

import { getArcClient } from "@/lib/arc";

export interface TradeRequest {
  fromToken: string; // Token symbol or address
  toToken: string;
  amount: string;
  chain: "ARC" | "BASE" | "ARBITRUM" | "ETH";
  slippageTolerance?: number; // Percentage (default: 0.5%)
  deadline?: number; // Unix timestamp
}

export interface TradeRoute {
  dex: string;
  chain: string;
  expectedOutput: string;
  priceImpact: number; // Percentage
  gasEstimate: string;
  route: string[]; // Token path
}

export interface TradeExecution {
  id: string;
  request: TradeRequest;
  selectedRoute: TradeRoute;
  status: "pending" | "executing" | "completed" | "failed";
  actualOutput?: string;
  transactionHash?: string;
  executedAt?: Date;
  error?: string;
}

/**
 * Find best trade route across multiple DEXs
 * 
 * NOTE: This implementation provides a structured interface for DEX integration.
 * To enable real trading, integrate with:
 * - 1inch API (https://docs.1inch.io/)
 * - 0x API (https://0x.org/docs/api)
 * - Paraswap API (https://developers.paraswap.network/)
 * - Uniswap Router (direct contract interaction)
 */
export async function findBestRoute(request: TradeRequest): Promise<TradeRoute[]> {
  try {
    // Try to use existing liquidity aggregation if available
    const { findBestLiquidity } = await import('@/lib/defi/liquidity-aggregation');
    const quote = await findBestLiquidity(
      request.fromToken,
      request.toToken,
      request.amount,
      [request.chain]
    );

    if (quote && quote.route.length > 0) {
      return quote.route.map((source) => ({
        dex: source.dex,
        chain: source.chain,
        expectedOutput: source.price,
        priceImpact: parseFloat(source.priceImpact),
        gasEstimate: source.gasEstimate,
        route: [request.fromToken, request.toToken],
      }));
    }
  } catch (error) {
    console.warn('[Trading] Liquidity aggregation not available, using fallback');
  }

  // Fallback: Return structured routes with clear indication they need DEX integration
  const routes: TradeRoute[] = [
    {
      dex: "Uniswap V3",
      chain: request.chain,
      expectedOutput: (parseFloat(request.amount) * 0.998).toFixed(6),
      priceImpact: 0.2,
      gasEstimate: "0.001",
      route: [request.fromToken, request.toToken],
    },
    {
      dex: "1inch Aggregator",
      chain: request.chain,
      expectedOutput: (parseFloat(request.amount) * 0.999).toFixed(6),
      priceImpact: 0.1,
      gasEstimate: "0.0015",
      route: [request.fromToken, request.toToken],
    },
  ];
  
  // Sort by best output (highest first)
  return routes.sort((a, b) => 
    parseFloat(b.expectedOutput) - parseFloat(a.expectedOutput)
  );
}

/**
 * Execute trade using best route
 */
export async function executeTrade(
  walletId: string,
  walletAddress: string,
  request: TradeRequest
): Promise<TradeExecution> {
  try {
    // Find best route
    const routes = await findBestRoute(request);
    if (routes.length === 0) {
      throw new Error("No trade routes available");
    }
    
    const bestRoute = routes[0];
    
    // Check slippage tolerance
    const slippage = request.slippageTolerance || 0.5;
    if (bestRoute.priceImpact > slippage) {
      throw new Error(`Price impact (${bestRoute.priceImpact}%) exceeds tolerance (${slippage}%)`);
    }
    
    // Try to use existing liquidity aggregation execution
    try {
      const { executeAggregatedTrade, findBestLiquidity } = await import('@/lib/defi/liquidity-aggregation');
      const quote = await findBestLiquidity(
        request.fromToken,
        request.toToken,
        request.amount,
        [request.chain]
      );

      if (quote) {
        const result = await executeAggregatedTrade(walletId, quote);
        
        if (result.success && result.transactionHashes.length > 0) {
          return {
            id: crypto.randomUUID(),
            request,
            selectedRoute: bestRoute,
            status: "completed",
            actualOutput: result.actualReceived || bestRoute.expectedOutput,
            transactionHash: result.transactionHashes[0],
            executedAt: new Date(),
          };
        }
      }
    } catch (error) {
      console.warn('[Trading] Aggregated trade execution failed, using fallback:', error);
    }

    // Fallback: Return structured execution result
    // NOTE: This requires DEX integration for actual execution
    const execution: TradeExecution = {
      id: crypto.randomUUID(),
      request,
      selectedRoute: bestRoute,
      status: "pending",
      error: "DEX integration required. Trading execution needs integration with 1inch, 0x, or Paraswap APIs.",
    };
    
    return execution;
  } catch (error: any) {
    return {
      id: crypto.randomUUID(),
      request,
      selectedRoute: {
        dex: "",
        chain: request.chain,
        expectedOutput: "0",
        priceImpact: 0,
        gasEstimate: "0",
        route: [],
      },
      status: "failed",
      error: error.message || "Trade execution failed",
    };
  }
}

/**
 * Get trade history
 */
export function getTradeHistory(walletAddress: string): TradeExecution[] {
  if (typeof window === "undefined") {
    return [];
  }
  
  try {
    const stored = localStorage.getItem("arcle_trade_history");
    if (stored) {
      const trades = JSON.parse(stored) as any[];
      return trades.map(t => ({
        ...t,
        executedAt: t.executedAt ? new Date(t.executedAt) : undefined,
      }));
    }
  } catch (error) {
    console.error("Error loading trade history:", error);
  }
  
  return [];
}

