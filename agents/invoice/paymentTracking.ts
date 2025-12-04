/**
 * Payment Tracking for Invoices
 * 
 * Tracks invoice payments and payment status
 */

import { getInvoiceLink, getUserInvoiceLinks, type InvoiceLink } from './oneTimeLink';

export interface PaymentTracking {
  invoiceId: string;
  linkId: string;
  amount: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  paymentHash?: string;
  paidAt?: number;
  createdAt: number;
}

/**
 * Track payment status for an invoice
 */
export async function trackInvoicePayment(linkId: string): Promise<PaymentTracking | null> {
  const link = await getInvoiceLink(linkId);
  
  if (!link) {
    return null;
  }

  return {
    invoiceId: link.invoiceId,
    linkId: link.linkId,
    amount: link.amount,
    status: link.status,
    paymentHash: link.paymentHash,
    paidAt: link.paidAt,
    createdAt: link.createdAt,
  };
}

/**
 * Get all payments for a user
 */
export async function getUserPayments(userId: string): Promise<PaymentTracking[]> {
  const links = await getUserInvoiceLinks(userId);
  return links.map((link) => ({
    invoiceId: link.invoiceId,
    linkId: link.linkId,
    amount: link.amount,
    status: link.status,
    paymentHash: link.paymentHash,
    paidAt: link.paidAt,
    createdAt: link.createdAt,
  }));
}

/**
 * Get payment statistics for a user
 */
export async function getPaymentStats(userId: string): Promise<{
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  totalAmount: string;
  paidAmount: string;
  pendingAmount: string;
}> {
  const links = await getUserInvoiceLinks(userId);
  
  const paid = links.filter((l) => l.status === 'paid');
  const pending = links.filter((l) => l.status === 'pending');
  
  const totalAmount = links.reduce((sum, l) => sum + parseFloat(l.amount), 0).toFixed(6);
  const paidAmount = paid.reduce((sum, l) => sum + parseFloat(l.amount), 0).toFixed(6);
  const pendingAmount = pending.reduce((sum, l) => sum + parseFloat(l.amount), 0).toFixed(6);

  return {
    totalInvoices: links.length,
    paidInvoices: paid.length,
    pendingInvoices: pending.length,
    totalAmount,
    paidAmount,
    pendingAmount,
  };
}

