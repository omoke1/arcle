/**
 * Feature Flags
 * 
 * Centralized feature flag management
 */

/**
 * Check if session keys are enabled
 */
export function isSessionKeysEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_SESSION_KEYS === 'true' || 
         process.env.ENABLE_SESSION_KEYS === 'true';
}

/**
 * Check if agent router is enabled
 */
export function isAgentRouterEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_AGENT_ROUTER === 'true' || 
         process.env.ENABLE_AGENT_ROUTER === 'true' ||
         true; // Default to enabled
}

/**
 * Check if hybrid mode is enabled (use both AI service and agent router)
 */
export function isHybridModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_HYBRID_MODE === 'true' || 
         process.env.ENABLE_HYBRID_MODE === 'true' ||
         true; // Default to enabled
}

/**
 * Check if Circle MSCA is enabled
 */
export function isMSCAEnabled(): boolean {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_ENABLE_CIRCLE_MSCA === 'true';
  }
  return process.env.ENABLE_CIRCLE_MSCA === 'true' || 
         process.env.NEXT_PUBLIC_ENABLE_CIRCLE_MSCA === 'true';
}

/**
 * Check if agent wallet is enabled
 * (Same as MSCA since we use Circle MSCAs as agent wallets)
 */
export function isAgentWalletEnabled(): boolean {
  return isMSCAEnabled();
}

/**
 * Get all feature flags
 */
export function getFeatureFlags() {
  return {
    sessionKeys: isSessionKeysEnabled(),
    msca: isMSCAEnabled(),
    agentWallet: isAgentWalletEnabled(),
    agentRouter: isAgentRouterEnabled(),
    hybridMode: isHybridModeEnabled(),
  };
}
