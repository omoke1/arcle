/**
 * Comprehensive Bridge Test
 * 
 * Tests the complete bridge functionality including:
 * - Route validation
 * - Actual bridge operations
 * - Error handling
 * - Status checking
 * 
 * Usage:
 *   npm run test:bridge:comprehensive
 *   or
 *   tsx scripts/test-bridge-comprehensive.ts
 */

import "dotenv/config";

const API_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Test configuration
const TEST_CONFIG = {
  walletId: process.env.TEST_WALLET_ID || "",
  userId: process.env.TEST_USER_ID || "",
  userToken: process.env.TEST_USER_TOKEN || "",
  fromChain: process.env.TEST_FROM_CHAIN || "ARC-TESTNET",
  toChain: process.env.TEST_TO_CHAIN || "BASE-SEPOLIA",
  amount: process.env.TEST_BRIDGE_AMOUNT || "0.1", // Small test amount
  destinationAddress: process.env.TEST_DESTINATION_ADDRESS || "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
};

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

/**
 * Test route validation
 */
async function testRouteValidation(): Promise<void> {
  console.log("\n🧪 Testing Route Validation...\n");

  const testCases = [
    {
      name: "Valid route: ARC-TESTNET → BASE-SEPOLIA",
      from: "ARC-TESTNET",
      to: "BASE-SEPOLIA",
      shouldPass: true,
    },
    {
      name: "Valid route: ARC-TESTNET → ETHEREUM-SEPOLIA",
      from: "ARC-TESTNET",
      to: "ETHEREUM-SEPOLIA",
      shouldPass: true,
    },
    {
      name: "Invalid route: Unsupported chain",
      from: "ARC-TESTNET",
      to: "UNSUPPORTED-CHAIN-12345",
      shouldPass: false,
    },
    {
      name: "Same chain (should fail)",
      from: "ARC-TESTNET",
      to: "ARC-TESTNET",
      shouldPass: false,
    },
  ];

  for (const testCase of testCases) {
    try {
      const response = await fetch(`${API_URL}/api/circle/bridge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletId: TEST_CONFIG.walletId || "test-wallet",
          amount: "0.1",
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
          console.log(`✅ ${testCase.name}: PASSED`);
          results.push({ name: testCase.name, passed: true });
        } else if (data.errorCode === "INVALID_CHAIN") {
          console.log(`❌ ${testCase.name}: FAILED (incorrectly rejected)`);
          results.push({ 
            name: testCase.name, 
            passed: false, 
            error: `Route incorrectly rejected: ${data.error}` 
          });
        } else {
          console.log(`⚠️  ${testCase.name}: Route accepted but may have failed for other reasons`);
          console.log(`   Status: ${data.success ? "success" : "error"}`);
          console.log(`   Error: ${data.error || "None"}`);
          results.push({ 
            name: testCase.name, 
            passed: true, // Route validation passed, even if bridge failed
            details: { status: data.success, error: data.error }
          });
        }
      } else {
        if (data.errorCode === "INVALID_CHAIN" || data.errorCode === "SAME_CHAIN") {
          console.log(`✅ ${testCase.name}: PASSED (correctly rejected)`);
          results.push({ 
            name: testCase.name, 
            passed: true,
            details: { errorCode: data.errorCode }
          });
        } else if (response.status === 400) {
          console.log(`✅ ${testCase.name}: PASSED (rejected with 400)`);
          results.push({ name: testCase.name, passed: true });
        } else {
          console.log(`❌ ${testCase.name}: FAILED (route was not rejected)`);
          results.push({ 
            name: testCase.name, 
            passed: false, 
            error: `Route was not rejected. Status: ${response.status}` 
          });
        }
      }
    } catch (error: any) {
      console.error(`❌ ${testCase.name}: ERROR - ${error.message}`);
      results.push({ 
        name: testCase.name, 
        passed: false, 
        error: error.message 
      });
    }
  }
}

/**
 * Test actual bridge operation
 */
async function testBridgeOperation(): Promise<TestResult> {
  if (!TEST_CONFIG.walletId || !TEST_CONFIG.userId || !TEST_CONFIG.userToken) {
    console.log("\n⚠️  Skipping bridge operation test - missing wallet credentials");
    console.log("   Set TEST_WALLET_ID, TEST_USER_ID, and TEST_USER_TOKEN to test actual bridging");
    return { name: "Bridge Operation", passed: false, error: "Missing credentials" };
  }

  console.log("\n🌉 Testing Bridge Operation...\n");
  console.log(`From: ${TEST_CONFIG.fromChain}`);
  console.log(`To: ${TEST_CONFIG.toChain}`);
  console.log(`Amount: ${TEST_CONFIG.amount} USDC`);
  console.log(`Destination: ${TEST_CONFIG.destinationAddress}\n`);

  try {
    const startTime = Date.now();
    const idempotencyKey = `test-bridge-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
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
        idempotencyKey,
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
        const explorerUrl = TEST_CONFIG.fromChain === "ARC-TESTNET" 
          ? `https://testnet.arcscan.app/tx/${hash}`
          : `https://sepolia.basescan.org/tx/${hash}`;
        console.log(`\n🔗 View on Explorer: ${explorerUrl}`);
      }

      if (data.message) {
        console.log(`\n💬 Message: ${data.message}`);
      }

      return {
        name: "Bridge Operation",
        passed: true,
        details: {
          bridgeId: data.data?.id || data.data?.bridgeId,
          txHash: data.data?.txHash || data.data?.transactionHash,
          status: data.data?.status,
        }
      };
    } else {
      console.log("❌ Bridge failed!");
      console.log(`Error Code: ${data.errorCode || "UNKNOWN"}`);
      console.log(`Error Type: ${data.errorType || "UNKNOWN"}`);
      console.log(`Error: ${data.error || "Unknown error"}`);
      
      if (data.supportedChains) {
        console.log(`\nSupported Chains:`);
        data.supportedChains.slice(0, 10).forEach((chain: string) => {
          console.log(`   - ${chain}`);
        });
      }
      
      if (data.details) {
        console.log(`\nDetails:`, JSON.stringify(data.details, null, 2));
      }

      return {
        name: "Bridge Operation",
        passed: false,
        error: data.error || "Unknown error",
        details: {
          errorCode: data.errorCode,
          errorType: data.errorType,
          supportedChains: data.supportedChains,
        }
      };
    }
  } catch (error: any) {
    console.error("❌ Bridge test error:", error.message);
    if (error.stack) console.error(error.stack);
    return {
      name: "Bridge Operation",
      passed: false,
      error: error.message,
    };
  }
}

