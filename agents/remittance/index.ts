/**
 * Remittance Agent
 * 
 * Handles cross-border payments via CCTP with FX conversion
 */

import { executeCCTPTransfer, trackCCTPTransfer } from './cctpFlow';
import { convertCurrencyForRemittance, getFXRate } from './fxIntegration';
import type { AgentRequest, AgentResponse } from '@/core/routing/types';
import { toSmallestUnit } from '@/agents/inera/utils';

class RemittanceAgent {
  /**
   * Send remittance
   */
  async sendRemittance(params: {
    walletId: string;
    userId: string;
    userToken: string;
    amount: string;
    fromChain: string;
    toChain: string;
    destinationAddress: string;
    fastTransfer?: boolean;
  }) {
    return await executeCCTPTransfer({
      walletId: params.walletId,
      userId: params.userId,
      userToken: params.userToken,
      amount: toSmallestUnit(params.amount),
      fromChain: params.fromChain,
      toChain: params.toChain,
      destinationAddress: params.destinationAddress,
      fastTransfer: params.fastTransfer,
    });
  }

  /**
   * Execute CCTP transfer
   */
  async executeCCTPTransfer(params: {
    walletId: string;
    userId: string;
    userToken: string;
    amount: string;
    fromChain: string;
    toChain: string;
    destinationAddress: string;
    fastTransfer?: boolean;
  }) {
    return await executeCCTPTransfer({
      walletId: params.walletId,
      userId: params.userId,
      userToken: params.userToken,
      amount: toSmallestUnit(params.amount),
      fromChain: params.fromChain,
      toChain: params.toChain,
      destinationAddress: params.destinationAddress,
      fastTransfer: params.fastTransfer,
    });
  }

  /**
   * Convert currency
   */
  async convertCurrency(params: {
    walletId: string;
    userId: string;
    userToken: string;
    amount: string;
    from: string;
    to: string;
  }) {
    try {
      return await convertCurrencyForRemittance({
        walletId: params.walletId,
        userId: params.userId,
        userToken: params.userToken,
        amount: toSmallestUnit(params.amount),
        fromCurrency: params.from,
        toCurrency: params.to,
      });
    } catch (error: any) {
      return {
        success: false,
        executedViaSessionKey: false,
        error: error.message || 'Currency conversion failed',
      };
    }
  }

  /**
   * Track remittance
   */
  async trackRemittance(remittanceId: string) {
    return await trackCCTPTransfer(remittanceId);
  }

  /**
   * Execute agent action
   */
  async execute(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'send':
      case 'sendRemittance':
        return await this.sendRemittance({
          walletId: params.walletId,
          userId: params.userId,
          userToken: params.userToken,
          amount: params.amount,
          fromChain: params.fromChain,
          toChain: params.toChain,
          destinationAddress: params.destinationAddress,
          fastTransfer: params.fastTransfer,
        });

      case 'cctp':
      case 'executeCCTP':
        return await this.executeCCTPTransfer({
          walletId: params.walletId,
          userId: params.userId,
          userToken: params.userToken,
          amount: params.amount,
          fromChain: params.fromChain,
          toChain: params.toChain,
          destinationAddress: params.destinationAddress,
          fastTransfer: params.fastTransfer,
        });

      case 'convertCurrency':
        return await this.convertCurrency({
          walletId: params.walletId,
          userId: params.userId,
          userToken: params.userToken,
          amount: params.amount,
          from: params.from,
          to: params.to,
        });

      case 'track':
        return await this.trackRemittance(params.remittanceId);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Handle agent request
   */
  async handle(request: AgentRequest): Promise<AgentResponse> {
    const { intent, entities, context } = request;

    if (!context?.walletId || !context?.userId || !context?.userToken) {
      return {
        success: false,
        message: 'Wallet authentication required for remittances',
        agent: 'remittance',
        error: 'Missing wallet context',
      };
    }

    const { amount, toChain, destinationAddress, fromChain } = entities;

    // Send remittance
    if (intent.toLowerCase().includes('remittance') || intent.toLowerCase().includes('send') && toChain) {
      if (!amount || !toChain || !destinationAddress) {
        return {
          success: false,
          message: 'Please provide amount, destination chain, and destination address for remittance',
          agent: 'remittance',
          error: 'Missing required parameters',
        };
      }

      const result = await this.sendRemittance({
        walletId: context.walletId,
        userId: context.userId,
        userToken: context.userToken,
        amount,
        fromChain: fromChain || 'ARC-TESTNET',
        toChain,
        destinationAddress,
        fastTransfer: entities.fastTransfer,
      });

      return {
        success: result.success,
        message: result.success
          ? `Remittance of $${amount} sent to ${toChain}${result.executedViaSessionKey ? ' automatically' : ''}`
          : `Failed to send remittance: ${result.error}`,
        agent: 'remittance',
        action: 'sendRemittance',
        requiresConfirmation: !result.executedViaSessionKey && result.challengeId !== undefined,
        data: result,
        error: result.error,
      };
    }

    return {
      success: false,
      message: 'Please specify remittance details (amount, destination chain, address)',
      agent: 'remittance',
      error: 'Unclear intent',
    };
  }

  /**
   * Check if Remittance Agent can handle a request
   */
  canHandle(intent: string, entities: Record<string, any>): boolean {
    const remittanceKeywords = ['remittance', 'cross-border', 'cctp', 'bridge'];
    const hasRemittanceIntent = remittanceKeywords.some((keyword) => intent.toLowerCase().includes(keyword));
    const hasDestinationChain = entities.toChain !== undefined || entities.destinationChain !== undefined;
    
    return hasRemittanceIntent || (intent.toLowerCase().includes('send') && hasDestinationChain);
  }
}

const remittanceAgent = new RemittanceAgent();

export default remittanceAgent;
export { RemittanceAgent };

