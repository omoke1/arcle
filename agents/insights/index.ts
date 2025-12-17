/**
 * Insights Agent
 *
 * Provides lightweight spending and activity summaries using Supabase
 * transaction history and existing FX utilities.
 */

import type { AgentRequest, AgentResponse } from '@/core/routing/types';
import type { IntentType } from '@/lib/ai/intent-classifier';
import { getUserTransactions, type Transaction } from '@/lib/db/services/transactions';
import { convertCurrency } from '@/lib/fx/fx-rates';

class InsightsAgent {
  /**
   * Execute a low-level insights action.
   *
   * Supported actions:
   * - "summary": get a simple recent spending summary for a user
   */
  async execute(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'summary': {
        const { userId, limit } = params;
        if (!userId) {
          throw new Error('Missing userId for insights summary');
        }

        const transactions = await getUserTransactions(userId, limit ?? 50);
        return buildSpendingSummary(transactions);
      }

      default:
        throw new Error(`Unknown insights action: ${action}`);
    }
  }

  /**
   * Handle a routed insights request from the Agent Router.
   */
  async handle(request: AgentRequest): Promise<AgentResponse> {
    const contextUserId = request.context?.userId;

    if (!contextUserId) {
      return {
        success: false,
        message: 'I need your wallet context to generate spending insights. Please make sure you are signed in with your ARCLE wallet.',
        agent: 'insights',
        error: 'Missing user context',
      };
    }

    try {
      const summary = await this.execute('summary', { userId: contextUserId, limit: 50 });

      const lines: string[] = [];

      lines.push('Here’s a quick snapshot of your recent activity:');
      lines.push(
        `- **Total completed outgoing volume (last 50 tx):** ${summary.totalOut.toFixed(2)} USDC approx.`,
      );
      lines.push(
        `- **Total completed incoming volume (last 50 tx):** ${summary.totalIn.toFixed(2)} USDC approx.`,
      );
      lines.push(
        `- **Number of completed transactions:** ${summary.completedCount} (of ${summary.totalCount} total)`,
      );

      if (summary.topCounterparties.length > 0) {
        lines.push('\nTop counterparties (by number of completed transactions):');
        summary.topCounterparties.forEach((cp: { address: string; count: number }) => {
          lines.push(`- \`${cp.address}\` — ${cp.count} tx`);
        });
      }

      return {
        success: true,
        message: lines.join('\n'),
        agent: 'insights',
        data: summary,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `I couldn't load your insights right now: ${error.message || 'unknown error'}.`,
        agent: 'insights',
        error: error.message || 'Insights summary failed',
      };
    }
  }

  canHandle(intent: string | IntentType, entities: Record<string, any>): boolean {
    const intentStr = typeof intent === 'string' ? intent.toLowerCase() : intent;
    
    if (typeof intent === 'string' && !intent.includes(' ')) {
      const insightsIntents: IntentType[] = ['balance', 'transaction_history', 'analytics', 'report', 'dashboard', 'summary'];
      if (insightsIntents.includes(intentStr as IntentType)) {
        return true;
      }
    }
    
    const insightsKeywords = [
      'balance',
      'analytics',
      'report',
      'spending',
      'transactions',
      'history',
      'dashboard',
      'activity',
      'summary',
    ];
    return insightsKeywords.some((keyword) => intentStr.includes(keyword));
  }
}

function buildSpendingSummary(transactions: Transaction[]) {
  let totalIn = 0;
  let totalOut = 0;
  let completedCount = 0;

  const counterparties: Record<string, number> = {};

  for (const tx of transactions) {
    const amount = parseFloat(tx.amount || '0');

    if (tx.status === 'completed') {
      completedCount += 1;

      // Simple heuristic: if user is sender, treat as outgoing; otherwise incoming
      const isOutgoing = !!tx.from_address && !!tx.to_address && tx.from_address !== tx.to_address;
      if (isOutgoing) {
        totalOut += amount;
        if (tx.to_address) {
          counterparties[tx.to_address] = (counterparties[tx.to_address] || 0) + 1;
        }
      } else {
        totalIn += amount;
        if (tx.from_address) {
          counterparties[tx.from_address] = (counterparties[tx.from_address] || 0) + 1;
        }
      }
    }
  }

  const topCounterparties = Object.entries(counterparties)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([address, count]) => ({ address, count }));

  return {
    totalIn,
    totalOut,
    completedCount,
    totalCount: transactions.length,
    topCounterparties,
  };
}

const insightsAgent = new InsightsAgent();

export default insightsAgent;
export { InsightsAgent };
