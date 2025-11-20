/**
 * Test Wallet Challenge Flow
 * 
 * User-Controlled Wallets require a challenge flow:
 * 1. Create user
 * 2. Create user token
 * 3. Create wallet challenge (returns challengeId)
 * 4. User completes challenge (PIN setup) - requires client-side SDK
 * 5. Wallet is created
 */

import dotenv from "dotenv";
import { initiateUserControlledWalletsClient } from '@circle-fin/user-controlled-wallets';

dotenv.config({ path: ".env.local" });
dotenv.config();

const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY || "";
const CIRCLE_APP_ID = process.env.NEXT_PUBLIC_CIRCLE_APP_ID || "";

async function testWalletChallengeFlow() {
  console.log("\n🧪 ===== Wallet Challenge Flow Test =====\n");

  if (!CIRCLE_API_KEY || !CIRCLE_APP_ID) {
    console.error("❌ Missing required environment variables");
    process.exit(1);
  }

  console.log("✅ Environment variables configured");
  console.log(`   📱 App ID: ${CIRCLE_APP_ID}`);
  console.log(`   🔑 API Key: ${CIRCLE_API_KEY.substring(0, 10)}...`);

  try {
    // Step 1: Initialize SDK
    console.log("\n📝 Step 1: Initializing Circle SDK...");
    const client = initiateUserControlledWalletsClient({
      apiKey: CIRCLE_API_KEY,
    });
    console.log("✅ SDK initialized");

    // Step 2: Create user
    console.log("\n📝 Step 2: Creating user...");
    const testUserId = `wallet-test-${Date.now()}`;
    const userResponse = await client.createUser({
      userId: testUserId,
    });
    console.log("✅ User created:", userResponse.data?.id);

    // Step 3: Create user token
    console.log("\n📝 Step 3: Creating user token...");
    const tokenResponse = await client.createUserToken({
      userId: userResponse.data?.id || testUserId,
    });
    const userToken = tokenResponse.data?.userToken;
    console.log("✅ Token created");

    // Step 4: Create PIN + Wallet challenge (combined)
    console.log("\n📝 Step 4: Creating PIN + Wallet challenge...");
    console.log("   Calling createUserPinWithWallets with:");
    console.log("   - userToken:", userToken?.substring(0, 20) + "...");
    console.log("   - blockchains: ['ARC-TESTNET']");
    console.log("\n   Note: This method combines PIN setup + wallet creation");
    
    const walletResponse = await client.createUserPinWithWallets({
      userToken: userToken!,
      blockchains: ['ARC-TESTNET'],
      accountType: 'SCA',
    });

    console.log("\n📊 Response from createWallet:");
    console.log(JSON.stringify(walletResponse.data, null, 2));

    // Check what was returned
    if (walletResponse.data) {
      const data: any = walletResponse.data;
      
      if (data.challengeId) {
        console.log("\n✅ Challenge Flow Confirmed!");
        console.log(`   🔐 Challenge ID: ${data.challengeId}`);
        console.log("\n⚠️  Next Steps (requires client-side SDK):");
        console.log("   1. Use Circle's W3sInitializeWidget with this challengeId");
        console.log("   2. User completes PIN setup");
        console.log("   3. Wallet is created after challenge completion");
        console.log("\n📚 Documentation:");
        console.log("   https://developers.circle.com/w3s/docs/web-sdk-ui-customize");
      } else if (data.wallet || data.wallets) {
        console.log("\n⚠️  Wallet returned directly (unexpected for User-Controlled):");
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log("\n❓ Unknown response structure:");
        console.log(JSON.stringify(data, null, 2));
      }
    }

    console.log("\n✅ ===== Test Complete =====\n");
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    if (error.response) {
      console.error("📊 Response Status:", error.response.status);
      console.error("📊 Response Data:", JSON.stringify(error.response.data, null, 2));
    }
    if (error.stack) {
      console.error("📚 Stack Trace:", error.stack);
    }
    process.exit(1);
  }
}

testWalletChallengeFlow().catch(console.error);

