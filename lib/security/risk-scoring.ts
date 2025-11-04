/**
 * Risk Scoring System
 * 
 * Calculates risk scores for transactions based on various factors
 */

import { getArcClient } from "@/lib/arc";

export interface RiskScoreResult {
  score: number; // 0-100
  level: "low" | "medium" | "high";
  reasons: string[];
  blocked: boolean;
}

/**
 * Known scam addresses (in production, this would be a database/API)
 */
const KNOWN_SCAM_ADDRESSES = new Set<string>([
  // Add known scam addresses here
  // Example: "0x1234567890123456789012345678901234567890".toLowerCase(),
]);

/**
 * Address history cache (in production, this would be persistent storage)
 * Uses localStorage for persistence across sessions
 */
interface AddressHistory {
  firstSeen: string; // ISO date string for serialization
  transactionCount: number;
  lastSeen: string; // ISO date string for serialization
}

const STORAGE_KEY = "arcle_address_history";

function loadAddressHistory(): Map<string, AddressHistory> {
  if (typeof window === "undefined") {
    return new Map();
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, AddressHistory>;
      return new Map(Object.entries(parsed));
    }
  } catch (error) {
    console.error("Error loading address history:", error);
  }
  
  return new Map();
}

function saveAddressHistory(cache: Map<string, AddressHistory>): void {
  if (typeof window === "undefined") return;
  
  try {
    const obj = Object.fromEntries(cache);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (error) {
    console.error("Error saving address history:", error);
  }
}

// Initialize cache from localStorage
let addressHistoryCache = loadAddressHistory();

/**
 * Calculate risk score for a transaction
 */
export async function calculateRiskScore(
  address: string,
  amount?: string
): Promise<RiskScoreResult> {
  const reasons: string[] = [];
  let score = 0;

  // Normalize address to lowercase for cache lookup
  // Note: Address should already be checksummed (EIP-55) from validation
  const normalizedAddress = address.toLowerCase();

  // Factor 1: Known scam address (+50 points)
  if (KNOWN_SCAM_ADDRESSES.has(normalizedAddress)) {
    score += 50;
    reasons.push("Known scam address");
  }

  // Factor 2: Zero address check
  if (normalizedAddress === "0x0000000000000000000000000000000000000000") {
    score = 100;
    reasons.push("Invalid zero address");
    return {
      score: 100,
      level: "high",
      reasons,
      blocked: true,
    };
  }

  // Factor 3: New address (never seen before) (+20 points)
  const addressHistory = addressHistoryCache.get(normalizedAddress);
  if (!addressHistory) {
    score += 20;
    reasons.push("New address (never seen before)");
    // Initialize history
    const now = new Date().toISOString();
    addressHistoryCache.set(normalizedAddress, {
      firstSeen: now,
      transactionCount: 0,
      lastSeen: now,
    });
    saveAddressHistory(addressHistoryCache);
  } else {
    // Update last seen
    addressHistory.lastSeen = new Date().toISOString();
    saveAddressHistory(addressHistoryCache);
  }

  // Factor 4: Zero transaction history (+30 points)
  if (addressHistory && addressHistory.transactionCount === 0) {
    score += 30;
    reasons.push("Address has zero transaction history");
  }

  // Factor 5: Check on-chain transaction count (simplified)
  // In production, this would query the blockchain
  try {
    const transactionCount = await getTransactionCount(normalizedAddress);
    if (transactionCount === 0 && !addressHistory) {
      score += 30;
      reasons.push("No on-chain transaction history");
    } else if (addressHistory) {
      // Update cache
      addressHistory.transactionCount = Math.max(
        addressHistory.transactionCount,
        transactionCount
      );
    }
  } catch (error) {
    // If we can't check, assume it's a new address
    if (!addressHistory) {
      score += 20;
      reasons.push("Unable to verify transaction history");
    }
  }

  // Factor 6: Large amounts (potential risk indicator)
  if (amount) {
    const amountNum = parseFloat(amount);
    if (amountNum > 10000) {
      score += 10;
      reasons.push("Large transaction amount");
    }
  }

  // Cap score at 100
  score = Math.min(score, 100);

  // Determine risk level
  let level: "low" | "medium" | "high";
  if (score >= 80) {
    level = "high";
  } else if (score >= 40) {
    level = "medium";
  } else {
    level = "low";
  }

  // Determine if transaction should be blocked
  const blocked = score >= 80;

  return {
    score,
    level,
    reasons: reasons.length > 0 ? reasons : ["No specific risk factors detected"],
    blocked,
  };
}

/**
 * Get transaction count for an address (simplified - would use proper RPC in production)
 */
async function getTransactionCount(address: string): Promise<number> {
  try {
    const client = getArcClient();
    // Note: Viem doesn't have a direct transaction count method
    // In production, you'd query the blockchain or use an indexer
    // For now, return 0 as a placeholder
    return 0;
  } catch (error) {
    console.error("Error getting transaction count:", error);
    return 0;
  }
}

/**
 * Add address to known scam database
 * Uses normalized address for consistency
 */
export function addScamAddress(address: string): void {
  const normalizedAddress = address.toLowerCase();
  KNOWN_SCAM_ADDRESSES.add(normalizedAddress);
  
  // Persist to localStorage
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("arcle_scam_addresses");
      const scamList = stored ? JSON.parse(stored) : [];
      if (!scamList.includes(normalizedAddress)) {
        scamList.push(normalizedAddress);
        localStorage.setItem("arcle_scam_addresses", JSON.stringify(scamList));
      }
    } catch (error) {
      console.error("Error saving scam address:", error);
    }
  }
}

/**
 * Load known scam addresses from localStorage
 */
function loadScamAddresses(): void {
  if (typeof window === "undefined") return;
  
  try {
    const stored = localStorage.getItem("arcle_scam_addresses");
    if (stored) {
      const scamList = JSON.parse(stored) as string[];
      scamList.forEach(addr => KNOWN_SCAM_ADDRESSES.add(addr.toLowerCase()));
    }
  } catch (error) {
    console.error("Error loading scam addresses:", error);
  }
}

// Load scam addresses on module initialization
if (typeof window !== "undefined") {
  loadScamAddresses();
}


/**
 * Update address history after successful transaction
 * Uses normalized (checksummed) address for consistency
 */
export function updateAddressHistory(address: string): void {
  // Normalize address (should already be checksummed, but ensure lowercase for cache)
  const normalizedAddress = address.toLowerCase();
  const history = addressHistoryCache.get(normalizedAddress);
  const now = new Date().toISOString();
  
  if (history) {
    history.transactionCount += 1;
    history.lastSeen = now;
  } else {
    addressHistoryCache.set(normalizedAddress, {
      firstSeen: now,
      transactionCount: 1,
      lastSeen: now,
    });
  }
  
  // Persist to localStorage
  saveAddressHistory(addressHistoryCache);
}

/**
 * Get address history with proper date conversion
 */
export function getAddressHistory(address: string) {
  const normalizedAddress = address.toLowerCase();
  const history = addressHistoryCache.get(normalizedAddress);
  
  if (!history) return null;
  
  return {
    firstSeen: new Date(history.firstSeen),
    transactionCount: history.transactionCount,
    lastSeen: new Date(history.lastSeen),
  };
}

