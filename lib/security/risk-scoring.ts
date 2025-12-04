/**
 * Risk Scoring System
 * 
 * Calculates risk scores for transactions based on various factors
 */

import { getArcClient } from "@/lib/arc";
import { detectPhishingUrls } from "./phishing-detection";

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
 * Uses Supabase for persistence across sessions
 */
import { loadPreference, savePreference } from "@/lib/supabase-data";

interface AddressHistory {
  firstSeen: string; // ISO date string for serialization
  transactionCount: number;
  lastSeen: string; // ISO date string for serialization
}

const STORAGE_KEY = "address_history";

async function loadAddressHistory(userId?: string): Promise<Map<string, AddressHistory>> {
  if (typeof window === "undefined" || !userId) {
    return new Map();
  }
  
  try {
    // Try Supabase first
    const pref = await loadPreference({ userId, key: STORAGE_KEY });
    if (pref?.value && typeof pref.value === 'object') {
      const parsed = pref.value as Record<string, AddressHistory>;
      return new Map(Object.entries(parsed));
    }
  } catch (error) {
    console.warn("[RiskScoring] Failed to load from Supabase, trying localStorage migration:", error);
  }
  
  // Migration fallback: try localStorage
  try {
    const stored = localStorage.getItem("arcle_address_history");
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, AddressHistory>;
      const cache = new Map(Object.entries(parsed));
      // Migrate to Supabase
      try {
        await savePreference({ userId, key: STORAGE_KEY, value: parsed });
        localStorage.removeItem("arcle_address_history");
      } catch (error) {
        console.error("[RiskScoring] Failed to migrate address history to Supabase:", error);
      }
      return cache;
    }
  } catch (error) {
    console.error("[RiskScoring] Error loading address history:", error);
  }
  
  return new Map();
}

async function saveAddressHistory(userId: string, cache: Map<string, AddressHistory>): Promise<void> {
  if (typeof window === "undefined") return;
  
  try {
    const obj = Object.fromEntries(cache);
    await savePreference({ userId, key: STORAGE_KEY, value: obj });
  } catch (error) {
    console.error("[RiskScoring] Error saving address history to Supabase:", error);
    // Migration fallback
    try {
      const obj = Object.fromEntries(cache);
      localStorage.setItem("arcle_address_history", JSON.stringify(obj));
    } catch (fallbackError) {
      console.error("[RiskScoring] Error saving address history to localStorage:", fallbackError);
    }
  }
}

// Per-user address history cache
const addressHistoryCaches = new Map<string, Map<string, AddressHistory>>();

/**
 * Known risky contract patterns (in production, this would query contract verification)
 */
const KNOWN_RISKY_CONTRACTS = new Set<string>([
  // Add known risky contract addresses here
]);

/**
 * Check if address is a contract (simplified - would query blockchain in production)
 */
async function isContract(address: string): Promise<boolean> {
  try {
    const client = getArcClient();
    const code = await client.getBytecode({ address: address as `0x${string}` });
    return !!(code && code !== "0x");
  } catch (error) {
    console.error("Error checking contract:", error);
    return false;
  }
}

/**
 * Check contract age (days since deployment)
 * In production, would query contract creation block
 */
async function getContractAge(address: string): Promise<number | null> {
  try {
    // TODO: Query contract creation block from blockchain
    // For MVP, return null (unknown)
    return null;
  } catch (error) {
    console.error("Error getting contract age:", error);
    return null;
  }
}

/**
 * Check if contract is verified (simplified)
 * In production, would query ArcScan or similar explorer API
 */
async function isContractVerified(address: string): Promise<boolean> {
  try {
    // TODO: Query ArcScan API for verification status
    // For MVP, return false (assume unverified)
    return false;
  } catch (error) {
    console.error("Error checking contract verification:", error);
    return false;
  }
}

/**
 * Calculate risk score for a transaction
 */
