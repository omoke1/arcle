/**
 * Agent Integration for Chat UI
 * 
 * Integrates agent router with chat interface
 * Provides fallback to existing AI service
 */

import { routeToAgent } from '@/core/routing/agentRouter';
import type { AgentRequest, AgentResponse } from '@/core/routing/types';
import { IntentClassifier, type ParsedIntent } from './intent-classifier';

/**
 * Process message through agent router with fallback to AI service
 */
export async function processMessageWithAgents(
  message: string,
  context: {
    hasWallet?: boolean;
    balance?: string;
    walletAddress?: string;
    walletId?: string;
    userId?: string;
    userToken?: string;
  },
  sessionId?: string
): Promise<{
  message: string;
  intent: ParsedIntent;
  agent?: string;
  requiresConfirmation?: boolean;
  data?: any;
  useAgentRouter: boolean;
}> {
  try {
    // First, classify intent to extract entities
    // IntentClassifier.classify is a static method
    const intent = IntentClassifier.classify(message);
    
    // Build agent request
    const agentRequest: AgentRequest = {
      intent: message,
      entities: intent.entities || {},
      context: {
        walletId: context.walletId,
        userId: context.userId,
        userToken: context.userToken,
        hasWallet: context.hasWallet,
        balance: context.balance,
        walletAddress: context.walletAddress,
      },
      sessionId,
    };

    // Route to agent
    const agentResponse = await routeToAgent(agentRequest);

    // If agent successfully handled it, return agent response
    if (agentResponse.success && agentResponse.agent !== 'inera') {
      return {
        message: agentResponse.message,
        intent,
        agent: agentResponse.agent,
        requiresConfirmation: agentResponse.requiresConfirmation,
        data: agentResponse.data,
        useAgentRouter: true,
      };
    }

    // Fallback to existing AI service for non-agent intents or if agent failed
    const { AIService } = await import('./ai-service');
    const aiResponse = await AIService.processMessage(message, context, sessionId);

    return {
      message: aiResponse.message,
      intent: aiResponse.intent,
      requiresConfirmation: aiResponse.requiresConfirmation,
      useAgentRouter: false,
    };
  } catch (error: any) {
    console.error('[Agent Integration] Error:', error);
    
    // Fallback to AI service on error
    const { AIService } = await import('./ai-service');
    const aiResponse = await AIService.processMessage(message, context, sessionId);

    return {
      message: aiResponse.message,
      intent: aiResponse.intent,
      requiresConfirmation: aiResponse.requiresConfirmation,
      useAgentRouter: false,
    };
  }
}

/**
 * Check if agent router should be used for a message
 */
export function shouldUseAgentRouter(message: string): boolean {
  const agentKeywords = [
    'send', 'pay', 'transfer', 'payment',
    'invoice', 'bill',
    'remittance', 'cross-border', 'cctp', 'bridge',
    'swap', 'yield', 'trade',
    'convert', 'fx', 'currency',
    // Commerce / ordering
    'order', 'purchase', 'buy', 'checkout',
    // Local accounts / fiat balances
    'local account', 'ngn account', 'bank account', 'ngn balance', 'local balance',
  ];

  const lowerMessage = message.toLowerCase();
  return agentKeywords.some((keyword) => lowerMessage.includes(keyword));
}

