/**
 * Agent Routing Type Definitions
 */

import type { ParsedIntent } from '@/lib/ai/intent-classifier';

export interface AgentRequest {
  intent: string; // Original message text
  entities: Record<string, any>;
  context?: {
    walletId?: string;
    userId?: string;
    userToken?: string;
    hasWallet?: boolean;
    balance?: string;
    walletAddress?: string;
  };
  sessionId?: string;
  classifiedIntent?: ParsedIntent; // AI-classified intent (optional, added by router)
}

export interface AgentResponse {
  success: boolean;
  message: string;
  agent: string;
  action?: string;
  requiresConfirmation?: boolean;
  data?: any;
  error?: string;
}

export interface AgentRoute {
  intent: string | string[];
  agent: string;
  priority?: number;
  condition?: (request: AgentRequest) => boolean;
}

import type { IntentType } from '@/lib/ai/intent-classifier';

export interface Agent {
  name: string;
  execute(action: string, params: Record<string, any>): Promise<any>;
  canHandle(intent: string | IntentType, entities: Record<string, any>): boolean;
  handle(request: AgentRequest): Promise<AgentResponse>;
}

