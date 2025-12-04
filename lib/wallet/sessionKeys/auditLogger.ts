/**
 * Audit Logger
 * 
 * Logs all session key operations for security and compliance
 * Tracks spending and action history
 */

import { kv } from '@vercel/kv';

const AUDIT_LOG_PREFIX = 'arcle:audit:session:';
const AUDIT_LOG_BY_WALLET_PREFIX = 'arcle:audit:wallet:';
const AUDIT_LOG_BY_USER_PREFIX = 'arcle:audit:user:';

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  sessionKeyId: string;
  walletId: string;
  userId: string;
  action: string;
  amount?: string;
  success: boolean;
  executedViaSessionKey: boolean;
  transactionHash?: string;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Check if KV is available
 */
function isKvAvailable(): boolean {
  try {
    return typeof kv !== 'undefined' && kv !== null;
  } catch {
    return false;
  }
}

/**
 * Log an audit entry
 */
export async function logAuditEntry(entry: AuditLogEntry): Promise<boolean> {
  try {
    if (!isKvAvailable()) {
      console.warn('[Audit Logger] KV not available, logging to console only');
      console.log('[Audit]', entry);
      return false;
    }

    const key = `${AUDIT_LOG_PREFIX}${entry.id}`;
    await kv.set(key, JSON.stringify(entry), { ex: 86400 * 90 }); // 90 days retention

    // Index by wallet
    const walletKey = `${AUDIT_LOG_BY_WALLET_PREFIX}${entry.walletId}`;
    await kv.lpush(walletKey, entry.id);
    await kv.ltrim(walletKey, 0, 999); // Keep last 1000 entries
    await kv.expire(walletKey, 86400 * 90);

    // Index by user
    const userKey = `${AUDIT_LOG_BY_USER_PREFIX}${entry.userId}`;
    await kv.lpush(userKey, entry.id);
    await kv.ltrim(userKey, 0, 999);
    await kv.expire(userKey, 86400 * 90);

    return true;
  } catch (error) {
    console.error('[Audit Logger] Error logging entry:', error);
    return false;
  }
}

/**
 * Get audit logs for a wallet
 */
export async function getWalletAuditLogs(
  walletId: string,
  limit: number = 100
): Promise<AuditLogEntry[]> {
  try {
    if (!isKvAvailable()) {
      return [];
    }

    const walletKey = `${AUDIT_LOG_BY_WALLET_PREFIX}${walletId}`;
    const entryIds = await kv.lrange<string>(walletKey, 0, limit - 1);

    const entries: AuditLogEntry[] = [];
    for (const entryId of entryIds) {
      const key = `${AUDIT_LOG_PREFIX}${entryId}`;
      const data = await kv.get<string>(key);
      if (data) {
        try {
          entries.push(JSON.parse(data));
        } catch {
          // Skip invalid entries
        }
      }
    }

    return entries.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('[Audit Logger] Error getting wallet audit logs:', error);
    return [];
  }
}

/**
 * Get audit logs for a user
 */
export async function getUserAuditLogs(
  userId: string,
  limit: number = 100
): Promise<AuditLogEntry[]> {
  try {
    if (!isKvAvailable()) {
      return [];
    }

    const userKey = `${AUDIT_LOG_BY_USER_PREFIX}${userId}`;
    const entryIds = await kv.lrange(userKey, 0, limit - 1) as string[];

    const entries: AuditLogEntry[] = [];
    for (const entryId of entryIds) {
      const key = `${AUDIT_LOG_PREFIX}${entryId}`;
      const data = await kv.get<string>(key);
      if (data) {
        try {
          entries.push(JSON.parse(data));
        } catch {
          // Skip invalid entries
        }
      }
    }

    return entries.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('[Audit Logger] Error getting user audit logs:', error);
    return [];
  }
}

/**
 * Get spending summary for a session
 */
export async function getSessionSpendingSummary(
  sessionKeyId: string
): Promise<{
  totalSpent: string;
  transactionCount: number;
  actions: Record<string, number>;
}> {
  try {
    if (!isKvAvailable()) {
      return {
        totalSpent: '0',
        transactionCount: 0,
        actions: {},
      };
    }

    // This would need to query all audit logs for the session
    // For now, return placeholder
    return {
      totalSpent: '0',
      transactionCount: 0,
      actions: {},
    };
  } catch (error) {
    console.error('[Audit Logger] Error getting spending summary:', error);
    return {
      totalSpent: '0',
      transactionCount: 0,
      actions: {},
    };
  }
}

