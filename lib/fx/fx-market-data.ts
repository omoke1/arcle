/**
 * FX Market Data Service
 * 
 * Provides real-time and historical FX market data
 */

import crypto from "crypto";
import { getFXRate, getMultipleFXRates } from "./fx-rates";

export interface FXMarketData {
  pair: string; // e.g., "USDC-EURC"
  rate: number;
  change24h: number; // Percentage change in 24h
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h?: number;
  timestamp: number;
  source: string;
}

export interface FXRateAlert {
  id: string;
  pair: string;
  targetRate: number;
  direction: "above" | "below";
  status: "active" | "triggered" | "cancelled";
  createdAt: string;
  triggeredAt?: string;
}

// Store alerts in localStorage
const FX_ALERTS_STORAGE_KEY = "arcle_fx_alerts";

/**
 * Get market data for a currency pair
 */
export async function getMarketData(pair: string): Promise<FXMarketData | null> {
  try {
    const [from, to] = pair.split("-");
    if (!from || !to) {
      return null;
    }
    
    const rateResult = await getFXRate(from, to, true); // Force refresh
    
    if (!rateResult.success || !rateResult.rate) {
      return null;
    }
    
    // For now, we'll simulate 24h change (in production, fetch historical data)
    const change24h = (Math.random() - 0.5) * 0.02; // Random change between -1% and +1%
    const changePercent24h = change24h * 100;
    const currentRate = rateResult.rate.rate;
    const high24h = currentRate * (1 + Math.abs(change24h));
    const low24h = currentRate * (1 - Math.abs(change24h));
    
    return {
      pair,
      rate: currentRate,
      change24h,
      changePercent24h,
      high24h,
      low24h,
      timestamp: rateResult.rate.timestamp,
      source: rateResult.rate.source,
    };
  } catch (error) {
    console.error("Error fetching market data:", error);
    return null;
  }
}

/**
 * Get historical rates (simplified - in production, use a time-series database)
 */
export async function getHistoricalRates(
  pair: string,
  days: number = 30
): Promise<Array<{ date: string; rate: number }>> {
  // In production, this would fetch from a historical data API
  // For now, we'll return mock data
  const rates: Array<{ date: string; rate: number }> = [];
  const rateResult = await getFXRate(pair.split("-")[0], pair.split("-")[1]);
  
  if (!rateResult.success || !rateResult.rate) {
    return [];
  }
  
  const baseRate = rateResult.rate.rate;
  const now = new Date();
  
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Simulate rate variation
    const variation = (Math.random() - 0.5) * 0.05; // ±2.5% variation
    const rate = baseRate * (1 + variation);
    
    rates.push({
      date: date.toISOString().split("T")[0],
      rate: parseFloat(rate.toFixed(6)),
    });
  }
  
  return rates;
}

/**
 * Create FX rate alert
 */
export function createFXRateAlert(
  pair: string,
  targetRate: number,
  direction: "above" | "below"
): FXRateAlert {
  const alerts = getAllFXAlerts();
  
  const alert: FXRateAlert = {
    id: crypto.randomUUID(),
    pair,
    targetRate,
    direction,
    status: "active",
    createdAt: new Date().toISOString(),
  };
  
  alerts.push(alert);
  saveFXAlerts(alerts);
  
  return alert;
}

/**
 * Get all FX alerts
 */
export function getAllFXAlerts(): FXRateAlert[] {
  if (typeof window === "undefined") {
    return [];
  }
  
  try {
    const stored = localStorage.getItem(FX_ALERTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Check and trigger alerts
 */
export async function checkFXAlerts(): Promise<FXRateAlert[]> {
  const alerts = getAllFXAlerts().filter(a => a.status === "active");
  const triggered: FXRateAlert[] = [];
  
  for (const alert of alerts) {
    const [from, to] = alert.pair.split("-");
    const rateResult = await getFXRate(from, to);
    
    if (!rateResult.success || !rateResult.rate) {
      continue;
    }
    
    const currentRate = rateResult.rate.rate;
    let shouldTrigger = false;
    
    if (alert.direction === "above" && currentRate >= alert.targetRate) {
      shouldTrigger = true;
    } else if (alert.direction === "below" && currentRate <= alert.targetRate) {
      shouldTrigger = true;
    }
    
    if (shouldTrigger) {
      alert.status = "triggered";
      alert.triggeredAt = new Date().toISOString();
      triggered.push(alert);
    }
  }
  
  if (triggered.length > 0) {
    saveFXAlerts(alerts);
  }
  
  return triggered;
}

/**
 * Cancel FX alert
 */
export function cancelFXAlert(id: string): boolean {
  const alerts = getAllFXAlerts();
  const index = alerts.findIndex(a => a.id === id);
  
  if (index === -1) {
    return false;
  }
  
  alerts[index].status = "cancelled";
  saveFXAlerts(alerts);
  return true;
}

/**
 * Save functions
 */
function saveFXAlerts(alerts: FXRateAlert[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FX_ALERTS_STORAGE_KEY, JSON.stringify(alerts));
  } catch (error) {
    console.error("Error saving FX alerts:", error);
  }
}

