/**
 * Payments Agent
 * 
 * Handles all payment operations: phone/email, one-time links, QR codes, recurring payments
 */

import { INERAAgent } from '@/agents/inera';
import { sendToPhone, sendToEmail } from './phoneEmailPayments';
import { createOneTimeLink, processPaymentLink, generatePaymentLinkUrl, getUserPaymentLinks } from './oneTimeLinks';
import { createQRPaymentLink, getQRPaymentLink } from './qrPayments';
import { createRecurringPayment, executeRecurringPayment } from './recurringPayments';
import { executeBillPayment, validateBillerDetails, SUPPORTED_BILLERS, BillType } from './billPayments';
import type { ExecutionResult } from '@/lib/wallet/sessionKeys/delegateExecution';
import type { AgentRequest, AgentResponse } from '@/core/routing/types';
import type { IntentType } from '@/lib/ai/intent-classifier';
import { toSmallestUnit } from '@/agents/inera/utils';

export interface PaymentParams {
  walletId: string;
  userId: string;
  userToken: string;
  amount: string;
  destinationAddress: string;
  description?: string;
}

class PaymentsAgent {
  /**
   * Execute a payment (delegates to INERA)
   */
  async executePayment(params: PaymentParams): Promise<ExecutionResult> {
    const inera = new INERAAgent();
    return await inera.executePayment({
      walletId: params.walletId,
      userId: params.userId,
      userToken: params.userToken,
      amount: toSmallestUnit(params.amount),
      destinationAddress: params.destinationAddress,
      agentId: 'payments', // Pass agentId for per-agent session keys
    });
  }

  /**
   * Send payment to phone number
   */
  async sendToPhone(params: {
    walletId: string;
    userId: string;
    userToken: string;
    phone: string;
    amount: string;
  }): Promise<ExecutionResult> {
    return await sendToPhone({
      walletId: params.walletId,
      userId: params.userId,
      userToken: params.userToken,
      recipient: params.phone,
      amount: toSmallestUnit(params.amount),
      recipientType: 'phone',
    });
  }

  /**
   * Send payment to email address
   */
  async sendToEmail(params: {
    walletId: string;
    userId: string;
    userToken: string;
    email: string;
    amount: string;
  }): Promise<ExecutionResult> {
    return await sendToEmail({
      walletId: params.walletId,
      userId: params.userId,
      userToken: params.userToken,
      recipient: params.email,
      amount: toSmallestUnit(params.amount),
      recipientType: 'email',
    });
  }

  /**
   * Create a one-time payment link (24h expiration)
   */
  async createOneTimeLink(params: {
    walletId: string;
    userId: string;
    amount: string;
    description?: string;
    expiresIn?: number;
  }) {
    return await createOneTimeLink({
      walletId: params.walletId,
      userId: params.userId,
      amount: params.amount,
      description: params.description,
      expiresIn: params.expiresIn,
    });
  }

  /**
   * Create a QR payment link
   */
  async createQRPaymentLink(params: {
    walletId: string;
    userId: string;
    amount: string;
    description?: string;
    merchantName?: string;
    merchantId?: string;
    expiresIn?: number;
  }) {
    return await createQRPaymentLink({
      walletId: params.walletId,
      userId: params.userId,
      amount: params.amount,
      description: params.description,
      merchantName: params.merchantName,
      merchantId: params.merchantId,
      expiresIn: params.expiresIn,
    });
  }

  /**
   * Create a recurring payment/subscription
   */
  async createRecurringPayment(params: {
    walletId: string;
    userId: string;
    userToken: string;
    merchant: string;
    amount: string;
    currency?: 'USDC' | 'EURC';
    frequency: 'daily' | 'weekly' | 'monthly';
    dayOfMonth?: number;
    weekday?: number;
    autoRenew?: boolean;
  }) {
    return await createRecurringPayment({
      walletId: params.walletId,
      userId: params.userId,
      userToken: params.userToken,
      merchant: params.merchant,
      amount: params.amount,
      currency: params.currency,
      frequency: params.frequency,
      dayOfMonth: params.dayOfMonth,
      weekday: params.weekday,
      autoRenew: params.autoRenew,
    });
  }

