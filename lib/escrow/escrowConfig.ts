/**
 * Escrow Configuration
 * 
 * Loads escrow contract configuration from environment variables
 */

export interface EscrowConfig {
  contractAddress: string;
  usdcTokenAddress: string;
  rpcUrl: string;
  privateKey?: string; // For signing transactions (backend only)
}

/**
 * Get escrow configuration for Arc Testnet
 */
export function getEscrowConfig(): EscrowConfig {
  const contractAddress = process.env.ESCROW_CONTRACT_ADDRESS_ARC_TESTNET || process.env.ESCROW_CONTRACT_ADDRESS;
  const usdcAddress = process.env.ARC_USDC_TESTNET_ADDRESS || process.env.NEXT_PUBLIC_ARC_USDC_TESTNET_ADDRESS || "0x3600000000000000000000000000000000000000";
  const rpcUrl = process.env.ARC_RPC_URL || process.env.ESCROW_RPC_URL_ARC_TESTNET || "https://rpc.testnet.arc.network";
  const privateKey = process.env.ESCROW_PRIVATE_KEY; // For backend operations only

  if (!contractAddress) {
    throw new Error(
      'ESCROW_CONTRACT_ADDRESS_ARC_TESTNET or ESCROW_CONTRACT_ADDRESS not set. ' +
      'Deploy the contract first using: npx hardhat run scripts/deploy-payment-escrow.ts --network arc-testnet'
    );
  }

  return {
    contractAddress,
    usdcTokenAddress: usdcAddress,
    rpcUrl,
    privateKey,
  };
}

/**
 * Check if escrow is configured
 */
export function isEscrowConfigured(): boolean {
  try {
    getEscrowConfig();
    return true;
  } catch {
    return false;
  }
}


