/**
 * Circle Gateway Smart Contract Integration
 * 
 * Gateway allows instant cross-chain transfers after depositing USDC
 * Reference: https://developers.circle.com/gateway/concepts/technical-guide
 * 
 * Gateway Flow:
 * 1. Deposit USDC into Gateway Wallet contract on source chain
 * 2. Wait for deposit finalization
 * 3. Request attestation via Gateway API (/v1/transfer)
 * 4. Mint USDC on destination chain via Gateway Minter contract
 */

// Gateway Contract Addresses (from Arc Network documentation)
// Source: https://docs.arc.network/arc/references/contract-addresses#gateway
export const GATEWAY_CONTRACT_ADDRESSES: Record<string, {
  gatewayWallet: string; // For depositing USDC
  gatewayMinter: string; // For minting USDC on destination
  usdc: string; // USDC token address
  domain: number; // Circle domain ID
}> = {
  // Testnet addresses
  "ARC-TESTNET": {
    // Gateway contracts on Arc Testnet
    // Source: https://docs.arc.network/arc/references/contract-addresses#gateway
    gatewayWallet: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9", // GatewayWallet
    gatewayMinter: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B", // GatewayMinter
    usdc: "0x3600000000000000000000000000000000000000", // Arc Testnet USDC
    domain: 26, // Arc Testnet domain ID
  },
  "BASE-SEPOLIA": {
    // Gateway contracts on Base Sepolia
    // Source: Gateway API /info endpoint
    gatewayWallet: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9", // GatewayWallet
    gatewayMinter: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B", // GatewayMinter
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    domain: 6, // Base Sepolia domain
  },
  "ARBITRUM-SEPOLIA": {
    gatewayWallet: "0x0000000000000000000000000000000000000000", // TODO: Get from Circle docs
    gatewayMinter: "0x0000000000000000000000000000000000000000", // TODO: Get from Circle docs
    usdc: "0x75faf114eafb1BDbe2F0316DF893fd58Ce87AAf7",
    domain: 23, // Arbitrum Sepolia domain
  },
  // Mainnet addresses (placeholder - need to get from Circle docs)
  "ARC": {
    gatewayWallet: "0x0000000000000000000000000000000000000000",
    gatewayMinter: "0x0000000000000000000000000000000000000000",
    usdc: "0x3600000000000000000000000000000000000000",
    domain: 26,
  },
  "BASE": {
    gatewayWallet: "0x0000000000000000000000000000000000000000",
    gatewayMinter: "0x0000000000000000000000000000000000000000",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    domain: 6,
  },
  "ETH": {
    gatewayWallet: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
    gatewayMinter: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    domain: 0,
  },
  "ETHEREUM": {
    gatewayWallet: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
    gatewayMinter: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    domain: 0,
  },
  "ARBITRUM": {
    gatewayWallet: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
    gatewayMinter: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B",
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    domain: 3,
  },
  "OPTIMISM": {
    gatewayWallet: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
    gatewayMinter: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B",
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    domain: 2,
  },
  "POLYGON": {
    gatewayWallet: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
    gatewayMinter: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B",
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    domain: 7,
  },
  "AVALANCHE": {
    gatewayWallet: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
    gatewayMinter: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B",
    usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    domain: 1,
  },
  "SONIC": {
    // Sonic testnet - need to verify these addresses
    gatewayWallet: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
    gatewayMinter: "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B",
    usdc: "0x0000000000000000000000000000000000000000", // TODO: Get Sonic USDC address
    domain: 999, // TODO: Get actual Sonic domain
  },
  "NEAR": {
    // NEAR doesn't use EVM Gateway - uses different bridge mechanism
    // This is a placeholder - NEAR requires different integration
    gatewayWallet: "0x0000000000000000000000000000000000000000",
    gatewayMinter: "0x0000000000000000000000000000000000000000",
    usdc: "0x0000000000000000000000000000000000000000",
    domain: 998, // TODO: NEAR uses different domain system
  },
};

// Gateway API endpoints
// Reference: https://developers.circle.com/gateway/quickstarts/unified-balance
export const GATEWAY_API_BASE_URL = "https://gateway-api-testnet.circle.com/v1";
export const GATEWAY_API_V1_INFO = `${GATEWAY_API_BASE_URL}/info`;
export const GATEWAY_API_V1_BALANCES = `${GATEWAY_API_BASE_URL}/balances`;
export const GATEWAY_API_V1_TRANSFER = `${GATEWAY_API_BASE_URL}/transfer`;

// Gateway Contract ABIs
// Reference: https://developers.circle.com/gateway/references/contract-interfaces-and-events

// Gateway Wallet ABI (for deposits)
export const GATEWAY_WALLET_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "depositFor",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "depositor", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "depositWithPermit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "addDelegate",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "delegate", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "removeDelegate",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "delegate", type: "address" },
    ],
    outputs: [],
  },
] as const;

// Gateway Minter ABI (for minting on destination)
// Reference: https://developers.circle.com/gateway/quickstarts/unified-balance
// Note: Function is called "gatewayMint" not "mint"
export const GATEWAY_MINTER_ABI = [
  {
    name: "gatewayMint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "attestationPayload", type: "bytes" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

// USDC ABI (for approvals and permits)
export const USDC_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "permit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;

/**
 * Get Gateway contract addresses for a chain
 */
export function getGatewayAddresses(chain: string) {
  const addresses = GATEWAY_CONTRACT_ADDRESSES[chain];
  if (!addresses) {
    throw new Error(`Gateway not supported for chain: ${chain}`);
  }
  if (addresses.gatewayWallet === "0x0000000000000000000000000000000000000000") {
    // For destination chains, minter might be available even if wallet isn't
    // Gateway Minter can be deployed on chains without Gateway Wallet
    if (addresses.gatewayMinter === "0x0000000000000000000000000000000000000000") {
      throw new Error(
        `Gateway contracts not deployed for chain: ${chain}. ` +
        `Check Circle documentation for contract addresses. ` +
        `Note: Gateway Minter may be available on destination chains even if Gateway Wallet isn't.`
      );
    }
    // If only minter is available, that's okay for destination chains
    console.warn(`[Gateway] Gateway Wallet not deployed on ${chain}, but Gateway Minter is available`);
  }
  return addresses;
}

/**
 * Get destination domain ID for a chain
 */
export function getGatewayDestinationDomain(chain: string): number {
  const addresses = getGatewayAddresses(chain);
  return addresses.domain;
}

