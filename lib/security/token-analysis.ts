/**
 * Token Analysis System
 * 
 * Analyzes incoming tokens for scam detection and risk assessment
 * Checks token contracts, metadata, and known scam databases
 */

import { analyzeContract } from "./contract-analysis";
import { getArcClient } from "@/lib/arc";
import { loadPreference, savePreference } from "@/lib/supabase-data";

export interface TokenAnalysis {
  tokenAddress: string;
  tokenName?: string;
  tokenSymbol?: string;
  decimals?: number;
  isScam: boolean;
  riskScore: number; // 0-100
  riskLevel: "low" | "medium" | "high";
  riskReasons: string[];
  blocked: boolean;
  contractAnalysis?: {
    verified: boolean;
    age?: number;
    riskScore: number;
  };
}

/**
 * Known safe tokens (auto-approved)
 */
const SAFE_TOKEN_WHITELIST = new Set<string>([
  // USDC on Arc Testnet
  "0x3600000000000000000000000000000000000000".toLowerCase(),
  // Add more safe tokens as needed
  // EURC address would go here when available
]);

/**
 * Known scam token addresses (blocked)
 */
const KNOWN_SCAM_TOKENS = new Set<string>([
  // Add known scam token addresses here
  // This would be populated from a database/API in production
]);

/**
 * Suspicious token name patterns
 */
const SUSPICIOUS_NAME_PATTERNS = [
  /test.*token/i,
  /scam.*token/i,
  /fake.*usdc/i,
  /fake.*usdt/i,
  /honeypot/i,
  /rug.*pull/i,
  /phishing/i,
  /malicious/i,
];

/**
 * Suspicious token symbol patterns
 */
const SUSPICIOUS_SYMBOL_PATTERNS = [
  /TEST/i,
  /SCAM/i,
  /FAKE/i,
  /HONEY/i,
  /RUG/i,
];

/**
 * Analyze a token for scam indicators
 */
