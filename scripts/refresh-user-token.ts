/**
 * Refresh User Token Script
 * 
 * This script refreshes a user token for User-Controlled Wallets.
 * User tokens expire after 60 minutes, so they need to be refreshed periodically.
 * 
 * Usage:
 *   REFRESH_USER_ID=your-user-id npm run refresh:user-token
 * 
 * Or set in .env:
 *   REFRESH_USER_ID=your-user-id
 */

import "dotenv/config";
import { getUserCircleClient } from "@/lib/circle-user-sdk";

async function main() {
  const userId = process.env.REFRESH_USER_ID;
  if (!userId) {
    console.error("❌ REFRESH_USER_ID env var required");
    console.error("\nUsage:");
    console.error("  REFRESH_USER_ID=your-user-id npm run refresh:user-token");
    console.error("\nOr set in .env:");
    console.error("  REFRESH_USER_ID=your-user-id");
    process.exit(1);
  }

  const client = getUserCircleClient();
  
  // Step 1: Try to check token validity first (if we have an old token)
  const oldToken = process.env.TEST_USER_TOKEN;
  if (oldToken) {
    console.log("🔍 Checking old token validity...");
    try {
      const statusResponse = await client.getUserStatus({ userToken: oldToken });
      if (statusResponse.data) {
        console.log("✅ Old token is still valid!");
        console.log(`   User status: ${statusResponse.data.status}`);
        console.log(`   PIN status: ${statusResponse.data.pinStatus || 'N/A'}`);
        console.log("\n💡 Token is still valid. No refresh needed.");
        return;
      }
    } catch (error: any) {
      const status = error.response?.status || error.status;
      if (status === 403 || status === 401) {
        console.log("⚠️  Old token is invalid or expired. Creating new token...");
      } else {
        console.log("⚠️  Could not verify token status. Creating new token...");
      }
    }
  }

  // Step 2: Create new user token
  console.log(`\n🔄 Creating new user token for userId: ${userId}`);
  try {
    const response = await client.createUserToken({ userId });

    if (!response.data?.userToken) {
      console.error("❌ Failed to create user token:", response);
      process.exit(1);
    }

    console.log("\n✅ New user token created successfully!");
    console.log("=".repeat(80));
    console.log("New user token:");
    console.log(response.data.userToken);
    console.log("=".repeat(80));
    
    if (response.data.encryptionKey) {
      console.log("\nEncryption key:");
      console.log(response.data.encryptionKey);
    }
    
    if (response.data.refreshToken) {
      console.log("\nRefresh token (save this for future refreshes):");
      console.log(response.data.refreshToken);
    }
    
    console.log("\n💡 Token expires after 60 minutes. Refresh again when needed.");
    console.log("\n📋 To use this token in tests, set:");
    console.log(`   $env:TEST_USER_TOKEN="${response.data.userToken}"`);
    
  } catch (error: any) {
    console.error("\n❌ Failed to create user token:");
    const status = error.response?.status || error.status;
    const message = error.response?.data?.message || error.message || "Unknown error";
    
    if (status === 403 || status === 401) {
      console.error("   Authentication failed. Please verify:");
      console.error("   1. User ID is correct");
      console.error("   2. API key has proper permissions");
      console.error("   3. App ID is configured correctly");
    }
    
    console.error(`   Status: ${status || 'N/A'}`);
    console.error(`   Message: ${message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});



