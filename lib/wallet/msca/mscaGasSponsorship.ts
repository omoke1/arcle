/**
 * Circle MSCA Gas Sponsorship
 * 
 * Integrates with Arc's native paymaster + Circle's approval system
 * Arc handles gas abstraction for small transactions automatically
 * Large transactions require user approval through Circle
 */

export interface GasSponsorshipConfig {
  sponsorThreshold: string; // Amount in USDC (smallest unit) - sponsor below this
  userPaysAbove: string; // Amount in USDC (smallest unit) - user pays above this
}

export const DEFAULT_GAS_CONFIG: GasSponsorshipConfig = {
  sponsorThreshold: '10000000', // 10 USDC
  userPaysAbove: '10000000', // 10 USDC
};

/**
 * Determine if transaction should be gas-sponsored
 * 
 * Arc's paymaster handles this automatically, but we can check for UI purposes
 */
export function shouldSponsorGas(
  amount: string,
  config: GasSponsorshipConfig = DEFAULT_GAS_CONFIG
): boolean {
  const amountBigInt = BigInt(amount);
  const threshold = BigInt(config.sponsorThreshold);
  
  return amountBigInt <= threshold;
}

/**
 * Get gas sponsorship status message
 */
export function getGasSponsorshipMessage(
  amount: string,
  config: GasSponsorshipConfig = DEFAULT_GAS_CONFIG
): string {
  if (shouldSponsorGas(amount, config)) {
    return 'Gas will be sponsored by Arcle';
  }
  return 'User will pay gas fees';
}

