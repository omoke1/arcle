/**
 * Server-Side Used Codes Storage
 * 
 * This module tracks which invite codes have been used to prevent reuse.
 * Uses Vercel KV (Redis) for persistent storage on Vercel, falls back to file system for local dev.
 */

import { kv } from '@vercel/kv';
import { promises as fs } from 'fs';
import path from 'path';

// KV keys
const USED_CODES_SET_KEY = 'arcle:used-invite-codes:set';
const USED_CODE_METADATA_PREFIX = 'arcle:used-invite-code:';

// Fallback file storage for local dev (when KV is not configured)
const isServerless = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const USED_CODES_FILE = isServerless 
  ? path.join('/tmp', 'used-invite-codes.json')
  : path.join(process.cwd(), 'data', 'used-invite-codes.json');

// Check if KV is available and properly configured
function isKvAvailable(): boolean {
  try {
    // KV is available if KV_URL or KV_REST_API_URL is set
    // Vercel automatically provides these when KV is configured
    const hasKvConfig = !!(process.env.KV_URL || process.env.KV_REST_API_URL || process.env.KV_REST_API_TOKEN);
    
    if (!hasKvConfig) {
      return false;
    }
    
    // Try to access kv to ensure it's initialized
    // This will throw if KV is not properly configured
    if (typeof kv === 'undefined' || kv === null) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
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
 * Load all used codes (KV or file fallback)
 */
async function loadUsedCodes(): Promise<UsedCodeEntry[]> {
  if (isKvAvailable()) {
    try {
      // Get all codes from KV set
      const codes = await kv.smembers<string>(USED_CODES_SET_KEY);
      
      // Load metadata for each code
      const entries: UsedCodeEntry[] = [];
      for (const code of codes) {
        const metadataKey = `${USED_CODE_METADATA_PREFIX}${code}`;
        const metadata = await kv.get<Omit<UsedCodeEntry, 'code'>>(metadataKey);
        
        if (metadata) {
          entries.push({
            code,
            ...metadata,
          });
        } else {
          // Fallback: code exists but no metadata
          entries.push({
            code,
            usedAt: new Date().toISOString(),
          });
        }
      }
      
      return entries;
    } catch (error) {
      console.error('[Used Codes] KV error, falling back to file:', error);
      // Fall through to file fallback
    }
  }
  
  // File fallback (local dev or KV not configured)
  try {
    await ensureDataDir();
    const data = await fs.readFile(USED_CODES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist yet, return empty array
    return [];
  }
}

/**
 * Save used codes (KV or file fallback)
 */
async function saveUsedCodes(codes: UsedCodeEntry[]): Promise<void> {
  if (isKvAvailable()) {
    try {
      // Clear existing set
      await kv.del(USED_CODES_SET_KEY);
      
      // Add all codes to set and store metadata
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
      console.error('[Used Codes] KV error saving, falling back to file:', error);
      // Fall through to file fallback
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
  
  if (isKvAvailable()) {
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
      console.error('[Used Codes] KV error checking, falling back to file:', error);
      // Fall through to file fallback
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

  if (isKvAvailable()) {
    try {
      // Add to set
      await kv.sadd(USED_CODES_SET_KEY, normalizedCode);
      
      // Store metadata
      const metadataKey = `${USED_CODE_METADATA_PREFIX}${normalizedCode}`;
      await kv.set(metadataKey, {
        usedAt: entry.usedAt,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      });
      
      console.log(`[Invite] Code ${normalizedCode} marked as used at ${entry.usedAt} (KV)`);
      return;
    } catch (error) {
      console.error('[Used Codes] KV error marking as used, falling back to file:', error);
      // Fall through to file fallback
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
  
  if (isKvAvailable()) {
    try {
      const exists = await kv.sismember(USED_CODES_SET_KEY, normalizedCode);
      if (exists === 0) {
        return false; // Code wasn't used
      }
      
      // Remove from set
      await kv.srem(USED_CODES_SET_KEY, normalizedCode);
      
      // Remove metadata
      const metadataKey = `${USED_CODE_METADATA_PREFIX}${normalizedCode}`;
      await kv.del(metadataKey);
      
      console.log(`[Invite Admin] Code ${normalizedCode} has been reset (KV)`);
      return true;
    } catch (error) {
      console.error('[Used Codes] KV error resetting, falling back to file:', error);
      // Fall through to file fallback
    }
  }
  
  // File fallback
  const usedCodes = await loadUsedCodes();
  const filtered = usedCodes.filter(entry => entry.code.toUpperCase() !== normalizedCode);
  
  if (filtered.length === usedCodes.length) {
    return false; // Code wasn't used
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
 * This will reset all used codes, allowing all codes to be used again
 */
export async function clearAllUsedCodes(): Promise<void> {
  if (isKvAvailable()) {
    try {
      // Get all codes first
      const codes = await kv.smembers<string>(USED_CODES_SET_KEY);
      
      // Delete metadata for each code
      for (const code of codes) {
        const metadataKey = `${USED_CODE_METADATA_PREFIX}${code}`;
        await kv.del(metadataKey);
      }
      
      // Delete the set
      await kv.del(USED_CODES_SET_KEY);
      
      console.log('[Invite Admin] All used codes have been cleared (KV)');
      return;
    } catch (error) {
      console.error('[Used Codes] KV error clearing, falling back to file:', error);
      // Fall through to file fallback
    }
  }
  
  // File fallback
  await ensureDataDir();
  await fs.writeFile(USED_CODES_FILE, JSON.stringify([], null, 2), 'utf-8');
  console.log('[Invite Admin] All used codes have been cleared (file)');
}
