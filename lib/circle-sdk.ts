/**
 * Circle SDK Client for Developer-Controlled Wallets
 * 
 * Uses Circle's official SDK instead of REST API
 * https://developers.circle.com/developer-controlled-wallets/docs
 */

import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { circleConfig } from './circle';

let clientInstance: ReturnType<typeof initiateDeveloperControlledWalletsClient> | null = null;

/**
 * Initialize Circle SDK client
 * Returns a singleton instance
 */
export function getCircleClient() {
  if (clientInstance) {
    return clientInstance;
  }

  const apiKey = circleConfig.apiKey;
  const entitySecret = circleConfig.entitySecret;

  if (!apiKey) {
    throw new Error("Circle API key not configured. Set CIRCLE_API_KEY or NEXT_PUBLIC_CIRCLE_API_KEY in .env");
  }

  if (!entitySecret) {
    throw new Error("Circle Entity Secret not configured. Set CIRCLE_ENTITY_SECRET in .env. Run 'npm run generate-entity-secret' to generate one.");
  }

  // Configure SDK with explicit baseUrl for sandbox
  // The SDK defaults to production (api.circle.com), so we need to explicitly set sandbox
  const isSandbox = apiKey.startsWith('TEST_API_KEY:') || 
                    circleConfig.environment === 'sandbox';
  
  const sdkConfig: Parameters<typeof initiateDeveloperControlledWalletsClient>[0] = {
    apiKey,
    entitySecret,
    // Explicitly set sandbox URL - SDK doesn't auto-detect from TEST_API_KEY prefix
    baseUrl: isSandbox 
      ? 'https://api-sandbox.circle.com'
      : 'https://api.circle.com',
  };

  console.log(`Circle SDK initialized with ${isSandbox ? 'SANDBOX' : 'PRODUCTION'} environment`);
  
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
        "Entity Secret not registered in Circle Console. " +
        "You must register your Entity Secret in Circle Developer Console before creating wallets. " +
        "Go to https://console.circle.com/ → Entity Settings → Register Entity Secret. " +
        "Alternatively, use the standalone script: npm run create-wallet"
      );
      (helpfulError as any).code = 156016;
      throw helpfulError;
    }
    
    throw error;
  }
}

