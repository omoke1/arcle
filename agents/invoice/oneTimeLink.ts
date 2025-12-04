/**
 * One-Time Invoice Links
 * 
 * Creates invoice links that can be paid once
 * Now uses database persistence instead of in-memory storage
 */

import { generateUUID } from '@/lib/utils/uuid';
import { INERAAgent } from '@/agents/inera';
import type { ExecutionResult } from '@/lib/wallet/sessionKeys/delegateExecution';
import {
  createInvoiceLink as createInvoiceLinkDb,
  getInvoiceLinkByLinkId,
  updateInvoiceLinkStatus,
  type InvoiceLink as InvoiceLinkDb,
  type InvoiceItem as InvoiceItemDb,
} from '@/lib/db/services/invoiceLinks';

export interface InvoiceLink {
  id: string;
  invoiceId: string;
  linkId: string;
  walletId: string;
  userId: string;
  amount: string;
  currency?: string;
  description?: string;
  items?: InvoiceItem[];
  expiresAt?: number; // Optional expiration
  createdAt: number;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  paymentHash?: string;
  paidAt?: number;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: string;
  total: string;
}

/**
 * Convert database InvoiceLink to legacy format
 */
function dbToLegacyFormat(dbLink: InvoiceLinkDb): InvoiceLink {
  return {
    id: dbLink.id,
    invoiceId: dbLink.invoice_id,
    linkId: dbLink.link_id,
    walletId: dbLink.wallet_id,
    userId: dbLink.user_id,
    amount: dbLink.amount,
    currency: dbLink.currency,
    description: dbLink.description || undefined,
    items: dbLink.items as InvoiceItem[] | undefined,
    expiresAt: dbLink.expires_at ? new Date(dbLink.expires_at).getTime() : undefined,
    createdAt: new Date(dbLink.created_at).getTime(),
    status: dbLink.status,
    paymentHash: dbLink.payment_hash || undefined,
    paidAt: dbLink.paid_at ? new Date(dbLink.paid_at).getTime() : undefined,
  };
}

/**
 * Create a one-time invoice link
 */
export async function createInvoiceLink(params: {
  walletId: string;
  userId: string;
  amount: string;
  currency?: string;
  description?: string;
  items?: InvoiceItem[];
  expiresIn?: number; // Seconds, optional
}): Promise<InvoiceLink> {
  const linkId = generateUUID();
  const invoiceId = generateUUID();
  const expiresAt = params.expiresIn ? Date.now() + params.expiresIn * 1000 : undefined;

  const dbLink = await createInvoiceLinkDb({
    linkId,
    invoiceId,
    walletId: params.walletId,
    userId: params.userId,
    amount: params.amount,
    currency: params.currency,
    description: params.description,
    items: params.items as InvoiceItemDb[] | undefined,
    expiresAt,
  });

  return dbToLegacyFormat(dbLink);
}

/**
 * Get invoice link by ID
 */
export async function getInvoiceLink(linkId: string): Promise<InvoiceLink | null> {
  const dbLink = await getInvoiceLinkByLinkId(linkId);
  
  if (!dbLink) {
    return null;
  }

  return dbToLegacyFormat(dbLink);
}

/**
 * Process payment for invoice
 */
export async function processInvoicePayment(
  linkId: string,
  payerWalletId: string,
  payerUserId: string,
  payerUserToken: string,
  destinationAddress: string
): Promise<ExecutionResult> {
  const link = await getInvoiceLink(linkId);

  if (!link) {
    return {
      success: false,
      executedViaSessionKey: false,
      error: 'Invoice link not found',
    };
  }

  if (link.status !== 'pending') {
    return {
      success: false,
      executedViaSessionKey: false,
      error: `Invoice is ${link.status}`,
    };
  }

  if (link.expiresAt && Date.now() > link.expiresAt) {
    await updateInvoiceLinkStatus(link.id, 'expired');
    return {
      success: false,
      executedViaSessionKey: false,
      error: 'Invoice link has expired',
    };
  }

  // Execute payment via INERA
  const inera = new INERAAgent();
  const result = await inera.executePayment({
    walletId: payerWalletId,
    userId: payerUserId,
    userToken: payerUserToken,
    amount: link.amount,
    destinationAddress,
  });

  if (result.success && result.transactionHash) {
    await updateInvoiceLinkStatus(link.id, 'paid', result.transactionHash);
  }

  return result;
}

/**
 * Get all invoice links for a user
 */
export async function getUserInvoiceLinks(userId: string): Promise<InvoiceLink[]> {
  const { getUserInvoiceLinks: getUserInvoiceLinksDb } = await import('@/lib/db/services/invoiceLinks');
  const dbLinks = await getUserInvoiceLinksDb(userId);
  return dbLinks.map(dbToLegacyFormat);
}

/**
 * Generate invoice link URL
 */
export function generateInvoiceLinkUrl(linkId: string, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/invoice/${linkId}`;
}

/**
 * Cancel an invoice
 */
export async function cancelInvoice(linkId: string): Promise<boolean> {
  const link = await getInvoiceLink(linkId);
  if (!link || link.status !== 'pending') {
    return false;
  }
  await updateInvoiceLinkStatus(link.id, 'cancelled');
  return true;
}

