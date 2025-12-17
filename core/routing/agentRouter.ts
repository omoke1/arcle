/**
 * Agent Router
 * 
 * Routes chat intents to appropriate agents using AI-based classification
 */

import type { AgentRequest, AgentResponse, AgentRoute } from './types';
import type { ParsedIntent, IntentType } from '@/lib/ai/intent-classifier';

// Intent to Agent mapping (using classified intent types)
const INTENT_TO_AGENT_MAP: Partial<Record<IntentType, string>> = {
  // Payments
  'send': 'payments',
  'pay': 'payments',
  'phone': 'payments', // Phone payments
  'email': 'payments', // Email payments
  
  // Invoice
  'invoice': 'invoice',
  'payment_roll': 'invoice',
  
  // Remittance & Bridge
  'remittance': 'remittance',
  'bridge': 'remittance',
  
  // DeFi
  'yield': 'defi',
  'withdraw': 'defi',
  'savings': 'defi',
  'trade': 'defi',
  'limit_order': 'defi',
  'liquidity': 'defi',
  'compound': 'defi',
  'arbitrage': 'defi',
  'rebalance': 'defi',
  'split_payment': 'defi',
  'batch': 'defi',
  
  // FX
  'convert': 'fx',
  'fx_rate': 'fx',
  'multi_currency': 'fx',
  'fx_alert': 'fx',
  
  // Commerce
  'order': 'commerce',
  'purchase': 'commerce',
  'buy': 'commerce',
  
  // Dispatch
  'dispatch': 'dispatch',
  
  // Vendor
  'vendor': 'vendor',
  
  // Local Accounts
  'local_account': 'local-accounts',
  
  // Insights & Analytics
  'balance': 'insights',
  'transaction_history': 'insights',
  'analytics': 'insights',
  'report': 'insights',
  'dashboard': 'insights',
  'summary': 'insights',
  
  // Merchant
  'merchant': 'merchant',
  'pos': 'merchant',
  'settlement': 'merchant',
  
  // Compliance
  'kyc': 'compliance',
  'verify': 'compliance',
  'compliance': 'compliance',
  'risk': 'compliance',
  'fraud': 'compliance',
  'scan': 'compliance', // Address scanning/verification (also used by INERA for general scanning)
  
  // Scheduling
  'schedule': 'inera',
  'subscription': 'inera',
  
  // Bill Payments
  'bill_payment': 'payments',
  
  // Other
  'greeting': 'inera',
  'help': 'inera',
  'wallet_creation': 'inera',
  'tokens': 'inera',
  'address': 'inera',
  'faucet': 'inera',
  'location': 'inera',
  'contact': 'inera',
  'notification': 'inera',
  'approve_token': 'inera',
  'reject_token': 'inera',
  'confirm': 'inera',
  'cancel': 'inera',
  'agent': 'inera',
  'unknown': 'inera',
};

// Fallback keyword-based routing (for when AI classification fails)
const KEYWORD_ROUTES: AgentRoute[] = [
  // Payments
  { intent: ['send', 'pay', 'transfer', 'payment'], agent: 'payments', priority: 1 },
  { intent: ['phone', 'email', 'send to'], agent: 'payments', priority: 1 },
  
  // Invoice
  { intent: ['invoice', 'bill', 'create invoice', 'payment link'], agent: 'invoice', priority: 1 },
  
  // Remittance
  { intent: ['remittance', 'cross-border', 'cctp', 'bridge'], agent: 'remittance', priority: 1 },
  
  // DeFi
  { intent: ['yield', 'farm', 'earn', 'savings', 'safelock'], agent: 'defi', priority: 1 },
  { intent: ['swap', 'trade', 'liquidity', 'arbitrage'], agent: 'defi', priority: 1 },
  
  // FX
  { intent: ['convert', 'fx', 'currency', 'exchange rate'], agent: 'fx', priority: 1 },
  
  // Commerce
  { intent: ['order', 'purchase', 'buy'], agent: 'commerce', priority: 1 },
  
  // Dispatch
  { intent: ['dispatch', 'assign rider', 'track delivery', 'rider', 'courier', 'delivery status'], agent: 'dispatch', priority: 1 },
  
  // Vendor
  { intent: ['vendor inventory', 'vendor menu', 'accept order', 'mark ready', 'vendor order'], agent: 'vendor', priority: 1 },
  
  // Local Accounts
  { intent: ['local account', 'ngn account', 'bank account', 'ngn balance', 'local balance'], agent: 'local-accounts', priority: 1 },
  
  // Insights
  { intent: ['balance', 'analytics', 'report', 'spending', 'history'], agent: 'insights', priority: 1 },
  
  // Merchant
  { intent: ['pos', 'point of sale', 'merchant', 'settlement'], agent: 'merchant', priority: 1 },
  
  // Compliance
  { intent: ['kyc', 'verify', 'compliance', 'risk', 'fraud', 'scam'], agent: 'compliance', priority: 1 },
  
  // Default
  { intent: '*', agent: 'inera', priority: 0 },
];

