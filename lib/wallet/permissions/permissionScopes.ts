/**
 * Permission Scopes
 * 
 * Defines action scopes that map to Circle MSCA permissions
 */

import type { WalletAction } from '../sessionKeys/sessionPermissions';

export interface ActionScope {
  name: string;
  description: string;
  actions: WalletAction[];
  defaultSpendingLimit?: string;
}

/**
 * Predefined permission scopes
 */
export const PERMISSION_SCOPES: Record<string, ActionScope> = {
  transfer: {
    name: 'Transfer',
    description: 'Simple token transfers only',
    actions: ['transfer'],
    defaultSpendingLimit: '1000000000', // 1000 USDC
  },
  trading: {
    name: 'Trading',
    description: 'Token transfers, swaps, and approvals',
    actions: ['transfer', 'swap', 'approve'],
    defaultSpendingLimit: '5000000000', // 5000 USDC
  },
  bridging: {
    name: 'Bridging',
    description: 'Cross-chain transfers and bridging',
    actions: ['transfer', 'bridge', 'cctp', 'gateway', 'approve'],
    defaultSpendingLimit: '10000000000', // 10000 USDC
  },
  full: {
    name: 'Full Access',
    description: 'All wallet operations',
    actions: ['transfer', 'approve', 'swap', 'bridge', 'cctp', 'gateway'],
    defaultSpendingLimit: '50000000000', // 50000 USDC
  },
};

/**
 * Get scope by name
 */
export function getScope(name: string): ActionScope | null {
  return PERMISSION_SCOPES[name] || null;
}

/**
 * Get all available scopes
 */
export function getAllScopes(): ActionScope[] {
  return Object.values(PERMISSION_SCOPES);
}

/**
 * Validate if actions match a scope
 */
export function actionsMatchScope(actions: WalletAction[], scope: ActionScope): boolean {
  return actions.every(action => scope.actions.includes(action));
}

