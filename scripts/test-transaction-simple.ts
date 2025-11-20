/**
 * Simple Transaction Test
 * Tests transaction creation with minimal logging
 */

import "dotenv/config";

const API_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

const credentials = {
  walletId: process.env.TEST_WALLET_ID || "d1f41f9f-0210-56d0-888f-51361b29c736",
  userId: process.env.TEST_USER_ID || "arcle-user-1763483394862-psyznid",
  userToken: process.env.TEST_USER_TOKEN || "",
};

async function testTransaction() {
  console.log("\n🧪 Simple Transaction Test\n");

  if (!credentials.userToken) {
    console.error("❌ TEST_USER_TOKEN not set");
    process.exit(1);
  }

  const requestBody = {
    walletId: credentials.walletId,
    destinationAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    amount: "0.1",
    userToken: credentials.userToken, // Only userToken (testing our fix)
    idempotencyKey: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  };

  console.log("📤 Request:", {
    ...requestBody,
    userToken: "***REDACTED***",
  });

  try {
    const response = await fetch(`${API_URL}/api/circle/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    console.log(`\n📊 Status: ${response.status}`);
    console.log("📥 Response:", JSON.stringify(data, null, 2));

    if (data.success) {
      if (data.data?.challengeId) {
        console.log("\n✅ Challenge required - Transaction needs PIN confirmation");
        console.log("=".repeat(80));
        console.log(`   Challenge ID: ${data.data.challengeId}`);
        console.log(`   Wallet ID: ${data.data.walletId || 'N/A'}`);
        console.log(`   Amount: ${data.data.amount || 'N/A'}`);
        console.log(`   Destination: ${data.data.destinationAddress || 'N/A'}`);
        console.log("=".repeat(80));
        console.log("\n💡 For user-controlled wallets, you need to:");
        console.log("   1. Use the Circle PIN widget in the browser to complete the challenge");
        console.log("   2. The transaction will proceed after PIN confirmation");
        console.log("   3. This is expected behavior - transactions require user PIN approval");
      } else if (data.data?.id) {
        console.log("\n✅ Transaction created successfully!");
        console.log(`   Transaction ID: ${data.data.id}`);
        console.log(`   Status: ${data.data.status}`);
        if (data.data.hash) {
          console.log(`   Hash: ${data.data.hash}`);
        }
      } else {
        console.log("\n✅ Transaction request accepted (unexpected response format)");
        console.log("   Response:", JSON.stringify(data.data, null, 2));
      }
    } else {
      console.error("\n❌ Transaction failed:");
      console.error(`   Error: ${data.error}`);
      if (data.details) {
        console.error(`   Details:`, JSON.stringify(data.details, null, 2));
      }
    }
  } catch (error: any) {
    console.error("\n❌ Request failed:", error.message);
  }
}

testTransaction().catch(console.error);

