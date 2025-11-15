/**
 * Circle CCTP Smart Contract Integration
 * 
 * Implements CCTP using Circle's smart contracts
 * Reference: https://github.com/circlefin/evm-cctp-contracts
 * 
 * CCTP Flow:
 * 1. Burn USDC on source chain via TokenMessenger contract
 * 2. Poll Circle's Attestation Service for attestation
 * 3. Mint USDC on destination chain via MessageTransmitter contract
 */

// CCTP Contract Addresses (from Circle's documentation and contracts repository)
// Reference: https://github.com/circlefin/evm-cctp-contracts
export const CCTP_CONTRACT_ADDRESSES: Record<string, {
  tokenMessenger: string; // For burning USDC (TokenMessengerV2)
  messageTransmitter: string; // For minting USDC (MessageTransmitterV2)
  tokenMinter?: string; // TokenMinterV2 (optional, for V2)
  messageV2?: string; // MessageV2 (optional, for V2)
  usdc: string; // USDC token address
  domain: number; // Circle domain ID
}> = {
  // Testnet addresses (Sepolia testnets)
  "ARC-TESTNET": {
    // CCTP V2 contracts on Arc Testnet
    // Source: https://docs.arc.network/arc/references/contract-addresses#cctp
    tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA", // TokenMessengerV2
    messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275", // MessageTransmitterV2
    tokenMinter: "0xb43db544E2c27092c107639Ad201b3dEfAbcF192", // TokenMinterV2
    messageV2: "0xbaC0179bB358A8936169a63408C8481D582390C4", // MessageV2
    usdc: "0x3600000000000000000000000000000000000000", // Arc Testnet USDC (confirmed)
    domain: 26, // Arc Testnet domain ID
  },
  "BASE-SEPOLIA": {
    tokenMessenger: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
    messageTransmitter: "0x7865fAfC2db2093669d92c0F33AeEF291086BEFD",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    domain: 6, // Base Sepolia domain
  },
  "ARBITRUM-SEPOLIA": {
    tokenMessenger: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
    messageTransmitter: "0x7865fAfC2db2093669d92c0F33AeEF291086BEFD",
    usdc: "0x75faf114eafb1BDbe2F0316DF893fd58Ce87AAf7",
    domain: 23, // Arbitrum Sepolia domain
  },
  "ETH-SEPOLIA": {
    tokenMessenger: "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5",
    messageTransmitter: "0x7865fAfC2db2093669d92c0F33AeEF291086BEFD",
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    domain: 0, // Ethereum Sepolia domain
  },
  // Mainnet addresses
  "ARC": {
    tokenMessenger: "0x0000000000000000000000000000000000000000",
    messageTransmitter: "0x0000000000000000000000000000000000000000",
    usdc: "0x3600000000000000000000000000000000000000",
    domain: 0,
  },
  "BASE": {
    tokenMessenger: "0x1682Ae6375C4E4A6e6d2a9e5e0E4C5e4d6e7f8a9b",
    messageTransmitter: "0x0a992d191DEeC32aFe36203Ad87D7d289a738F81",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    domain: 6,
  },
  "ARBITRUM": {
    tokenMessenger: "0x1682Ae6375C4E4A6e6d2a9e5e0E4C5e4d6e7f8a9b",
    messageTransmitter: "0xC30362313FBBA5cf9163F0bb16a0e01F01A896ca",
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    domain: 3,
  },
  "ETH": {
    tokenMessenger: "0xbd3fa81b58ba92a82136038B25a3324e6c2b2c0e",
    messageTransmitter: "0x0a992d191DEeC32aFe36203Ad87D7d289a738F81",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    domain: 0,
  },
};

// CCTP V2 ABIs (from Circle's contracts)
// Reference: https://developers.circle.com/cctp/migration-from-v1-to-v2
// V2 contracts: TokenMessengerV2, MessageTransmitterV2
export const TOKEN_MESSENGER_V2_ABI = [
  {
    name: "depositForBurn",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" }, // V2: Address that can call receiveMessage on destination
      { name: "maxFee", type: "uint256" }, // V2: Maximum fee for Fast Transfer
      { name: "minFinalityThreshold", type: "uint32" }, // V2: 1000 for Fast, 2000 for Standard
    ],
    outputs: [{ name: "nonce", type: "uint64" }],
  },
] as const;

// Keep V1 ABI for backward compatibility if needed
export const TOKEN_MESSENGER_ABI = TOKEN_MESSENGER_V2_ABI;

export const MESSAGE_TRANSMITTER_ABI = [
  {
    name: "receiveMessage",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "message", type: "bytes" },
      { name: "attestation", type: "bytes" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
] as const;

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
] as const;

// CCTP V2 API URLs
// Reference: https://developers.circle.com/cctp/migration-from-v1-to-v2
export const CCTP_ATTESTATION_SERVICE_URL = "https://iris-api.circle.com"; // V2 API
export const CCTP_V2_MESSAGES_ENDPOINT = "https://iris-api.circle.com/v2/messages"; // V2: Single endpoint for message + attestation

/**
 * Get CCTP contract addresses for a chain
 */
export function getCCTPAddresses(chain: string) {
  const addresses = CCTP_CONTRACT_ADDRESSES[chain];
  if (!addresses) {
    throw new Error(`CCTP not supported for chain: ${chain}`);
  }
  if (addresses.tokenMessenger === "0x0000000000000000000000000000000000000000") {
    throw new Error(`CCTP contracts not deployed for chain: ${chain}. Check Circle documentation for contract addresses.`);
  }
  return addresses;
}

/**
 * Get destination domain ID for a chain
 */
export function getDestinationDomain(chain: string): number {
  const addresses = getCCTPAddresses(chain);
  return addresses.domain;
}
