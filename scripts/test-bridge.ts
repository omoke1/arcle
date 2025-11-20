/**
 * Bridge Testing Script
 * 
 * Tests the updated bridge functionality with Bridge Kit v1.1.2 improvements:
 * - Route validation (prevents fund loss on unsupported routes)
 * - Error handling with unified taxonomy
 * - Supported chains validation
 * 
 * Usage:
 *   npm run test:bridge
 *   or
 *   tsx scripts/test-bridge.ts
 */

import "dotenv/config";

const API_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

// Test configuration
const TEST_CONFIG = {
  walletId: process.env.TEST_WALLET_ID || "",
  userId: process.env.TEST_USER_ID || "",
  userToken: process.env.TEST_USER_TOKEN || "",
  fromChain: "ARC-TESTNET",
  toChain: "BASE-SEPOLIA",
  amount: "0.1", // Small test amount
  destinationAddress: process.env.TEST_DESTINATION_ADDRESS || "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
};

/**
 * Test route validation
 */
async function testRouteValidation() {
  console.log("\n🧪 Testing Route Validation...\n");

  const testCases = [
    {
      name: "Valid route: ARC-TESTNET → BASE-SEPOLIA",
      from: "ARC-TESTNET",
      to: "BASE-SEPOLIA",
      shouldPass: true,
    },
    {
      name: "Invalid route: Unsupported chain",
      from: "ARC-TESTNET",
      to: "UNSUPPORTED-CHAIN",
      shouldPass: false,
    },
    {
      name: "Same chain (should fail)",
      from: "ARC-TESTNET",
      to: "ARC-TESTNET",
      shouldPass: false,
    },
    {
      name: "Valid route: Ethereum → Base",
      from: "ethereum-sepolia",
      to: "base-sepolia",
      shouldPass: true,
    },
  ];

  for (const testCase of testCases) {
    try {
      const response = await fetch(`${API_URL}/api/circle/bridge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletId: TEST_CONFIG.walletId,
          amount: TEST_CONFIG.amount,
          fromChain: testCase.from,
          toChain: testCase.to,
          destinationAddress: TEST_CONFIG.destinationAddress,
          userId: TEST_CONFIG.userId,
          userToken: TEST_CONFIG.userToken,
        }),
      });

      const data = await response.json();

      if (testCase.shouldPass) {
        if (data.success || response.status === 200) {
          console.log(`✅ ${testCase.name}: PASSED (route accepted)`);
        } else if (data.errorCode === "INVALID_CHAIN") {
          console.log(`❌ ${testCase.name}: FAILED (incorrectly rejected valid route)`);
          console.log(`   Error: ${data.error}`);
        } else {
          console.log(`⚠️  ${testCase.name}: Route accepted but bridge may have failed for other reasons`);
          console.log(`   Status: ${data.success ? "success" : "error"}`);
          console.log(`   Error: ${data.error || "None"}`);
        }
      } else {
        if (data.errorCode === "INVALID_CHAIN" || data.errorCode === "SAME_CHAIN") {
          console.log(`✅ ${testCase.name}: PASSED (correctly rejected invalid route)`);
          console.log(`   Error Code: ${data.errorCode}`);
          console.log(`   Message: ${data.error}`);
          if (data.supportedChains) {
            console.log(`   Supported Chains: ${data.supportedChains.slice(0, 5).join(", ")}...`);
          }
        } else if (response.status === 400) {
          console.log(`✅ ${testCase.name}: PASSED (rejected with 400 status)`);
          console.log(`   Error: ${data.error || "Validation failed"}`);
        } else {
          console.log(`⚠️  ${testCase.name}: Route was not rejected as expected`);
          console.log(`   Status: ${response.status}`);
          console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
        }
      }
    } catch (error: any) {
      console.error(`❌ ${testCase.name}: ERROR - ${error.message}`);
    }
  }
}

/**
 * Test actual bridge operation (if wallet is configured)
 */
async function testBridgeOperation() {
  if (!TEST_CONFIG.walletId || !TEST_CONFIG.userId || !TEST_CONFIG.userToken) {
    console.log("\n⚠️  Skipping bridge operation test - missing wallet credentials");
    console.log("   Set TEST_WALLET_ID, TEST_USER_ID, and TEST_USER_TOKEN to test actual bridging");
    return;
  }

  console.log("\n🌉 Testing Bridge Operation...\n");
  console.log(`From: ${TEST_CONFIG.fromChain}`);
  console.log(`To: ${TEST_CONFIG.toChain}`);
  console.log(`Amount: ${TEST_CONFIG.amount} USDC`);
  console.log(`Destination: ${TEST_CONFIG.destinationAddress}\n`);

  try {
    const startTime = Date.now();
    const response = await fetch(`${API_URL}/api/circle/bridge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletId: TEST_CONFIG.walletId,
        amount: TEST_CONFIG.amount,
        fromChain: TEST_CONFIG.fromChain,
        toChain: TEST_CONFIG.toChain,
        destinationAddress: TEST_CONFIG.destinationAddress,
        userId: TEST_CONFIG.userId,
        userToken: TEST_CONFIG.userToken,
        idempotencyKey: `test-bridge-${Date.now()}`,
      }),
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    console.log(`📊 Response Status: ${response.status} (${duration}ms)\n`);

    if (data.success) {
      console.log("✅ Bridge initiated successfully!");
      console.log(`📋 Bridge Details:`);
      console.log(`   🆔 ID: ${data.data?.id || data.data?.bridgeId || "N/A"}`);
      console.log(`   🔗 Hash: ${data.data?.txHash || data.data?.transactionHash || "Not available yet"}`);
      console.log(`   📊 Status: ${data.data?.status || "pending"}`);
      
      if (data.data?.txHash || data.data?.transactionHash) {
        const hash = data.data.txHash || data.data.transactionHash;
        console.log(`\n🔗 View on Explorer: https://testnet.arcscan.app/tx/${hash}`);
      }
    } else {
      console.log("❌ Bridge failed!");
      console.log(`Error Code: ${data.errorCode || "UNKNOWN"}`);
      console.log(`Error Type: ${data.errorType || "UNKNOWN"}`);
      console.log(`Error: ${data.error || "Unknown error"}`);
      
      if (data.supportedChains) {
        console.log(`\nSupported Chains:`);
        data.supportedChains.forEach((chain: string) => {
          console.log(`   - ${chain}`);
        });
      }
      
      if (data.details) {
        console.log(`\nDetails:`, JSON.stringify(data.details, null, 2));
      }
    }
  } catch (error: any) {
    console.error("❌ Bridge test error:", error.message);
    if (error.stack) console.error(error.stack);
  }
}

