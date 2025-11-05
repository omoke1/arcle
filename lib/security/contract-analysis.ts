/**
 * Contract Analysis System
 * 
 * Integrates with ArcScan API for contract verification and age
 * Performs opcode heuristics for risk detection
 */

import { getArcClient } from "@/lib/arc";

export interface ContractAnalysis {
  isContract: boolean;
  verified: boolean;
  age?: number; // Days since deployment
  creationBlock?: number;
  riskScore: number;
  riskReasons: string[];
  opcodeAnalysis?: OpcodeAnalysis;
}

export interface OpcodeAnalysis {
  hasExternalCalls: boolean;
  hasDelegateCall: boolean;
  hasSelfDestruct: boolean;
  hasSuspiciousPatterns: boolean;
  complexity: "low" | "medium" | "high";
}

const ARCSCAN_API_URL = process.env.NEXT_PUBLIC_ARCSCAN_API_URL || "https://api.arcscan.app/api";

/**
 * Analyze contract using ArcScan API
 */
export async function analyzeContract(address: string): Promise<ContractAnalysis> {
  const normalizedAddress = address.toLowerCase();
  
  // Check if it's a contract
  const isContract = await checkIsContract(normalizedAddress);
  
  if (!isContract) {
    return {
      isContract: false,
      verified: false,
      riskScore: 0,
      riskReasons: [],
    };
  }

  // Fetch contract info from ArcScan
  const contractInfo = await fetchContractInfo(normalizedAddress);
  
  // Analyze opcodes
  const opcodeAnalysis = await analyzeOpcodes(normalizedAddress);
  
  // Calculate risk score
  const riskReasons: string[] = [];
  let riskScore = 0;

  // Check verification status
  if (!contractInfo.verified) {
    riskScore += 30;
    riskReasons.push("Contract is not verified on ArcScan");
  }

  // Check contract age
  if (contractInfo.age !== undefined) {
    if (contractInfo.age < 7) {
      riskScore += 40;
      riskReasons.push(`Very new contract (${contractInfo.age} days old)`);
    } else if (contractInfo.age < 30) {
      riskScore += 20;
      riskReasons.push(`New contract (${contractInfo.age} days old)`);
    }
  }

  // Check opcode patterns
  if (opcodeAnalysis.hasDelegateCall) {
    riskScore += 25;
    riskReasons.push("Contract uses DELEGATECALL (potential proxy risk)");
  }

  if (opcodeAnalysis.hasSelfDestruct) {
    riskScore += 30;
    riskReasons.push("Contract contains SELFDESTRUCT (can destroy itself)");
  }

  if (opcodeAnalysis.hasSuspiciousPatterns) {
    riskScore += 20;
    riskReasons.push("Suspicious opcode patterns detected");
  }

  if (opcodeAnalysis.complexity === "high") {
    riskScore += 15;
    riskReasons.push("High contract complexity");
  }

  // Cap at 100
  riskScore = Math.min(riskScore, 100);

  return {
    isContract: true,
    verified: contractInfo.verified,
    age: contractInfo.age,
    creationBlock: contractInfo.creationBlock,
    riskScore,
    riskReasons,
    opcodeAnalysis,
  };
}

/**
 * Check if address is a contract
 */
async function checkIsContract(address: string): Promise<boolean> {
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
 * Fetch contract information from ArcScan API
 */
async function fetchContractInfo(address: string): Promise<{
  verified: boolean;
  age?: number;
  creationBlock?: number;
}> {
  try {
    // ArcScan API endpoint for contract info
    // Note: This is a placeholder - actual ArcScan API may differ
    const response = await fetch(`${ARCSCAN_API_URL}/contract/${address}`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      // If API not available, return defaults
      return {
        verified: false,
      };
    }

    const data = await response.json();
    
    // Calculate age from creation timestamp
    let age: number | undefined;
    if (data.creationTimestamp) {
      const creationDate = new Date(data.creationTimestamp * 1000);
      const now = new Date();
      age = Math.floor((now.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      verified: data.verified || false,
      age,
      creationBlock: data.creationBlock,
    };
  } catch (error) {
    console.error("Error fetching contract info from ArcScan:", error);
    // Return defaults on error
    return {
      verified: false,
    };
  }
}

/**
 * Analyze contract opcodes for suspicious patterns
 */
async function analyzeOpcodes(address: string): Promise<OpcodeAnalysis> {
  try {
    const client = getArcClient();
    const code = await client.getBytecode({ address: address as `0x${string}` });
    
    if (!code || code === "0x") {
      return {
        hasExternalCalls: false,
        hasDelegateCall: false,
        hasSelfDestruct: false,
        hasSuspiciousPatterns: false,
        complexity: "low",
      };
    }

    // Convert hex to bytes for analysis
    const bytecode = code.slice(2); // Remove 0x prefix
    
    // Check for opcodes (simplified heuristic)
    // DELEGATECALL: 0xf4
    // SELFDESTRUCT: 0xff
    // CALL: 0xf1
    // STATICCALL: 0xfa
    
    const hasDelegateCall = bytecode.includes("f4");
    const hasSelfDestruct = bytecode.includes("ff");
    const hasExternalCalls = bytecode.includes("f1") || bytecode.includes("fa");
    
    // Check for suspicious patterns (multiple delegate calls, unusual patterns)
    const delegateCallCount = (bytecode.match(/f4/g) || []).length;
    const hasSuspiciousPatterns = delegateCallCount > 3 || 
                                  (hasDelegateCall && hasSelfDestruct);
    
    // Determine complexity based on bytecode size and opcode variety
    const complexity = bytecode.length > 10000 ? "high" :
                      bytecode.length > 5000 ? "medium" : "low";

    return {
      hasExternalCalls,
      hasDelegateCall: hasDelegateCall,
      hasSelfDestruct: hasSelfDestruct,
      hasSuspiciousPatterns,
      complexity,
    };
  } catch (error) {
    console.error("Error analyzing opcodes:", error);
    return {
      hasExternalCalls: false,
      hasDelegateCall: false,
      hasSelfDestruct: false,
      hasSuspiciousPatterns: false,
      complexity: "low",
    };
  }
}

/**
 * Get contract verification URL on ArcScan
 */
export function getContractExplorerUrl(address: string): string {
  const explorerUrl = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || "https://testnet.arcscan.app";
  return `${explorerUrl}/address/${address}`;
}