/**
 * Test error taxonomy
 */
async function testErrorTaxonomy(): Promise<void> {
  console.log("\n🔍 Testing Error Taxonomy...\n");

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

    const hasErrorCode = !!data.errorCode;
    const hasErrorType = !!data.errorType;
    const hasErrorMessage = !!data.error;
    const hasRecoverable = data.recoverable !== undefined;
    const hasSupportedChains = !!data.supportedChains;

    console.log("Error Response Structure:");
    console.log(`   ${hasErrorCode ? '✅' : '❌'} Has errorCode: ${hasErrorCode}`);
    console.log(`   ${hasErrorType ? '✅' : '❌'} Has errorType: ${hasErrorType}`);
    console.log(`   ${hasErrorMessage ? '✅' : '❌'} Has error message: ${hasErrorMessage}`);
    console.log(`   ${hasRecoverable ? '✅' : '❌'} Has recoverable flag: ${hasRecoverable}`);
    console.log(`   ${hasSupportedChains ? '✅' : '❌'} Has supportedChains: ${hasSupportedChains}`);

    const allPresent = hasErrorCode && hasErrorType && hasErrorMessage && hasRecoverable && hasSupportedChains;
    
    if (allPresent) {
      console.log(`\n✅ Error taxonomy is complete!`);
      results.push({ name: "Error Taxonomy", passed: true });
    } else {
      console.log(`\n⚠️  Error taxonomy is incomplete`);
      results.push({ 
        name: "Error Taxonomy", 
        passed: false, 
        error: "Missing required error fields" 
      });
    }

    if (data.errorCode === "INVALID_CHAIN") {
      console.log(`✅ Error code is correct: ${data.errorCode}`);
    } else {
      console.log(`⚠️  Error code: ${data.errorCode} (expected INVALID_CHAIN)`);
    }

    if (data.supportedChains && Array.isArray(data.supportedChains)) {
      console.log(`✅ Supported chains list provided (${data.supportedChains.length} chains)`);
    }
  } catch (error: any) {
    console.error("❌ Error taxonomy test failed:", error.message);
    results.push({ 
      name: "Error Taxonomy", 
      passed: false, 
      error: error.message 
    });
  }
}

