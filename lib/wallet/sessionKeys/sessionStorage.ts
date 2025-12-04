/**
 * Session Key Storage
 * 
 * Stores Circle session key metadata in Redis/Vercel KV
 * Circle handles on-chain permission enforcement, we just cache metadata
 */

import { kv } from '@vercel/kv';
import type { CircleSessionKey } from './sessionPermissions';

const SESSION_KEY_PREFIX = 'arcle:session:';
const SESSION_KEY_BY_WALLET_PREFIX = 'arcle:session:wallet:';
const SESSION_KEY_BY_USER_PREFIX = 'arcle:session:user:';

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
 * Store session key metadata
 */
export async function storeSessionKey(
  sessionKeyId: string,
  sessionKey: CircleSessionKey
): Promise<boolean> {
  try {
    let kvResult = true;
    if (!isKvAvailable()) {
      console.warn('[Session Storage] KV not available, using in-memory fallback');
      kvResult = typeof window === 'undefined';
    } else {
      const key = `${SESSION_KEY_PREFIX}${sessionKeyId}`;
      await kv.set(key, JSON.stringify(sessionKey), { ex: 86400 * 7 }); // 7 days TTL

      // Also index by wallet and user for quick lookup
      if (sessionKey.walletId) {
        const walletKey = `${SESSION_KEY_BY_WALLET_PREFIX}${sessionKey.walletId}`;
        await kv.sadd(walletKey, sessionKeyId);
        await kv.expire(walletKey, 86400 * 7);
      }

      if (sessionKey.userId) {
        const userKey = `${SESSION_KEY_BY_USER_PREFIX}${sessionKey.userId}`;
        await kv.sadd(userKey, sessionKeyId);
        await kv.expire(userKey, 86400 * 7);
      }
    }

    await upsertSessionKeyInSupabase(sessionKey).catch((error) => {
      console.error('[Session Storage] Supabase sync failed:', error);
    });

    return kvResult;
  } catch (error) {
    console.error('[Session Storage] Error storing session key:', error);
    return false;
  }
}

/**
 * Get session key metadata
 */
export async function getSessionKey(sessionKeyId: string): Promise<CircleSessionKey | null> {
  try {
    // Try KV first
    if (isKvAvailable()) {
      try {
        const key = `${SESSION_KEY_PREFIX}${sessionKeyId}`;
        const data = await kv.get<string>(key);
        
        if (data) {
          return JSON.parse(data);
        }
      } catch (kvError) {
        console.warn('[Session Storage] KV error, falling back to Supabase:', kvError);
      }
    }

    // Fallback to Supabase
    const supabaseKey = await getSessionKeyFromSupabase(sessionKeyId);
    if (supabaseKey) {
      return supabaseKey;
    }

    return null;
  } catch (error) {
    console.error('[Session Storage] Error getting session key:', error);
    return null;
  }
}

/**
 * Get all active session keys for a wallet
 */
export async function getWalletSessionKeys(walletId: string): Promise<string[]> {
  try {
    // Try KV first
    if (isKvAvailable()) {
      try {
        const walletKey = `${SESSION_KEY_BY_WALLET_PREFIX}${walletId}`;
        const sessionKeyIds = await kv.smembers(walletKey) as string[];
        
        if (Array.isArray(sessionKeyIds) && sessionKeyIds.length > 0) {
          return sessionKeyIds;
        }
      } catch (kvError) {
        console.warn('[Session Storage] KV error, falling back to Supabase:', kvError);
      }
    }

    // Fallback to Supabase
    const supabaseKeys = await getWalletSessionKeysFromSupabase(walletId);
    if (supabaseKeys.length > 0) {
      return supabaseKeys;
    }

    return [];
  } catch (error) {
    console.error('[Session Storage] Error getting wallet session keys:', error);
    return [];
  }
}

/**
 * Get all active session keys for a user
 */
export async function getUserSessionKeys(userId: string): Promise<string[]> {
  try {
    if (!isKvAvailable()) {
      return [];
    }

    const userKey = `${SESSION_KEY_BY_USER_PREFIX}${userId}`;
    const sessionKeyIds = await kv.smembers(userKey) as string[];
    
    return Array.isArray(sessionKeyIds) ? sessionKeyIds : [];
  } catch (error) {
    console.error('[Session Storage] Error getting user session keys:', error);
    return [];
  }
}

/**
 * Delete session key metadata
 */