export async function analyzeToken(
  tokenAddress: string,
  tokenName?: string,
  tokenSymbol?: string,
  decimals?: number
): Promise<TokenAnalysis> {
  const normalizedAddress = tokenAddress.toLowerCase();
  const reasons: string[] = [];
  let riskScore = 0;

  // Check if token is in safe whitelist
  if (SAFE_TOKEN_WHITELIST.has(normalizedAddress)) {
    return {
      tokenAddress: normalizedAddress,
      tokenName,
      tokenSymbol,
      decimals,
      isScam: false,
      riskScore: 0,
      riskLevel: "low",
      riskReasons: [],
      blocked: false,
    };
  }

  // Check if token is in known scam list
  if (KNOWN_SCAM_TOKENS.has(normalizedAddress)) {
    return {
      tokenAddress: normalizedAddress,
      tokenName,
      tokenSymbol,
      decimals,
      isScam: true,
      riskScore: 100,
      riskLevel: "high",
      riskReasons: ["Known scam token"],
      blocked: true,
    };
  }

  // Analyze token name
  if (tokenName) {
    for (const pattern of SUSPICIOUS_NAME_PATTERNS) {
      if (pattern.test(tokenName)) {
        riskScore += 40;
        reasons.push(`Suspicious token name: "${tokenName}"`);
        break;
      }
    }
  }

  // Analyze token symbol
  if (tokenSymbol) {
    for (const pattern of SUSPICIOUS_SYMBOL_PATTERNS) {
      if (pattern.test(tokenSymbol)) {
        riskScore += 30;
        reasons.push(`Suspicious token symbol: "${tokenSymbol}"`);
        break;
      }
    }
  }

  // Check if token name/symbol mimics legitimate tokens
  if (tokenName || tokenSymbol) {
    const nameOrSymbol = (tokenName || tokenSymbol || "").toLowerCase();
    const legitimateTokens = ["usdc", "usdt", "dai", "eurc", "weth", "eth"];
    
    for (const legit of legitimateTokens) {
      // Check for typosquatting (e.g., "USDC" vs "USDC" with similar characters)
      if (nameOrSymbol.includes(legit) && nameOrSymbol !== legit) {
        // Check if it's a close match (potential typosquatting)
        const similarity = calculateSimilarity(nameOrSymbol, legit);
        if (similarity > 0.7 && similarity < 1.0) {
          riskScore += 50;
          reasons.push(`Potential typosquatting: "${nameOrSymbol}" mimics "${legit}"`);
        }
      }
    }
  }

  // Analyze contract
  let contractAnalysis;
  try {
    const contractResult = await analyzeContract(normalizedAddress);
    contractAnalysis = {
      verified: contractResult.verified,
      age: contractResult.age,
      riskScore: contractResult.riskScore,
    };

    // Add contract risk to token risk
    if (!contractResult.verified) {
      riskScore += 30;
      reasons.push("Token contract is not verified");
    }

    if (contractResult.age !== undefined && contractResult.age < 7) {
      riskScore += 40;
      reasons.push(`Very new token contract (${contractResult.age} days old)`);
    } else if (contractResult.age !== undefined && contractResult.age < 30) {
      riskScore += 20;
      reasons.push(`New token contract (${contractResult.age} days old)`);
    }

    // Add contract opcode risks
    if (contractResult.opcodeAnalysis) {
      if (contractResult.opcodeAnalysis.hasSelfDestruct) {
        riskScore += 30;
        reasons.push("Token contract contains SELFDESTRUCT");
      }
      if (contractResult.opcodeAnalysis.hasSuspiciousPatterns) {
        riskScore += 25;
        reasons.push("Token contract has suspicious opcode patterns");
      }
    }
  } catch (error) {
    console.warn("Error analyzing token contract:", error);
    // If we can't analyze the contract, add some risk
    riskScore += 20;
    reasons.push("Unable to analyze token contract");
  }

  // Check for honeypot indicators (simplified - would need on-chain analysis)
  // Honeypots allow receiving but not sending
  // This would require testing the token's transfer function

  // Cap risk score at 100
  riskScore = Math.min(riskScore, 100);

  // Determine risk level
  let riskLevel: "low" | "medium" | "high";
  if (riskScore >= 80) {
    riskLevel = "high";
  } else if (riskScore >= 40) {
    riskLevel = "medium";
  } else {
    riskLevel = "low";
  }

  // Block if high risk
  const blocked = riskScore >= 80;
  const isScam = riskScore >= 70; // Consider it a scam if risk is very high

  return {
    tokenAddress: normalizedAddress,
    tokenName,
    tokenSymbol,
    decimals,
    isScam,
    riskScore,
    riskLevel,
    riskReasons: reasons.length > 0 ? reasons : ["No specific risk factors detected"],
    blocked,
    contractAnalysis,
  };
}

/**
 * Calculate string similarity (Levenshtein distance based)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Add token to safe whitelist
 */
export async function addSafeToken(userId: string, tokenAddress: string): Promise<void> {
  const normalized = tokenAddress.toLowerCase();
  SAFE_TOKEN_WHITELIST.add(normalized);
  
  // Persist to Supabase
  if (typeof window !== "undefined") {
    try {
      const pref = await loadPreference({ userId, key: "safe_tokens" });
      const tokenList = (pref?.value as string[]) || [];
      if (!tokenList.includes(normalized)) {
        tokenList.push(normalized);
        await savePreference({ userId, key: "safe_tokens", value: tokenList });
      }
    } catch (error) {
      console.error("[TokenAnalysis] Error saving safe token to Supabase:", error);
      // Migration fallback
      try {
        const stored = localStorage.getItem("arcle_safe_tokens");
        const tokenList = stored ? JSON.parse(stored) : [];
        if (!tokenList.includes(normalized)) {
          tokenList.push(normalized);
          localStorage.setItem("arcle_safe_tokens", JSON.stringify(tokenList));
        }
      } catch (fallbackError) {
        console.error("[TokenAnalysis] Error saving safe token to localStorage:", fallbackError);
      }
    }
  }
}

/**
 * Add token to scam list
 */
