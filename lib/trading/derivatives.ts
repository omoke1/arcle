/**
 * Derivatives Trading Service
 * 
 * Manages perpetual contracts, options, and margin trading
 * Note: This is a basic implementation for demonstration
 */

import crypto from "crypto";

export interface PerpetualPosition {
  id: string;
  pair: string; // e.g., "USDC/EURC"
  side: "long" | "short";
  size: string; // Position size in base currency
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  margin: string; // Collateral amount
  liquidationPrice: number;
  pnl: string; // Profit and loss
  pnlPercent: number;
  status: "open" | "closed" | "liquidated";
  openedAt: string;
  closedAt?: string;
}

export interface OptionsPosition {
  id: string;
  type: "call" | "put";
  underlying: string; // e.g., "USDC"
  strikePrice: number;
  expiryDate: string;
  premium: string;
  quantity: number;
  status: "active" | "exercised" | "expired";
  openedAt: string;
}

export interface TradingOrder {
  id: string;
  type: "market" | "limit" | "stop_loss" | "take_profit";
  pair: string;
  side: "buy" | "sell";
  amount: string;
  price?: number; // For limit orders
  stopLoss?: number;
  takeProfit?: number;
  status: "pending" | "filled" | "cancelled" | "rejected";
  createdAt: string;
  filledAt?: string;
}

// Store in localStorage
const PERPETUAL_POSITIONS_STORAGE_KEY = "arcle_perpetual_positions";
const OPTIONS_POSITIONS_STORAGE_KEY = "arcle_options_positions";
const TRADING_ORDERS_STORAGE_KEY = "arcle_trading_orders";

/**
 * Open a perpetual position
 */
export function openPerpetualPosition(
  pair: string,
  side: "long" | "short",
  size: string,
  leverage: number,
  margin: string
): PerpetualPosition {
  const positions = getAllPerpetualPositions();
  
  // Get current price (mock - in production, fetch from exchange)
  const currentPrice = getCurrentPrice(pair);
  
  // Calculate liquidation price
  const entryPrice = currentPrice;
  const marginNum = parseFloat(margin);
  const sizeNum = parseFloat(size);
  const leverageNum = leverage;
  
  // Simplified liquidation calculation
  // For long: liquidation = entryPrice * (1 - 1/leverage)
  // For short: liquidation = entryPrice * (1 + 1/leverage)
  const liquidationPrice = side === "long"
    ? entryPrice * (1 - 1 / leverageNum)
    : entryPrice * (1 + 1 / leverageNum);
  
  const position: PerpetualPosition = {
    id: crypto.randomUUID(),
    pair,
    side,
    size,
    entryPrice,
    currentPrice,
    leverage: leverageNum,
    margin,
    liquidationPrice,
    pnl: "0.00",
    pnlPercent: 0,
    status: "open",
    openedAt: new Date().toISOString(),
  };
  
  positions.push(position);
  savePerpetualPositions(positions);
  
  return position;
}

/**
 * Close a perpetual position
 */
export function closePerpetualPosition(id: string, exitPrice?: number): PerpetualPosition | null {
  const positions = getAllPerpetualPositions();
  const index = positions.findIndex(p => p.id === id);
  
  if (index === -1 || positions[index].status !== "open") {
    return null;
  }
  
  const position = positions[index];
  const finalPrice = exitPrice || getCurrentPrice(position.pair);
  
  // Calculate PnL
  const pnl = calculatePnL(position, finalPrice);
  
  positions[index] = {
    ...position,
    status: "closed",
    currentPrice: finalPrice,
    pnl: pnl.amount,
    pnlPercent: pnl.percent,
    closedAt: new Date().toISOString(),
  };
  
  savePerpetualPositions(positions);
  return positions[index];
}

/**
 * Calculate PnL for a position
 */
function calculatePnL(position: PerpetualPosition, currentPrice: number): { amount: string; percent: number } {
  const entryPrice = position.entryPrice;
  const size = parseFloat(position.size);
  const leverage = position.leverage;
  
  let pnl: number;
  if (position.side === "long") {
    pnl = (currentPrice - entryPrice) / entryPrice * size * leverage;
  } else {
    pnl = (entryPrice - currentPrice) / entryPrice * size * leverage;
  }
  
  const pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100 * (position.side === "long" ? 1 : -1);
  
  return {
    amount: pnl.toFixed(6),
    percent: parseFloat(pnlPercent.toFixed(2)),
  };
}

/**
 * Get current price (mock - in production, fetch from exchange)
 */
function getCurrentPrice(pair: string): number {
  // Mock price - in production, fetch from exchange API
  if (pair.includes("USDC") && pair.includes("EURC")) {
    return 0.92; // Mock USDC/EURC rate
  }
  return 1.0;
}

/**
 * Check for liquidations
 */
export function checkLiquidations(): PerpetualPosition[] {
  const positions = getAllPerpetualPositions().filter(p => p.status === "open");
  const liquidated: PerpetualPosition[] = [];
  
  for (const position of positions) {
    const currentPrice = getCurrentPrice(position.pair);
    
    // Check if price hit liquidation
    const shouldLiquidate = position.side === "long"
      ? currentPrice <= position.liquidationPrice
      : currentPrice >= position.liquidationPrice;
    
    if (shouldLiquidate) {
      const updated = closePerpetualPosition(position.id, currentPrice);
      if (updated) {
        updated.status = "liquidated";
        liquidated.push(updated);
      }
    }
  }
  
  return liquidated;
}

/**
 * Create options position
 */
export function createOptionsPosition(
  type: "call" | "put",
  underlying: string,
  strikePrice: number,
  expiryDate: string,
  premium: string,
  quantity: number
): OptionsPosition {
  const positions = getAllOptionsPositions();
  
  const position: OptionsPosition = {
    id: crypto.randomUUID(),
    type,
    underlying,
    strikePrice,
    expiryDate,
    premium,
    quantity,
    status: "active",
    openedAt: new Date().toISOString(),
  };
  
  positions.push(position);
  saveOptionsPositions(positions);
  
  return position;
}

/**
 * Create trading order
 */
export function createTradingOrder(order: Omit<TradingOrder, "id" | "createdAt" | "status">): TradingOrder {
  const orders = getAllTradingOrders();
  
  const newOrder: TradingOrder = {
    ...order,
    id: crypto.randomUUID(),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  
  orders.push(newOrder);
  saveTradingOrders(orders);
  
  return newOrder;
}

/**
 * Get all perpetual positions
 */
export function getAllPerpetualPositions(): PerpetualPosition[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(PERPETUAL_POSITIONS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Get all options positions
 */
export function getAllOptionsPositions(): OptionsPosition[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(OPTIONS_POSITIONS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Get all trading orders
 */
export function getAllTradingOrders(): TradingOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(TRADING_ORDERS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save functions
 */
function savePerpetualPositions(positions: PerpetualPosition[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PERPETUAL_POSITIONS_STORAGE_KEY, JSON.stringify(positions));
  } catch (error) {
    console.error("Error saving perpetual positions:", error);
  }
}

function saveOptionsPositions(positions: OptionsPosition[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(OPTIONS_POSITIONS_STORAGE_KEY, JSON.stringify(positions));
  } catch (error) {
    console.error("Error saving options positions:", error);
  }
}

function saveTradingOrders(orders: TradingOrder[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TRADING_ORDERS_STORAGE_KEY, JSON.stringify(orders));
  } catch (error) {
    console.error("Error saving trading orders:", error);
  }
}

