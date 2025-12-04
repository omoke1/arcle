/**
 * Compound Strategies Service
 *
 * Manages auto-compound strategies and history with database persistence.
 * Replaces in-memory Map storage to prevent data loss on restart.
 */

import { getSupabaseAdmin, getSupabaseClient } from "../supabase";

export type CompoundFrequency = "daily" | "weekly" | "monthly";
export type CompoundStatus = "active" | "paused" | "stopped";

export interface CompoundStrategy {
  id: string;
  strategy_id: string;
  wallet_id: string;
  user_id: string | null;
  name: string;
  frequency: CompoundFrequency;
  minimum_yield: string;
  reinvest_percentage: number;
  target_positions: string[];
  status: CompoundStatus;
  created_at: string;
  last_compounded_at: string | null;
  next_compound_at: string | null;
  total_compounded: string;
  compound_count: number;
  updated_at: string;
}

export interface YieldHistory {
  id: string;
  strategy_id: string;
  date: string;
  yield_earned: string;
  reinvested: string;
  current_value: string;
  created_at: string;
}

export interface CreateCompoundStrategyData {
  strategyId: string;
  walletId: string;
  userId?: string;
  name: string;
  frequency: CompoundFrequency;
  minimumYield?: string;
  reinvestPercentage?: number;
  targetPositions?: string[];
  nextCompoundAt?: number; // Unix timestamp in milliseconds
}

/**
 * Create a new compound strategy
 */
export async function createCompoundStrategy(
  data: CreateCompoundStrategyData,
): Promise<CompoundStrategy> {
  const admin = getSupabaseAdmin();

  const { data: strategy, error } = await admin
    .from("compound_strategies")
    .insert({
      strategy_id: data.strategyId,
      wallet_id: data.walletId,
      user_id: data.userId || null,
      name: data.name,
      frequency: data.frequency,
      minimum_yield: data.minimumYield || "10",
      reinvest_percentage: data.reinvestPercentage || 100,
      target_positions: data.targetPositions || [],
      status: "active",
      next_compound_at: data.nextCompoundAt
        ? new Date(data.nextCompoundAt).toISOString()
        : null,
      total_compounded: "0",
      compound_count: 0,
    })
    .select()
    .single();

  if (error) {
    console.error("[CompoundStrategies Service] Error creating strategy:", error);
    throw new Error(`Failed to create compound strategy: ${error.message}`);
  }

  return strategy as CompoundStrategy;
}

/**
 * Get compound strategy by strategy_id
 */
export async function getCompoundStrategyByStrategyId(
  strategyId: string,
): Promise<CompoundStrategy | null> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("compound_strategies")
    .select("*")
    .eq("strategy_id", strategyId)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("[CompoundStrategies Service] Error getting strategy:", error);
    return null;
  }

  return (data as CompoundStrategy) ?? null;
}

/**
 * Get all strategies for a wallet
 */
export async function getCompoundStrategiesByWallet(
  walletId: string,
): Promise<CompoundStrategy[]> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("compound_strategies")
    .select("*")
    .eq("wallet_id", walletId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[CompoundStrategies Service] Error getting wallet strategies:", error);
    return [];
  }

  return (data as CompoundStrategy[]) || [];
}

/**
 * Get all active strategies
 */
export async function getActiveCompoundStrategies(): Promise<CompoundStrategy[]> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("compound_strategies")
    .select("*")
    .eq("status", "active")
    .order("next_compound_at", { ascending: true });

  if (error) {
    console.error("[CompoundStrategies Service] Error getting active strategies:", error);
    return [];
  }

  return (data as CompoundStrategy[]) || [];
}

/**
 * Update compound strategy status
 */
export async function updateCompoundStrategyStatus(
  strategyId: string,
  status: CompoundStatus,
): Promise<CompoundStrategy | null> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from("compound_strategies")
    .update({ status })
    .eq("strategy_id", strategyId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[CompoundStrategies Service] Error updating strategy status:", error);
    return null;
  }

  return (data as CompoundStrategy) ?? null;
}

/**
 * Update compound strategy after execution
 */
export async function updateCompoundStrategyAfterExecution(
  strategyId: string,
  updates: {
    lastCompoundedAt: number;
    nextCompoundAt: number;
    totalCompounded: string;
    compoundCount: number;
  },
): Promise<CompoundStrategy | null> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from("compound_strategies")
    .update({
      last_compounded_at: new Date(updates.lastCompoundedAt).toISOString(),
      next_compound_at: new Date(updates.nextCompoundAt).toISOString(),
      total_compounded: updates.totalCompounded,
      compound_count: updates.compoundCount,
    })
    .eq("strategy_id", strategyId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[CompoundStrategies Service] Error updating strategy:", error);
    return null;
  }

  return (data as CompoundStrategy) ?? null;
}

/**
 * Add compound history entry
 */
export async function addCompoundHistory(
  strategyId: string,
  data: {
    yieldEarned: string;
    reinvested: string;
    currentValue?: string;
    date?: number;
  },
): Promise<YieldHistory | null> {
  const admin = getSupabaseAdmin();

  const { data: history, error } = await admin
    .from("compound_history")
    .insert({
      strategy_id: strategyId,
      date: data.date
        ? new Date(data.date).toISOString()
        : new Date().toISOString(),
      yield_earned: data.yieldEarned,
      reinvested: data.reinvested,
      current_value: data.currentValue || "0",
    })
    .select()
    .single();

  if (error) {
    console.error("[CompoundStrategies Service] Error adding history:", error);
    return null;
  }

  return history as YieldHistory;
}

/**
 * Get compound history for a strategy
 */
export async function getCompoundHistory(
  strategyId: string,
  limit?: number,
): Promise<YieldHistory[]> {
  const client = getSupabaseClient();

  let query = client
    .from("compound_history")
    .select("*")
    .eq("strategy_id", strategyId)
    .order("date", { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[CompoundStrategies Service] Error getting history:", error);
    return [];
  }

  return (data as YieldHistory[]) || [];
}