/**
 * Test API endpoint availability
 */
async function testAPIAvailability(): Promise<void> {
  console.log("\n🔌 Testing API Availability...\n");

  try {
    const response = await fetch(`${API_URL}/api/circle/bridge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletId: "test",
        amount: "0.1",
        fromChain: "ARC-TESTNET",
        toChain: "BASE-SEPOLIA",
        destinationAddress: "0x0000000000000000000000000000000000000000",
      }),
    });

    // Even if it fails, if we get a response, the API is available
    if (response.status === 400 || response.status === 500) {
      console.log(`✅ API is available (returned ${response.status})`);
      results.push({ name: "API Availability", passed: true });
    } else {
      console.log(`⚠️  API returned unexpected status: ${response.status}`);
      results.push({ 
        name: "API Availability", 
        passed: false, 
        error: `Unexpected status: ${response.status}` 
      });
    }
  } catch (error: any) {
    console.error(`❌ API is not available: ${error.message}`);
    results.push({ 
      name: "API Availability", 
      passed: false, 
      error: error.message 
    });
  }
}

/**
 * Print test summary
 */
function printSummary(): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 Test Summary");
  console.log("=".repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`\nTotal Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`\nSuccess Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.log("Failed Tests:");
    results.filter(r => !r.passed).forEach(result => {
      console.log(`  ❌ ${result.name}`);
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
    });
  }

  console.log("\n" + "=".repeat(60));
}

/**
 * Main test function
 */
async function main() {
  console.log("\n🧪 ===== Comprehensive Bridge Testing =====\n");
  console.log(`🔗 API URL: ${API_URL}\n`);

  // Check if credentials are available
  const hasCredentials = !!(TEST_CONFIG.walletId && TEST_CONFIG.userId && TEST_CONFIG.userToken);
  
  if (!hasCredentials) {
    console.log("⚠️  Note: Wallet credentials not provided. Only route validation tests will run.");
    console.log("   To test actual bridging, set:");
    console.log("   - TEST_WALLET_ID");
    console.log("   - TEST_USER_ID");
    console.log("   - TEST_USER_TOKEN");
    console.log("   - TEST_FROM_CHAIN (optional, default: ARC-TESTNET)");
    console.log("   - TEST_TO_CHAIN (optional, default: BASE-SEPOLIA)");
    console.log("   - TEST_BRIDGE_AMOUNT (optional, default: 0.1)");
    console.log("   - TEST_DESTINATION_ADDRESS (optional)\n");
  }

  try {
    // Test 1: API availability
    await testAPIAvailability();

    // Test 2: Route validation
    await testRouteValidation();

    // Test 3: Error taxonomy
    await testErrorTaxonomy();

    // Test 4: Actual bridge operation (if credentials available)
    if (hasCredentials) {
      const bridgeResult = await testBridgeOperation();
      results.push(bridgeResult);
    } else {
      console.log("\n💡 To test actual bridge operations:");
      console.log("   1. Get your wallet credentials from localStorage or Circle API");
      console.log("   2. Set environment variables:");
      console.log("      TEST_WALLET_ID=your_wallet_id");
      console.log("      TEST_USER_ID=your_user_id");
      console.log("      TEST_USER_TOKEN=your_user_token");
      console.log("   3. Run this script again");
    }

    // Print summary
    printSummary();

    // Exit with appropriate code
    const allPassed = results.every(r => r.passed);
    if (!allPassed) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error("\n❌ Test suite failed:", error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
main();

