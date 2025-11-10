/**
 * Cross-Chain Limit Order System
 * 
 * Execute trades when price conditions are met across chains
 */

export interface LimitOrder {
  id: string;
  fromToken: string;
  toToken: string;
  amount: string;
  targetPrice: number; // Price to execute at
  chain: "ARC" | "BASE" | "ARBITRUM" | "ETH";
  orderType: "buy" | "sell";
  status: "pending" | "filled" | "cancelled" | "expired";
  createdAt: Date;
  expiresAt?: Date;
  filledAt?: Date;
  filledPrice?: number;
  transactionHash?: string;
}

/**
 * Create limit order
 */
export function createLimitOrder(
  fromToken: string,
  toToken: string,
  amount: string,
  targetPrice: number,
  chain: "ARC" | "BASE" | "ARBITRUM" | "ETH",
  orderType: "buy" | "sell",
  expiresInDays?: number
): LimitOrder {
  const order: LimitOrder = {
    id: crypto.randomUUID(),
    fromToken,
    toToken,
    amount,
    targetPrice,
    chain,
    orderType,
    status: "pending",
    createdAt: new Date(),
    expiresAt: expiresInDays 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined,
  };
  
  // Store order
  if (typeof window !== "undefined") {
    const orders = getStoredOrders();
    orders.push(order);
    localStorage.setItem("arcle_limit_orders", JSON.stringify(orders));
  }
  
  return order;
}

/**
 * Check and execute pending limit orders
 */
export async function checkLimitOrders(): Promise<LimitOrder[]> {
  const orders = getStoredOrders();
  const pendingOrders = orders.filter(o => o.status === "pending");
  const executed: LimitOrder[] = [];
  
  for (const order of pendingOrders) {
    // Check if order expired
    if (order.expiresAt && order.expiresAt < new Date()) {
      order.status = "expired";
      continue;
    }
    
    // In production, this would:
    // 1. Query current price from DEX
    // 2. Compare with target price
    // 3. Execute if condition met
    
    // For now, simulate price check
    const currentPrice = 1.0; // Mock current price
    
    if (order.orderType === "buy" && currentPrice <= order.targetPrice) {
      // Execute buy order
      order.status = "filled";
      order.filledAt = new Date();
      order.filledPrice = currentPrice;
      order.transactionHash = `0x${crypto.randomUUID().replace(/-/g, '')}`;
      executed.push(order);
    } else if (order.orderType === "sell" && currentPrice >= order.targetPrice) {
      // Execute sell order
      order.status = "filled";
      order.filledAt = new Date();
      order.filledPrice = currentPrice;
      order.transactionHash = `0x${crypto.randomUUID().replace(/-/g, '')}`;
      executed.push(order);
    }
  }
  
  // Save updated orders
  if (typeof window !== "undefined" && executed.length > 0) {
    localStorage.setItem("arcle_limit_orders", JSON.stringify(orders));
  }
  
  return executed;
}

/**
 * Cancel limit order
 */
export function cancelLimitOrder(orderId: string): boolean {
  const orders = getStoredOrders();
  const order = orders.find(o => o.id === orderId);
  
  if (!order || order.status !== "pending") {
    return false;
  }
  
  order.status = "cancelled";
  
  if (typeof window !== "undefined") {
    localStorage.setItem("arcle_limit_orders", JSON.stringify(orders));
  }
  
  return true;
}

/**
 * Get all limit orders
 */
export function getLimitOrders(): LimitOrder[] {
  return getStoredOrders();
}

/**
 * Get stored orders from localStorage
 */
function getStoredOrders(): LimitOrder[] {
  if (typeof window === "undefined") {
    return [];
  }
  
  try {
    const stored = localStorage.getItem("arcle_limit_orders");
    if (stored) {
      const orders = JSON.parse(stored) as any[];
      return orders.map(o => ({
        ...o,
        createdAt: new Date(o.createdAt),
        expiresAt: o.expiresAt ? new Date(o.expiresAt) : undefined,
        filledAt: o.filledAt ? new Date(o.filledAt) : undefined,
      }));
    }
  } catch (error) {
    console.error("Error loading limit orders:", error);
  }
  
  return [];
}