export async function addScamToken(userId: string, tokenAddress: string): Promise<void> {
  const normalized = tokenAddress.toLowerCase();
  KNOWN_SCAM_TOKENS.add(normalized);
  
  // Persist to Supabase
  if (typeof window !== "undefined") {
    try {
      const pref = await loadPreference({ userId, key: "scam_tokens" });
      const tokenList = (pref?.value as string[]) || [];
      if (!tokenList.includes(normalized)) {
        tokenList.push(normalized);
        await savePreference({ userId, key: "scam_tokens", value: tokenList });
      }
    } catch (error) {
      console.error("[TokenAnalysis] Error saving scam token to Supabase:", error);
      // Migration fallback
      try {
        const stored = localStorage.getItem("arcle_scam_tokens");
        const tokenList = stored ? JSON.parse(stored) : [];
        if (!tokenList.includes(normalized)) {
          tokenList.push(normalized);
          localStorage.setItem("arcle_scam_tokens", JSON.stringify(tokenList));
        }
      } catch (fallbackError) {
        console.error("[TokenAnalysis] Error saving scam token to localStorage:", fallbackError);
      }
    }
  }
}

/**
 * Load safe tokens from Supabase
 */
async function loadSafeTokens(userId?: string): Promise<void> {
  if (typeof window === "undefined") return;
  
  try {
    if (userId) {
      // Try Supabase first
      const pref = await loadPreference({ userId, key: "safe_tokens" });
      if (pref?.value && Array.isArray(pref.value)) {
        pref.value.forEach((addr: string) => SAFE_TOKEN_WHITELIST.add(addr.toLowerCase()));
        return;
      }
    }
    
    // Migration fallback: try localStorage
    const stored = localStorage.getItem("arcle_safe_tokens");
    if (stored) {
      const tokenList = JSON.parse(stored) as string[];
      tokenList.forEach(addr => SAFE_TOKEN_WHITELIST.add(addr.toLowerCase()));
      
      // Migrate to Supabase if userId is available
      if (userId) {
        try {
          await savePreference({ userId, key: "safe_tokens", value: tokenList });
          localStorage.removeItem("arcle_safe_tokens");
        } catch (error) {
          console.error("[TokenAnalysis] Failed to migrate safe tokens to Supabase:", error);
        }
      }
    }
  } catch (error) {
    console.error("[TokenAnalysis] Error loading safe tokens:", error);
  }
}

/**
 * Load scam tokens from Supabase
 */
async function loadScamTokens(userId?: string): Promise<void> {
  if (typeof window === "undefined") return;
  
  try {
    if (userId) {
      // Try Supabase first
      const pref = await loadPreference({ userId, key: "scam_tokens" });
      if (pref?.value && Array.isArray(pref.value)) {
        pref.value.forEach((addr: string) => KNOWN_SCAM_TOKENS.add(addr.toLowerCase()));
        return;
      }
    }
    
    // Migration fallback: try localStorage
    const stored = localStorage.getItem("arcle_scam_tokens");
    if (stored) {
      const tokenList = JSON.parse(stored) as string[];
      tokenList.forEach(addr => KNOWN_SCAM_TOKENS.add(addr.toLowerCase()));
      
      // Migrate to Supabase if userId is available
      if (userId) {
        try {
          await savePreference({ userId, key: "scam_tokens", value: tokenList });
          localStorage.removeItem("arcle_scam_tokens");
        } catch (error) {
          console.error("[TokenAnalysis] Failed to migrate scam tokens to Supabase:", error);
        }
      }
    }
  } catch (error) {
    console.error("[TokenAnalysis] Error loading scam tokens:", error);
  }
}

// Load tokens on module initialization (will be loaded per-user when needed)

/**
 * Get token metadata from blockchain (simplified - would use ERC-20 standard)
 */
export async function getTokenMetadata(tokenAddress: string): Promise<{
  name?: string;
  symbol?: string;
  decimals?: number;
}> {
  try {
    const client = getArcClient();
    
    // In production, this would call the ERC-20 contract methods:
    // - name()
    // - symbol()
    // - decimals()
    // For now, return empty (would need contract ABI and calls)
    
    return {
      name: undefined,
      symbol: undefined,
      decimals: undefined,
    };
  } catch (error) {
    console.error("Error fetching token metadata:", error);
    return {};
  }
}

