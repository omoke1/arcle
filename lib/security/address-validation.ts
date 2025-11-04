/**
 * Address Validation & Security
 * 
 * Implements EIP-55 checksum validation and address security checks
 */

import { getAddress, isAddress } from "viem";

/**
 * Validate Ethereum address with EIP-55 checksum
 */
export function validateAddress(address: string): {
  isValid: boolean;
  isChecksumValid: boolean;
  error?: string;
  normalizedAddress?: string;
} {
  // Basic format check
  if (!address || typeof address !== "string") {
    return {
      isValid: false,
      isChecksumValid: false,
      error: "Address is required",
    };
  }

  // Check if it's a valid Ethereum address format
  if (!isAddress(address)) {
    return {
      isValid: false,
      isChecksumValid: false,
      error: "Invalid address format",
    };
  }

  // Normalize address (convert to checksummed format)
  let normalizedAddress: string;
  try {
    normalizedAddress = getAddress(address);
  } catch (error) {
    return {
      isValid: false,
      isChecksumValid: false,
      error: "Failed to normalize address",
    };
  }

  // Check if checksum is valid
  const isChecksumValid = address === normalizedAddress;

  return {
    isValid: true,
    isChecksumValid,
    normalizedAddress,
    error: isChecksumValid ? undefined : "Address checksum is invalid",
  };
}

/**
 * Check if address is a zero address or invalid
 */
export function isZeroAddress(address: string): boolean {
  if (!address) return true;
  return address.toLowerCase() === "0x0000000000000000000000000000000000000000";
}

/**
 * Check if address is a contract address (basic check - would need RPC call for certainty)
 */
export function isContractAddress(address: string): boolean {
  // This is a placeholder - would need to check on-chain
  // For now, we can't determine without an RPC call
  return false;
}

