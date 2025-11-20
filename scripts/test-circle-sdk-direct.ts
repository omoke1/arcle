/**
 * Direct Circle SDK Test
 * 
 * Tests the Circle SDK directly without going through API routes
 */

import dotenv from "dotenv";
import { initiateUserControlledWalletsClient } from '@circle-fin/user-controlled-wallets';

dotenv.config({ path: ".env.local" });
dotenv.config();

const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY || "";
const CIRCLE_APP_ID = process.env.NEXT_PUBLIC_CIRCLE_APP_ID || "";

async function testCircleSDKDirect() {
  console.log("\n🧪 ===== Direct Circle SDK Test =====\n");

  // Verify environment variables
  if (!CIRCLE_API_KEY || !CIRCLE_APP_ID) {
    console.error("❌ Missing required environment variables:");
    if (!CIRCLE_API_KEY) console.error("   - CIRCLE_API_KEY");
    if (!CIRCLE_APP_ID) console.error("   - NEXT_PUBLIC_CIRCLE_APP_ID");
    process.exit(1);
  }

  console.log("✅ Environment variables configured");
  console.log(`   📱 App ID: ${CIRCLE_APP_ID}`);
  console.log(`   🔑 API Key: ${CIRCLE_API_KEY.substring(0, 10)}...`);
  console.log(`   🔑 API Key type: ${CIRCLE_API_KEY.startsWith('TEST_API_KEY') ? 'Sandbox (TEST)' : 'Production (LIVE)'}`);

  // Initialize Circle SDK client
  console.log("\n📝 Step 1: Initializing Circle SDK client...");
  try {
    const client = initiateUserControlledWalletsClient({
      apiKey: CIRCLE_API_KEY,
    });
    console.log("✅ Circle SDK client initialized successfully");

    // Create a test user
    console.log("\n📝 Step 2: Creating test user...");
    const testUserId = `test-user-${Date.now()}`;
    console.log(`   👤 Test User ID: ${testUserId}`);
    
    const createUserResponse = await client.createUser({
      userId: testUserId,
    });

    console.log("\n✅ User created successfully!");
    console.log("📊 Response:", JSON.stringify(createUserResponse.data, null, 2));

    if (createUserResponse.data) {
      console.log("\n📝 Step 3: Creating user token...");
      const tokenResponse = await client.createUserToken({
        userId: createUserResponse.data.id || testUserId,
      });

      console.log("✅ User token created successfully!");
      console.log("📊 Token Response:", JSON.stringify(tokenResponse.data, null, 2));

      if (tokenResponse.data?.userToken) {
        console.log("\n📝 Step 4: Listing wallets...");
        const walletsResponse = await client.listWallets({
          userToken: tokenResponse.data.userToken,
        });

        console.log("✅ Wallets listed successfully!");
        console.log("📊 Wallets Response:", JSON.stringify(walletsResponse.data, null, 2));
      }
    }

    console.log("\n✅ ===== All tests passed! =====\n");
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

testCircleSDKDirect().catch(console.error);










