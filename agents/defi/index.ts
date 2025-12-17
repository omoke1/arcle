/**
 * DeFi Agent
 * 
 * Handles yield farming, savings goals, safelocks, and DeFi operations
 * Integrates with real Circle USYC for yield farming
 */

import type { AgentRequest, AgentResponse } from '@/core/routing/types';
import type { IntentType } from '@/lib/ai/intent-classifier';
import { getAvailableStrategies, startYieldFarming, getActivePositions, getBestYieldStrategy } from '@/lib/defi/yield-farming';
import { getSavingsGoalsByUser, createSavingsGoal } from '@/lib/defi/goal-based-savings-db';
import { getSafeLocksByUser, createSafeLock } from '@/lib/defi/safelock-db';

class DeFiAgent {
  /**
   * Execute a low-level DeFi action
   */
  async execute(action: string, params: Record<string, any>): Promise<any> {
    switch (action) {
      case 'yield-strategies': {
        const chain = params.chain;
        return await getAvailableStrategies(chain);
      }

      case 'start-yield': {
        const { walletId, walletAddress, strategyId, amount, userId, userToken } = params;
        if (!walletId || !walletAddress || !strategyId || !amount || !userId || !userToken) {
          throw new Error('Missing required parameters for yield farming');
        }
        return await startYieldFarming(walletId, walletAddress, strategyId, amount, userId, userToken);
      }

      case 'get-positions': {
        const { walletAddress, walletId, blockchain } = params;
        if (!walletAddress || !walletId) {
          throw new Error('Missing walletAddress or walletId');
        }
        return await getActivePositions(walletAddress, walletId, blockchain || 'ETH');
      }

      case 'best-strategy': {
        const { amount, riskTolerance, chain } = params;
        if (!amount) {
          throw new Error('Missing amount for best strategy');
        }
        return await getBestYieldStrategy(amount, riskTolerance || 'low', chain);
      }

      case 'savings-goals': {
        const { userId } = params;
        if (!userId) {
          throw new Error('Missing userId');
        }
        return await getSavingsGoalsByUser(userId);
      }

      case 'create-savings-goal': {
        const { userId, walletId, goalName, targetAmount, initialDeposit, lockPeriod } = params;
        if (!userId || !walletId || !goalName || !targetAmount || !initialDeposit || !lockPeriod) {
          throw new Error('Missing required parameters for savings goal');
        }
        return await createSavingsGoal({
          userId,
          walletId,
          goalName,
          targetAmount,
          initialDeposit,
          lockPeriod,
        });
      }

      case 'safelocks': {
        const { userId } = params;
        if (!userId) {
          throw new Error('Missing userId');
        }
        return await getSafeLocksByUser(userId);
      }

      case 'create-safelock': {
        const { userId, walletId, amount, lockPeriod } = params;
        if (!userId || !walletId || !amount || !lockPeriod) {
          throw new Error('Missing required parameters for SafeLock');
        }
        return await createSafeLock({
          userId,
          walletId,
          amount,
          lockPeriod,
        });
      }

      default:
        throw new Error(`Unknown DeFi action: ${action}`);
    }
  }

