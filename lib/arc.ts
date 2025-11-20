/**
 * Arc Network Configuration
 * 
 * Arc blockchain is Circle's Layer-1 blockchain
 * EVM-compatible, uses USDC for gas
 * 
 * Reference: https://docs.arc.network/
 * Connect to Arc: https://docs.arc.network/arc/references/connect-to-arc
 */

import { createPublicClient, http, type PublicClient, type Chain } from "viem";

// Arc Network Chain Configuration
// Arc is an EVM-compatible chain that uses USDC for gas

/**
 * Arc Testnet Configuration
 * - RPC: https://rpc.testnet.arc.network
 * - Chain ID: 5042002
 * - Explorer: https://testnet.arcscan.app
 */
export const arcTestnetChain: Chain = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.arc.network"],
    },
    public: {
      http: [
        "https://rpc.testnet.arc.network",
        "https://rpc.quicknode.testnet.arc.network",
        "https://rpc.blockdaemon.testnet.arc.network",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "Arc Testnet Explorer",
      url: "https://testnet.arcscan.app",
    },
  },
  testnet: true,
};

/**
 * Arc Mainnet Configuration
 * - RPC: https://rpc.arc.network (to be confirmed)
 * - Chain ID: TBD (mainnet not yet launched)
 */
export const arcMainnetChain: Chain = {
  id: parseInt(process.env.NEXT_PUBLIC_ARC_MAINNET_CHAIN_ID || "1"), // Placeholder
  name: "Arc",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_ARC_MAINNET_RPC_URL || "https://rpc.arc.network"],
    },
    public: {
      http: [process.env.NEXT_PUBLIC_ARC_MAINNET_RPC_URL || "https://rpc.arc.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arc Explorer",
      url: "https://arcscan.app",
    },
  },
  testnet: false,
};

// Select chain based on environment
// DEFAULT TO TESTNET - Only use mainnet if explicitly set to production
export const arcChain: Chain = 
  process.env.NEXT_PUBLIC_ENV === "production" 
    ? arcMainnetChain 
    : arcTestnetChain; // Default to testnet

export const arcConfig = {
  // DEFAULT TO TESTNET RPC - Only use mainnet if explicitly set to production
  rpcUrl: process.env.NEXT_PUBLIC_ARC_RPC_URL || 
    (process.env.NEXT_PUBLIC_ENV === "production" 
      ? "https://rpc.arc.network" 
      : "https://rpc.testnet.arc.network"), // Default to testnet
  chainId: arcChain.id,
  chain: arcChain,
};

// Log current network configuration for debugging
if (typeof window === 'undefined') { // Server-side only
  console.log('🌐 Arc Network Configuration:', {
    environment: process.env.NEXT_PUBLIC_ENV || 'testnet (default)',
    chain: arcChain.name,
    chainId: arcChain.id,
    rpcUrl: arcConfig.rpcUrl,
    isTestnet: arcChain.testnet,
    explorer: arcChain.blockExplorers?.default?.url,
  });
}

/**
 * USDC Token Contract Addresses on Arc
 * 
 * Arc Testnet USDC: 0x3600000000000000000000000000000000000000
 * Found on Arc Explorer: https://testnet.arcscan.app/address/0x3600000000000000000000000000000000000000
 * 
 * Note: Arc is NOT listed in Circle's general USDC addresses documentation:
 * https://developers.circle.com/stablecoins/usdc-contract-addresses
 * 
 * Mainnet address will be updated when Arc mainnet launches.
 */
export const USDC_ADDRESSES = {
  // Mainnet USDC address (Arc mainnet may not be launched yet)
  mainnet: process.env.NEXT_PUBLIC_ARC_USDC_ADDRESS || "0x...",
  // Testnet USDC address - Found on Arc Explorer
  testnet: process.env.NEXT_PUBLIC_ARC_USDC_TESTNET_ADDRESS || "0x3600000000000000000000000000000000000000",
} as const;

const DEFAULT_ARC_USDC_DECIMALS = 6;
const envDecimals = Number(process.env.NEXT_PUBLIC_ARC_USDC_DECIMALS);
const ARC_USDC_DECIMALS =
  Number.isFinite(envDecimals) && envDecimals > 0 ? envDecimals : DEFAULT_ARC_USDC_DECIMALS;

export function getUsdcDecimals(): number {
  return ARC_USDC_DECIMALS;
}

export function getUSDCAddress(): `0x${string}` {
  // DEFAULT TO TESTNET - Only use mainnet if explicitly set to production
  const isTestnet = process.env.NEXT_PUBLIC_ENV !== "production";
  const address = isTestnet ? USDC_ADDRESSES.testnet : USDC_ADDRESSES.mainnet;
  
  if (!address || address === "0x...") {
    throw new Error(
      `USDC contract address not configured for Arc ${isTestnet ? "testnet" : "mainnet"}. ` +
      `Set NEXT_PUBLIC_ARC_USDC_${isTestnet ? "TESTNET_" : ""}ADDRESS in .env`
    );
  }
  
  // Log for debugging
  console.log(`💰 Using USDC address for Arc ${isTestnet ? "testnet" : "mainnet"}: ${address}`);
  
  return address as `0x${string}`;
}

/**
 * Get Arc network public client
 */
export function getArcClient(): PublicClient {
  if (!arcConfig.rpcUrl || arcConfig.rpcUrl.includes("url-here")) {
    throw new Error(
      "Arc RPC URL not configured. Set NEXT_PUBLIC_ARC_RPC_URL in .env or it will default to testnet."
    );
  }

  return createPublicClient({
    chain: arcChain,
    transport: http(arcConfig.rpcUrl),
  });
}

/**
 * Common Arc network utilities
 */
export const arcUtils = {
  /**
   * Format address for display
   */
  formatAddress(address: string, length = 4): string {
    if (!address || address.length < length * 2 + 2) return address;
    return `${address.slice(0, length + 2)}...${address.slice(-length)}`;
  },

  /**
   * Validate Ethereum/Arc address format
   */
  isValidAddress(address: string): boolean {
    if (!address || typeof address !== "string") return false;
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  },

  /**
   * Convert USDC amount (6 decimals) to readable format
   */
  formatUSDC(amount: bigint, decimals: number = ARC_USDC_DECIMALS): string {
    const decimalsBigInt = BigInt(decimals);
    const divisor = 10n ** decimalsBigInt;
    const whole = amount / divisor;
    const fraction = amount % divisor;
    const fractionStr = fraction.toString().padStart(decimals, "0");
    // Trim trailing zeros for readability, but keep at least two decimals when possible
    const formatted = `${whole.toString()}.${fractionStr}`.replace(/\.?0+$/, '');
    return formatted.includes(".") ? formatted : `${formatted}.00`;
  },

  /**
   * Convert USDC amount string to bigint (6 decimals)
   */
  parseUSDC(amount: string, decimals: number = ARC_USDC_DECIMALS): bigint {
    if (!amount) return 0n;
    const decimalsBigInt = BigInt(decimals);
    const [wholePart, fractionPart = ""] = amount.split(".");
    const whole = wholePart && wholePart.length > 0 ? wholePart : "0";
    const paddedFraction = fractionPart.padEnd(decimals, "0").slice(0, decimals) || "0";
    return BigInt(whole) * (10n ** decimalsBigInt) + BigInt(paddedFraction);
  },
};
