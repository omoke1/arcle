/**
 * Test Bridge API Endpoint
 * 
 * Tests the actual bridge API endpoint
 * Make sure dev server is running: npm run dev
 */

async function testBridgeEndpoint() {
  console.log("🧪 Testing Bridge API Endpoint\n");
  console.log("⚠️  Make sure dev server is running: npm run dev\n");
  console.log("=" .repeat(60) + "\n");

  const baseUrl = "http://localhost:3000";
  
  // Test data - using a test wallet ID (replace with real one)
  const testWalletId = process.env.TEST_WALLET_ID || "test-wallet-id-placeholder";
  const testDestinationAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";
  const testAmount = "0.1";

  // Test 1: Same-chain transfer (should work if wallet ID is valid)
  console.log("📋 Test 1: Same-chain transfer (ARC to ARC)");
  console.log("-".repeat(60));
  
  try {
    const response = await fetch(`${baseUrl}/api/circle/bridge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        walletId: testWalletId,
        amount: testAmount,
        fromChain: "ARC-TESTNET",
        toChain: "ARC-TESTNET",
        destinationAddress: testDestinationAddress,
      }),
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    
    if (response.ok && data.success) {
      console.log("✅ SUCCESS: Same-chain transfer initiated");
      console.log(`   Bridge ID: ${data.data?.bridgeId || data.data?.id}`);
      console.log(`   Status: ${data.data?.status}`);
      console.log(`   Transaction Hash: ${data.data?.transactionHash || "N/A"}\n`);
    } else {
      console.log("⚠️  Response received (may be expected if wallet ID is invalid)");
      console.log(`   Error: ${data.error || "Unknown"}`);
      if (data.details) {
        console.log(`   Details: ${JSON.stringify(data.details, null, 2)}`);
      }
      console.log();
    }
  } catch (error: any) {
    console.log(`❌ ERROR: ${error.message}`);
    console.log("   Make sure the dev server is running!\n");
  }

  // Test 2: Cross-chain transfer (ARC to BASE) - Main CCTP test
  console.log("📋 Test 2: Cross-chain transfer (ARC to BASE) - CCTP Test");
  console.log("-".repeat(60));
  
  try {
    const response = await fetch(`${baseUrl}/api/circle/bridge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        walletId: testWalletId,
        amount: testAmount,
        fromChain: "ARC-TESTNET",
        toChain: "BASE-SEPOLIA",
        destinationAddress: testDestinationAddress,
      }),
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    
    if (response.ok && data.success) {
      console.log("✅ SUCCESS: Cross-chain transfer initiated!");
      console.log(`   Bridge ID: ${data.data?.bridgeId || data.data?.id}`);
      console.log(`   Status: ${data.data?.status}`);
      console.log(`   Message: ${data.message || "N/A"}`);
      console.log(`   Transaction Hash: ${data.data?.transactionHash || "N/A"}\n`);
      console.log("🎉 CCTP bridge is working!\n");
    } else {
      console.log("Response details:");
      console.log(`   Error: ${data.error || "Unknown error"}`);
      
      if (response.status === 400) {
        console.log("   💡 400: Bad Request - Check wallet ID and parameters");
      } else if (response.status === 404) {
        console.log("   💡 404: Endpoint not found");
      } else if (response.status === 500) {
        console.log("   💡 500: Server Error - Check server logs");
        if (data.details) {
          console.log(`   API Error: ${data.details.apiError || "N/A"}`);
          console.log(`   Contract Error: ${data.details.contractError || "N/A"}`);
          if (data.details.note) {
            console.log(`   Note: ${data.details.note}`);
          }
          if (data.details.resources) {
            console.log(`   Resources:`);
            data.details.resources.forEach((url: string) => {
              console.log(`     - ${url}`);
            });
          }
        }
      } else if (response.status === 501) {
        console.log("   💡 501: Not Implemented - CCTP may require manual implementation");
      }
      console.log();
    }
  } catch (error: any) {
    console.log(`❌ ERROR: ${error.message}`);
    console.log("   Make sure the dev server is running!\n");
  }

  // Test 3: Cross-chain transfer (BASE to ARBITRUM) - Another CCTP test
  console.log("📋 Test 3: Cross-chain transfer (BASE to ARBITRUM)");
  console.log("-".repeat(60));
  
  try {
    const response = await fetch(`${baseUrl}/api/circle/bridge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        walletId: testWalletId,
        amount: testAmount,
        fromChain: "BASE-SEPOLIA",
        toChain: "ARBITRUM-SEPOLIA",
        destinationAddress: testDestinationAddress,
      }),
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    
    if (response.ok && data.success) {
      console.log("✅ SUCCESS: Cross-chain transfer initiated!");
      console.log(`   Bridge ID: ${data.data?.bridgeId || data.data?.id}\n`);
    } else {
      console.log(`   Response: ${data.error || "See details above"}\n`);
    }
  } catch (error: any) {
    console.log(`❌ ERROR: ${error.message}\n`);
  }

  // Test 4: Invalid chain (should fail gracefully)
  console.log("📋 Test 4: Invalid chain (Error Handling)");
  console.log("-".repeat(60));
  
  try {
    const response = await fetch(`${baseUrl}/api/circle/bridge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        walletId: testWalletId,
        amount: testAmount,
        fromChain: "INVALID-CHAIN",
        toChain: "BASE-SEPOLIA",
        destinationAddress: testDestinationAddress,
      }),
    });

    const data = await response.json();
    
    if (response.status === 400 || response.status === 500) {
      console.log(`✅ Correctly rejected invalid chain`);
      console.log(`   Error: ${data.error || "Unknown"}\n`);
    } else {
      console.log(`⚠️  Unexpected status: ${response.status}\n`);
    }
  } catch (error: any) {
    console.log(`❌ ERROR: ${error.message}\n`);
  }

  console.log("=" .repeat(60));
  console.log("✅ Bridge API Endpoint Tests Completed!\n");
  console.log("💡 Note: Some tests may fail if:");
  console.log("   - Dev server is not running");
  console.log("   - Wallet ID is invalid");
  console.log("   - Circle SDK doesn't support contract calls yet\n");
}

testBridgeEndpoint().catch(console.error);

