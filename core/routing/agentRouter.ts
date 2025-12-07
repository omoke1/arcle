/**
 * Agent Router
 * 
 * Routes chat intents to appropriate agents
 */

import type { AgentRequest, AgentResponse, AgentRoute } from './types';

// Agent routing configuration
const AGENT_ROUTES: AgentRoute[] = [
  // Payments
  { intent: ['send', 'pay', 'transfer'], agent: 'payments', priority: 1 },
  { intent: ['payment', 'send money'], agent: 'payments', priority: 1 },
  
  // Invoice
  { intent: ['invoice', 'bill', 'create invoice'], agent: 'invoice', priority: 1 },
  { intent: ['payment link', 'invoice link'], agent: 'invoice', priority: 2 },
  
  // Remittance
  { intent: ['remittance', 'send remittance', 'cross-border'], agent: 'remittance', priority: 1 },
  { intent: ['cctp', 'bridge'], agent: 'remittance', priority: 2, condition: (req) => 
    req.entities.toChain !== undefined || req.entities.destinationChain !== undefined
  },
  
  // DeFi
  { intent: ['swap', 'trade'], agent: 'defi', priority: 1 },
  { intent: ['yield', 'earn', 'liquidity'], agent: 'defi', priority: 1 },
  { intent: ['arbitrage', 'rebalance'], agent: 'defi', priority: 2 },
  
  // FX
  { intent: ['convert', 'fx', 'currency'], agent: 'fx', priority: 1 },
  { intent: ['exchange rate', 'fx rate'], agent: 'fx', priority: 2 },
  
  // Local accounts / fiat balances
  { intent: ['local account', 'ngn account', 'bank account', 'ngn balance', 'local balance'], agent: 'local-accounts', priority: 1 },
  
  // Commerce
  { intent: ['order', 'purchase', 'buy'], agent: 'commerce', priority: 1 },
  { intent: ['delivery', 'shipment'], agent: 'commerce', priority: 2 },
  
  // Dispatch
  { intent: ['dispatch', 'assign rider', 'track delivery'], agent: 'dispatch', priority: 1 },
  { intent: ['rider', 'courier', 'delivery status'], agent: 'dispatch', priority: 2 },
  
  // Vendor
  { intent: ['vendor inventory', 'vendor menu', 'accept order', 'mark ready'], agent: 'vendor', priority: 1 },
  { intent: ['order status', 'vendor order'], agent: 'vendor', priority: 2 },
  
  // Insights
  { intent: ['balance', 'analytics', 'report'], agent: 'insights', priority: 1 },
  { intent: ['spending', 'transactions', 'history'], agent: 'insights', priority: 1 },
  { intent: ['dashboard', 'summary'], agent: 'insights', priority: 2 },
  
  // Merchant
  { intent: ['pos', 'point of sale', 'merchant'], agent: 'merchant', priority: 1 },
  { intent: ['settlement', 'merchant settlement'], agent: 'merchant', priority: 2 },
  
  // Compliance
  { intent: ['kyc', 'verify', 'compliance'], agent: 'compliance', priority: 1 },
  { intent: ['risk', 'fraud'], agent: 'compliance', priority: 2 },
  
  // Default: INERA for orchestration
  { intent: '*', agent: 'inera', priority: 0 },
];

/**
 * Route a chat intent to the appropriate agent
 */
export async function routeToAgent(request: AgentRequest): Promise<AgentResponse> {
  try {
    // Find matching route
    const route = findMatchingRoute(request);
    
    if (!route) {
      return {
        success: false,
        message: "I'm not sure how to handle that request. Could you rephrase?",
        agent: 'inera',
        error: 'No matching agent route found',
      };
    }

    // Load agent dynamically
    const agentModule = await import(`@/agents/${route.agent}/index`);
    const agent = agentModule.default || agentModule;

    if (!agent) {
      return {
        success: false,
        message: `Agent '${route.agent}' not found`,
        agent: route.agent,
        error: 'Agent module not found',
      };
    }

    // Execute agent
    const result = await agent.handle(request);

    return {
      success: result.success !== false,
      message: result.message || 'Operation completed',
      agent: route.agent,
      action: result.action,
      requiresConfirmation: result.requiresConfirmation,
      data: result.data,
      error: result.error,
    };
  } catch (error: any) {
    console.error('[Agent Router] Error routing request:', error);
    return {
      success: false,
      message: 'An error occurred while processing your request',
      agent: 'inera',
      error: error.message || 'Routing error',
    };
  }
}

/**
 * Find matching route for a request
 */
function findMatchingRoute(request: AgentRequest): AgentRoute | null {
  const intent = request.intent.toLowerCase();
  
  // Sort routes by priority (higher first)
  const sortedRoutes = [...AGENT_ROUTES].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  
  for (const route of sortedRoutes) {
    // Check if intent matches
    const intents = Array.isArray(route.intent) ? route.intent : [route.intent];
    
    if (route.intent === '*') {
      // Default route - check condition if present
      if (!route.condition || route.condition(request)) {
        return route;
      }
      continue;
    }
    
    const matches = intents.some((routeIntent) => {
      if (typeof routeIntent === 'string') {
        return intent.includes(routeIntent.toLowerCase());
      }
      return false;
    });
    
    if (matches) {
      // Check condition if present
      if (!route.condition || route.condition(request)) {
        return route;
      }
    }
  }
  
  return null;
}

/**
 * Get all available agents
 */
export async function getAvailableAgents(): Promise<string[]> {
  return [
    'inera',
    'payments',
    'invoice',
    'remittance',
    'defi',
    'fx',
    'commerce',
    'dispatch',
    'vendor',
    'insights',
    'merchant',
    'compliance',
  ];
}

/**
 * Check if an agent can handle a request
 */
export async function canAgentHandle(agentName: string, request: AgentRequest): Promise<boolean> {
  try {
    const agentModule = await import(`@/agents/${agentName}/index`);
    const agent = agentModule.default || agentModule;
    
    if (agent && typeof agent.canHandle === 'function') {
      return agent.canHandle(request.intent, request.entities);
    }
    
    return false;
  } catch {
    return false;
  }
}

