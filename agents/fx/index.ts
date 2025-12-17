/**
 * FX Agent
 *
 * Handles currency conversion and FX operations using real FX rate services.
 */

import type { AgentRequest, AgentResponse } from '@/core/routing/types';
import type { IntentType } from '@/lib/ai/intent-classifier';
import { convertCurrency, getFXRate } from '@/lib/fx/fx-rates';

class FXAgent {
  /**
   * Execute a low-level FX action.
   *
   * Supported actions:
   * - "convert": convert amount between currencies
   * - "rate": fetch current FX rate for a pair
   */
  async execute(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'convert': {
        const { amount, from, to } = params;
        if (!amount || !from || !to) {
          throw new Error('Missing amount, from, or to for FX conversion');
        }

        const result = await convertCurrency(String(amount), String(from).toUpperCase(), String(to).toUpperCase());
        if (!result.success || !result.convertedAmount || result.rate === undefined) {
          throw new Error(result.error || 'FX conversion failed');
        }

        return {
          convertedAmount: result.convertedAmount,
          rate: result.rate,
        };
      }

      case 'rate': {
        const { from, to } = params;
        if (!from || !to) {
          throw new Error('Missing from or to for FX rate lookup');
        }

        const rateResult = await getFXRate(String(from).toUpperCase(), String(to).toUpperCase());
        if (!rateResult.success || !rateResult.rate) {
          throw new Error(rateResult.error || 'Could not fetch FX rate');
        }

        return rateResult.rate;
      }

      default:
        throw new Error(`Unknown FX action: ${action}`);
    }
  }

  /**
   * High-level handler for routed agent requests.
   *
   * Expects entities like:
   * - amount: string
   * - fromCurrency / sourceCurrency
   * - toCurrency / targetCurrency
   */
  async handle(request: AgentRequest): Promise<AgentResponse> {
    const { intent, entities } = request;

    const amount = entities.amount;
    const from =
      entities.fromCurrency ||
      entities.sourceCurrency ||
      entities.baseCurrency ||
      'USDC';
    const to =
      entities.toCurrency ||
      entities.targetCurrency ||
      entities.quoteCurrency ||
      'EURC';

    if (!amount) {
      return {
        success: false,
        message: 'Tell me how much you want to convert, for example: "Convert 100 USDC to EURC".',
        agent: 'fx',
        error: 'Missing amount',
      };
    }

    try {
      const result = await this.execute('convert', {
        amount,
        from,
        to,
      });

      const converted = result.convertedAmount;
      const rate = result.rate;

      return {
        success: true,
        message: `At a rate of ${rate.toFixed(6)}, ${amount} ${String(from).toUpperCase()} is approximately ${converted} ${String(to).toUpperCase()}.`,
        agent: 'fx',
        data: { amount, from, to, convertedAmount: converted, rate },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `I couldn't complete that FX conversion: ${error.message || 'unknown error'}`,
        agent: 'fx',
        error: error.message || 'FX conversion failed',
      };
    }
  }

  canHandle(intent: string | IntentType, entities: Record<string, any>): boolean {
    const intentStr = typeof intent === 'string' ? intent.toLowerCase() : intent;
    
    if (typeof intent === 'string' && !intent.includes(' ')) {
      const fxIntents: IntentType[] = ['convert', 'fx_rate', 'multi_currency', 'fx_alert'];
      if (fxIntents.includes(intentStr as IntentType)) {
        return true;
      }
    }
    
    const fxKeywords = ['convert', 'fx', 'currency', 'exchange rate', 'forex', 'swap'];
    const mentionsFX = fxKeywords.some((keyword) => intentStr.includes(keyword));

    const hasCurrencyEntities =
      typeof entities.fromCurrency === 'string' ||
      typeof entities.toCurrency === 'string' ||
      typeof entities.sourceCurrency === 'string' ||
      typeof entities.targetCurrency === 'string' ||
      typeof entities.baseCurrency === 'string' ||
      typeof entities.quoteCurrency === 'string';

    return mentionsFX || hasCurrencyEntities;
  }
}

const fxAgent = new FXAgent();

export default fxAgent;
export { FXAgent };
