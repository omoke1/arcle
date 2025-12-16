/**
 * Invite Code System for Arcle Testers
 * 
 * Features:
 * - 30 unique codes for testers
 * - One-time use per code
 * - Supabase-based verification
 * - Simple admin interface
 */

import { loadPreference, savePreference } from "@/lib/supabase-data";

// Invite code batch metadata
// When you generate a new batch of codes, update INVITE_BATCH_CREATED_AT
// so that codes automatically expire 24 hours after creation if not used.
const INVITE_BATCH_CREATED_AT = "2025-12-16T04:56:09.978Z";
const INVITE_CODE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function isInviteBatchExpired(): boolean {
  if (!INVITE_BATCH_CREATED_AT) return false;
  const createdAt = new Date(INVITE_BATCH_CREATED_AT).getTime();
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt > INVITE_CODE_TTL_MS;
}

// Generate random invite code (8 characters, alphanumeric, readable)
function generateCode(): string {
  // Exclude confusing characters: 0, O, I, l, 1
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Pre-generated invite codes (regenerate these as needed)
// Rules:
// - 8 characters
// - Uppercase
// - Alphanumeric using readable characters only (no 0, O, I, l, 1)
// - Each code can be used once
// - Codes expire 24 hours after INVITE_BATCH_CREATED_AT if not used
export const DAILY_INVITE_CODES: string[] = [
  "22ZXUGBP", // Code 1
  "ZMFLLHWX", // Code 2
  "A8MT8TUS", // Code 3
  "BM55C5SR", // Code 4
  "VYQBGB8N", // Code 5
  "5ZDCLQCH", // Code 6
  "YJ6JXXFU", // Code 7
  "RQ95BB9W", // Code 8
  "MBS4XSCX", // Code 9
  "9QCR9Y3H", // Code 10
];

// Get all invite codes from environment or fallback to default
export function getInviteCodes(): string[] {
  if (typeof window !== 'undefined') {
    // Client-side: codes should be validated server-side only
    return [];
  }

  // Server-side: ALWAYS start with DAILY_INVITE_CODES as the base
  // This ensures new codes added to DAILY_INVITE_CODES always work
  // Environment variable codes are ADDED to the base, not replacing it
  const allCodes = new Set<string>(DAILY_INVITE_CODES);

  // Add environment codes if they exist (for additional codes beyond DAILY_INVITE_CODES)
  const envCodes = process.env.INVITE_CODES;
  if (envCodes) {
    // Add environment codes to the set (automatically handles duplicates)
    envCodes.split(',').forEach(code => {
      const trimmed = code.trim().toUpperCase();
      if (trimmed) {
        allCodes.add(trimmed);
      }
    });
  }

  // Log for debugging (only in development or when explicitly enabled)
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_INVITE_CODES === 'true') {
    console.log(`[Invite Codes] Total codes available: ${allCodes.size} (${DAILY_INVITE_CODES.length} from DAILY_INVITE_CODES + ${envCodes ? envCodes.split(',').length : 0} from env)`);
  }

  return Array.from(allCodes);
}

// Verify if a code is valid (server-side only)
export function isValidInviteCode(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }

  // Enforce batch-level expiry (24h from INVITE_BATCH_CREATED_AT)
  if (isInviteBatchExpired()) {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_INVITE_CODES === 'true') {
      console.log("[Invite Codes] Current batch has expired; no codes are valid anymore.");
    }
    return false;
  }

  const trimmedCode = code.toUpperCase().trim();
  if (!trimmedCode || trimmedCode.length !== 8) {
    return false;
  }

  const validCodes = getInviteCodes();
  const isValid = validCodes.includes(trimmedCode);

  // Log for debugging (only in development or when explicitly enabled)
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_INVITE_CODES === 'true') {
    console.log(`[Invite Code Validation] Code: ${trimmedCode}, Valid: ${isValid}, Total codes: ${validCodes.length}`);
    if (!isValid) {
      console.log(`[Invite Code Validation] Code not found. First 5 codes: ${validCodes.slice(0, 5).join(', ')}`);
    }
  }

  return isValid;
}

