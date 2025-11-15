/**
 * Test Bridge Functionality
 * 
 * Manually tests the CCTP bridge API endpoint with v2 API support
 */

import dotenv from "dotenv";
import { circleApiRequest } from "../lib/circle";
import { getCircleClient } from "../lib/circle-sdk";
import { generateUUID } from "../lib/utils/uuid";

dotenv.config();

async function testBridge() {
  console.log("🧪 Testing Bridge Functionality\n");

  try {
    // Get Circle SDK client
    const client = getCircleClient();

    // Step 1: Get or create a test wallet
    console.log("📋 Step 1: Getting test wallet...");
    let walletId: string;
    let walletAddress: string;

    try {
      // Try to get the first available wallet
      const walletsResponse = await client.listWallets({});
      if (walletsResponse.data?.wallets && walletsResponse.data.wallets.length > 0) {
        walletId = walletsResponse.data.wallets[0].id!;
        walletAddress = walletsResponse.data.wallets[0].address || "";
        console.log(`✅ Found wallet: ${walletId}`);
        console.log(`   Address: ${walletAddress || "N/A"}\n`);
      } else {
        throw new Error("No wallets found. Please create a wallet first.");
      }
    } catch (error: any) {
      console.error("❌ Error getting wallet:", error.message);
      console.log("\n💡 Tip: Run 'npm run create-wallet' to create a wallet first.\n");
      process.exit(1);
    }

    // Step 2: Check wallet balance
    console.log("📋 Step 2: Checking wallet balance...");
    try {
      const balanceResponse = await circleApiRequest<any>(
        `/v1/w3s/developer/wallets/${walletId}/balances?blockchain=ARC-TESTNET`
      );
      const balances = balanceResponse.data?.tokenBalances || [];
      const usdcBalance = balances.find((b: any) => 
        b.token?.symbol === "USDC" || b.token?.address?.toLowerCase() === "0x3600000000000000000000000000000000000000"
      );
      
      if (usdcBalance) {
        const balance = (BigInt(usdcBalance.amount || "0") / 1_000_000n).toString();
        console.log(`✅ USDC Balance: ${balance} USDC\n`);
        
        if (parseFloat(balance) < 1) {
          console.log("⚠️  Warning: Low balance. Bridge test requires at least 1 USDC.\n");
        }
      } else {
        console.log("⚠️  No USDC balance found. Bridge test requires USDC.\n");
      }
    } catch (error: any) {
      console.warn("⚠️  Could not check balance:", error.message);
    }

    // Step 3: Test same-chain transfer (should work)
    console.log("📋 Step 3: Testing same-chain transfer (ARC to ARC)...");
    const testDestinationAddress = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"; // Example address
    const testAmount = "0.1"; // Small test amount

    try {
      const sameChainResponse = await fetch("http://localhost:3000/api/circle/bridge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletId,
          amount: testAmount,
          fromChain: "ARC-TESTNET",
          toChain: "ARC-TESTNET",
          destinationAddress: testDestinationAddress,
          idempotencyKey: generateUUID(),
        }),
      });

      const sameChainData = await sameChainResponse.json();
      
      if (sameChainData.success) {
        console.log("✅ Same-chain transfer initiated successfully!");
        console.log(`   Bridge ID: ${sameChainData.data?.bridgeId || sameChainData.data?.id}`);
        console.log(`   Status: ${sameChainData.data?.status}`);
        console.log(`   Transaction Hash: ${sameChainData.data?.transactionHash || "N/A"}\n`);
      } else {
        console.log("❌ Same-chain transfer failed:");
        console.log(`   Error: ${sameChainData.error}`);
        console.log(`   Details: ${JSON.stringify(sameChainData.details, null, 2)}\n`);
      }
    } catch (error: any) {
      console.error("❌ Error testing same-chain transfer:", error.message);
      console.log("   Make sure the dev server is running: npm run dev\n");
    }

    // Step 4: Test cross-chain transfer (ARC to BASE) - This is the main test
    console.log("📋 Step 4: Testing cross-chain transfer (ARC to BASE) with v2 API...");
    const crossChainDestination = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"; // Example BASE address

    try {
      const crossChainResponse = await fetch("http://localhost:3000/api/circle/bridge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletId,
          amount: testAmount,
          fromChain: "ARC-TESTNET",
          toChain: "BASE-SEPOLIA",
          destinationAddress: crossChainDestination,
          idempotencyKey: generateUUID(),
        }),
      });

      const crossChainData = await crossChainResponse.json();
      
      if (crossChainResponse.ok && crossChainData.success) {
        console.log("✅ Cross-chain transfer initiated successfully!");
        console.log(`   Bridge ID: ${crossChainData.data?.bridgeId || crossChainData.data?.id}`);
        console.log(`   Status: ${crossChainData.data?.status}`);
        console.log(`   Transaction Hash: ${crossChainData.data?.transactionHash || "N/A"}`);
        console.log(`   Message: ${crossChainData.message || "N/A"}\n`);
        
        console.log("🎉 Bridge test PASSED! The v2 API endpoint is working.\n");
      } else {
        console.log("❌ Cross-chain transfer failed:");
        console.log(`   Status Code: ${crossChainResponse.status}`);
        console.log(`   Error: ${crossChainData.error || "Unknown error"}`);
        console.log(`   Details: ${JSON.stringify(crossChainData.details || crossChainData, null, 2)}\n`);
        
        // Check if it's a 404 (endpoint doesn't exist) or 501 (not implemented)
        if (crossChainResponse.status === 404) {
          console.log("💡 This might mean the v2 endpoint doesn't exist yet.");
          console.log("   The API will fall back to v1 endpoints.\n");
        } else if (crossChainResponse.status === 501) {
          console.log("💡 The endpoint returned 501 (Not Implemented).");
          console.log("   This might mean CCTP for developer wallets requires manual implementation.\n");
        }
      }
    } catch (error: any) {
      console.error("❌ Error testing cross-chain transfer:", error.message);
      console.log("   Make sure the dev server is running: npm run dev\n");
    }

    // Step 5: Test direct v2 API call (bypassing our endpoint)
    console.log("📋 Step 5: Testing direct v2 API call to Circle...");
    try {
      const directV2Payload = {
        idempotencyKey: generateUUID(),
        source: {
          type: "wallet",
          id: walletId,
        },
        destination: {
          type: "blockchain",
          address: crossChainDestination,
          chain: "BASE-SEPOLIA",
        },
        amount: {
          amount: Math.floor(parseFloat(testAmount) * 1_000_000).toString(),
          currency: "USDC",
        },
      };

      console.log("   Trying /v2/w3s/developer/transfers...");
      try {
        const v2Response = await circleApiRequest<any>(
          `/v2/w3s/developer/transfers`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(directV2Payload),
          }
        );
        console.log("   ✅ v2 endpoint exists and responded!");
        console.log(`   Response: ${JSON.stringify(v2Response, null, 2)}\n`);
      } catch (v2Error: any) {
        console.log(`   ❌ v2 endpoint failed: ${v2Error.message}`);
        if (v2Error.response?.status === 404) {
          console.log("   💡 v2 endpoint doesn't exist (404). Trying v1...\n");
        } else {
          console.log(`   Status: ${v2Error.response?.status || "N/A"}`);
          console.log(`   Response: ${JSON.stringify(v2Error.response?.data || {}, null, 2)}\n`);
        }
      }
    } catch (error: any) {
      console.error("   ❌ Error testing direct API:", error.message);
    }

    console.log("✅ Bridge test completed!\n");

  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testBridge().catch(console.error);

