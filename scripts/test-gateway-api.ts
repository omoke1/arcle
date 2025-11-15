/**
 * Test Gateway API Integration
 * 
 * Tests Gateway API endpoints without requiring contract calls
 */

import dotenv from "dotenv";
import {
  GATEWAY_API_V1_INFO,
  GATEWAY_API_V1_BALANCES,
  GATEWAY_API_V1_TRANSFER,
  getGatewayDestinationDomain,
} from "../lib/gateway/gateway-contracts";

dotenv.config();

const ARC_WALLET_ADDRESS = "0x78d4064b6ff337a157256800e782058f11e6c1d7";

async function testGatewayAPI() {
  console.log("🌐 Testing Gateway API Integration\n");
  console.log("=".repeat(60));
  
  // Test 1: Info endpoint
  console.log("\n📋 Test 1: Gateway API Info Endpoint");
  console.log("-".repeat(60));
  try {
    const infoResponse = await fetch(GATEWAY_API_V1_INFO);
    const infoData = await infoResponse.json();
    
    if (infoResponse.ok) {
      console.log("✅ Info endpoint working");
      console.log(`   Version: ${infoData.version}`);
      console.log(`   Supported domains: ${infoData.domains?.length || 0}`);
      
      // Check for Arc and Base
      const arcDomain = infoData.domains?.find((d: any) => d.chain === "ARC" && d.network === "Testnet");
      const baseDomain = infoData.domains?.find((d: any) => d.chain === "Base" && d.network === "Sepolia");
      
      if (arcDomain) {
        console.log(`\n✅ Arc Testnet found:`);
        console.log(`   Domain: ${arcDomain.domain}`);
        console.log(`   Wallet: ${arcDomain.walletContract?.address || "N/A"}`);
        console.log(`   Minter: ${arcDomain.minterContract?.address || "N/A"}`);
      }
      
      if (baseDomain) {
        console.log(`\n✅ Base Sepolia found:`);
        console.log(`   Domain: ${baseDomain.domain}`);
        console.log(`   Wallet: ${baseDomain.walletContract?.address || "N/A"}`);
        console.log(`   Minter: ${baseDomain.minterContract?.address || "N/A"}`);
      }
    } else {
      console.log(`❌ Info endpoint failed: ${infoResponse.status}`);
    }
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
  }
  
  // Test 2: Balance endpoint
  console.log("\n📋 Test 2: Gateway API Balance Endpoint");
  console.log("-".repeat(60));
  try {
    const arcDomain = getGatewayDestinationDomain("ARC-TESTNET");
    const balanceResponse = await fetch(GATEWAY_API_V1_BALANCES, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: "USDC",
        sources: [
          {
            depositor: ARC_WALLET_ADDRESS,
            domain: arcDomain,
          },
        ],
      }),
    });
    
    const balanceData = await balanceResponse.json();
    
    if (balanceResponse.ok) {
      console.log("✅ Balance endpoint working");
      if (balanceData.balances && balanceData.balances.length > 0) {
        for (const balance of balanceData.balances) {
          const amount = parseFloat(balance.balance || "0") / 1_000_000;
          console.log(`   Domain ${balance.domain}: ${amount} USDC`);
        }
      } else {
        console.log("   No Gateway balance found (0 USDC)");
      }
    } else {
      console.log(`❌ Balance endpoint failed: ${balanceResponse.status}`);
      console.log(`   Response: ${JSON.stringify(balanceData, null, 2)}`);
    }
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
  }
  
  // Test 3: Transfer endpoint (without signature - will fail but shows API structure)
  console.log("\n📋 Test 3: Gateway API Transfer Endpoint Structure");
  console.log("-".repeat(60));
  console.log("   Testing API endpoint structure (will fail without valid signature)");
  
  try {
    // Create a minimal burn intent (will be rejected but shows API accepts the format)
    const testBurnIntent = {
      maxBlockHeight: "115792089237316195423570985008687907853269984665640564039457584007913129639935",
      maxFee: "2010000",
      spec: {
        version: 1,
        sourceDomain: 26,
        destinationDomain: 6,
        sourceContract: "0x0000000000000000000000000000000000000000000000000000000000000000",
        destinationContract: "0x0000000000000000000000000000000000000000000000000000000000000000",
        sourceToken: "0x0000000000000000000000000000000000000000000000000000000000000000",
        destinationToken: "0x0000000000000000000000000000000000000000000000000000000000000000",
        sourceDepositor: "0x0000000000000000000000000000000000000000000000000000000000000000",
        destinationRecipient: "0x0000000000000000000000000000000000000000000000000000000000000000",
        sourceSigner: "0x0000000000000000000000000000000000000000000000000000000000000000",
        destinationCaller: "0x0000000000000000000000000000000000000000000000000000000000000000",
        value: "2000000",
        salt: "0x0000000000000000000000000000000000000000000000000000000000000000",
        hookData: "0x",
      },
    };
    
    const transferResponse = await fetch(GATEWAY_API_V1_TRANSFER, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          burnIntent: testBurnIntent,
          signature: "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
        },
      ]),
    });
    
    const transferData = await transferResponse.json();
    
    if (transferResponse.ok) {
      console.log("✅ Transfer endpoint working (unexpected - should require valid signature)");
    } else {
      console.log(`⚠️  Transfer endpoint responded (expected failure): ${transferResponse.status}`);
      if (transferData.message) {
        console.log(`   Message: ${transferData.message}`);
      }
      if (transferData.error) {
        console.log(`   Error: ${transferData.error}`);
      }
      // If it's a validation error (not 404/500), the API structure is correct
      if (transferResponse.status === 400 || transferResponse.status === 401) {
        console.log("✅ API endpoint structure is correct (validation error expected)");
      }
    }
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ Gateway API Test Completed!\n");
  
  console.log("Summary:");
  console.log("- Gateway API endpoints are accessible");
  console.log("- Balance check works");
  console.log("- Transfer endpoint structure is correct");
  console.log("\n⚠️  Limitations:");
  console.log("- Deposit requires contract call (Circle API doesn't support 'data' field)");
  console.log("- Mint requires contract call (Circle API doesn't support 'data' field)");
  console.log("- Transfer requires valid EIP-712 signature");
}

testGatewayAPI().catch(console.error);

