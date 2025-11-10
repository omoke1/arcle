/**
 * AI Agent Service
 * 
 * Manages autonomous AI agents for commerce automation
 */

import crypto from "crypto";

export interface AIAgent {
  id: string;
  name: string;
  description?: string;
  permissions: AgentPermission[];
  status: "active" | "paused" | "cancelled";
  createdAt: string;
  lastExecutedAt?: string;
  executionCount: number;
  metadata?: {
    category?: string;
    tags?: string[];
  };
}

export interface AgentPermission {
  action: string; // e.g., "pay_invoice", "send_transaction", "create_invoice"
  conditions?: {
    maxAmount?: string;
    requiresApproval?: boolean;
    allowedRecipients?: string[];
    blockedRecipients?: string[];
  };
}

export interface AgentExecution {
  id: string;
  agentId: string;
  action: string;
  result: "success" | "failed" | "pending";
  details?: string;
  executedAt: string;
  transactionHash?: string;
}

export interface AgentMarketplace {
  id: string;
  name: string;
  description: string;
  category: string;
  permissions: AgentPermission[];
  usageCount: number;
  rating?: number;
}

// Store in localStorage
const AGENTS_STORAGE_KEY = "arcle_ai_agents";
const AGENT_EXECUTIONS_STORAGE_KEY = "arcle_agent_executions";
const AGENT_MARKETPLACE_STORAGE_KEY = "arcle_agent_marketplace";

/**
 * Create an AI agent
 */
export function createAIAgent(agent: Omit<AIAgent, "id" | "createdAt" | "status" | "executionCount">): AIAgent {
  const agents = getAllAIAgents();
  
  const newAgent: AIAgent = {
    ...agent,
    id: crypto.randomUUID(),
    status: "active",
    createdAt: new Date().toISOString(),
    executionCount: 0,
  };
  
  agents.push(newAgent);
  saveAIAgents(agents);
  
  return newAgent;
}

/**
 * Get all AI agents
 */
export function getAllAIAgents(): AIAgent[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(AGENTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Get agent by ID
 */
export function getAgentById(id: string): AIAgent | null {
  const agents = getAllAIAgents();
  return agents.find(a => a.id === id) || null;
}

/**
 * Update agent
 */
export function updateAgent(id: string, updates: Partial<AIAgent>): AIAgent | null {
  const agents = getAllAIAgents();
  const index = agents.findIndex(a => a.id === id);
  
  if (index === -1) {
    return null;
  }
  
  agents[index] = { ...agents[index], ...updates };
  saveAIAgents(agents);
  
  return agents[index];
}

/**
 * Execute agent action
 */
export function executeAgentAction(
  agentId: string,
  action: string,
  details?: string,
  transactionHash?: string
): AgentExecution {
  const executions = getAllAgentExecutions();
  const agent = getAgentById(agentId);
  
  if (!agent) {
    throw new Error("Agent not found");
  }
  
  // Check if agent has permission for this action
  const hasPermission = agent.permissions.some(p => p.action === action);
  if (!hasPermission) {
    throw new Error(`Agent does not have permission for action: ${action}`);
  }
  
  // Check conditions
  const permission = agent.permissions.find(p => p.action === action);
  if (permission?.conditions?.requiresApproval) {
    throw new Error("This action requires approval");
  }
  
  const execution: AgentExecution = {
    id: crypto.randomUUID(),
    agentId,
    action,
    result: "success",
    details,
    executedAt: new Date().toISOString(),
    transactionHash,
  };
  
  executions.push(execution);
  saveAgentExecutions(executions);
  
  // Update agent stats
  updateAgent(agentId, {
    lastExecutedAt: execution.executedAt,
    executionCount: agent.executionCount + 1,
  });
  
  return execution;
}

/**
 * Get all agent executions
 */
export function getAllAgentExecutions(): AgentExecution[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(AGENT_EXECUTIONS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Get executions for an agent
 */
export function getExecutionsForAgent(agentId: string): AgentExecution[] {
  const executions = getAllAgentExecutions();
  return executions.filter(e => e.agentId === agentId);
}

/**
 * Get marketplace agents
 */
export function getMarketplaceAgents(): AgentMarketplace[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(AGENT_MARKETPLACE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : getDefaultMarketplaceAgents();
  } catch {
    return getDefaultMarketplaceAgents();
  }
}

/**
 * Get default marketplace agents
 */
function getDefaultMarketplaceAgents(): AgentMarketplace[] {
  return [
    {
      id: "invoice-auto-payer",
      name: "Invoice Auto-Payer",
      description: "Automatically pays invoices under a specified amount",
      category: "payments",
      permissions: [
        {
          action: "pay_invoice",
          conditions: {
            maxAmount: "1000",
            requiresApproval: false,
          },
        },
      ],
      usageCount: 0,
      rating: 4.5,
    },
    {
      id: "yield-compounder",
      name: "Yield Compounder",
      description: "Automatically compounds yield farming rewards",
      category: "defi",
      permissions: [
        {
          action: "compound_yield",
          conditions: {
            requiresApproval: false,
          },
        },
      ],
      usageCount: 0,
      rating: 4.8,
    },
    {
      id: "portfolio-rebalancer",
      name: "Portfolio Rebalancer",
      description: "Automatically rebalances portfolio across chains",
      category: "defi",
      permissions: [
        {
          action: "rebalance_portfolio",
          conditions: {
            requiresApproval: true,
          },
        },
      ],
      usageCount: 0,
      rating: 4.3,
    },
  ];
}

/**
 * Save functions
 */
function saveAIAgents(agents: AIAgent[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AGENTS_STORAGE_KEY, JSON.stringify(agents));
  } catch (error) {
    console.error("Error saving AI agents:", error);
  }
}

function saveAgentExecutions(executions: AgentExecution[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AGENT_EXECUTIONS_STORAGE_KEY, JSON.stringify(executions));
  } catch (error) {
    console.error("Error saving agent executions:", error);
  }
}