// Check if code has been used (Supabase)
export async function isCodeUsed(code: string, userId?: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const usedCodes = await getUsedCodes(userId);
  return usedCodes.includes(code.toUpperCase().trim());
}

// Get all used codes from Supabase
export async function getUsedCodes(userId?: string): Promise<string[]> {
  if (typeof window === 'undefined') return [];

  // Try to get userId if not provided
  if (!userId) {
    // Try to get from a "current_user_id" preference
    try {
      const currentUserPref = await loadPreference({ userId: "current", key: "current_user_id" }).catch(() => null);
      if (currentUserPref?.value) {
        userId = currentUserPref.value;
      }
    } catch (error) {
      // Ignore
    }
  }

  // If we have userId, try Supabase
  if (userId) {
    try {
      const pref = await loadPreference({ userId, key: "used_invite_codes" });
      if (pref?.value && Array.isArray(pref.value)) {
        return pref.value;
      }
    } catch (error) {
      console.warn("[InviteCodes] Failed to load from Supabase, trying localStorage migration:", error);
    }
  }

  // Migration fallback: try localStorage
  const stored = localStorage.getItem('arcle_used_codes');
  if (stored) {
    const codes = JSON.parse(stored);
    if (Array.isArray(codes)) {
      // Migrate to Supabase if userId is available
      if (userId) {
        try {
          await savePreference({ userId, key: "used_invite_codes", value: codes });
          localStorage.removeItem('arcle_used_codes');
        } catch (error) {
          console.error("[InviteCodes] Failed to migrate used codes to Supabase:", error);
        }
      }
      return codes;
    }
  }

  return [];
}

// Mark code as used
export async function markCodeAsUsed(code: string, userId?: string): Promise<void> {
  if (typeof window === 'undefined') return;

  // Try to get userId if not provided
  if (!userId) {
    try {
      const currentUserPref = await loadPreference({ userId: "current", key: "current_user_id" }).catch(() => null);
      if (currentUserPref?.value) {
        userId = currentUserPref.value;
      }
    } catch (error) {
      // Ignore
    }
  }

  const usedCodes = await getUsedCodes(userId);
  const upperCode = code.toUpperCase().trim();

  if (!usedCodes.includes(upperCode)) {
    usedCodes.push(upperCode);

    // Save to Supabase if userId is available
    if (userId) {
      try {
        await savePreference({ userId, key: "used_invite_codes", value: usedCodes });
        await savePreference({ userId, key: `code_used_${upperCode}`, value: new Date().toISOString() });
      } catch (error) {
        console.error("[InviteCodes] Failed to save to Supabase, using localStorage fallback:", error);
        // Migration fallback
        localStorage.setItem('arcle_used_codes', JSON.stringify(usedCodes));
        localStorage.setItem(`arcle_code_used_${upperCode}`, new Date().toISOString());
      }
    } else {
      // No userId - use localStorage only
      localStorage.setItem('arcle_used_codes', JSON.stringify(usedCodes));
      localStorage.setItem(`arcle_code_used_${upperCode}`, new Date().toISOString());
    }
  }
}

// Check if user has valid access
export async function hasValidAccess(userId?: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // Try to get userId if not provided
  if (!userId) {
    try {
      const currentUserPref = await loadPreference({ userId: "current", key: "current_user_id" }).catch(() => null);
      if (currentUserPref?.value) {
        userId = currentUserPref.value;
      }
    } catch (error) {
      // Ignore
    }
  }

  // Try Supabase first
  if (userId) {
    try {
      const pref = await loadPreference({ userId, key: "invite_verified" });
      if (pref?.value === true || pref?.value === "true") {
        return true;
      }
    } catch (error) {
      console.warn("[InviteCodes] Failed to load from Supabase, trying localStorage migration:", error);
    }
  }

  // Migration fallback: try localStorage
  const stored = localStorage.getItem('arcle_invite_verified');
  if (stored === 'true') {
    // Migrate to Supabase if userId is available
    if (userId) {
      try {
        await savePreference({ userId, key: "invite_verified", value: true });
        const code = localStorage.getItem('arcle_invite_code_used');
        const grantedAt = localStorage.getItem('arcle_access_granted_at');
        if (code) {
          await savePreference({ userId, key: "invite_code_used", value: code });
        }
        if (grantedAt) {
          await savePreference({ userId, key: "access_granted_at", value: grantedAt });
        }
      } catch (error) {
        console.error("[InviteCodes] Failed to migrate invite verification to Supabase:", error);
      }
    }
    return true;
  }

  return false;
}

