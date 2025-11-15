/**
 * Server-Side Used Codes Storage
 * 
 * This module tracks which invite codes have been used to prevent reuse.
 * Uses file-based storage until database is implemented.
 */

import { promises as fs } from 'fs';
import path from 'path';

const USED_CODES_FILE = path.join(process.cwd(), 'data', 'used-invite-codes.json');

// Ensure data directory exists
async function ensureDataDir() {
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
 * Load all used codes from file
 */
export async function loadUsedCodes(): Promise<UsedCodeEntry[]> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(USED_CODES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist yet or is empty, return empty array
    return [];
  }
}

/**
 * Save used codes to file
 */
async function saveUsedCodes(codes: UsedCodeEntry[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(USED_CODES_FILE, JSON.stringify(codes, null, 2), 'utf-8');
}

/**
 * Check if a code has been used (server-side)
 */
export async function isCodeUsedOnServer(code: string): Promise<boolean> {
  const usedCodes = await loadUsedCodes();
  return usedCodes.some(entry => entry.code.toUpperCase() === code.toUpperCase());
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
  const usedCodes = await loadUsedCodes();
  
  // Double-check it's not already used
  const alreadyUsed = usedCodes.some(entry => entry.code.toUpperCase() === code.toUpperCase());
  if (alreadyUsed) {
    throw new Error('Code has already been used');
  }

  // Add to used codes
  const entry: UsedCodeEntry = {
    code: code.toUpperCase(),
    usedAt: new Date().toISOString(),
    ipAddress: metadata?.ipAddress,
    userAgent: metadata?.userAgent,
  };

  usedCodes.push(entry);
  await saveUsedCodes(usedCodes);
  
  console.log(`[Invite] Code ${code.toUpperCase()} marked as used at ${entry.usedAt}`);
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
  const usedCodes = await loadUsedCodes();
  const filtered = usedCodes.filter(entry => entry.code.toUpperCase() !== code.toUpperCase());
  
  if (filtered.length === usedCodes.length) {
    return false; // Code wasn't used
  }
  
  await saveUsedCodes(filtered);
  console.log(`[Invite Admin] Code ${code.toUpperCase()} has been reset`);
  return true;
}

/**
 * Admin function: Get all used codes
 */
export async function getAllUsedCodes(): Promise<UsedCodeEntry[]> {
  return await loadUsedCodes();
}