  /**
   * Execute a bill payment (Airtime, Electricity, Betting)
   */
  async executeBillPayment(params: {
    walletId: string;
    userId: string;
    userToken: string;
    billType: BillType;
    provider: string;
    identifier: string;
    amount: string;
  }) {
    // Validate biller details before executing payment
    const validation = await validateBillerDetails(
      params.billType,
      params.provider,
      params.identifier,
    );

    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid biller details provided');
    }

    return await executeBillPayment({
      walletId: params.walletId,
      userId: params.userId,
      userToken: params.userToken,
      billType: params.billType,
      provider: params.provider,
      identifier: params.identifier,
      amount: toSmallestUnit(params.amount),
    });
  }

  /**
   * Execute agent action (for routing)
   */
  async execute(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'send':
      case 'pay':
      case 'transfer':
        return await this.executePayment({
          walletId: params.walletId,
          userId: params.userId,
          userToken: params.userToken,
          amount: params.amount,
          destinationAddress: params.destinationAddress,
          description: params.description,
        });

      case 'sendToPhone':
        return await this.sendToPhone({
          walletId: params.walletId,
          userId: params.userId,
          userToken: params.userToken,
          phone: params.phone,
          amount: params.amount,
        });

      case 'sendToEmail':
        return await this.sendToEmail({
          walletId: params.walletId,
          userId: params.userId,
          userToken: params.userToken,
          email: params.email,
          amount: params.amount,
        });

      case 'createOneTimeLink':
        return this.createOneTimeLink({
          walletId: params.walletId,
          userId: params.userId,
          amount: params.amount,
          description: params.description,
          expiresIn: params.expiresIn,
        });

      case 'createQRPaymentLink':
        return this.createQRPaymentLink({
          walletId: params.walletId,
          userId: params.userId,
          amount: params.amount,
          description: params.description,
          merchantName: params.merchantName,
          merchantId: params.merchantId,
          expiresIn: params.expiresIn,
        });

      case 'createRecurringPayment':
        return await this.createRecurringPayment({
          walletId: params.walletId,
          userId: params.userId,
          userToken: params.userToken,
          merchant: params.merchant,
          amount: params.amount,
          currency: params.currency,
          frequency: params.frequency,
          dayOfMonth: params.dayOfMonth,
          weekday: params.weekday,
          autoRenew: params.autoRenew,
        });

      case 'executeBillPayment':
        return await this.executeBillPayment({
          walletId: params.walletId,
          userId: params.userId,
          userToken: params.userToken,
          billType: params.billType,
          provider: params.provider,
          identifier: params.identifier,
          amount: params.amount,
        });

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Handle agent request (for routing)
   */
  async handle(request: AgentRequest): Promise<AgentResponse> {
    const { intent, entities, context } = request;

    if (!context?.walletId || !context?.userId || !context?.userToken) {
      return {
        success: false,
        message: 'Wallet authentication required for payments',
        agent: 'payments',
        error: 'Missing wallet context',
      };
    }

    const { amount, address, recipient, phone, email } = entities;

    // Handle different payment types
    if (phone) {
      try {
        const result = await this.sendToPhone({
          walletId: context.walletId,
          userId: context.userId,
          userToken: context.userToken,
          phone,
          amount: amount || '0',
        });

        // Check if this is a pending payment or immediate execution
        const isPending = result.data?.status === 'pending' && result.data?.claimCode;
        const claimCode = result.data?.claimCode;
        
        return {
          success: result.success,
          message: result.success
            ? isPending && claimCode
              ? `✅ Pending payment created for ${phone}!\n\n**Amount:** $${amount} USDC\n**Claim Code:** ${claimCode}\n\nI've created a pending payment. The recipient will receive a notification with instructions to claim it. They can claim it by:\n1. Opening Arcle\n2. Using claim code: **${claimCode}**\n3. Linking their phone number to their wallet\n\nThe payment expires in 30 days if not claimed.`
              : `✅ Payment of $${amount} sent to ${phone}.\n\nThis goes directly to the wallet address saved on that phone contact. The recipient just needs to open Arcle with that wallet to see the funds—there's nothing for them to manually claim.`
            : `❌ Failed to send payment: ${result.error}`,
          agent: 'payments',
          action: 'sendToPhone',
          requiresConfirmation: !result.executedViaSessionKey && result.challengeId !== undefined,
          data: result,
          error: result.error,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `❌ I couldn't send that payment to ${phone}: ${error.message}.\n\nMake sure you have a contact saved for this phone number with a wallet address.`,
          agent: 'payments',
          error: error.message,
        };
      }
    }

    if (email) {
      try {
        const result = await this.sendToEmail({
          walletId: context.walletId,
          userId: context.userId,
          userToken: context.userToken,
          email,
          amount: amount || '0',
        });

        // Check if this is a pending payment or immediate execution
        const isPending = result.data?.status === 'pending' && result.data?.claimCode;
        const claimCode = result.data?.claimCode;
        
        return {
          success: result.success,
          message: result.success
            ? isPending && claimCode
              ? `✅ Pending payment created for ${email}!\n\n**Amount:** $${amount} USDC\n**Claim Code:** ${claimCode}\n\nI've created a pending payment. The recipient will receive an email with instructions to claim it. They can claim it by:\n1. Opening Arcle\n2. Using claim code: **${claimCode}**\n3. Linking their email to their wallet\n\nThe payment expires in 30 days if not claimed.`
              : `✅ Payment of $${amount} sent to ${email}.\n\nThis goes directly to the wallet address saved on that email contact. When the recipient signs into Arcle with that wallet, the money is already there—no separate claim step needed.`
            : `❌ Failed to send payment: ${result.error}`,
          agent: 'payments',
          action: 'sendToEmail',
          requiresConfirmation: !result.executedViaSessionKey && result.challengeId !== undefined,
          data: result,
          error: result.error,
        };
      } catch (error: any) {
        return {
          success: false,
          message: `❌ I couldn't send that payment to ${email}: ${error.message}.\n\nMake sure you have a contact saved for this email with a wallet address.`,
          agent: 'payments',
          error: error.message,
        };
      }
    }

    // Regular address-based payment
    if (amount && (address || recipient)) {
      const destinationAddress = address || recipient;

      if (!destinationAddress) {
        return {
          success: false,
          message: 'Please provide a destination address or recipient',
          agent: 'payments',
          error: 'Missing destination address',
        };
      }

      const result = await this.executePayment({
        walletId: context.walletId,
        userId: context.userId,
        userToken: context.userToken,
        amount,
        destinationAddress,
      });

      return {
        success: result.success,
        message: result.success
          ? `Payment of $${amount} sent${result.executedViaSessionKey ? ' automatically' : ''}`
          : `Failed to send payment: ${result.error}`,
        agent: 'payments',
        action: 'send',
        requiresConfirmation: !result.executedViaSessionKey && result.challengeId !== undefined,
        data: result,
        error: result.error,
      };
    }

    return {
      success: false,
      message: 'Please provide amount and destination for payment',
      agent: 'payments',
      error: 'Missing required parameters',
    };
  }

  /**
   * Check if Payments Agent can handle a request
   */
  canHandle(intent: string | IntentType, entities: Record<string, any>): boolean {
    // Support both string (raw message) and IntentType (classified)
    const intentStr = typeof intent === 'string' ? intent.toLowerCase() : intent;
    
    // Check if it's a classified intent type
    if (typeof intent === 'string' && !intent.includes(' ')) {
      const paymentIntents: IntentType[] = ['send', 'pay', 'phone', 'email', 'bill_payment'];
      if (paymentIntents.includes(intentStr as IntentType)) {
        return true;
      }
    }
    
    // Fallback to keyword matching
    const paymentKeywords = ['send', 'pay', 'transfer', 'payment', 'phone', 'email'];
    const hasPaymentIntent = paymentKeywords.some((keyword) => intentStr.includes(keyword));
    const hasAmount = entities.amount !== undefined;
    const hasDestination = entities.address !== undefined || entities.recipient !== undefined || entities.phone !== undefined || entities.email !== undefined;

    return hasPaymentIntent && (hasAmount || hasDestination);
  }
}

const paymentsAgent = new PaymentsAgent();

export default paymentsAgent;
export { PaymentsAgent };

