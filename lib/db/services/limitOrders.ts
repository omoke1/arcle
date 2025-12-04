/**
 * Limit Orders Service
 *
 * Manages limit orders with database persistence.
 * Replaces in-memory Map storage to prevent data loss on restart.
 */

import { getSupabaseAdmin, getSupabaseClient } from "../supabase";

export type OrderType = "buy" | "sell";
export type OrderStatus = "pending" | "executed" | "cancelled" | "expired";

export interface LimitOrder {
  id: string;
  order_id: string;
  wallet_id: string;
  user_id: string | null;
  type: OrderType;
  from_token: string;
  to_token: string;
  amount: string;
  target_price: string;
  current_price: string | null;
  blockchain: string;
  status: OrderStatus;
  created_at: string;
  expires_at: string | null;
  executed_at: string | null;
  transaction_hash: string | null;
  slippage_tolerance: number;
}

export interface CreateLimitOrderData {
  orderId: string;
  walletId: string;
  userId?: string;
  type: OrderType;
  fromToken: string;
  toToken: string;
  amount: string;
  targetPrice: string;
  blockchain: string;
  expiresAt?: number; // Unix timestamp in milliseconds
  slippageTolerance?: number;
}

/**
 * Create a new limit order
 */
export async function createLimitOrder(
  data: CreateLimitOrderData,
): Promise<LimitOrder> {
  const admin = getSupabaseAdmin();

  const { data: order, error } = await admin
    .from("limit_orders")
    .insert({
      order_id: data.orderId,
      wallet_id: data.walletId,
      user_id: data.userId || null,
      type: data.type,
      from_token: data.fromToken,
      to_token: data.toToken,
      amount: data.amount,
      target_price: data.targetPrice,
      blockchain: data.blockchain,
      status: "pending",
      expires_at: data.expiresAt
        ? new Date(data.expiresAt).toISOString()
        : null,
      slippage_tolerance: data.slippageTolerance || 0.5,
    })
    .select()
    .single();

  if (error) {
    console.error("[LimitOrders Service] Error creating limit order:", error);
    throw new Error(`Failed to create limit order: ${error.message}`);
  }

  return order as LimitOrder;
}

/**
 * Get limit order by order_id
 */
export async function getLimitOrderByOrderId(
  orderId: string,
): Promise<LimitOrder | null> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("limit_orders")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("[LimitOrders Service] Error getting limit order:", error);
    return null;
  }

  return (data as LimitOrder) ?? null;
}

/**
 * Get all limit orders for a wallet
 */
export async function getLimitOrdersByWallet(
  walletId: string,
  status?: OrderStatus,
): Promise<LimitOrder[]> {
  const client = getSupabaseClient();

  let query = client
    .from("limit_orders")
    .select("*")
    .eq("wallet_id", walletId)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[LimitOrders Service] Error getting wallet orders:", error);
    return [];
  }

  return (data as LimitOrder[]) || [];
}

/**
 * Get all pending orders
 */
export async function getPendingLimitOrders(): Promise<LimitOrder[]> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("limit_orders")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[LimitOrders Service] Error getting pending orders:", error);
    return [];
  }

  return (data as LimitOrder[]) || [];
}

/**
 * Update limit order status
 */
export async function updateLimitOrderStatus(
  orderId: string,
  status: OrderStatus,
  updates?: {
    currentPrice?: string;
    executedAt?: number;
    transactionHash?: string;
  },
): Promise<LimitOrder | null> {
  const admin = getSupabaseAdmin();

  const updateData: any = { status };
  if (updates?.currentPrice !== undefined) {
    updateData.current_price = updates.currentPrice;
  }
  if (updates?.executedAt !== undefined) {
    updateData.executed_at = new Date(updates.executedAt).toISOString();
  }
  if (updates?.transactionHash !== undefined) {
    updateData.transaction_hash = updates.transactionHash;
  }

  const { data, error } = await admin
    .from("limit_orders")
    .update(updateData)
    .eq("order_id", orderId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[LimitOrders Service] Error updating limit order:", error);
    return null;
  }

  return (data as LimitOrder) ?? null;
}

/**
 * Clean up expired orders (mark as expired)
 * This should be called periodically via cron
 */
export async function cleanupExpiredLimitOrders(): Promise<number> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from("limit_orders")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString())
    .select();

  if (error) {
    console.error("[LimitOrders Service] Error cleaning up expired orders:", error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Clean up old executed/cancelled orders
 */
export async function cleanupOldLimitOrders(
  olderThanDays: number = 7,
): Promise<number> {
  const admin = getSupabaseAdmin();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const { data, error } = await admin
    .from("limit_orders")
    .delete()
    .in("status", ["executed", "cancelled", "expired"])
    .lt("created_at", cutoffDate.toISOString())
    .select();

  if (error) {
    console.error("[LimitOrders Service] Error cleaning up old orders:", error);
    return 0;
  }

  return data?.length || 0;
}