// Grant access to user
export async function grantAccess(code: string, userId?: string): Promise<void> {
  if (typeof window === 'undefined') return;

  // Try to get userId if not provided
  if (!userId) {
    try {
      const currentUserPref = await loadPreference({ userId: "current", key: "current_user_id" }).catch(() => null);
      if (currentUserPref?.value) {
        userId = currentUserPref.value;
      }
    } catch (error) {
      // Ignore
    }
  }

  const upperCode = code.toUpperCase().trim();

  // Save to Supabase if userId is available
  if (userId) {
    try {
      await savePreference({ userId, key: "invite_verified", value: true });
      await savePreference({ userId, key: "invite_code_used", value: upperCode });
      await savePreference({ userId, key: "access_granted_at", value: new Date().toISOString() });
    } catch (error) {
      console.error("[InviteCodes] Failed to save to Supabase, using localStorage fallback:", error);
      // Migration fallback
      localStorage.setItem('arcle_invite_verified', 'true');
      localStorage.setItem('arcle_invite_code_used', upperCode);
      localStorage.setItem('arcle_access_granted_at', new Date().toISOString());
    }
  } else {
    // No userId - use localStorage only
    localStorage.setItem('arcle_invite_verified', 'true');
    localStorage.setItem('arcle_invite_code_used', upperCode);
    localStorage.setItem('arcle_access_granted_at', new Date().toISOString());
  }

  await markCodeAsUsed(code, userId);
}

// Revoke access (for admin)
export async function revokeAccess(userId?: string): Promise<void> {
  if (typeof window === 'undefined') return;

  // Try to get userId if not provided
  if (!userId) {
    try {
      const currentUserPref = await loadPreference({ userId: "current", key: "current_user_id" }).catch(() => null);
      if (currentUserPref?.value) {
        userId = currentUserPref.value;
      }
    } catch (error) {
      // Ignore
    }
  }

  // Remove from Supabase if userId is available
  if (userId) {
    try {
      // Note: We can't delete preferences easily, so we'll set them to false/null
      await savePreference({ userId, key: "invite_verified", value: false });
    } catch (error) {
      console.error("[InviteCodes] Failed to revoke in Supabase:", error);
    }
  }

  // Also clear localStorage
  localStorage.removeItem('arcle_invite_verified');
  localStorage.removeItem('arcle_invite_code_used');
  localStorage.removeItem('arcle_access_granted_at');
}

// Get stats for admin
export interface InviteStats {
  totalCodes: number;
  usedCodes: number;
  remainingCodes: number;
  usedCodesList: Array<{
    code: string;
    usedAt: string;
  }>;
}

export async function getInviteStats(userId?: string): Promise<InviteStats> {
  const usedCodes = await getUsedCodes(userId);
  const validCodes = getInviteCodes();

  // Get timestamps for used codes
  const usedCodesList = await Promise.all(
    usedCodes.map(async (code) => {
      let usedAt = 'Unknown';

      // Try Supabase first
      if (userId) {
        try {
          const pref = await loadPreference({ userId, key: `code_used_${code}` });
          if (pref?.value) {
            usedAt = pref.value;
          }
        } catch (error) {
          // Ignore
        }
      }

      // Migration fallback: try localStorage
      if (usedAt === 'Unknown' && typeof window !== 'undefined') {
        const stored = localStorage.getItem(`arcle_code_used_${code}`);
        if (stored) {
          usedAt = stored;
        }
      }

      return { code, usedAt };
    })
  );

  return {
    totalCodes: validCodes.length,
    usedCodes: usedCodes.length,
    remainingCodes: validCodes.length - usedCodes.filter(c => validCodes.includes(c)).length,
    usedCodesList,
  };
}

// Generate new set of codes (for admin/daily refresh)
export function generateNewCodeSet(count: number = 10): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(generateCode());
  }
  return Array.from(codes);
}

