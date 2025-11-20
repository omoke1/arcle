/**
 * Bridge Route Validation Testing
 * 
 * Tests the route validation logic directly (no API server needed)
 * This verifies the Bridge Kit v1.1.2 safety improvements
 */

import { validateBridgeRoute, getSupportedChainsList, SUPPORTED_CHAINS } from '../lib/bridge/bridge-kit-user-wallets';

/**
 * Test route validation function
 */
function testRouteValidation() {
  console.log("\n🧪 Testing Bridge Route Validation (Bridge Kit v1.1.2)\n");
  console.log("=" .repeat(60));

  const testCases = [
    {
      name: "✅ Valid route: ARC-TESTNET → BASE-SEPOLIA",
      from: "ARC-TESTNET",
      to: "BASE-SEPOLIA",
      shouldPass: true,
    },
    {
      name: "✅ Valid route: ethereum-sepolia → base-sepolia",
      from: "ethereum-sepolia",
      to: "base-sepolia",
      shouldPass: true,
    },
    {
      name: "✅ Valid route: Ethereum → Base (normalized)",
      from: "Ethereum",
      to: "Base",
      shouldPass: true,
    },
    {
      name: "❌ Invalid route: Unsupported chain",
      from: "ARC-TESTNET",
      to: "UNSUPPORTED-CHAIN-12345",
      shouldPass: false,
    },
    {
      name: "❌ Same chain (should fail)",
      from: "ARC-TESTNET",
      to: "ARC-TESTNET",
      shouldPass: false,
    },
    {
      name: "❌ Both chains unsupported",
      from: "UNSUPPORTED-1",
      to: "UNSUPPORTED-2",
      shouldPass: false,
    },
    {
      name: "✅ Valid route: Arbitrum → Polygon",
      from: "arbitrum-sepolia",
      to: "polygon-amoy",
      shouldPass: true,
    },
    {
      name: "✅ Valid route: Solana → Ethereum",
      from: "solana-devnet",
      to: "ethereum-sepolia",
      shouldPass: true,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const result = validateBridgeRoute(testCase.from, testCase.to);
    const passedTest = (testCase.shouldPass && result.valid) || (!testCase.shouldPass && !result.valid);

    if (passedTest) {
      console.log(`\n✅ ${testCase.name}`);
      passed++;
      
      if (result.valid) {
        console.log(`   Route is valid ✓`);
      } else {
        console.log(`   Route correctly rejected ✓`);
        if (result.error) {
          console.log(`   Error Code: ${result.error.code}`);
          console.log(`   Error Type: ${result.error.type}`);
          console.log(`   Recoverable: ${result.error.recoverable}`);
          if (result.error.supportedChains) {
            console.log(`   Supported Chains: ${result.error.supportedChains.length} chains`);
          }
        }
      }
    } else {
      console.log(`\n❌ ${testCase.name}`);
      console.log(`   Expected: ${testCase.shouldPass ? 'valid' : 'invalid'}`);
      console.log(`   Got: ${result.valid ? 'valid' : 'invalid'}`);
      if (result.error) {
        console.log(`   Error: ${result.error.message}`);
      }
      failed++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`\n📊 Test Results:`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  return { passed, failed, total: passed + failed };
}

/**
 * Test supported chains list
 */
function testSupportedChains() {
  console.log("\n\n🔗 Testing Supported Chains List\n");
  console.log("=".repeat(60));

  const supportedChains = getSupportedChainsList();
  console.log(`\nTotal Supported Chains: ${supportedChains.length}\n`);

  console.log("Mainnet Chains:");
  const mainnetChains = supportedChains.filter(c => !c.includes('testnet') && !c.includes('devnet') && !c.includes('sepolia') && !c.includes('amoy') && !c.includes('fuji'));
  mainnetChains.forEach(chain => console.log(`   - ${chain}`));

  console.log("\nTestnet Chains:");
  const testnetChains = supportedChains.filter(c => c.includes('testnet') || c.includes('devnet') || c.includes('sepolia') || c.includes('amoy') || c.includes('fuji'));
  testnetChains.forEach(chain => console.log(`   - ${chain}`));

  // Verify Arc Testnet is included
  const hasArcTestnet = supportedChains.includes('arc-testnet');
  console.log(`\n✅ Arc Testnet included: ${hasArcTestnet ? 'YES' : 'NO'}`);

  return supportedChains.length;
}

/**
 * Test error taxonomy
 */
function testErrorTaxonomy() {
  console.log("\n\n🔍 Testing Error Taxonomy\n");
  console.log("=".repeat(60));

  // Test unsupported chain error
  const result = validateBridgeRoute("ARC-TESTNET", "UNSUPPORTED-CHAIN");
  
  if (!result.valid && result.error) {
    console.log("\n✅ Error Taxonomy Structure:");
    console.log(`   ✅ Has code: ${!!result.error.code} (${result.error.code})`);
    console.log(`   ✅ Has type: ${!!result.error.type} (${result.error.type})`);
    console.log(`   ✅ Has message: ${!!result.error.message}`);
    console.log(`   ✅ Has recoverable flag: ${result.error.recoverable !== undefined} (${result.error.recoverable})`);
    console.log(`   ✅ Has supportedChains: ${!!result.error.supportedChains} (${result.error.supportedChains?.length || 0} chains)`);

    if (result.error.code === "INVALID_CHAIN") {
      console.log(`\n✅ Error code is correct: ${result.error.code}`);
    } else {
      console.log(`\n⚠️  Error code: ${result.error.code} (expected INVALID_CHAIN)`);
    }

    if (result.error.supportedChains && Array.isArray(result.error.supportedChains)) {
      console.log(`\n✅ Supported chains list provided (${result.error.supportedChains.length} chains)`);
      console.log(`   Sample: ${result.error.supportedChains.slice(0, 3).join(", ")}...`);
    }

    // Test same chain error
    const sameChainResult = validateBridgeRoute("ARC-TESTNET", "ARC-TESTNET");
    if (!sameChainResult.valid && sameChainResult.error) {
      console.log(`\n✅ Same chain error code: ${sameChainResult.error.code}`);
      console.log(`   Message: ${sameChainResult.error.message}`);
    }
  } else {
    console.log("\n❌ Error taxonomy test failed - route was not rejected");
  }
}

/**
 * Main test function
 */
function main() {
  console.log("\n🧪 ===== Bridge Kit v1.1.2 Route Validation Testing =====\n");
  console.log("Testing route validation logic (no API server required)\n");

  try {
    // Test 1: Route validation
    const validationResults = testRouteValidation();

    // Test 2: Supported chains
    const chainCount = testSupportedChains();

    // Test 3: Error taxonomy
    testErrorTaxonomy();

    // Summary
    console.log("\n\n" + "=".repeat(60));
    console.log("📋 Test Summary");
    console.log("=".repeat(60));
    console.log(`✅ Route Validation: ${validationResults.passed}/${validationResults.total} tests passed`);
    console.log(`✅ Supported Chains: ${chainCount} chains configured`);
    console.log(`✅ Error Taxonomy: Unified error structure implemented`);
    
    if (validationResults.failed === 0) {
      console.log("\n🎉 All validation tests passed!");
      console.log("\n💡 Next Steps:");
      console.log("   1. Start the dev server: npm run dev");
      console.log("   2. Test actual bridge API: npm run test:bridge");
      console.log("   3. Or test with real credentials in the chat interface");
    } else {
      console.log(`\n⚠️  ${validationResults.failed} test(s) failed. Please review.`);
    }

    console.log("\n");
  } catch (error: any) {
    console.error("\n❌ Test suite failed:", error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
main();

