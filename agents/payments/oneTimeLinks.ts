/**
 * One-Time Payment Links
 * 
 * Creates payment links that expire after 24 hours
 * Now uses database persistence instead of in-memory storage
 */

import { generateUUID } from '@/lib/utils/uuid';
import { INERAAgent } from '@/agents/inera';
import type { ExecutionResult } from '@/lib/wallet/sessionKeys/delegateExecution';
import {
  createPaymentLink as createPaymentLinkDb,
  getPaymentLinkByLinkId,
  updatePaymentLinkStatus,
  getUserPaymentLinks as getUserPaymentLinksDb,
  type PaymentLink as PaymentLinkDb,
} from '@/lib/db/services/paymentLinks';

export interface OneTimeLinkParams {
  walletId: string;
  userId: string;
  amount: string;
  description?: string;
  expiresIn?: number; // Seconds, default 24 hours
}

export interface PaymentLink {
  id: string;
  linkId: string;
  walletId: string;
  userId: string;
  amount: string;
  description?: string;
  expiresAt: number;
  createdAt: number;
  status: 'pending' | 'paid' | 'expired';
  paymentHash?: string;
}

/**
 * Convert database PaymentLink to legacy format
 */
function dbToLegacyFormat(dbLink: PaymentLinkDb): PaymentLink {
  return {
    id: dbLink.id,
    linkId: dbLink.link_id,
    walletId: dbLink.wallet_id,
    userId: dbLink.user_id,
    amount: dbLink.amount,
    description: dbLink.description || undefined,
    expiresAt: dbLink.expires_at ? new Date(dbLink.expires_at).getTime() : 0,
    createdAt: new Date(dbLink.created_at).getTime(),
    status: dbLink.status,
    paymentHash: dbLink.payment_hash || undefined,
  };
}

/**
 * Create a one-time payment link
 */
export async function createOneTimeLink(params: OneTimeLinkParams): Promise<PaymentLink> {
  const linkId = generateUUID();
  const expiresIn = params.expiresIn || 24 * 60 * 60; // Default 24 hours
  const expiresAt = Date.now() + expiresIn * 1000;

  const dbLink = await createPaymentLinkDb({
    linkId,
    walletId: params.walletId,
    userId: params.userId,
    amount: params.amount,
    description: params.description,
    expiresAt,
  });

  return dbToLegacyFormat(dbLink);
}

/**
 * Get payment link by ID
 */
export async function getPaymentLink(linkId: string): Promise<PaymentLink | null> {
  const dbLink = await getPaymentLinkByLinkId(linkId);
  
  if (!dbLink) {
    return null;
  }

  return dbToLegacyFormat(dbLink);
}

/**
 * Process payment via link
 */
export async function processPaymentLink(
  linkId: string,
  payerWalletId: string,
  payerUserId: string,
  payerUserToken: string,
  destinationAddress: string
): Promise<ExecutionResult> {
  const link = await getPaymentLink(linkId);

  if (!link) {
    return {
      success: false,
      executedViaSessionKey: false,
      error: 'Payment link not found',
    };
  }

  if (link.status !== 'pending') {
    return {
      success: false,
      executedViaSessionKey: false,
      error: `Payment link is ${link.status}`,
    };
  }

  if (link.expiresAt && Date.now() > link.expiresAt) {
    await updatePaymentLinkStatus(link.id, 'expired');
    return {
      success: false,
      executedViaSessionKey: false,
      error: 'Payment link has expired',
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
    await updatePaymentLinkStatus(link.id, 'paid', result.transactionHash);
  }

  return result;
}

/**
 * Generate payment link URL
 */
export function generatePaymentLinkUrl(linkId: string, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/pay/${linkId}`;
}

/**
 * Get all payment links for a user
 */
export async function getUserPaymentLinks(userId: string): Promise<PaymentLink[]> {
  const dbLinks = await getUserPaymentLinksDb(userId);
  return dbLinks.map(dbToLegacyFormat);
}

