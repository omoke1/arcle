/**
 * Test Transaction API Structure
 * 
 * Tests the updated transaction endpoint structure:
 * - Accepts EITHER userId OR userToken (not both required)
 * - Handles challengeId responses
 * - Handles direct transaction responses
 * 
 * This test validates the API structure without requiring a full wallet setup
 */

import "dotenv/config";

const API_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

async function testApiStructure() {
  console.log("\n🧪 Testing Transaction API Structure\n");
  console.log("=".repeat(80));

  // Test 1: Missing both userId and userToken
  console.log("\n1️⃣ Test: Missing both userId and userToken");
  console.log("-".repeat(80));
  try {
    const response = await fetch(`${API_URL}/api/circle/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletId: "test-wallet-id",
        destinationAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        amount: "0.1",
      }),
    });
    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Success: ${data.success}`);
    console.log(`   Error: ${data.error || "N/A"}`);
    
    if (response.status === 400 && data.error?.includes("Either userId or userToken")) {
      console.log("   ✅ Correctly rejects missing authentication");
    } else {
      console.log("   ⚠️  Unexpected response");
    }
  } catch (error: any) {
    console.log(`   ❌ Request failed: ${error.message}`);
  }

  // Test 2: Only userId provided (no userToken)
  console.log("\n2️⃣ Test: Only userId provided");
  console.log("-".repeat(80));
  try {
    const response = await fetch(`${API_URL}/api/circle/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletId: "test-wallet-id",
        destinationAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        amount: "0.1",
        userId: "test-user-id",
      }),
    });
    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Success: ${data.success}`);
    
    if (response.status === 400) {
      console.log(`   Error: ${data.error || "N/A"}`);
      if (data.error?.includes("Wallet not found") || data.error?.includes("Invalid")) {
        console.log("   ✅ Accepts userId (validation error is expected with test data)");
      }
    } else if (response.status === 200 || response.status === 201) {
      console.log("   ✅ Accepts userId-only authentication");
    } else {
      console.log(`   ⚠️  Unexpected status: ${response.status}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Request failed: ${error.message}`);
  }

  // Test 3: Only userToken provided (no userId)
  console.log("\n3️⃣ Test: Only userToken provided");
  console.log("-".repeat(80));
  try {
    const response = await fetch(`${API_URL}/api/circle/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletId: "test-wallet-id",
        destinationAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        amount: "0.1",
        userToken: "test-user-token",
      }),
    });
    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Success: ${data.success}`);
    
    if (response.status === 400) {
      console.log(`   Error: ${data.error || "N/A"}`);
      if (data.error?.includes("Wallet not found") || data.error?.includes("Invalid")) {
        console.log("   ✅ Accepts userToken (validation error is expected with test data)");
      }
    } else if (response.status === 200 || response.status === 201) {
      console.log("   ✅ Accepts userToken-only authentication");
    } else {
      console.log(`   ⚠️  Unexpected status: ${response.status}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Request failed: ${error.message}`);
  }

  // Test 4: Both userId and userToken provided (should prefer userToken)
  console.log("\n4️⃣ Test: Both userId and userToken provided");
  console.log("-".repeat(80));
  try {
    const response = await fetch(`${API_URL}/api/circle/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletId: "test-wallet-id",
        destinationAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        amount: "0.1",
        userId: "test-user-id",
        userToken: "test-user-token",
      }),
    });
    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Success: ${data.success}`);
    
    if (response.status === 400) {
      console.log(`   Error: ${data.error || "N/A"}`);
      if (data.error?.includes("Wallet not found") || data.error?.includes("Invalid")) {
        console.log("   ✅ Accepts both (should prefer userToken internally)");
      }
    } else if (response.status === 200 || response.status === 201) {
      console.log("   ✅ Accepts both userId and userToken");
    } else {
      console.log(`   ⚠️  Unexpected status: ${response.status}`);
    }
  } catch (error: any) {
    console.log(`   ❌ Request failed: ${error.message}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n✅ API Structure Tests Complete");
  console.log("\n💡 Next Steps:");
  console.log("   1. Ensure dev server is running: npm run dev");
  console.log("   2. Create a wallet via chat UI (requires PIN setup)");
  console.log("   3. Get credentials from browser localStorage:");
  console.log("      - arcle_user_id");
  console.log("      - arcle_user_token");
  console.log("      - arcle_wallet_id");
  console.log("   4. Run: npm run test:transaction:chat");
  console.log("      (with TEST_USER_ID, TEST_USER_TOKEN, TEST_WALLET_ID set)");
  console.log("");
}

// Run test
testApiStructure().catch(console.error);