/**
 * Route a chat intent to the appropriate agent using AI classification
 */
export async function routeToAgent(request: AgentRequest): Promise<AgentResponse> {
  try {
    // Step 1: Try AI-based intent classification first
    let classifiedIntent: ParsedIntent | null = null;
    let agentName: string | null = null;

    try {
      // Use context-aware classifier if available, fallback to rule-based
      const { classifyIntentWithContext } = await import('@/lib/ai/context-aware-classifier');
      classifiedIntent = await classifyIntentWithContext(request.intent, {
        hasWallet: request.context?.hasWallet,
        recentMessages: [], // Could be enhanced with actual conversation history
      });
    } catch (error) {
      // Fallback to rule-based classifier
      const { IntentClassifier } = await import('@/lib/ai/intent-classifier');
      classifiedIntent = IntentClassifier.classify(request.intent);
    }

    // Step 2: Map classified intent to agent
    if (classifiedIntent && classifiedIntent.intent !== 'unknown') {
      agentName = INTENT_TO_AGENT_MAP[classifiedIntent.intent] || null;
      
      // Merge classified entities with request entities
      if (classifiedIntent.entities) {
        request.entities = { ...request.entities, ...classifiedIntent.entities };
      }
      
      // Store classified intent in request for agents to use
      request.classifiedIntent = classifiedIntent;
    }

    // Step 3: Fallback to keyword-based routing if AI classification didn't find an agent
    let route: AgentRoute | null = null;
    if (!agentName) {
      route = findMatchingRoute(request);
      if (route) {
        agentName = route.agent;
      }
    }

    // Step 4: Default to INERA if no agent found
    if (!agentName) {
      agentName = 'inera';
    }

    // Step 5: Load and execute agent
    const agentModule = await import(`@/agents/${agentName}/index`);
    const agent = agentModule.default || agentModule;

    if (!agent) {
      return {
        success: false,
        message: `Agent '${agentName}' not found`,
        agent: agentName,
        error: 'Agent module not found',
      };
    }

    // Step 6: Check if agent can handle this request (using AI classification if available)
    if (classifiedIntent && typeof agent.canHandle === 'function') {
      const canHandle = agent.canHandle(classifiedIntent.intent, request.entities);
      if (!canHandle && agentName !== 'inera') {
        // Try INERA as fallback
        const ineraModule = await import('@/agents/inera/index');
        const inera = ineraModule.default || ineraModule;
        if (inera) {
          const result = await inera.handle(request);
          return {
            success: result.success !== false,
            message: result.message || 'Operation completed',
            agent: 'inera',
            action: result.action,
            requiresConfirmation: result.requiresConfirmation,
            data: result.data,
            error: result.error,
          };
        }
      }
    }

    // Step 7: Execute agent
    const result = await agent.handle(request);

    return {
      success: result.success !== false,
      message: result.message || 'Operation completed',
      agent: agentName,
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
  const sortedRoutes = [...KEYWORD_ROUTES].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  
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
 * Check if an agent can handle a request (using AI classification)
 */
export async function canAgentHandle(agentName: string, request: AgentRequest): Promise<boolean> {
  try {
    // First, classify the intent
    let classifiedIntent: ParsedIntent | null = null;
    try {
      const { classifyIntentWithContext } = await import('@/lib/ai/context-aware-classifier');
      classifiedIntent = await classifyIntentWithContext(request.intent);
    } catch {
      const { IntentClassifier } = await import('@/lib/ai/intent-classifier');
      classifiedIntent = IntentClassifier.classify(request.intent);
    }

    // Load agent
    const agentModule = await import(`@/agents/${agentName}/index`);
    const agent = agentModule.default || agentModule;
    
    if (!agent || typeof agent.canHandle !== 'function') {
      return false;
    }

    // Use classified intent if available
    if (classifiedIntent && classifiedIntent.intent !== 'unknown') {
      // Check if this agent handles this intent type
      const mappedAgent = INTENT_TO_AGENT_MAP[classifiedIntent.intent];
      if (mappedAgent === agentName) {
        return true;
      }
      
      // Also check agent's canHandle with classified intent
      return agent.canHandle(classifiedIntent.intent, request.entities);
    }
    
    // Fallback to original intent string
    return agent.canHandle(request.intent, request.entities);
  } catch {
    return false;
  }
}

