/**
 * REAL Limit Orders Implementation
 * 
 * Create and manage limit orders that execute automatically
 * when target price is reached. Uses price monitoring + DEX execution.
 */

import { executeTokenSwap, getTradeQuote } from "../archived/legacy-dev-controlled/token-trading-dex";

export type OrderType = "buy" | "sell";
export type OrderStatus = "pending" | "executed" | "cancelled" | "expired";

export interface LimitOrder {
  id: string;
  walletId: string;
  type: OrderType;
  fromToken: string;
  toToken: string;
  amount: string;
  targetPrice: string;
  currentPrice?: string;
  blockchain: string;
  status: OrderStatus;
  createdAt: number;
  expiresAt?: number;
  executedAt?: number;
  transactionHash?: string;
  slippageTolerance: number;
}

export interface CreateOrderParams {
  walletId: string;
  type: OrderType;
  fromToken: string;
  toToken: string;
  amount: string;
  targetPrice: string;
  blockchain: string;
  expiryHours?: number;
  slippageTolerance?: number;
}

export interface OrderExecutionResult {
  success: boolean;
  order: LimitOrder;
  transactionHash?: string;
  executedPrice?: string;
  error?: string;
}

// In-memory storage (in production, use database)
let orders: Map<string, LimitOrder> = new Map();

/**
 * Create a new limit order
 */
export function createLimitOrder(params: CreateOrderParams): LimitOrder {
  const order: LimitOrder = {
    id: crypto.randomUUID(),
    walletId: params.walletId,
    type: params.type,
    fromToken: params.fromToken,
    toToken: params.toToken,
    amount: params.amount,
    targetPrice: params.targetPrice,
    blockchain: params.blockchain,
    status: "pending",
    createdAt: Date.now(),
    expiresAt: params.expiryHours ? Date.now() + (params.expiryHours * 60 * 60 * 1000) : undefined,
    slippageTolerance: params.slippageTolerance || 0.5,
  };

  orders.set(order.id, order);

  console.log(`[Limit Order] Created: ${order.id} - ${order.type} ${order.amount} ${order.fromToken} at $${order.targetPrice}`);

  return order;
}

/**
 * Get order by ID
 */
export function getOrder(orderId: string): LimitOrder | undefined {
  return orders.get(orderId);
}

/**
 * Get all orders for a wallet
 */
export function getOrdersByWallet(walletId: string, status?: OrderStatus): LimitOrder[] {
  const walletOrders = Array.from(orders.values()).filter(o => o.walletId === walletId);
  
  if (status) {
    return walletOrders.filter(o => o.status === status);
  }
  
  return walletOrders;
}

/**
 * Get all pending orders
 */
export function getPendingOrders(): LimitOrder[] {
  return Array.from(orders.values()).filter(o => o.status === "pending");
}

/**
 * Cancel an order
 */
export function cancelOrder(orderId: string): boolean {
  const order = orders.get(orderId);
  
  if (!order) {
    return false;
  }

  if (order.status !== "pending") {
    console.log(`[Limit Order] Cannot cancel order ${orderId} with status ${order.status}`);
    return false;
  }

  order.status = "cancelled";
  orders.set(orderId, order);

  console.log(`[Limit Order] Cancelled: ${orderId}`);

  return true;
}

/**
 * Monitor prices and execute orders when target price is reached
 * This should be called periodically (e.g., every 30 seconds)
 */
export async function monitorAndExecuteOrders(): Promise<OrderExecutionResult[]> {
  const results: OrderExecutionResult[] = [];
  const pendingOrders = getPendingOrders();

  console.log(`[Limit Order Monitor] Checking ${pendingOrders.length} pending orders`);

  for (const order of pendingOrders) {
    try {
      // Check if order has expired
      if (order.expiresAt && Date.now() > order.expiresAt) {
        order.status = "expired";
        orders.set(order.id, order);
        console.log(`[Limit Order] Expired: ${order.id}`);
        continue;
      }

      // Get current price
      const quote = await getTradeQuote(
        order.fromToken,
        order.toToken,
        order.amount,
        order.blockchain,
        order.slippageTolerance
      );

      if (!quote) {
        console.log(`[Limit Order] Could not get quote for order ${order.id}`);
        continue;
      }

      // Calculate current price (toAmount / fromAmount)
      const currentPrice = (parseFloat(quote.estimatedToAmount) / parseFloat(order.amount)).toFixed(6);
      order.currentPrice = currentPrice;

      console.log(`[Limit Order] ${order.id}: Current $${currentPrice}, Target $${order.targetPrice}`);

      // Check if target price is reached
      const shouldExecute = checkPriceCondition(order, currentPrice);

      if (shouldExecute) {
        console.log(`[Limit Order] Executing order ${order.id}`);
        const result = await executeOrder(order);
        results.push(result);
      }
    } catch (error: any) {
      console.error(`[Limit Order] Error monitoring order ${order.id}:`, error);
    }
  }

  return results;
}

