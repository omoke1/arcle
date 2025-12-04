/**
 * Agent Routing Type Definitions
 */

export interface AgentRequest {
  intent: string;
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

export interface Agent {
  name: string;
  execute(action: string, params: Record<string, any>): Promise<any>;
  canHandle(intent: string, entities: Record<string, any>): boolean;
}

