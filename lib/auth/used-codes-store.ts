/**
 * Server-Side Used Codes Storage
 * 
 * This module tracks which invite codes have been used to prevent reuse.
 * Supports:
 * - Vercel KV (Redis) - when KV_URL/KV_REST_API_URL is set
 * - Standard Redis (Redis Labs, etc.) - when REDIS_URL is set
 * - File system fallback - for local dev or when Redis is not configured
 */

import { kv } from '@vercel/kv';
import { createClient } from 'redis';
import { promises as fs } from 'fs';
import path from 'path';

// KV keys
const USED_CODES_SET_KEY = 'arcle:used-invite-codes:set';
const USED_CODE_METADATA_PREFIX = 'arcle:used-invite-code:';

// Fallback file storage for local dev (when Redis is not configured)
const isServerless = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const USED_CODES_FILE = isServerless 
  ? path.join('/tmp', 'used-invite-codes.json')
  : path.join(process.cwd(), 'data', 'used-invite-codes.json');

// Redis client singleton (for standard Redis)
let redisClient: ReturnType<typeof createClient> | null = null;

// Get or create Redis client (for standard Redis, not Vercel KV)
async function getRedisClient() {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  try {
    redisClient = createClient({
      url: redisUrl,
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] Client error:', err);
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('[Redis] Failed to connect:', error);
    return null;
  }
}

// Check if Vercel KV is available
function isVercelKvAvailable(): boolean {
  try {
    const hasKvConfig = !!(process.env.KV_URL || process.env.KV_REST_API_URL || process.env.KV_REST_API_TOKEN);
    
    if (!hasKvConfig) {
      return false;
    }
    
    if (typeof kv === 'undefined' || kv === null) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

// Check if standard Redis is available
function isStandardRedisAvailable(): boolean {
  return !!process.env.REDIS_URL;
}

// Check if any Redis is available
function isRedisAvailable(): boolean {
  return isVercelKvAvailable() || isStandardRedisAvailable();
}

// Ensure data directory exists (only needed for local dev file fallback)
async function ensureDataDir() {
  if (isServerless) {
    return;
  }
  
  const dataDir = path.join(process.cwd(), 'data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Interface for used code tracking
export interface UsedCodeEntry {
  code: string;
  usedAt: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Load all used codes (Redis or file fallback)
 */
async function loadUsedCodes(): Promise<UsedCodeEntry[]> {
  // Try Vercel KV first
  if (isVercelKvAvailable()) {
    try {
      const codes = await kv.smembers(USED_CODES_SET_KEY) as string[];
      const entries: UsedCodeEntry[] = [];
      
      for (const code of codes) {
        const metadataKey = `${USED_CODE_METADATA_PREFIX}${code}`;
        const metadata = await kv.get<Omit<UsedCodeEntry, 'code'>>(metadataKey);
        
        if (metadata) {
          entries.push({ code, ...metadata });
        } else {
          entries.push({ code, usedAt: new Date().toISOString() });
        }
      }
      
      return entries;
    } catch (error) {
      console.error('[Used Codes] Vercel KV error, trying standard Redis:', error);
    }
  }

  // Try standard Redis
  if (isStandardRedisAvailable()) {
    try {
      const client = await getRedisClient();
      if (client) {
        const codes = await client.sMembers(USED_CODES_SET_KEY);
        const entries: UsedCodeEntry[] = [];
        
        for (const code of codes) {
          const metadataKey = `${USED_CODE_METADATA_PREFIX}${code}`;
          const metadataStr = await client.get(metadataKey);
          
          if (metadataStr) {
            try {
              const metadata = JSON.parse(metadataStr);
              entries.push({ code, ...metadata });
            } catch {
              entries.push({ code, usedAt: new Date().toISOString() });
            }
          } else {
            entries.push({ code, usedAt: new Date().toISOString() });
          }
        }
        
        return entries;
      }
    } catch (error) {
      console.error('[Used Codes] Standard Redis error, falling back to file:', error);
    }
  }
  
  // File fallback
  try {
    await ensureDataDir();
    const data = await fs.readFile(USED_CODES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

/**
 * Save used codes (Redis or file fallback)
 */
async function saveUsedCodes(codes: UsedCodeEntry[]): Promise<void> {
  // Try Vercel KV first
  if (isVercelKvAvailable()) {
    try {
      await kv.del(USED_CODES_SET_KEY);
      
      for (const entry of codes) {
        const normalizedCode = entry.code.toUpperCase();
        await kv.sadd(USED_CODES_SET_KEY, normalizedCode);
        
        const metadataKey = `${USED_CODE_METADATA_PREFIX}${normalizedCode}`;
        await kv.set(metadataKey, {
          usedAt: entry.usedAt,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        });
      }
      
      return;
    } catch (error) {
      console.error('[Used Codes] Vercel KV error saving, trying standard Redis:', error);
    }
  }

  // Try standard Redis
  if (isStandardRedisAvailable()) {
    try {
      const client = await getRedisClient();
      if (client) {
        await client.del(USED_CODES_SET_KEY);
        
        for (const entry of codes) {
          const normalizedCode = entry.code.toUpperCase();
          await client.sAdd(USED_CODES_SET_KEY, normalizedCode);
          
          const metadataKey = `${USED_CODE_METADATA_PREFIX}${normalizedCode}`;
          await client.set(metadataKey, JSON.stringify({
            usedAt: entry.usedAt,
            ipAddress: entry.ipAddress,
            userAgent: entry.userAgent,
          }));
        }
        
        return;
      }
    } catch (error) {
      console.error('[Used Codes] Standard Redis error saving, falling back to file:', error);
    }
  }
  
  // File fallback
  await ensureDataDir();
  await fs.writeFile(USED_CODES_FILE, JSON.stringify(codes, null, 2), 'utf-8');
}

/**
 * Check if a code has been used (server-side)
 */
export async function isCodeUsedOnServer(code: string): Promise<boolean> {
  const normalizedCode = code.toUpperCase().trim();
  
  // Try Vercel KV first
  if (isVercelKvAvailable()) {
    try {
      const isUsed = await kv.sismember(USED_CODES_SET_KEY, normalizedCode);
      
      if (process.env.NODE_ENV === 'development' || process.env.DEBUG_INVITE_CODES === 'true') {
        if (isUsed) {
          const metadataKey = `${USED_CODE_METADATA_PREFIX}${normalizedCode}`;
          const metadata = await kv.get<Omit<UsedCodeEntry, 'code'>>(metadataKey);
          console.log(`[Used Codes] Code ${normalizedCode} is marked as used. Used at: ${metadata?.usedAt}, IP: ${metadata?.ipAddress}`);
        } else {
          const totalUsed = await kv.scard(USED_CODES_SET_KEY);
          console.log(`[Used Codes] Code ${normalizedCode} is NOT in used codes list. Total used codes: ${totalUsed}`);
        }
      }
      
      return isUsed === 1;
    } catch (error) {
      console.error('[Used Codes] Vercel KV error checking, trying standard Redis:', error);
    }
  }

  // Try standard Redis
  if (isStandardRedisAvailable()) {
    try {
      const client = await getRedisClient();
      if (client) {
        const isUsedNum = await client.sIsMember(USED_CODES_SET_KEY, normalizedCode);
        const isUsed = isUsedNum === 1; // Convert number (0 or 1) to boolean
        
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG_INVITE_CODES === 'true') {
          if (isUsed) {
            const metadataKey = `${USED_CODE_METADATA_PREFIX}${normalizedCode}`;
            const metadataStr = await client.get(metadataKey);
            if (metadataStr) {
              const metadata = JSON.parse(metadataStr);
              console.log(`[Used Codes] Code ${normalizedCode} is marked as used. Used at: ${metadata?.usedAt}, IP: ${metadata?.ipAddress}`);
            }
          } else {
            const totalUsed = await client.sCard(USED_CODES_SET_KEY);
            console.log(`[Used Codes] Code ${normalizedCode} is NOT in used codes list. Total used codes: ${totalUsed}`);
          }
        }
        
        return isUsed;
      }
    } catch (error) {
      console.error('[Used Codes] Standard Redis error checking, falling back to file:', error);
    }
  }
  
  // File fallback
  const usedCodes = await loadUsedCodes();
  const isUsed = usedCodes.some(entry => entry.code.toUpperCase() === normalizedCode);
  
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_INVITE_CODES === 'true') {
    if (isUsed) {
      const entry = usedCodes.find(e => e.code.toUpperCase() === normalizedCode);
      console.log(`[Used Codes] Code ${normalizedCode} is marked as used. Used at: ${entry?.usedAt}, IP: ${entry?.ipAddress}`);
    } else {
      console.log(`[Used Codes] Code ${normalizedCode} is NOT in used codes list. Total used codes: ${usedCodes.length}`);
    }
  }
  
  return isUsed;
}

/**
 * Mark a code as used (server-side)
 */
export async function markCodeAsUsedOnServer(
  code: string,
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  const normalizedCode = code.toUpperCase().trim();
  
  // Double-check it's not already used
  const alreadyUsed = await isCodeUsedOnServer(normalizedCode);
  if (alreadyUsed) {
    throw new Error('Code has already been used');
  }

  // Create entry
  const entry: UsedCodeEntry = {
    code: normalizedCode,
    usedAt: new Date().toISOString(),
    ipAddress: metadata?.ipAddress,
    userAgent: metadata?.userAgent,
  };

  // Try Vercel KV first
  if (isVercelKvAvailable()) {
    try {
      await kv.sadd(USED_CODES_SET_KEY, normalizedCode);
      
      const metadataKey = `${USED_CODE_METADATA_PREFIX}${normalizedCode}`;
      await kv.set(metadataKey, {
        usedAt: entry.usedAt,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      });
      
      console.log(`[Invite] Code ${normalizedCode} marked as used at ${entry.usedAt} (Vercel KV)`);
      return;
    } catch (error) {
      console.error('[Used Codes] Vercel KV error marking as used, trying standard Redis:', error);
    }
  }

  // Try standard Redis
  if (isStandardRedisAvailable()) {
    try {
      const client = await getRedisClient();
      if (client) {
        await client.sAdd(USED_CODES_SET_KEY, normalizedCode);
        
        const metadataKey = `${USED_CODE_METADATA_PREFIX}${normalizedCode}`;
        await client.set(metadataKey, JSON.stringify({
          usedAt: entry.usedAt,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        }));
        
        console.log(`[Invite] Code ${normalizedCode} marked as used at ${entry.usedAt} (Standard Redis)`);
        return;
      }
    } catch (error) {
      console.error('[Used Codes] Standard Redis error marking as used, falling back to file:', error);
    }
  }
  
  // File fallback
  const usedCodes = await loadUsedCodes();
  usedCodes.push(entry);
  await saveUsedCodes(usedCodes);
  
  console.log(`[Invite] Code ${normalizedCode} marked as used at ${entry.usedAt} (file)`);
}

/**
 * Get usage statistics
 */
export async function getUsageStats(): Promise<{
  totalUsed: number;
  recentUsage: UsedCodeEntry[];
}> {
  const usedCodes = await loadUsedCodes();
  
  // Sort by date (most recent first)
  const sorted = [...usedCodes].sort((a, b) => 
    new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime()
  );
  
  return {
    totalUsed: usedCodes.length,
    recentUsage: sorted.slice(0, 10), // Last 10 uses
  };
}

/**
 * Admin function: Reset a specific code (use with caution)
 */
export async function resetCode(code: string): Promise<boolean> {
  const normalizedCode = code.toUpperCase().trim();
  
  // Try Vercel KV first
  if (isVercelKvAvailable()) {
    try {
      const exists = await kv.sismember(USED_CODES_SET_KEY, normalizedCode);
      if (exists === 0) {
        return false;
      }
      
      await kv.srem(USED_CODES_SET_KEY, normalizedCode);
      const metadataKey = `${USED_CODE_METADATA_PREFIX}${normalizedCode}`;
      await kv.del(metadataKey);
      
      console.log(`[Invite Admin] Code ${normalizedCode} has been reset (Vercel KV)`);
      return true;
    } catch (error) {
      console.error('[Used Codes] Vercel KV error resetting, trying standard Redis:', error);
    }
  }

  // Try standard Redis
  if (isStandardRedisAvailable()) {
    try {
      const client = await getRedisClient();
      if (client) {
        const existsNum = await client.sIsMember(USED_CODES_SET_KEY, normalizedCode);
        if (existsNum === 0) {
          return false;
        }
        
        await client.sRem(USED_CODES_SET_KEY, normalizedCode);
        const metadataKey = `${USED_CODE_METADATA_PREFIX}${normalizedCode}`;
        await client.del(metadataKey);
        
        console.log(`[Invite Admin] Code ${normalizedCode} has been reset (Standard Redis)`);
        return true;
      }
    } catch (error) {
      console.error('[Used Codes] Standard Redis error resetting, falling back to file:', error);
    }
  }
  
  // File fallback
  const usedCodes = await loadUsedCodes();
  const filtered = usedCodes.filter(entry => entry.code.toUpperCase() !== normalizedCode);
  
  if (filtered.length === usedCodes.length) {
    return false;
  }
  
  await saveUsedCodes(filtered);
  console.log(`[Invite Admin] Code ${normalizedCode} has been reset (file)`);
  return true;
}

/**
 * Admin function: Get all used codes
 */
export async function getAllUsedCodes(): Promise<UsedCodeEntry[]> {
  return await loadUsedCodes();
}

/**
 * Admin function: Clear all used codes (use with extreme caution)
 */
export async function clearAllUsedCodes(): Promise<void> {
  // Try Vercel KV first
  if (isVercelKvAvailable()) {
    try {
      const codes = await kv.smembers(USED_CODES_SET_KEY) as string[];
      
      for (const code of codes) {
        const metadataKey = `${USED_CODE_METADATA_PREFIX}${code}`;
        await kv.del(metadataKey);
      }
      
      await kv.del(USED_CODES_SET_KEY);
      console.log('[Invite Admin] All used codes have been cleared (Vercel KV)');
      return;
    } catch (error) {
      console.error('[Used Codes] Vercel KV error clearing, trying standard Redis:', error);
    }
  }

  // Try standard Redis
  if (isStandardRedisAvailable()) {
    try {
      const client = await getRedisClient();
      if (client) {
        const codes = await client.sMembers(USED_CODES_SET_KEY);
        
        for (const code of codes) {
          const metadataKey = `${USED_CODE_METADATA_PREFIX}${code}`;
          await client.del(metadataKey);
        }
        
        await client.del(USED_CODES_SET_KEY);
        console.log('[Invite Admin] All used codes have been cleared (Standard Redis)');
        return;
      }
    } catch (error) {
      console.error('[Used Codes] Standard Redis error clearing, falling back to file:', error);
    }
  }
  
  // File fallback
  await ensureDataDir();
  await fs.writeFile(USED_CODES_FILE, JSON.stringify([], null, 2), 'utf-8');
  console.log('[Invite Admin] All used codes have been cleared (file)');
}
