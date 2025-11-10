/**
 * Letter of Credit Service
 * 
 * Manages letters of credit for international trade
 */

import crypto from "crypto";

export interface LetterOfCredit {
  id: string;
  lcNumber: string;
  beneficiary: string; // Beneficiary address or name
  beneficiaryAddress?: string; // Wallet address
  amount: string;
  currency: string;
  description?: string;
  expiryDate: string; // ISO date string
  status: "draft" | "issued" | "accepted" | "executed" | "expired" | "cancelled";
  createdAt: string;
  issuedAt?: string;
  executedAt?: string;
  conditions?: string[]; // LC conditions (e.g., shipping documents required)
  metadata?: {
    tradeType?: string;
    goods?: string;
    origin?: string;
    destination?: string;
  };
}

// Store LCs in localStorage
const LCS_STORAGE_KEY = "arcle_letters_of_credit";

/**
 * Create a new letter of credit
 */
export function createLetterOfCredit(lc: Omit<LetterOfCredit, "id" | "lcNumber" | "createdAt" | "status">): LetterOfCredit {
  const lcs = getAllLettersOfCredit();
  
  // Generate LC number
  const lcNumber = `LC-${new Date().getFullYear()}-${String(lcs.length + 1).padStart(4, "0")}`;
  
  const newLC: LetterOfCredit = {
    ...lc,
    id: crypto.randomUUID(),
    lcNumber,
    status: "draft",
    createdAt: new Date().toISOString(),
  };
  
  lcs.push(newLC);
  saveLettersOfCredit(lcs);
  
  return newLC;
}

/**
 * Get all letters of credit
 */
export function getAllLettersOfCredit(): LetterOfCredit[] {
  if (typeof window === "undefined") {
    return [];
  }
  
  try {
    const stored = localStorage.getItem(LCS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Get LC by ID
 */
export function getLCById(id: string): LetterOfCredit | null {
  const lcs = getAllLettersOfCredit();
  return lcs.find(lc => lc.id === id) || null;
}

/**
 * Update LC
 */
export function updateLC(id: string, updates: Partial<LetterOfCredit>): LetterOfCredit | null {
  const lcs = getAllLettersOfCredit();
  const index = lcs.findIndex(lc => lc.id === id);
  
  if (index === -1) {
    return null;
  }
  
  lcs[index] = { ...lcs[index], ...updates };
  saveLettersOfCredit(lcs);
  
  return lcs[index];
}

/**
 * Issue LC (change status from draft to issued)
 */
export function issueLC(id: string): LetterOfCredit | null {
  return updateLC(id, {
    status: "issued",
    issuedAt: new Date().toISOString(),
  });
}

/**
 * Execute LC (when conditions are met)
 */
export function executeLC(id: string): LetterOfCredit | null {
  return updateLC(id, {
    status: "executed",
    executedAt: new Date().toISOString(),
  });
}

/**
 * Get expired LCs
 */
export function getExpiredLCs(): LetterOfCredit[] {
  const lcs = getAllLettersOfCredit();
  const now = new Date();
  
  return lcs.filter(lc => {
    if (lc.status === "executed" || lc.status === "cancelled") {
      return false;
    }
    
    const expiry = new Date(lc.expiryDate);
    return expiry < now;
  }).map(lc => {
    if (lc.status !== "expired") {
      updateLC(lc.id, { status: "expired" });
      return { ...lc, status: "expired" as const };
    }
    return lc;
  });
}

/**
 * Save LCs to localStorage
 */
function saveLettersOfCredit(lcs: LetterOfCredit[]): void {
  if (typeof window === "undefined") {
    return;
  }
  
  try {
    localStorage.setItem(LCS_STORAGE_KEY, JSON.stringify(lcs));
  } catch (error) {
    console.error("Error saving letters of credit:", error);
  }
}

