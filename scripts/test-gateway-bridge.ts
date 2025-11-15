/**
 * Test Gateway Bridge: Arc Testnet → Base
 * 
 * Tests the Circle Gateway implementation
 */

import dotenv from "dotenv";
import { getGatewayAddresses, getGatewayDestinationDomain } from "../lib/gateway/gateway-contracts";
import { checkGatewayBalance, executeGatewayTransfer } from "../lib/gateway/gateway-implementation";

dotenv.config();

const ARC_WALLET_ADDRESS = "0x78d4064b6ff337a157256800e782058f11e6c1d7";
const BASE_DESTINATION_ADDRESS = "0x37195b0fc7198a4fc8c7dafe3bcc5bcf8cb680a0";
const BRIDGE_AMOUNT = "2"; // $2 USDC
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

async function testGatewayBridge() {
  console.log("🌉 Testing Circle Gateway Bridge: Arc Testnet → Base Sepolia\n");
  console.log("=".repeat(60));
  console.log(`Arc Wallet: ${ARC_WALLET_ADDRESS}`);
  console.log(`Base Destination: ${BASE_DESTINATION_ADDRESS}`);
  console.log(`Amount: $${BRIDGE_AMOUNT} USDC\n`);
  console.log("=".repeat(60));
  
  // Step 1: Verify Gateway addresses
  console.log("\n📋 Step 1: Verifying Gateway Contract Addresses");
  console.log("-".repeat(60));
  
  try {
    const arcAddresses = getGatewayAddresses("ARC-TESTNET");
    console.log("✅ Arc Testnet Gateway Addresses:");
    console.log(`   Gateway Wallet: ${arcAddresses.gatewayWallet}`);
    console.log(`   Gateway Minter: ${arcAddresses.gatewayMinter}`);
    console.log(`   Domain ID: ${arcAddresses.domain}`);
    
    const baseDomain = getGatewayDestinationDomain("BASE-SEPOLIA");
    console.log(`\n✅ Base Sepolia Domain ID: ${baseDomain}`);
  } catch (error: any) {
    console.error(`❌ Error getting Gateway addresses: ${error.message}`);
    return;
  }
  
  // Step 2: Get wallet ID
  console.log("\n📋 Step 2: Getting Wallet ID");
  console.log("-".repeat(60));
  
  let walletId: string | undefined = process.env.TEST_WALLET_ID;
  
  if (!walletId) {
    try {
      const walletsResponse = await fetch(`${API_BASE_URL}/api/circle/wallets`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      
      if (walletsResponse.ok) {
        const walletsData = await walletsResponse.json();
        if (walletsData.success && walletsData.data?.wallets) {
          const wallets = walletsData.data.wallets;
          const normalizedTarget = ARC_WALLET_ADDRESS.toLowerCase();
          
          const matchingWallet = wallets.find((w: any) => {
            const addresses = [
              w.address,
              w.wallet?.address,
              w.data?.address,
            ].filter(Boolean);
            
            return addresses.some((addr: string) => {
              const normalizedAddr = addr.toLowerCase();
              return normalizedAddr === normalizedTarget || 
                     normalizedAddr.startsWith(normalizedTarget);
            });
          });
          
          if (matchingWallet) {
            walletId = matchingWallet.id || matchingWallet.walletId;
            console.log(`✅ Found wallet ID: ${walletId}`);
          }
        }
      }
    } catch (error: any) {
      console.log(`⚠️  Could not fetch wallets: ${error.message}`);
    }
  } else {
    console.log(`✅ Using wallet ID from environment: ${walletId}`);
  }
  
  if (!walletId) {
    console.log("\n❌ No wallet ID available. Please set TEST_WALLET_ID in .env");
    return;
  }
  
  // Step 3: Check Gateway balance
  console.log("\n📋 Step 3: Checking Gateway Balance");
  console.log("-".repeat(60));
  
  try {
    const balance = await checkGatewayBalance(ARC_WALLET_ADDRESS, "ARC-TESTNET");
    console.log(`✅ Gateway Balance: ${balance} USDC`);
    
    if (balance < parseFloat(BRIDGE_AMOUNT)) {
      console.log(`⚠️  Insufficient Gateway balance. Need to deposit first.`);
      console.log(`   Current: ${balance} USDC, Required: ${BRIDGE_AMOUNT} USDC`);
    } else {
      console.log(`✅ Sufficient balance for bridge`);
    }
  } catch (error: any) {
    console.log(`⚠️  Could not check Gateway balance: ${error.message}`);
  }
  
  // Step 4: Test Gateway Bridge via API
  console.log("\n📋 Step 4: Testing Gateway Bridge via API");
  console.log("-".repeat(60));
  console.log(`   From: ARC-TESTNET`);
  console.log(`   To: BASE-SEPOLIA`);
  console.log(`   Amount: ${BRIDGE_AMOUNT} USDC`);
  
  try {
    const bridgeResponse = await fetch(`${API_BASE_URL}/api/circle/bridge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletId: walletId,
        amount: BRIDGE_AMOUNT,
        fromChain: "ARC-TESTNET",
        toChain: "BASE-SEPOLIA",
        destinationAddress: BASE_DESTINATION_ADDRESS,
      }),
    });
    
    const bridgeData = await bridgeResponse.json();
    
    if (bridgeResponse.ok && bridgeData.success) {
      console.log("\n✅ Gateway Bridge Request Successful!");
      console.log(`   Bridge ID: ${bridgeData.data?.bridgeId || bridgeData.data?.id}`);
      console.log(`   Status: ${bridgeData.data?.status}`);
      console.log(`   Method: ${bridgeData.data?.method || "gateway"}`);
      console.log(`   Transaction Hash: ${bridgeData.data?.transactionHash || bridgeData.data?.txHash || "Pending"}`);
      
      if (bridgeData.data?.status === "completed") {
        console.log("\n🎉 Gateway bridge completed successfully!");
      }
    } else {
      console.log("\n❌ Gateway Bridge Request Failed:");
      console.log(`   Status: ${bridgeResponse.status}`);
      console.log(`   Error: ${bridgeData.error || bridgeData.message || "Unknown error"}`);
      
      if (bridgeData.details) {
        console.log("\n📋 Error Details:");
        console.log(`   CCTP Error: ${bridgeData.details.cctpError || "N/A"}`);
        console.log(`   Gateway Error: ${bridgeData.details.gatewayError || "N/A"}`);
        console.log(`   API Error: ${bridgeData.details.apiError || "N/A"}`);
        
        if (bridgeData.details.note) {
          console.log(`\n💡 Note: ${bridgeData.details.note}`);
        }
      }
    }
  } catch (error: any) {
    console.error(`\n❌ Error testing Gateway bridge: ${error.message}`);
    console.error(error);
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ Gateway Bridge Test Completed!\n");
}

testGatewayBridge().catch(console.error);

