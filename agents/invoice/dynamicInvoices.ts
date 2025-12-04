/**
 * Dynamic Invoice Creation
 * 
 * Creates invoices with line items, descriptions, and metadata
 */

import { createInvoiceLink, type InvoiceLink, type InvoiceItem } from './oneTimeLink';

export interface DynamicInvoiceParams {
  walletId: string;
  userId: string;
  amount: string;
  currency?: string;
  description?: string;
  items?: Array<{
    description: string;
    quantity: number;
    unitPrice: string;
  }>;
  metadata?: Record<string, any>;
  expiresIn?: number;
}

/**
 * Create a dynamic invoice with line items
 */
export async function createDynamicInvoice(params: DynamicInvoiceParams): Promise<InvoiceLink> {
  // Calculate total from items if provided
  let totalAmount = params.amount;
  let invoiceItems: InvoiceItem[] | undefined;

  if (params.items && params.items.length > 0) {
    invoiceItems = params.items.map((item) => {
      const total = (parseFloat(item.unitPrice) * item.quantity).toFixed(6);
      return {
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total,
      };
    });

    // Calculate total from items
    totalAmount = invoiceItems.reduce((sum, item) => sum + parseFloat(item.total), 0).toFixed(6);
  }

  return await createInvoiceLink({
    walletId: params.walletId,
    userId: params.userId,
    amount: totalAmount,
    currency: params.currency,
    description: params.description,
    items: invoiceItems,
    expiresIn: params.expiresIn,
  });
}

/**
 * Create invoice from template
 */
export function createInvoiceFromTemplate(
  templateId: string,
  params: {
    walletId: string;
    userId: string;
    variables?: Record<string, any>;
  }
): InvoiceLink | null {
  // TODO: Implement invoice templates
  // This would load a template and fill in variables
  
  return null;
}

