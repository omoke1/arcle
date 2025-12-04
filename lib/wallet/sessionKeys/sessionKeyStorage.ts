/**
 * Secure Session Key Storage
 * 
 * Stores session key private keys securely
 * In production, use encrypted storage, HSM, or key management service
 */

import { kv } from '@vercel/kv';
import type { CircleSessionKey } from './sessionPermissions';

const SESSION_KEY_PREFIX = 'session_key:';
const ENCRYPTION_KEY = process.env.SESSION_KEY_ENCRYPTION_KEY || '';

/**
 * Store session key private key securely
 * 
 * In production, this should:
 * 1. Encrypt the private key before storing
 * 2. Use a key management service (AWS KMS, HashiCorp Vault, etc.)
 * 3. Never log or expose the private key
 */
export async function storeSessionKeyPrivateKey(
  sessionKeyId: string,
  privateKey: string
): Promise<void> {
  if (!ENCRYPTION_KEY) {
    console.warn('[Session Key Storage] No encryption key configured. Private keys should be encrypted.');
  }

  // TODO: Encrypt private key before storing
  // For now, store as-is (NOT RECOMMENDED FOR PRODUCTION)
  const encryptedKey = privateKey; // Placeholder - should encrypt

  const key = `${SESSION_KEY_PREFIX}${sessionKeyId}`;
  
  try {
    if (typeof kv !== 'undefined' && kv) {
      await kv.set(key, encryptedKey);
    } else {
      // Fallback to in-memory storage (NOT PERSISTENT)
      console.warn('[Session Key Storage] KV not available, using in-memory storage (not persistent)');
      (globalThis as any).__sessionKeyStorage = (globalThis as any).__sessionKeyStorage || {};
      (globalThis as any).__sessionKeyStorage[key] = encryptedKey;
    }
  } catch (error) {
    console.error('[Session Key Storage] Failed to store session key:', error);
    throw error;
  }
}

/**
 * Retrieve session key private key
 */
export async function getSessionKeyPrivateKey(
  sessionKeyId: string
): Promise<string | null> {
  const key = `${SESSION_KEY_PREFIX}${sessionKeyId}`;
  
  try {
    let encryptedKey: string | null = null;
    
    if (typeof kv !== 'undefined' && kv) {
      encryptedKey = await kv.get<string>(key);
    } else {
      // Fallback to in-memory storage
      encryptedKey = (globalThis as any).__sessionKeyStorage?.[key] || null;
    }

    if (!encryptedKey) {
      return null;
    }

    // TODO: Decrypt private key
    // For now, return as-is (assuming it's stored encrypted)
    const privateKey = encryptedKey; // Placeholder - should decrypt

    return privateKey;
  } catch (error) {
    console.error('[Session Key Storage] Failed to retrieve session key:', error);
    return null;
  }
}

/**
 * Delete session key private key
 */
export async function deleteSessionKeyPrivateKey(
  sessionKeyId: string
): Promise<void> {
  const key = `${SESSION_KEY_PREFIX}${sessionKeyId}`;
  
  try {
    if (typeof kv !== 'undefined' && kv) {
      await kv.del(key);
    } else {
      // Fallback to in-memory storage
      delete (globalThis as any).__sessionKeyStorage?.[key];
    }
  } catch (error) {
    console.error('[Session Key Storage] Failed to delete session key:', error);
    throw error;
  }
}

