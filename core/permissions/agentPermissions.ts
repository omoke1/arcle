/**
 * Agent-Specific Permissions
 * 
 * Defines permission scopes for each agent
 */

import type { WalletAction } from '@/lib/wallet/sessionKeys/sessionPermissions';

export interface AgentPermissionScope {
  agent: string;
  allowedActions: WalletAction[];
  defaultSpendingLimit: string;
  maxAmountPerTransaction?: string;
  allowedChains?: string[];
  allowedTokens?: string[];
}

/**
 * Agent permission scopes
 */
export const AGENT_PERMISSIONS: Record<string, AgentPermissionScope> = {
  inera: {
    agent: 'inera',
    allowedActions: ['transfer', 'approve', 'swap', 'bridge', 'cctp', 'gateway'],
    defaultSpendingLimit: '100000000000', // 100,000 USDC
  },
  payments: {
    agent: 'payments',
    allowedActions: ['transfer'],
    defaultSpendingLimit: '10000000000', // 10,000 USDC
    maxAmountPerTransaction: '1000000000', // 1,000 USDC per transaction
  },
  invoice: {
    agent: 'invoice',
    allowedActions: ['transfer'],
    defaultSpendingLimit: '5000000000', // 5,000 USDC
  },
  remittance: {
    agent: 'remittance',
    allowedActions: ['transfer', 'bridge', 'cctp', 'gateway'],
    defaultSpendingLimit: '50000000000', // 50,000 USDC
    allowedChains: ['ARC-TESTNET', 'ETHEREUM-SEPOLIA', 'BASE-SEPOLIA', 'ARBITRUM-SEPOLIA', 'POLYGON-AMOY', 'AVALANCHE-FUJI'],
  },
  defi: {
    agent: 'defi',
    allowedActions: ['transfer', 'approve', 'swap'],
    defaultSpendingLimit: '20000000000', // 20,000 USDC
  },
  fx: {
    agent: 'fx',
    allowedActions: ['transfer', 'swap'],
    defaultSpendingLimit: '10000000000', // 10,000 USDC
  },
  commerce: {
    agent: 'commerce',
    allowedActions: ['transfer', 'approve'],
    defaultSpendingLimit: '5000000000', // 5,000 USDC
  },
  insights: {
    agent: 'insights',
    allowedActions: [], // Read-only, no transactions
    defaultSpendingLimit: '0',
  },
  merchant: {
    agent: 'merchant',
    allowedActions: ['transfer'],
    defaultSpendingLimit: '20000000000', // 20,000 USDC
  },
  compliance: {
    agent: 'compliance',
    allowedActions: [], // Read-only, no transactions
    defaultSpendingLimit: '0',
  },
};

/**
 * Get permission scope for an agent
 */
export function getAgentPermissions(agentName: string): AgentPermissionScope | null {
  return AGENT_PERMISSIONS[agentName] || null;
}

/**
 * Check if agent can perform an action
 */
export function canAgentPerformAction(agentName: string, action: WalletAction): boolean {
  const permissions = getAgentPermissions(agentName);
  if (!permissions) {
    return false;
  }
  return permissions.allowedActions.includes(action);
}

/**
 * Get default spending limit for an agent
 */
export function getAgentDefaultSpendingLimit(agentName: string): string {
  const permissions = getAgentPermissions(agentName);
  return permissions?.defaultSpendingLimit || '0';
}

/**
 * Agent display names (Web2-friendly, no crypto terms)
 */
export const AGENT_DISPLAY_NAMES: Record<string, { name: string; description: string }> = {
  inera: {
    name: 'Arcle Assistant',
    description: 'Manages your finances, sends money, converts currency, moves funds across networks',
  },
  payments: {
    name: 'Payments Agent',
    description: 'Sends payments, processes subscriptions, handles payment links',
  },
  invoice: {
    name: 'Invoice Agent',
    description: 'Creates invoices, generates payment links, tracks payments',
  },
  remittance: {
    name: 'Remittance Agent',
    description: 'Sends cross-border payments, converts currency',
  },
  defi: {
    name: 'DeFi Agent',
    description: 'Makes trades, manages yield, handles swaps',
  },
  fx: {
    name: 'FX Agent',
    description: 'Converts currency, manages exchange rates',
  },
  commerce: {
    name: 'Commerce Agent',
    description: 'Places orders, tracks deliveries, manages marketplace',
  },
  insights: {
    name: 'Insights Agent',
    description: 'Provides spending reports and analytics (read-only)',
  },
  merchant: {
    name: 'Merchant Agent',
    description: 'Processes payments, handles settlements',
  },
  compliance: {
    name: 'Compliance Agent',
    description: 'Monitors transactions for security (read-only)',
  },
};

/**
 * Get display name for an agent
 */
export function getAgentDisplayName(agentId: string): string {
  return AGENT_DISPLAY_NAMES[agentId]?.name || agentId;
}

/**
 * Get description for an agent
 */
export function getAgentDescription(agentId: string): string {
  return AGENT_DISPLAY_NAMES[agentId]?.description || '';
}

