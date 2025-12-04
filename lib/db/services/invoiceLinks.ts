/**
 * Invoice Links Service
 *
 * Manages one-time invoice links with database persistence.
 * Replaces in-memory Map storage to prevent data loss on restart.
 */

import { getSupabaseAdmin, getSupabaseClient } from "../supabase";

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: string;
  total: string;
}

export interface InvoiceLink {
  id: string;
  link_id: string;
  invoice_id: string;
  wallet_id: string;
  user_id: string;
  amount: string;
  currency: string;
  description: string | null;
  items: InvoiceItem[] | null;
  expires_at: string | null;
  status: "pending" | "paid" | "expired" | "cancelled";
  payment_hash: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateInvoiceLinkData {
  linkId: string;
  invoiceId: string;
  walletId: string;
  userId: string;
  amount: string;
  currency?: string;
  description?: string;
  items?: InvoiceItem[];
  expiresAt?: number; // Unix timestamp in milliseconds
}

/**
 * Create a new invoice link
 */
export async function createInvoiceLink(
  data: CreateInvoiceLinkData,
): Promise<InvoiceLink> {
  const admin = getSupabaseAdmin();

  const { data: link, error } = await admin
    .from("invoice_links")
    .insert({
      link_id: data.linkId,
      invoice_id: data.invoiceId,
      wallet_id: data.walletId,
      user_id: data.userId,
      amount: data.amount,
      currency: data.currency || "USDC",
      description: data.description || null,
      items: data.items ? JSON.stringify(data.items) : null,
      expires_at: data.expiresAt
        ? new Date(data.expiresAt).toISOString()
        : null,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("[InvoiceLinks Service] Error creating invoice link:", error);
    throw new Error(`Failed to create invoice link: ${error.message}`);
  }

  // Parse items JSON if present
  const linkData = link as any;
  if (linkData.items && typeof linkData.items === "string") {
    linkData.items = JSON.parse(linkData.items);
  }

  return linkData as InvoiceLink;
}

/**
 * Get invoice link by link_id
 */
export async function getInvoiceLinkByLinkId(
  linkId: string,
): Promise<InvoiceLink | null> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("invoice_links")
    .select("*")
    .eq("link_id", linkId)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("[InvoiceLinks Service] Error getting invoice link:", error);
    return null;
  }

  if (!data) {
    return null;
  }

  // Parse items JSON if present
  const linkData = data as any;
  if (linkData.items && typeof linkData.items === "string") {
    linkData.items = JSON.parse(linkData.items);
  }

  // Check if expired
  const link = linkData as InvoiceLink;
  if (
    link.expires_at &&
    new Date(link.expires_at).getTime() < Date.now() &&
    link.status === "pending"
  ) {
    await updateInvoiceLinkStatus(link.id, "expired");
    return { ...link, status: "expired" };
  }

  return link;
}

/**
 * Get all invoice links for a user
 */
export async function getUserInvoiceLinks(
  userId: string,
): Promise<InvoiceLink[]> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("invoice_links")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[InvoiceLinks Service] Error getting user invoice links:", error);
    return [];
  }

  if (!data) {
    return [];
  }

  // Parse items JSON for all links
  return (data as any[]).map((link) => {
    if (link.items && typeof link.items === "string") {
      link.items = JSON.parse(link.items);
    }
    return link as InvoiceLink;
  });
}

/**
 * Update invoice link status
 */
export async function updateInvoiceLinkStatus(
  id: string,
  status: InvoiceLink["status"],
  paymentHash?: string,
): Promise<InvoiceLink | null> {
  const admin = getSupabaseAdmin();

  const updateData: any = { status };
  if (paymentHash) {
    updateData.payment_hash = paymentHash;
    updateData.paid_at = new Date().toISOString();
  }

  const { data, error } = await admin
    .from("invoice_links")
    .update(updateData)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[InvoiceLinks Service] Error updating invoice link:", error);
    return null;
  }

  if (!data) {
    return null;
  }

  // Parse items JSON if present
  const linkData = data as any;
  if (linkData.items && typeof linkData.items === "string") {
    linkData.items = JSON.parse(linkData.items);
  }

  return linkData as InvoiceLink;
}

/**
 * Clean up expired invoice links (mark as expired)
 * This should be called periodically via cron
 */
export async function cleanupExpiredInvoiceLinks(): Promise<number> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from("invoice_links")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString())
    .select();

  if (error) {
    console.error("[InvoiceLinks Service] Error cleaning up expired links:", error);
    return 0;
  }

  return data?.length || 0;
}

