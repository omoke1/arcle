/**
 * Circle SDK Client for User-Controlled Wallets
 * 
 * Uses Circle's User-Controlled Wallets SDK
 * https://developers.circle.com/user-controlled-wallets/docs
 */

import { initiateUserControlledWalletsClient } from '@circle-fin/user-controlled-wallets';
import { circleConfig } from './circle';

let userClientInstance: ReturnType<typeof initiateUserControlledWalletsClient> | null = null;

/**
 * Clear the User-Controlled client instance
 */
export function clearUserCircleClient() {
  userClientInstance = null;
}

/**
 * Get User-Controlled Wallets SDK client
 * Returns a singleton instance
 */
export function getUserCircleClient() {
  if (userClientInstance) {
    return userClientInstance;
  }

  const apiKey = circleConfig.apiKey;
  const appId = circleConfig.appId;

  if (!apiKey) {
    throw new Error("Circle API key not configured. Set CIRCLE_API_KEY or NEXT_PUBLIC_CIRCLE_API_KEY in .env");
  }

  if (!appId) {
    throw new Error("Circle App ID not configured. Set NEXT_PUBLIC_CIRCLE_APP_ID in .env. Required for User-Controlled Wallets.");
  }

  // Circle SDK determines sandbox vs production from the API key prefix
  // Only pass apiKey to the SDK - it handles baseUrl internally
  const sdkConfig: any = {
    apiKey,
  };

  console.log(`User-Controlled Wallets SDK initialized`);
  console.log(`App ID: ${appId.substring(0, 8)}...`);
  console.log(`API Key type: ${apiKey.startsWith('TEST_API_KEY') ? 'Sandbox (TEST)' : 'Production (LIVE)'}`);
  
  userClientInstance = initiateUserControlledWalletsClient(sdkConfig);
  
  return userClientInstance;
}

