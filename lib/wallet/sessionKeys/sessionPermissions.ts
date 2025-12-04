/**
 * Session Permissions
 * 
 * Defines permission scopes and interfaces for Circle MSCA session keys
 * Circle's MSCAs enforce these permissions on-chain automatically
 */

export type WalletAction = 'transfer' | 'approve' | 'swap' | 'bridge' | 'cctp' | 'gateway';

export interface SessionPermissions {
  allowedActions: WalletAction[];
  spendingLimit: string; // USDC amount (in smallest unit: 1 USDC = 1000000)
  spendingUsed: string; // Track usage (Circle may also track this)
  expiryTime: number; // Unix timestamp
  autoRenew: boolean;
  maxRenewals: number;
  renewalsUsed: number;
  // Circle-specific permissions
  allowedChains?: string[]; // e.g., ['ARC-TESTNET', 'ETH-SEPOLIA']
  allowedTokens?: string[]; // Token addresses that can be interacted with
  maxAmountPerTransaction?: string; // Per-transaction limit
}

export interface CircleSessionKeyConfig {
  walletId: string;
  userId: string;
  userToken: string;
  allowedActions: WalletAction[];
  spendingLimit: string;
  expiryTime: number; // Unix timestamp (Circle handles enforcement)
  autoRenew: boolean;
  allowedChains?: string[];
  allowedTokens?: string[];
  maxAmountPerTransaction?: string;
}

export interface CircleSessionKey {
  sessionKeyId: string; // Circle's session key identifier
  walletId: string;
  userId: string;
  permissions: SessionPermissions;
  createdAt: number;
  expiresAt: number;
  status: 'active' | 'expired' | 'revoked';
  // Circle MSCA metadata
  mscaAddress?: string; // MSCA wallet address if applicable
  sessionKeyAddress?: string; // Session key wallet address (EOA)
  lastUsed?: number;
  // Agent metadata (for per-agent session keys)
  agentId?: string;        // Which agent owns this session key
  agentName?: string;      // Human-readable name (e.g., "Payments Agent")
  agentDescription?: string; // What this agent does
}

/**
 * Default permission scopes for common use cases
 */
export const DEFAULT_PERMISSION_SCOPES: Record<string, WalletAction[]> = {
  basic: ['transfer'],
  trading: ['transfer', 'swap', 'approve'],
  bridging: ['transfer', 'bridge', 'cctp', 'gateway', 'approve'],
  full: ['transfer', 'approve', 'swap', 'bridge', 'cctp', 'gateway'],
};

/**
 * Validate if an action is allowed in the permission set
 */
export function isActionAllowed(
  action: WalletAction,
  permissions: SessionPermissions
): boolean {
  return permissions.allowedActions.includes(action);
}

/**
 * Check if spending limit would be exceeded
 */
export function wouldExceedSpendingLimit(
  amount: string,
  permissions: SessionPermissions
): boolean {
  const currentUsed = BigInt(permissions.spendingUsed || '0');
  const limit = BigInt(permissions.spendingLimit);
  const newAmount = BigInt(amount);
  
  return currentUsed + newAmount > limit;
}

/**
 * Check if session is expired
 */
export function isSessionExpired(sessionKey: CircleSessionKey): boolean {
  return Date.now() >= sessionKey.expiresAt * 1000 || sessionKey.status !== 'active';
}

/**
 * Check if session can be renewed
 */
export function canRenewSession(sessionKey: CircleSessionKey): boolean {
  if (!sessionKey.permissions.autoRenew) return false;
  if (sessionKey.permissions.renewalsUsed >= sessionKey.permissions.maxRenewals) return false;
  return true;
}

