/**
 * Invoice Agent
 * 
 * Handles invoice creation, link generation, QR codes, and payment tracking
 */

import { createInvoiceLink, getInvoiceLink, generateInvoiceLinkUrl, getUserInvoiceLinks, cancelInvoice, processInvoicePayment } from './oneTimeLink';
import { generateInvoiceQRCode, getInvoiceWithQR } from './qrGenerator';
import { createDynamicInvoice } from './dynamicInvoices';
import { trackInvoicePayment, getUserPayments, getPaymentStats } from './paymentTracking';
import type { AgentRequest, AgentResponse } from '@/core/routing/types';
import { toSmallestUnit } from '@/agents/inera/utils';
import { sendInvoiceCreatedEmail } from '@/lib/notifications/email/invoice-emails';

class InvoiceAgent {
  /**
   * Create an invoice
   */
  async createInvoice(params: {
    walletId: string;
    userId: string;
    amount: string;
    currency?: string;
    description?: string;
    items?: Array<{ description: string; quantity: number; unitPrice: string }>;
    expiresIn?: number;
  }) {
    if (params.items && params.items.length > 0) {
      return await createDynamicInvoice({
        walletId: params.walletId,
        userId: params.userId,
        amount: params.amount,
        currency: params.currency,
        description: params.description,
        items: params.items,
        expiresIn: params.expiresIn,
      });
    }

    return await createInvoiceLink({
      walletId: params.walletId,
      userId: params.userId,
      amount: params.amount,
      currency: params.currency,
      description: params.description,
      expiresIn: params.expiresIn,
    });
  }

  /**
   * Generate invoice link
   */
  generateInvoiceLink(linkId: string, baseUrl?: string): string {
    return generateInvoiceLinkUrl(linkId, baseUrl);
  }

  /**
   * Generate invoice QR code
   */
  async generateInvoiceQR(linkId: string, baseUrl?: string): Promise<string> {
    return await generateInvoiceQRCode(linkId, baseUrl);
  }

  /**
   * Get invoice with QR code
   */
  async getInvoiceWithQR(linkId: string, baseUrl?: string) {
    return await getInvoiceWithQR(linkId, baseUrl);
  }

  /**
   * Track invoice payment
   */
  async trackPayment(linkId: string) {
    return await trackInvoicePayment(linkId);
  }

  /**
   * Send invoice to recipient
   */
  async sendInvoice(linkId: string, recipient: string): Promise<{ success: boolean; error?: string }> {
    const link = await getInvoiceLink(linkId);
    
    if (!link) {
      return { success: false, error: 'Invoice not found' };
    }

    const invoiceUrl = generateInvoiceLinkUrl(linkId);

    // If recipient looks like an email address and Resend is configured, send email
    const isEmail = /.+@.+\..+/.test(recipient);

    if (isEmail && process.env.RESEND_API_KEY) {
      try {
        await sendInvoiceCreatedEmail({
          to: recipient,
          amount: link.amount,
          currency: 'USDC',
          description: link.description,
          invoiceUrl,
          invoiceNumber: link.linkId,
        });
      } catch (error) {
        console.error('[Invoice Agent] Failed to send invoice email via Resend:', error);
        // We still succeed so the caller can share the link manually
        return {
          success: true,
          error: 'Invoice created, but failed to send email. Please share the link manually.',
        };
      }
    } else {
      // Fallback: log so the UI can still share the link manually
      console.log(`[Invoice Agent] Invoice ${linkId} for ${recipient}: ${invoiceUrl}`);
    }

    return { success: true };
  }

  /**
   * Execute agent action
   */
  async execute(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'create':
        return this.createInvoice({
          walletId: params.walletId,
          userId: params.userId,
          amount: params.amount,
          currency: params.currency,
          description: params.description,
          items: params.items,
          expiresIn: params.expiresIn,
        });

      case 'generateLink':
        return this.generateInvoiceLink(params.linkId, params.baseUrl);

      case 'generateQR':
        return await this.generateInvoiceQR(params.linkId, params.baseUrl);

      case 'getWithQR':
        return await this.getInvoiceWithQR(params.linkId, params.baseUrl);

      case 'trackPayment':
        return this.trackPayment(params.linkId);

      case 'sendInvoice':
        return await this.sendInvoice(params.linkId, params.recipient);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Handle agent request
   */
  async handle(request: AgentRequest): Promise<AgentResponse> {
    const { intent, entities, context } = request;

    if (!context?.walletId || !context?.userId) {
      return {
        success: false,
        message: 'Wallet authentication required for invoices',
        agent: 'invoice',
        error: 'Missing wallet context',
      };
    }

    const { amount, description, items } = entities;

    // Create invoice
    if (intent.toLowerCase().includes('invoice') || intent.toLowerCase().includes('bill')) {
      if (!amount) {
        return {
          success: false,
          message: 'Please provide an amount for the invoice',
          agent: 'invoice',
          error: 'Missing amount',
        };
      }

      const invoice = await this.createInvoice({
        walletId: context.walletId,
        userId: context.userId,
        amount,
        currency: entities.currency || 'USDC',
        description,
        items: items ? (Array.isArray(items) ? items : [items]) : undefined,
        expiresIn: entities.expiresIn,
      });

      const invoiceUrl = this.generateInvoiceLink(invoice.linkId);

      return {
        success: true,
        message: `Invoice created! Amount: $${amount}${description ? ` - ${description}` : ''}. Share this link: ${invoiceUrl}`,
        agent: 'invoice',
        action: 'create',
        data: {
          invoice,
          invoiceUrl,
        },
      };
    }

    // Get invoice status
    if (entities.invoiceId || entities.linkId) {
      const linkId = entities.invoiceId || entities.linkId;
      const tracking = await this.trackPayment(linkId);
      
      if (!tracking) {
        return {
          success: false,
          message: 'Invoice not found',
          agent: 'invoice',
          error: 'Invoice not found',
        };
      }

      return {
        success: true,
        message: `Invoice status: ${tracking.status}${tracking.status === 'paid' ? ` (paid at ${new Date(tracking.paidAt!).toLocaleString()})` : ''}`,
        agent: 'invoice',
        action: 'trackPayment',
        data: tracking,
      };
    }

    return {
      success: false,
      message: 'Please specify what you want to do with invoices (create, check status, etc.)',
      agent: 'invoice',
      error: 'Unclear intent',
    };
  }

  /**
   * Check if Invoice Agent can handle a request
   */
  canHandle(intent: string, entities: Record<string, any>): boolean {
    const invoiceKeywords = ['invoice', 'bill', 'payment link', 'invoice link'];
    const hasInvoiceIntent = invoiceKeywords.some((keyword) => intent.toLowerCase().includes(keyword));
    
    return hasInvoiceIntent;
  }
}

const invoiceAgent = new InvoiceAgent();

export default invoiceAgent;
export { InvoiceAgent };

