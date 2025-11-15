/**
 * Gateway EIP-712 Typed Data
 * 
 * Implements EIP-712 signing for Gateway burn intents
 * Reference: https://developers.circle.com/gateway/quickstarts/unified-balance
 */

import { pad, zeroAddress } from "viem";

// Export maxUint256 for use in other files
export const maxUint256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

/**
 * Convert address to bytes32 format (padded to 32 bytes)
 */
export function addressToBytes32(address: string): `0x${string}` {
  return pad(address.toLowerCase() as `0x${string}`, { size: 32 });
}

/**
 * EIP-712 Domain for Gateway Wallet
 */
export const GATEWAY_EIP712_DOMAIN = {
  name: "GatewayWallet",
  version: "1",
};

/**
 * EIP-712 Type Definitions
 */
export const EIP712_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
  ],
  TransferSpec: [
    { name: "version", type: "uint32" },
    { name: "sourceDomain", type: "uint32" },
    { name: "destinationDomain", type: "uint32" },
    { name: "sourceContract", type: "bytes32" },
    { name: "destinationContract", type: "bytes32" },
    { name: "sourceToken", type: "bytes32" },
    { name: "destinationToken", type: "bytes32" },
    { name: "sourceDepositor", type: "bytes32" },
    { name: "destinationRecipient", type: "bytes32" },
    { name: "sourceSigner", type: "bytes32" },
    { name: "destinationCaller", type: "bytes32" },
    { name: "value", type: "uint256" },
    { name: "salt", type: "bytes32" },
    { name: "hookData", type: "bytes" },
  ],
  BurnIntent: [
    { name: "maxBlockHeight", type: "uint256" },
    { name: "maxFee", type: "uint256" },
    { name: "spec", type: "TransferSpec" },
  ],
};

/**
 * Create TransferSpec with proper encoding
 */
export interface TransferSpecParams {
  version: number;
  sourceDomain: number;
  destinationDomain: number;
  sourceContract: string;
  destinationContract: string;
  sourceToken: string;
  destinationToken: string;
  sourceDepositor: string;
  destinationRecipient: string;
  sourceSigner: string;
  destinationCaller?: string;
  value: bigint;
  salt: string;
  hookData?: string;
}

export function createTransferSpec(params: TransferSpecParams) {
  return {
    version: params.version,
    sourceDomain: params.sourceDomain,
    destinationDomain: params.destinationDomain,
    sourceContract: addressToBytes32(params.sourceContract),
    destinationContract: addressToBytes32(params.destinationContract),
    sourceToken: addressToBytes32(params.sourceToken),
    destinationToken: addressToBytes32(params.destinationToken),
    sourceDepositor: addressToBytes32(params.sourceDepositor),
    destinationRecipient: addressToBytes32(params.destinationRecipient),
    sourceSigner: addressToBytes32(params.sourceSigner),
    destinationCaller: params.destinationCaller 
      ? addressToBytes32(params.destinationCaller)
      : addressToBytes32(zeroAddress),
    value: params.value.toString(),
    salt: params.salt as `0x${string}`,
    hookData: params.hookData || "0x",
  };
}

/**
 * Create BurnIntent
 */
export interface BurnIntentParams {
  maxBlockHeight: bigint | string;
  maxFee: bigint | string;
  spec: ReturnType<typeof createTransferSpec>;
}

export function createBurnIntent(params: BurnIntentParams) {
  return {
    maxBlockHeight: typeof params.maxBlockHeight === "bigint" 
      ? params.maxBlockHeight.toString() 
      : params.maxBlockHeight,
    maxFee: typeof params.maxFee === "bigint" 
      ? params.maxFee.toString() 
      : params.maxFee,
    spec: params.spec,
  };
}

/**
 * Create EIP-712 Typed Data for signing BurnIntent
 */
export function createBurnIntentTypedData(burnIntent: ReturnType<typeof createBurnIntent>) {
  return {
    domain: GATEWAY_EIP712_DOMAIN,
    types: {
      BurnIntent: EIP712_TYPES.BurnIntent,
      TransferSpec: EIP712_TYPES.TransferSpec,
    },
    primaryType: "BurnIntent" as const,
    message: burnIntent,
  };
}