/**
 * Test error taxonomy
 */
async function testErrorTaxonomy() {
  console.log("\n🔍 Testing Error Taxonomy...\n");

  // Test unsupported chain error
  try {
    const response = await fetch(`${API_URL}/api/circle/bridge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletId: TEST_CONFIG.walletId || "test-wallet",
        amount: "1.0",
        fromChain: "ARC-TESTNET",
        toChain: "UNSUPPORTED-CHAIN-12345",
        destinationAddress: TEST_CONFIG.destinationAddress,
        userId: TEST_CONFIG.userId,
        userToken: TEST_CONFIG.userToken,
      }),
    });

    const data = await response.json();

    console.log("Error Response Structure:");
    console.log(`   ✅ Has errorCode: ${!!data.errorCode}`);
    console.log(`   ✅ Has errorType: ${!!data.errorType}`);
    console.log(`   ✅ Has error message: ${!!data.error}`);
    console.log(`   ✅ Has recoverable flag: ${data.recoverable !== undefined}`);
    console.log(`   ✅ Has supportedChains: ${!!data.supportedChains}`);

    if (data.errorCode === "INVALID_CHAIN") {
      console.log(`\n✅ Error code is correct: ${data.errorCode}`);
    } else {
      console.log(`\n⚠️  Error code: ${data.errorCode} (expected INVALID_CHAIN)`);
    }

    if (data.supportedChains && Array.isArray(data.supportedChains)) {
      console.log(`\n✅ Supported chains list provided (${data.supportedChains.length} chains)`);
    }
  } catch (error: any) {
    console.error("❌ Error taxonomy test failed:", error.message);
  }
}

/**
 * Main test function
 */
async function main() {
  console.log("\n🧪 ===== Bridge Kit v1.1.2 Testing =====\n");
  console.log(`🔗 API URL: ${API_URL}\n`);

  // Check if credentials are available
  const hasCredentials = !!(TEST_CONFIG.walletId && TEST_CONFIG.userId && TEST_CONFIG.userToken);
  
  if (!hasCredentials) {
    console.log("⚠️  Note: Wallet credentials not provided. Only route validation tests will run.");
    console.log("   To test actual bridging, set:");
    console.log("   - TEST_WALLET_ID");
    console.log("   - TEST_USER_ID");
    console.log("   - TEST_USER_TOKEN\n");
  }

  try {
    // Test 1: Route validation
    await testRouteValidation();

    // Test 2: Error taxonomy
    await testErrorTaxonomy();

    // Test 3: Actual bridge operation (if credentials available)
    if (hasCredentials) {
      await testBridgeOperation();
    } else {
      console.log("\n💡 To test actual bridge operations:");
      console.log("   1. Get your wallet credentials from localStorage or Circle API");
      console.log("   2. Set environment variables:");
      console.log("      TEST_WALLET_ID=your_wallet_id");
      console.log("      TEST_USER_ID=your_user_id");
      console.log("      TEST_USER_TOKEN=your_user_token");
      console.log("   3. Run this script again");
    }

    console.log("\n✅ Bridge testing complete!\n");
  } catch (error: any) {
    console.error("\n❌ Test suite failed:", error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
main();

