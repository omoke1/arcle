/**
 * Payment Links Service
 *
 * Manages one-time payment links with database persistence.
 * Replaces in-memory Map storage to prevent data loss on restart.
 */

import { getSupabaseAdmin, getSupabaseClient } from "../supabase";

export interface PaymentLink {
  id: string;
  link_id: string;
  wallet_id: string;
  user_id: string;
  amount: string;
  description: string | null;
  expires_at: string | null;
  status: "pending" | "paid" | "expired";
  payment_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentLinkData {
  linkId: string;
  walletId: string;
  userId: string;
  amount: string;
  description?: string;
  expiresAt?: number; // Unix timestamp in milliseconds
}

/**
 * Create a new payment link
 */
export async function createPaymentLink(
  data: CreatePaymentLinkData,
): Promise<PaymentLink> {
  const admin = getSupabaseAdmin();

  const { data: link, error } = await admin
    .from("payment_links")
    .insert({
      link_id: data.linkId,
      wallet_id: data.walletId,
      user_id: data.userId,
      amount: data.amount,
      description: data.description || null,
      expires_at: data.expiresAt
        ? new Date(data.expiresAt).toISOString()
        : null,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("[PaymentLinks Service] Error creating payment link:", error);
    throw new Error(`Failed to create payment link: ${error.message}`);
  }

  return link as PaymentLink;
}

/**
 * Get payment link by link_id
 */
export async function getPaymentLinkByLinkId(
  linkId: string,
): Promise<PaymentLink | null> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("payment_links")
    .select("*")
    .eq("link_id", linkId)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("[PaymentLinks Service] Error getting payment link:", error);
    return null;
  }

  if (!data) {
    return null;
  }

  // Check if expired
  const link = data as PaymentLink;
  if (
    link.expires_at &&
    new Date(link.expires_at).getTime() < Date.now() &&
    link.status === "pending"
  ) {
    await updatePaymentLinkStatus(link.id, "expired");
    return { ...link, status: "expired" };
  }

  return link;
}

/**
 * Get all payment links for a user
 */
export async function getUserPaymentLinks(
  userId: string,
): Promise<PaymentLink[]> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("payment_links")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[PaymentLinks Service] Error getting user payment links:", error);
    return [];
  }

  return (data as PaymentLink[]) || [];
}

/**
 * Update payment link status
 */
export async function updatePaymentLinkStatus(
  id: string,
  status: PaymentLink["status"],
  paymentHash?: string,
): Promise<PaymentLink | null> {
  const admin = getSupabaseAdmin();

  const updateData: any = { status };
  if (paymentHash) {
    updateData.payment_hash = paymentHash;
  }

  const { data, error } = await admin
    .from("payment_links")
    .update(updateData)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[PaymentLinks Service] Error updating payment link:", error);
    return null;
  }

  return (data as PaymentLink) ?? null;
}

/**
 * Clean up expired payment links (mark as expired)
 * This should be called periodically via cron
 */
export async function cleanupExpiredPaymentLinks(): Promise<number> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from("payment_links")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString())
    .select();

  if (error) {
    console.error("[PaymentLinks Service] Error cleaning up expired links:", error);
    return 0;
  }

  return data?.length || 0;
}