/**
 * Check if price condition is met for order execution
 */
function checkPriceCondition(order: LimitOrder, currentPrice: string): boolean {
  const target = parseFloat(order.targetPrice);
  const current = parseFloat(currentPrice);

  if (order.type === "buy") {
    // Buy order: execute when price drops to or below target
    return current <= target;
  } else {
    // Sell order: execute when price rises to or above target
    return current >= target;
  }
}

/**
 * Execute a limit order
 */
async function executeOrder(order: LimitOrder): Promise<OrderExecutionResult> {
  try {
    console.log(`[Limit Order] Executing: ${order.id}`);

    const tradeResult = await executeTokenSwap(
      order.walletId,
      order.fromToken,
      order.toToken,
      order.amount,
      order.blockchain,
      order.slippageTolerance
    );

    if (tradeResult.success) {
      order.status = "executed";
      order.executedAt = Date.now();
      order.transactionHash = tradeResult.transactionHash;
      orders.set(order.id, order);

      console.log(`[Limit Order] ✅ Executed: ${order.id}`);

      return {
        success: true,
        order,
        transactionHash: tradeResult.transactionHash,
        executedPrice: order.currentPrice,
      };
    } else {
      console.log(`[Limit Order] ❌ Execution failed: ${tradeResult.error}`);

      return {
        success: false,
        order,
        error: tradeResult.error,
      };
    }
  } catch (error: any) {
    console.error(`[Limit Order] Execution error:`, error);

    return {
      success: false,
      order,
      error: error.message || "Failed to execute order",
    };
  }
}

/**
 * Start order monitoring (should be called once on app start)
 */
export function startOrderMonitoring(intervalSeconds: number = 30): NodeJS.Timeout {
  console.log(`[Limit Order] Starting monitoring with ${intervalSeconds}s interval`);

  return setInterval(async () => {
    try {
      await monitorAndExecuteOrders();
    } catch (error: any) {
      console.error(`[Limit Order] Monitor error:`, error);
    }
  }, intervalSeconds * 1000);
}

/**
 * Stop order monitoring
 */
export function stopOrderMonitoring(intervalId: NodeJS.Timeout): void {
  clearInterval(intervalId);
  console.log(`[Limit Order] Stopped monitoring`);
}

/**
 * Format order for display
 */
export function formatOrder(order: LimitOrder): string {
  const statusEmoji = {
    pending: "⏳",
    executed: "✅",
    cancelled: "❌",
    expired: "⏰",
  };

  let message = `${statusEmoji[order.status]} Limit Order #${order.id.substring(0, 8)}\n\n`;
  message += `Type: ${order.type.toUpperCase()}\n`;
  message += `Amount: ${order.amount} ${order.fromToken}\n`;
  message += `Target: ${order.toToken} at $${order.targetPrice}\n`;

  if (order.currentPrice) {
    message += `Current Price: $${order.currentPrice}\n`;
  }

  message += `Status: ${order.status}\n`;
  message += `Blockchain: ${order.blockchain}\n`;

  if (order.expiresAt) {
    const expiresIn = Math.max(0, Math.floor((order.expiresAt - Date.now()) / 1000 / 60));
    message += `Expires in: ${expiresIn} minutes\n`;
  }

  if (order.executedAt) {
    message += `Executed: ${new Date(order.executedAt).toLocaleString()}\n`;
  }

  if (order.transactionHash) {
    message += `\nTx: ${order.transactionHash}`;
  }

  return message;
}

/**
 * Format all orders for a wallet
 */
export function formatOrdersList(orders: LimitOrder[]): string {
  if (orders.length === 0) {
    return "No limit orders found.";
  }

  let message = `📋 Your Limit Orders (${orders.length})\n\n`;

  orders.forEach((order, index) => {
    const statusEmoji = {
      pending: "⏳",
      executed: "✅",
      cancelled: "❌",
      expired: "⏰",
    };

    message += `${index + 1}. ${statusEmoji[order.status]} ${order.type.toUpperCase()} ${order.amount} ${order.fromToken}\n`;
    message += `   Target: $${order.targetPrice}`;
    
    if (order.currentPrice) {
      message += ` (Current: $${order.currentPrice})`;
    }
    
    message += `\n   Status: ${order.status}\n\n`;
  });

  return message;
}

/**
 * Clear old executed/cancelled orders (cleanup)
 */
export function cleanupOldOrders(olderThanDays: number = 7): number {
  const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
  let removed = 0;

  for (const [id, order] of orders.entries()) {
    if ((order.status === "executed" || order.status === "cancelled" || order.status === "expired") && 
        order.createdAt < cutoffTime) {
      orders.delete(id);
      removed++;
    }
  }

  if (removed > 0) {
    console.log(`[Limit Order] Cleaned up ${removed} old orders`);
  }

  return removed;
}
