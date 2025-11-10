/**
 * Multi-Currency Service
 * 
 * Handles multiple stablecoin support (USDC, EURC, etc.)
 * Integrates with Circle API for multi-currency balances
 */

export type SupportedCurrency = "USDC" | "EURC";

export interface CurrencyBalance {
  currency: SupportedCurrency;
  amount: string;
  amountRaw: string;
  tokenId?: string;
  blockchain: string;
  lastUpdated?: string;
}

export interface MultiCurrencyBalance {
  walletId?: string;
  address?: string;
  balances: CurrencyBalance[];
  totalValueUSD: string;
}

/**
 * Get currency token address on Arc network
 */
export function getCurrencyAddress(currency: SupportedCurrency, blockchain: string = "ARC-TESTNET"): string {
  // Arc Testnet addresses
  if (blockchain === "ARC-TESTNET" || blockchain === "ARC") {
    switch (currency) {
      case "USDC":
        return process.env.NEXT_PUBLIC_ARC_USDC_TESTNET_ADDRESS || "0x3600000000000000000000000000000000000000";
      case "EURC":
        // EURC address on Arc (to be configured when available)
        return process.env.NEXT_PUBLIC_ARC_EURC_TESTNET_ADDRESS || "";
      default:
        return "";
    }
  }
  
  return "";
}

/**
 * Format currency amount (both USDC and EURC have 6 decimals)
 */
export function formatCurrency(amount: bigint, currency: SupportedCurrency = "USDC"): string {
  const decimals = 6; // Both USDC and EURC use 6 decimals
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fractional = amount % divisor;
  
  const fractionalStr = fractional.toString().padStart(decimals, "0");
  const trimmedFractional = fractionalStr.replace(/0+$/, ""); // Remove trailing zeros
  
  if (trimmedFractional === "") {
    return whole.toString();
  }
  
  return `${whole}.${trimmedFractional}`;
}

/**
 * Parse currency amount to smallest unit
 */
export function parseCurrency(amount: string): bigint {
  const decimals = 6;
  const parts = amount.split(".");
  const whole = parts[0] || "0";
  const fractional = (parts[1] || "").padEnd(decimals, "0").substring(0, decimals);
  
  return BigInt(whole) * BigInt(10 ** decimals) + BigInt(fractional);
}

/**
 * Get currency symbol display
 */
export function getCurrencySymbol(currency: SupportedCurrency): string {
  return currency;
}

/**
 * Get currency name
 */
export function getCurrencyName(currency: SupportedCurrency): string {
  switch (currency) {
    case "USDC":
      return "USD Coin";
    case "EURC":
      return "Euro Coin";
    default:
      return currency;
  }
}

/**
 * Check if currency is supported
 */
export function isSupportedCurrency(currency: string): currency is SupportedCurrency {
  return currency === "USDC" || currency === "EURC";
}