export async function calculateRiskScore(
  address: string,
  amount?: string,
  isContractAddress?: boolean,
  message?: string, // Optional: message text for phishing detection
  userId?: string // Optional: userId for address history
): Promise<RiskScoreResult> {
  const reasons: string[] = [];
  let score = 0;

  // Factor 0: Phishing URL detection (if message provided)
  if (message) {
    const phishingResult = detectPhishingUrls(message);
    if (phishingResult.isPhishing) {
      score += phishingResult.confidence;
      reasons.push(...phishingResult.reasons.map(r => `Phishing: ${r}`));
      
      // If blocked by phishing detection, return immediately
      if (phishingResult.blocked) {
        return {
          score: Math.min(score, 100),
          level: "high",
          reasons,
          blocked: false, // Never block - allow user to proceed after seeing warnings
        };
      }
    }
  }

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
  let addressHistory: AddressHistory | null = null;
  if (userId && typeof window !== "undefined") {
    // Load or get cache for this user
    let cache = addressHistoryCaches.get(userId);
    if (!cache) {
      cache = await loadAddressHistory(userId);
      addressHistoryCaches.set(userId, cache);
    }
    
    addressHistory = cache.get(normalizedAddress) || null;
    
    if (!addressHistory) {
      score += 20;
      reasons.push("New address (never seen before)");
      // Initialize history
      const now = new Date().toISOString();
      cache.set(normalizedAddress, {
        firstSeen: now,
        transactionCount: 0,
        lastSeen: now,
      });
      await saveAddressHistory(userId, cache);
    } else {
      // Update last seen
      addressHistory.lastSeen = new Date().toISOString();
      await saveAddressHistory(userId, cache);
    }
  } else {
    // No userId - treat as new address
    score += 20;
    reasons.push("New address (never seen before)");
  }

  // Factor 4: Zero transaction history (+30 points)
  if (addressHistory && addressHistory.transactionCount === 0) {
    score += 30;
    reasons.push("Address has zero transaction history");
  }

  // Factor 5: Check on-chain transaction count (simplified)
  // In production, this would query the blockchain
  if (userId && typeof window !== "undefined") {
    try {
      const transactionCount = await getTransactionCount(normalizedAddress);
      let cache = addressHistoryCaches.get(userId);
      if (!cache) {
        cache = await loadAddressHistory(userId);
        addressHistoryCaches.set(userId, cache);
      }
      
      const currentHistory = cache.get(normalizedAddress);
      if (transactionCount === 0 && !currentHistory) {
        score += 30;
        reasons.push("No on-chain transaction history");
      } else if (currentHistory) {
        // Update cache
        currentHistory.transactionCount = Math.max(
          currentHistory.transactionCount,
          transactionCount
        );
        await saveAddressHistory(userId, cache);
      }
    } catch (error) {
      // If we can't check, assume it's a new address
      if (!addressHistory) {
        score += 20;
        reasons.push("Unable to verify transaction history");
      }
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

  // Factor 7: Contract address checks (using enhanced contract analysis)
  const isContractAddr = isContractAddress !== undefined ? isContractAddress : await isContract(normalizedAddress);
  if (isContractAddr) {
    // Check if it's a known risky contract
    if (KNOWN_RISKY_CONTRACTS.has(normalizedAddress)) {
      score += 40;
      reasons.push("Known risky contract address");
    } else {
      // Use enhanced contract analysis
      const { analyzeContract } = await import("./contract-analysis");
      const contractAnalysis = await analyzeContract(normalizedAddress);
      
      // Add contract-specific risk factors
      if (contractAnalysis.age !== undefined) {
        if (contractAnalysis.age < 7) {
          score += 40;
          reasons.push(`Very new contract (${contractAnalysis.age} days old)`);
        } else if (contractAnalysis.age < 30) {
          score += 20;
          reasons.push(`New contract (${contractAnalysis.age} days old)`);
        }
      }

      if (!contractAnalysis.verified) {
        score += 30;
        reasons.push("Contract is not verified on ArcScan");
      }

      // Add opcode-based risk factors
      if (contractAnalysis.opcodeAnalysis) {
        if (contractAnalysis.opcodeAnalysis.hasDelegateCall) {
          score += 25;
          reasons.push("Contract uses DELEGATECALL (potential proxy risk)");
        }
        if (contractAnalysis.opcodeAnalysis.hasSelfDestruct) {
          score += 30;
          reasons.push("Contract contains SELFDESTRUCT");
        }
        if (contractAnalysis.opcodeAnalysis.hasSuspiciousPatterns) {
          score += 20;
          reasons.push("Suspicious opcode patterns detected");
        }
      }
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
export async function addScamAddress(userId: string, address: string): Promise<void> {
  const normalizedAddress = address.toLowerCase();
  KNOWN_SCAM_ADDRESSES.add(normalizedAddress);
  
  // Persist to Supabase
  if (typeof window !== "undefined") {
    try {
      const pref = await loadPreference({ userId, key: "scam_addresses" });
      const scamList = (pref?.value as string[]) || [];
      if (!scamList.includes(normalizedAddress)) {
        scamList.push(normalizedAddress);
        await savePreference({ userId, key: "scam_addresses", value: scamList });
      }
    } catch (error) {
      console.error("[RiskScoring] Error saving scam address to Supabase:", error);
      // Migration fallback
      try {
        const stored = localStorage.getItem("arcle_scam_addresses");
        const scamList = stored ? JSON.parse(stored) : [];
        if (!scamList.includes(normalizedAddress)) {
          scamList.push(normalizedAddress);
          localStorage.setItem("arcle_scam_addresses", JSON.stringify(scamList));
        }
      } catch (fallbackError) {
        console.error("[RiskScoring] Error saving scam address to localStorage:", fallbackError);
      }
    }
  }
}

/**
 * Load known scam addresses from Supabase
 */
async function loadScamAddresses(userId?: string): Promise<void> {
  if (typeof window === "undefined") return;
  
  try {
    if (userId) {
      // Try Supabase first
      const pref = await loadPreference({ userId, key: "scam_addresses" });
      if (pref?.value && Array.isArray(pref.value)) {
        pref.value.forEach((addr: string) => KNOWN_SCAM_ADDRESSES.add(addr.toLowerCase()));
        return;
      }
    }
    
    // Migration fallback: try localStorage
    const stored = localStorage.getItem("arcle_scam_addresses");
    if (stored) {
      const scamList = JSON.parse(stored) as string[];
      scamList.forEach(addr => KNOWN_SCAM_ADDRESSES.add(addr.toLowerCase()));
      
      // Migrate to Supabase if userId is available
      if (userId) {
        try {
          await savePreference({ userId, key: "scam_addresses", value: scamList });
          localStorage.removeItem("arcle_scam_addresses");
        } catch (error) {
          console.error("[RiskScoring] Failed to migrate scam addresses to Supabase:", error);
        }
      }
    }
  } catch (error) {
    console.error("[RiskScoring] Error loading scam addresses:", error);
  }
}

// Load scam addresses on module initialization (will be loaded per-user when needed)


/**
 * Update address history after successful transaction
 * Uses normalized (checksummed) address for consistency
 */
export async function updateAddressHistory(userId: string, address: string): Promise<void> {
  if (typeof window === "undefined" || !userId) return;
  
  // Load or get cache for this user
  let cache = addressHistoryCaches.get(userId);
  if (!cache) {
    cache = await loadAddressHistory(userId);
    addressHistoryCaches.set(userId, cache);
  }
  
  // Normalize address (should already be checksummed, but ensure lowercase for cache)
  const normalizedAddress = address.toLowerCase();
  const history = cache.get(normalizedAddress);
  const now = new Date().toISOString();
  
  if (history) {
    history.transactionCount += 1;
    history.lastSeen = now;
  } else {
    cache.set(normalizedAddress, {
      firstSeen: now,
      transactionCount: 1,
      lastSeen: now,
    });
  }
  
  // Persist to Supabase
  await saveAddressHistory(userId, cache);
}

/**
 * Get address history with proper date conversion
 */
export async function getAddressHistory(userId: string, address: string) {
  if (typeof window === "undefined" || !userId) return null;
  
  // Load or get cache for this user
  let cache = addressHistoryCaches.get(userId);
  if (!cache) {
    cache = await loadAddressHistory(userId);
    addressHistoryCaches.set(userId, cache);
  }
  
  const normalizedAddress = address.toLowerCase();
  const history = cache.get(normalizedAddress);
  
  if (!history) return null;
  
  return {
    firstSeen: new Date(history.firstSeen),
    transactionCount: history.transactionCount,
    lastSeen: new Date(history.lastSeen),
  };
}