  /**
   * Handle a routed DeFi request
   */
  async handle(request: AgentRequest): Promise<AgentResponse> {
    const { intent, entities, context } = request;
    const intentLower = intent.toLowerCase();
    const userId = (context as any)?.userId;
    const walletId = (context as any)?.walletId;
    const walletAddress = (context as any)?.walletAddress;
    const userToken = (context as any)?.userToken;

    // Yield farming
    if (intentLower.includes('yield') || intentLower.includes('farm') || intentLower.includes('earn')) {
      if (intentLower.includes('strategies') || intentLower.includes('options') || intentLower.includes('available')) {
        try {
          const strategies = await this.execute('yield-strategies', { chain: entities.chain });
          const lines = ['💰 Available Yield Strategies:\n'];
          strategies.forEach((s: any) => {
            lines.push(`• ${s.name} (${s.chain})`);
            lines.push(`  APY: ${s.apy}% | Risk: ${s.riskLevel} | Min: $${s.minAmount}`);
          });
          return {
            success: true,
            message: lines.join('\n'),
            agent: 'defi',
            data: { strategies },
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Could not fetch yield strategies: ${error.message}`,
            agent: 'defi',
            error: error.message,
          };
        }
      }

      if (intentLower.includes('start') || intentLower.includes('begin') || entities.amount) {
        if (!userId || !userToken || !walletId || !walletAddress) {
          return {
            success: false,
            message: 'I need your wallet information to start yield farming. Please make sure you are signed in.',
            agent: 'defi',
            error: 'Missing wallet context',
          };
        }

        const amount = entities.amount;
        if (!amount) {
          return {
            success: false,
            message: 'How much would you like to invest in yield farming? For example: "Start yield farming with 100 USDC"',
            agent: 'defi',
            error: 'Missing amount',
          };
        }

        try {
          // Get best strategy
          const strategy = await this.execute('best-strategy', { amount, riskTolerance: 'low' });
          if (!strategy) {
            return {
              success: false,
              message: 'No suitable yield strategy found for your amount.',
              agent: 'defi',
            };
          }

          const result = await this.execute('start-yield', {
            walletId,
            walletAddress,
            strategyId: strategy.id,
            amount,
            userId,
            userToken,
          });

          if (result.success) {
            return {
              success: true,
              message: `✅ Yield farming started! ${result.message}\n\nStrategy: ${strategy.name}\nAPY: ${strategy.apy}%`,
              agent: 'defi',
              data: result,
            };
          } else {
            return {
              success: false,
              message: result.message || 'Failed to start yield farming',
              agent: 'defi',
              error: result.message,
            };
          }
        } catch (error: any) {
          return {
            success: false,
            message: `Could not start yield farming: ${error.message}`,
            agent: 'defi',
            error: error.message,
          };
        }
      }

      if (intentLower.includes('position') || intentLower.includes('active')) {
        if (!walletId || !walletAddress) {
          return {
            success: false,
            message: 'I need your wallet information to check yield positions.',
            agent: 'defi',
            error: 'Missing wallet context',
          };
        }

        try {
          const positions = await this.execute('get-positions', { walletAddress, walletId });
          if (positions.length === 0) {
            return {
              success: true,
              message: "You don't have any active yield positions yet.",
              agent: 'defi',
              data: { positions: [] },
            };
          }

          const lines = [`💰 Your Yield Positions (${positions.length}):\n`];
          positions.forEach((p: any, i: number) => {
            lines.push(`${i + 1}. ${p.protocol} - ${p.amount} USDC`);
            lines.push(`   APY: ${p.apy}% | Earned: ${p.earned} USDC | Status: ${p.status}`);
          });

          return {
            success: true,
            message: lines.join('\n'),
            agent: 'defi',
            data: { positions },
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Could not fetch positions: ${error.message}`,
            agent: 'defi',
            error: error.message,
          };
        }
      }
    }

    // Savings goals
    if (intentLower.includes('savings goal') || intentLower.includes('save for')) {
      if (intentLower.includes('list') || intentLower.includes('show') || intentLower.includes('my')) {
        if (!userId) {
          return {
            success: false,
            message: 'I need your user ID to show savings goals.',
            agent: 'defi',
            error: 'Missing userId',
          };
        }

        try {
          const goals = await this.execute('savings-goals', { userId });
          if (goals.length === 0) {
            return {
              success: true,
              message: "You don't have any savings goals yet. Create one to start saving!",
              agent: 'defi',
            };
          }

          const lines = [`💰 Your Savings Goals (${goals.length}):\n`];
          goals.forEach((g: any, i: number) => {
            const progress = ((parseFloat(g.current_amount) / parseFloat(g.target_amount)) * 100).toFixed(1);
            lines.push(`${i + 1}. ${g.goal_name}: $${g.current_amount}/$${g.target_amount} (${progress}%)`);
          });

          return {
            success: true,
            message: lines.join('\n'),
            agent: 'defi',
            data: { goals },
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Could not fetch savings goals: ${error.message}`,
            agent: 'defi',
            error: error.message,
          };
        }
      }
    }

    // SafeLocks
    if (intentLower.includes('safelock') || intentLower.includes('lock') || intentLower.includes('fixed deposit')) {
      if (intentLower.includes('list') || intentLower.includes('show') || intentLower.includes('my')) {
        if (!userId) {
          return {
            success: false,
            message: 'I need your user ID to show SafeLocks.',
            agent: 'defi',
            error: 'Missing userId',
          };
        }

        try {
          const safelocks = await this.execute('safelocks', { userId });
          if (safelocks.length === 0) {
            return {
              success: true,
              message: "You don't have any SafeLocks yet.",
              agent: 'defi',
            };
          }

          const lines = [`🔒 Your SafeLocks (${safelocks.length}):\n`];
          safelocks.forEach((s: any, i: number) => {
            lines.push(`${i + 1}. $${s.amount} at ${s.apy}% APY - ${s.status}`);
          });

          return {
            success: true,
            message: lines.join('\n'),
            agent: 'defi',
            data: { safelocks },
          };
        } catch (error: any) {
          return {
            success: false,
            message: `Could not fetch SafeLocks: ${error.message}`,
            agent: 'defi',
            error: error.message,
          };
        }
      }
    }

    // Default help message
    return {
      success: true,
      message: `I can help you with DeFi operations:\n\n` +
        `• **Yield Farming**: "Show yield strategies" or "Start yield farming with 100 USDC"\n` +
        `• **Savings Goals**: "Show my savings goals" or "Create a savings goal"\n` +
        `• **SafeLocks**: "Show my SafeLocks" or "Create a SafeLock"\n\n` +
        `What would you like to do?`,
      agent: 'defi',
    };
  }

  canHandle(intent: string | IntentType, entities: Record<string, any>): boolean {
    // Support both string (raw message) and IntentType (classified)
    const intentStr = typeof intent === 'string' ? intent.toLowerCase() : intent;
    
    // Check if it's a classified intent type
    if (typeof intent === 'string' && !intent.includes(' ')) {
      // Might be an intent type, check directly
      const defiIntents: IntentType[] = [
        'yield', 'withdraw', 'savings', 'safelock', 'trade', 'limit_order',
        'liquidity', 'compound', 'arbitrage', 'rebalance', 'split_payment', 'batch'
      ];
      if (defiIntents.includes(intentStr as IntentType)) {
        return true;
      }
    }
    
    // Fallback to keyword matching
    const defiKeywords = [
      'yield', 'farm', 'earn', 'apy',
      'savings goal', 'save for', 'savings',
      'safelock', 'lock', 'fixed deposit',
      'defi', 'decentralized finance',
      'trade', 'swap', 'liquidity', 'arbitrage', 'rebalance',
    ];
    return defiKeywords.some((keyword) => intentStr.includes(keyword));
  }
}

const defiAgent = new DeFiAgent();

export default defiAgent;
export { DeFiAgent };

