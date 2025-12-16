/**
 * Secure Session Key Storage
 * 
 * Stores session key private keys securely
 * In production, use encrypted storage, HSM, or key management service
 */

import { kv } from '@vercel/kv';
import type { CircleSessionKey } from './sessionPermissions';
import crypto from 'crypto';

const SESSION_KEY_PREFIX = 'session_key:';
// Use a fixed key for dev if env var is missing (WARN: Not for production)
const ENCRYPTION_KEY = process.env.SESSION_KEY_ENCRYPTION_KEY || 'dev-only-fallback-key-32-chars!!';
const ALGORITHM = 'aes-256-cbc';

// Ensure key is 32 bytes
function getEncryptionKey(): Buffer {
  return crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift()!, 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Helper to get KV client (supports mock for testing)
function getKv() {
  return (globalThis as any).mockKv || kv;
}

/**
 * Store session key private key securely
 * 
 * Encrypts the private key before storing in KV.
 */
export async function storeSessionKeyPrivateKey(
  sessionKeyId: string,
  privateKey: string
): Promise<void> {
  if (!process.env.SESSION_KEY_ENCRYPTION_KEY) {
    console.warn('[Session Key Storage] No encryption key configured. Using dev fallback (UNSAFE for production).');
  }

  const encryptedKey = encrypt(privateKey);
  const key = `${SESSION_KEY_PREFIX}${sessionKeyId}`;

  try {
    const client = getKv();
    if (client) {
      await client.set(key, encryptedKey);
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
 * 
 * Decrypts the private key after retrieval.
 */
export async function getSessionKeyPrivateKey(
  sessionKeyId: string
): Promise<string | null> {
  const key = `${SESSION_KEY_PREFIX}${sessionKeyId}`;

  try {
    let encryptedKey: string | null = null;
    const client = getKv();

    if (client) {
      encryptedKey = await client.get(key) as string | null;
    } else {
      // Fallback to in-memory storage
      encryptedKey = (globalThis as any).__sessionKeyStorage?.[key] || null;
    }

    if (!encryptedKey) {
      return null;
    }

    try {
      return decrypt(encryptedKey);
    } catch (error) {
      console.error('[Session Key Storage] Failed to decrypt session key:', error);
      return null;
    }
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
    const client = getKv();
    if (client) {
      await client.del(key);
    } else {
      // Fallback to in-memory storage
      delete (globalThis as any).__sessionKeyStorage?.[key];
    }
  } catch (error) {
    console.error('[Session Key Storage] Failed to delete session key:', error);
    throw error;
  }
}