export async function deleteSessionKey(sessionKeyId: string): Promise<boolean> {
  try {
    let kvResult = true;
    let sessionKey: CircleSessionKey | null = null;

    if (isKvAvailable()) {
      const key = `${SESSION_KEY_PREFIX}${sessionKeyId}`;
      sessionKey = await getSessionKey(sessionKeyId);

      if (sessionKey) {
        // Remove from indexes
        if (sessionKey.walletId) {
          const walletKey = `${SESSION_KEY_BY_WALLET_PREFIX}${sessionKey.walletId}`;
          await kv.srem(walletKey, sessionKeyId);
        }

        if (sessionKey.userId) {
          const userKey = `${SESSION_KEY_BY_USER_PREFIX}${sessionKey.userId}`;
          await kv.srem(userKey, sessionKeyId);
        }
      }

      await kv.del(key);
    } else {
      kvResult = false;
    }

    await deleteSessionKeyFromSupabase(sessionKeyId).catch((error) => {
      console.error('[Session Storage] Supabase delete failed:', error);
    });

    return kvResult;
  } catch (error) {
    console.error('[Session Storage] Error deleting session key:', error);
    return false;
  }
}

/**
 * Update session key metadata
 */
export async function updateSessionKey(
  sessionKeyId: string,
  updates: Partial<CircleSessionKey>
): Promise<boolean> {
  try {
    const existing = await getSessionKey(sessionKeyId);
    if (!existing) return false;

    const updated = { ...existing, ...updates };
    return await storeSessionKey(sessionKeyId, updated as CircleSessionKey);
  } catch (error) {
    console.error('[Session Storage] Error updating session key:', error);
    return false;
  }
}

function isServerEnvironment() {
  return typeof window === 'undefined';
}

async function upsertSessionKeyInSupabase(sessionKey: CircleSessionKey) {
  if (!isServerEnvironment()) {
    return;
  }

  const { isSupabaseConfigured } = await import('@/lib/db/supabase');
  if (!isSupabaseConfigured()) {
    return;
  }

  const [userService, walletService, sessionKeyService] = await Promise.all([
    import('@/lib/db/services/users'),
    import('@/lib/db/services/wallets'),
    import('@/lib/db/services/sessionKeys'),
  ]);

  if (!sessionKey.userId) {
    return;
  }

  const userRecord = await userService.getOrCreateUser({
    circle_user_id: sessionKey.userId,
  });

  if (!userRecord) {
    return;
  }

  let walletRecordId: string | null = null;
  if (sessionKey.walletId) {
    const walletRecord = await walletService.getWalletByCircleId(sessionKey.walletId);
    walletRecordId = walletRecord?.id ?? null;
  }

  const existing = await sessionKeyService.getSessionKeyByCircleId(sessionKey.sessionKeyId);

  const payload = {
    user_id: userRecord.id,
    wallet_id: walletRecordId ?? undefined,
    circle_session_key_id: sessionKey.sessionKeyId,
    agent_id: sessionKey.agentId,
    agent_name: sessionKey.agentName,
    agent_description: sessionKey.agentDescription,
    permissions: sessionKey.permissions,
    spending_limit: sessionKey.permissions?.spendingLimit,
    spending_used: sessionKey.permissions?.spendingUsed,
    expires_at: new Date(sessionKey.expiresAt * 1000).toISOString(),
    status: sessionKey.status,
  };

  if (existing) {
    await sessionKeyService.updateSessionKey(existing.id, payload);
  } else {
    await sessionKeyService.createSessionKey(payload);
  }
}

async function deleteSessionKeyFromSupabase(sessionKeyId: string) {
  if (!isServerEnvironment()) {
    return;
  }

  const { isSupabaseConfigured } = await import('@/lib/db/supabase');
  if (!isSupabaseConfigured()) {
    return;
  }

  const sessionKeyService = await import('@/lib/db/services/sessionKeys');
  const existing = await sessionKeyService.getSessionKeyByCircleId(sessionKeyId);
  if (existing) {
    await sessionKeyService.deleteSessionKey(existing.id);
  }
}

async function getSessionKeyFromSupabase(sessionKeyId: string): Promise<CircleSessionKey | null> {
  if (!isServerEnvironment()) {
    return null;
  }

  const { isSupabaseConfigured } = await import('@/lib/db/supabase');
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { getSessionKeyByCircleId } = await import('@/lib/db/services/sessionKeys');
  const record = await getSessionKeyByCircleId(sessionKeyId);
  return record as unknown as CircleSessionKey | null;
}

async function getWalletSessionKeysFromSupabase(walletId: string): Promise<string[]> {
  if (!isServerEnvironment()) {
    return [];
  }

  const { isSupabaseConfigured } = await import('@/lib/db/supabase');
  if (!isSupabaseConfigured()) {
    return [];
  }

  const { getWalletSessionKeys } = await import('@/lib/db/services/sessionKeys');
  const records = await getWalletSessionKeys(walletId);
  return records.map((record) => record.circle_session_key_id);
}

async function getUserSessionKeysFromSupabase(userId: string): Promise<string[]> {
  if (!isServerEnvironment()) {
    return [];
  }

  const { isSupabaseConfigured } = await import('@/lib/db/supabase');
  if (!isSupabaseConfigured()) {
    return [];
  }

  const { getActiveUserSessionKeys } = await import('@/lib/db/services/sessionKeys');
  const records = await getActiveUserSessionKeys(userId);
  return records.map((record) => record.circle_session_key_id);
}

