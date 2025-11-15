/**
 * Invite Code System for Arcle Testers
 * 
 * Features:
 * - 20 unique codes for testers
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
];

// Get all invite codes from environment or fallback to default
export function getInviteCodes(): string[] {
  if (typeof window !== 'undefined') {
    // Client-side: codes should be validated server-side only
    return [];
  }
  
  // Server-side: Get from environment or use default
  const envCodes = process.env.INVITE_CODES;
  if (envCodes) {
    return envCodes.split(',').map(code => code.trim());
  }
  
  return DAILY_INVITE_CODES;
}

// Verify if a code is valid (server-side only)
export function isValidInviteCode(code: string): boolean {
  const validCodes = getInviteCodes();
  return validCodes.includes(code.toUpperCase().trim());
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
  const validCodes = DAILY_INVITE_CODES;
  
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

