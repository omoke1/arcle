/**
 * Circle SDK Client for Developer-Controlled Wallets
 * 
 * Uses Circle's official SDK instead of REST API
 * https://developers.circle.com/developer-controlled-wallets/docs
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { circleConfig } from '../circle';

let clientInstance: ReturnType<typeof initiateDeveloperControlledWalletsClient> | null = null;
let cachedPublicKey: string | null = null;

/**
 * Clear the SDK client instance (useful for testing or re-initialization)
 */
export function clearCircleClient() {
  clientInstance = null;
  cachedPublicKey = null; // Clear cached public key when clearing client
}

/**
 * Get entity public key (cached)
 * This is needed for transaction encryption
 */
export async function getEntityPublicKey(): Promise<string | null> {
  // Return cached key if available
  if (cachedPublicKey) {
    return cachedPublicKey;
  }
  
  try {
    const client = getCircleClient();
    console.log('Fetching entity public key...');
    const response = await client.getPublicKey();
    
    if (response.data?.publicKey) {
      cachedPublicKey = response.data.publicKey;
      console.log("✅ Successfully fetched and cached entity public key");
      return cachedPublicKey;
    }
    
    return null;
  } catch (error: any) {
    console.error("Failed to fetch entity public key:", error);
    console.error("Error details:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      url: error.config?.url || error.request?.url || 'unknown',
    });
    // Don't throw - let the transaction creation handle the error
    return null;
  }
}

/**
 * Initialize Circle SDK client
 * Returns a singleton instance
 */
export function getCircleClient() {
  if (clientInstance) {
    return clientInstance;
  }

  const apiKey = circleConfig.apiKey;
  // NOTE: This is archived/legacy code for Developer-Controlled Wallets
  // We now use User-Controlled Wallets only (see lib/circle-user-sdk.ts)
  // Read entitySecret directly from env since it's removed from circleConfig
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET || "";

  if (!apiKey) {
    throw new Error("Circle API key not configured. Set CIRCLE_API_KEY or NEXT_PUBLIC_CIRCLE_API_KEY in .env");
  }

  if (!entitySecret) {
    throw new Error("Circle Entity Secret not configured. Set CIRCLE_ENTITY_SECRET in .env. Run 'npm run generate-entity-secret' to generate one.");
  }

  // Configure SDK baseUrl - ALWAYS use production URL (api.circle.com)
  // Per Circle API: The base URL should be https://api.circle.com for both testnet and mainnet
  // The environment (testnet vs mainnet) is determined by the API key, not the base URL
  // User confirmed: URL should be https://api.circle.com/v1/w3s/config/entity/publicKey
  const baseUrl = 'https://api.circle.com';
  const isSandbox = false; // Always use production URL, even for testnet
  
  const sdkConfig: Parameters<typeof initiateDeveloperControlledWalletsClient>[0] = {
    apiKey,
    entitySecret,
    // Use production URL by default, or sandbox if explicitly configured
    baseUrl,
  };

  console.log(`Circle SDK initialized with ${isSandbox ? 'SANDBOX' : 'PRODUCTION'} environment`);
  console.log(`Circle SDK baseUrl: ${baseUrl}`);
  console.log(`Environment variables: NEXT_PUBLIC_ENV=${process.env.NEXT_PUBLIC_ENV}, CIRCLE_ENV=${process.env.CIRCLE_ENV}`);
  
  clientInstance = initiateDeveloperControlledWalletsClient(sdkConfig);
  
  return clientInstance;
}

/**
 * Get or create a default wallet set
 * This is a helper to ensure we have a wallet set to create wallets in
 */
export async function getOrCreateWalletSet(name: string = 'ARCLE Default Wallet Set') {
  const client = getCircleClient();
  
  try {
    // Try to list wallet sets first
    const walletSets = await client.listWalletSets();
    
    // Use existing wallet set if available
    if (walletSets.data?.walletSets && walletSets.data.walletSets.length > 0) {
      return walletSets.data.walletSets[0];
    }
    
    // Create a new wallet set if none exists
    const response = await client.createWalletSet({ name });
    
    if (!response.data?.walletSet) {
      throw new Error("Failed to create wallet set");
    }
    
    return response.data.walletSet;
  } catch (error: any) {
    console.error("Error getting/creating wallet set:", error);
    
    // Provide more helpful error message
    if (error?.response?.data?.code === 156016 || 
        error?.response?.data?.message?.includes("entity secret has not been set yet")) {
      const helpfulError = new Error(
        "Entity Secret not registered with Circle. " +
        "You must register your Entity Secret before creating wallets. " +
        "Run 'npm run register-entity-secret' to register it. " +
        "See: https://developers.circle.com/wallets/dev-controlled/register-entity-secret"
      );
      (helpfulError as any).code = 156016;
      throw helpfulError;
    }
    
    throw error;
  }
}

