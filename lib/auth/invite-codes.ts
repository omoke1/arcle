/**
 * Invite Code System for Arcle Testers
 * 
 * Features:
 * - 30 unique codes for testers
 * - One-time use per code
 * - localStorage-based verification
 * - Simple admin interface
 */

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

// Pre-generated invite codes (regenerate these daily)
// Format: CODE:YYYY-MM-DD (so you know when it was created)
export const DAILY_INVITE_CODES = [
  'ARC2K9M4', // Code 1
  'QW7N8PX3', // Code 2
  'FH5RJ6TY', // Code 3
  'VM4BK2ZL', // Code 4
  'DP9CG3WE', // Code 5
  'XN6TY8QR', // Code 6
  'JK4MW7VP', // Code 7
  'BL9FH2ZN', // Code 8
  'GT3YX5RC', // Code 9
  'PM8NJ6KW', // Code 10
  'ZK8QW3RH', // Code 11
  'TY6PL9DN', // Code 12
  'HS4VJ7XM', // Code 13
  'WR9BN2FK', // Code 14
  'CX5DG8YL', // Code 15
  'NM3ZT6QP', // Code 16
  'FJ7KR4WV', // Code 17
  'QL2MX9HB', // Code 18
  'RP8YN5CJ', // Code 19
  'VG4WT7ZD', // Code 20
  'R7V4JVY2', // Code 21
  'GRVDTQTJ', // Code 22
  'BEAGWP8S', // Code 23
  'FUN53U3E', // Code 24
  'PUHJEV8U', // Code 25
  'PTSWXBXB', // Code 26
  'HV7YSX5S', // Code 27
  'PXZZ8DVB', // Code 28
  '5MNKMJBQ', // Code 29
  'LUN2ZLX5', // Code 30
  // New codes added: 2024-11-18
  'QMV3SSXS', // Code 31
  'PGKM7ASS', // Code 32
  '8Z6BCUD4', // Code 33
  'CRKR5MR9', // Code 34
  'ANYQPV34', // Code 35
  'RTSHVBJC', // Code 36
  'KKYHVQYF', // Code 37
  'Y4XWPK4X', // Code 38
  'SYQH557M', // Code 39
  'JQNC5JNB', // Code 40
  // New codes added for user testing: 2025-11-15
  'AVZREXA6', // Code 41
  'QGLHNC7T', // Code 42
  'B8MPSBT8', // Code 43
  'SBAYW6K2', // Code 44
  'M8LHCE9X', // Code 45
  'X439VTSZ', // Code 46
  'EQN6NU5G', // Code 47
  '6ZYLEAX4', // Code 48
  'J48MYZFR', // Code 49
  '7TL97FVN', // Code 50
  // New codes added: 2025-11-20
  'G2LKFBXD', // Code 51
  '2F88PMVE', // Code 52
  '3NEMTDF7', // Code 53
  'X6JNNB2F', // Code 54
  'CW97FJ99', // Code 55
  'M4753KUP', // Code 56
  'ACUBEL3F', // Code 57
  'Q8XR8NMT', // Code 58
  '8JG6WWVA', // Code 59
  'NFT4WNJW', // Code 60
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

// Check if code has been used (localStorage)
export function isCodeUsed(code: string): boolean {
  if (typeof window === 'undefined') return false;
  
  const usedCodes = getUsedCodes();
  return usedCodes.includes(code.toUpperCase().trim());
}

// Get all used codes from localStorage
export function getUsedCodes(): string[] {
  if (typeof window === 'undefined') return [];
  
  const stored = localStorage.getItem('arcle_used_codes');
  return stored ? JSON.parse(stored) : [];
}

// Mark code as used
export function markCodeAsUsed(code: string): void {
  if (typeof window === 'undefined') return;
  
  const usedCodes = getUsedCodes();
  const upperCode = code.toUpperCase().trim();
  
  if (!usedCodes.includes(upperCode)) {
    usedCodes.push(upperCode);
    localStorage.setItem('arcle_used_codes', JSON.stringify(usedCodes));
    
    // Also store timestamp
    localStorage.setItem(`arcle_code_used_${upperCode}`, new Date().toISOString());
  }
}

// Check if user has valid access
export function hasValidAccess(): boolean {
  if (typeof window === 'undefined') return false;
  
  return localStorage.getItem('arcle_invite_verified') === 'true';
}

// Grant access to user
export function grantAccess(code: string): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem('arcle_invite_verified', 'true');
  localStorage.setItem('arcle_invite_code_used', code.toUpperCase());
  localStorage.setItem('arcle_access_granted_at', new Date().toISOString());
  
  markCodeAsUsed(code);
}

// Revoke access (for admin)
export function revokeAccess(): void {
  if (typeof window === 'undefined') return;
  
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

export function getInviteStats(): InviteStats {
  const usedCodes = getUsedCodes();
  const validCodes = getInviteCodes();
  
  const usedCodesList = usedCodes.map(code => ({
    code,
    usedAt: localStorage.getItem(`arcle_code_used_${code}`) || 'Unknown',
  }));
  
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

