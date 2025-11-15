/**
 * Simple Bridge Test
 * 
 * Tests the bridge API endpoint via HTTP requests
 * Make sure the dev server is running: npm run dev
 */

async function testBridge() {
  console.log("🧪 Testing Bridge API Endpoint\n");
  console.log("⚠️  Make sure the dev server is running: npm run dev\n");

  const baseUrl = "http://localhost:3000";
  
  // Test data - you'll need to replace these with actual values
  const testWalletId = process.env.TEST_WALLET_ID || "test-wallet-id";
  const testDestinationAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";
  const testAmount = "0.1";

  // Test 1: Same-chain transfer (should work)
  console.log("📋 Test 1: Same-chain transfer (ARC to ARC)");
  try {
    const sameChainResponse = await fetch(`${baseUrl}/api/circle/bridge`, {
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

    const sameChainData = await sameChainResponse.json();
    console.log(`   Status: ${sameChainResponse.status}`);
    
    if (sameChainResponse.ok && sameChainData.success) {
      console.log("   ✅ SUCCESS: Same-chain transfer initiated");
      console.log(`   Bridge ID: ${sameChainData.data?.bridgeId || sameChainData.data?.id}`);
      console.log(`   Status: ${sameChainData.data?.status}\n`);
    } else {
      console.log("   ❌ FAILED:");
      console.log(`   Error: ${sameChainData.error || "Unknown error"}`);
      if (sameChainData.details) {
        console.log(`   Details: ${JSON.stringify(sameChainData.details, null, 2)}`);
      }
      console.log();
    }
  } catch (error: any) {
    console.log(`   ❌ ERROR: ${error.message}`);
    console.log("   Make sure the dev server is running!\n");
  }

  // Test 2: Cross-chain transfer with v2 API (main test)
  console.log("📋 Test 2: Cross-chain transfer (ARC to BASE) - Testing v2 API");
  try {
    const crossChainResponse = await fetch(`${baseUrl}/api/circle/bridge`, {
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

    const crossChainData = await crossChainResponse.json();
    console.log(`   Status: ${crossChainResponse.status}`);
    
    if (crossChainResponse.ok && crossChainData.success) {
      console.log("   ✅ SUCCESS: Cross-chain transfer initiated via v2 API!");
      console.log(`   Bridge ID: ${crossChainData.data?.bridgeId || crossChainData.data?.id}`);
      console.log(`   Status: ${crossChainData.data?.status}`);
      console.log(`   Message: ${crossChainData.message || "N/A"}`);
      console.log(`   Transaction Hash: ${crossChainData.data?.transactionHash || "N/A"}\n`);
      console.log("   🎉 Bridge test PASSED! The v2 API endpoint is working.\n");
    } else {
      console.log("   ❌ FAILED:");
      console.log(`   Error: ${crossChainData.error || "Unknown error"}`);
      
      if (crossChainResponse.status === 404) {
        console.log("   💡 404: The v2 endpoint might not exist yet.");
      } else if (crossChainResponse.status === 501) {
        console.log("   💡 501: Not Implemented - CCTP may require manual implementation.");
      } else if (crossChainResponse.status === 400) {
        console.log("   💡 400: Bad Request - Check wallet ID and parameters.");
      } else if (crossChainResponse.status === 500) {
        console.log("   💡 500: Server Error - Check server logs for details.");
      }
      
      if (crossChainData.details) {
        console.log(`   Details: ${JSON.stringify(crossChainData.details, null, 2)}`);
      }
      console.log();
    }
  } catch (error: any) {
    console.log(`   ❌ ERROR: ${error.message}`);
    console.log("   Make sure the dev server is running!\n");
  }

  // Test 3: Check server health
  console.log("📋 Test 3: Server health check");
  try {
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    if (healthResponse.ok) {
      console.log("   ✅ Server is running\n");
    } else {
      console.log(`   ⚠️  Server responded with status: ${healthResponse.status}\n`);
    }
  } catch (error: any) {
    console.log(`   ❌ Server not reachable: ${error.message}`);
    console.log("   Make sure to run: npm run dev\n");
  }

  console.log("✅ Bridge test completed!\n");
  console.log("💡 Note: Replace TEST_WALLET_ID with an actual wallet ID from your Circle account");
  console.log("   You can get a wallet ID by running: npm run create-wallet\n");
}

testBridge().catch(console.error);

