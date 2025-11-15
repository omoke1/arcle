/**
 * Test Cross-Chain Bridge: Arc Testnet → Base
 * 
 * Tests the CCTP bridge implementation with real contract addresses
 * Destination: Base Sepolia (testnet)
 */

import dotenv from "dotenv";
import { getCCTPAddresses, getDestinationDomain } from "../lib/cctp/cctp-contracts";

dotenv.config();

const BASE_DESTINATION_ADDRESS = "0x37195b0fc7198a4fc8c7dafe3bcc5bcf8cb680a0";
const TEST_AMOUNT = "0.1"; // Small test amount
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

async function testBridgeArcToBase() {
  console.log("🌉 Testing Cross-Chain Bridge: Arc Testnet → Base Sepolia\n");
  console.log("=".repeat(60));
  
  // Step 1: Verify CCTP addresses are available
  console.log("\n📋 Step 1: Verifying CCTP Contract Addresses");
  console.log("-".repeat(60));
  
  try {
    const arcAddresses = getCCTPAddresses("ARC-TESTNET");
    console.log("✅ Arc Testnet CCTP Addresses:");
    console.log(`   TokenMessengerV2: ${arcAddresses.tokenMessenger}`);
    console.log(`   MessageTransmitterV2: ${arcAddresses.messageTransmitter}`);
    console.log(`   Domain ID: ${arcAddresses.domain}`);
    console.log(`   USDC: ${arcAddresses.usdc}`);
    
    const baseDomain = getDestinationDomain("BASE-SEPOLIA");
    console.log(`\n✅ Base Sepolia Domain ID: ${baseDomain}`);
  } catch (error: any) {
    console.error(`❌ Error getting CCTP addresses: ${error.message}`);
    return;
  }
  
  // Step 2: Get wallet ID from environment or use API
  console.log("\n📋 Step 2: Getting Wallet");
  console.log("-".repeat(60));
  
  let walletId: string | undefined = process.env.TEST_WALLET_ID;
  let walletAddress: string | undefined = process.env.TEST_WALLET_ADDRESS;
  
  if (!walletId) {
    // Try to get wallet from API
    try {
      console.log("   Fetching wallet from API...");
      const walletResponse = await fetch(`${API_BASE_URL}/api/circle/wallets`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      
      if (walletResponse.ok) {
        const walletData = await walletResponse.json();
        if (walletData.success && walletData.data?.walletId) {
          walletId = walletData.data.walletId;
          walletAddress = walletData.data.address;
          console.log(`✅ Found wallet from API:`);
        } else {
          console.log("⚠️  No wallet found. Creating one...");
          // Try to create wallet
          const createResponse = await fetch(`${API_BASE_URL}/api/circle/wallets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idempotencyKey: `test-${Date.now()}` }),
          });
          
          if (createResponse.ok) {
            const createData = await createResponse.json();
            if (createData.success) {
              walletId = createData.data?.walletId;
              walletAddress = createData.data?.address;
              console.log(`✅ Created new wallet:`);
            }
          }
        }
      }
    } catch (error: any) {
      console.log(`⚠️  Could not get wallet from API: ${error.message}`);
      console.log("   Make sure dev server is running: npm run dev");
      console.log("   Or set TEST_WALLET_ID in .env file");
    }
  }
  
  if (!walletId) {
    console.log("\n❌ No wallet available. Please:");
    console.log("   1. Set TEST_WALLET_ID in .env file, OR");
    console.log("   2. Run: npm run create-wallet, OR");
    console.log("   3. Make sure dev server is running: npm run dev");
    return;
  }
  
  console.log(`✅ Using wallet:`);
  console.log(`   Wallet ID: ${walletId}`);
  console.log(`   Address: ${walletAddress || "N/A"}`);
  
  // Step 3: Check balance
  console.log("\n📋 Step 3: Checking Balance");
  console.log("-".repeat(60));
  
  try {
    const balanceResponse = await fetch(
      `${API_BASE_URL}/api/circle/balance?walletId=${walletId}&blockchain=ARC-TESTNET`
    );
    const balanceData = await balanceResponse.json();
    
    if (balanceData.success) {
      const balance = parseFloat(balanceData.data?.balance || "0");
      console.log(`✅ Current Balance: ${balance} USDC`);
      
      if (balance < parseFloat(TEST_AMOUNT)) {
        console.log(`⚠️  Insufficient balance. Need at least ${TEST_AMOUNT} USDC`);
        console.log(`   Requesting testnet tokens...`);
        
        // Request faucet
        const faucetResponse = await fetch(`${API_BASE_URL}/api/circle/faucet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: walletAddress,
            blockchain: "ARC-TESTNET",
            native: true,
            usdc: true,
          }),
        });
        
        const faucetData = await faucetResponse.json();
        if (faucetData.success) {
          console.log("✅ Testnet tokens requested. Waiting 10 seconds...");
          await new Promise(resolve => setTimeout(resolve, 10000));
        } else {
          console.log(`⚠️  Faucet request failed: ${faucetData.error || "Unknown error"}`);
        }
      }
    } else {
      console.log(`⚠️  Could not check balance: ${balanceData.error || "Unknown error"}`);
    }
  } catch (error: any) {
    console.error(`❌ Error checking balance: ${error.message}`);
  }
  
  // Step 4: Test Bridge via API
  console.log("\n📋 Step 4: Testing Bridge via API");
  console.log("-".repeat(60));
  console.log(`   From: ARC-TESTNET`);
  console.log(`   To: BASE-SEPOLIA`);
  console.log(`   Amount: ${TEST_AMOUNT} USDC`);
  console.log(`   Destination: ${BASE_DESTINATION_ADDRESS}`);
  
  try {
    const bridgeResponse = await fetch(`${API_BASE_URL}/api/circle/bridge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletId: walletId,
        amount: TEST_AMOUNT,
        fromChain: "ARC-TESTNET",
        toChain: "BASE-SEPOLIA",
        destinationAddress: BASE_DESTINATION_ADDRESS,
      }),
    });
    
    const bridgeData = await bridgeResponse.json();
    
    if (bridgeResponse.ok && bridgeData.success) {
      console.log("\n✅ Bridge Request Successful!");
      console.log(`   Bridge ID: ${bridgeData.data?.bridgeId || bridgeData.data?.id}`);
      console.log(`   Status: ${bridgeData.data?.status}`);
      console.log(`   Transaction Hash: ${bridgeData.data?.transactionHash || bridgeData.data?.txHash || "Pending"}`);
      
      if (bridgeData.data?.status === "pending" || bridgeData.data?.status === "attesting") {
        console.log("\n⏳ Bridge is in progress. This may take a few minutes.");
        console.log("   You can check the status on:");
        console.log(`   - Arc: https://testnet.arcscan.app/tx/${bridgeData.data?.transactionHash || ""}`);
        console.log(`   - Base: https://sepolia.basescan.org/address/${BASE_DESTINATION_ADDRESS}`);
      }
    } else {
      console.log("\n❌ Bridge Request Failed:");
      console.log(`   Status: ${bridgeResponse.status}`);
      console.log(`   Error: ${bridgeData.error || bridgeData.message || "Unknown error"}`);
      
      if (bridgeData.details) {
        console.log("\n📋 Error Details:");
        console.log(`   API Error: ${bridgeData.details.apiError || "N/A"}`);
        console.log(`   Contract Error: ${bridgeData.details.contractError || "N/A"}`);
        console.log(`   Error Code: ${bridgeData.details.errorCode || "N/A"}`);
        console.log(`   Wallet Address: ${bridgeData.details.walletAddress || "N/A"}`);
        
        if (bridgeData.details.errorResponse) {
          console.log(`   Error Response: ${JSON.stringify(bridgeData.details.errorResponse, null, 2)}`);
        }
      }
      
      if (bridgeData.error?.includes("data") || bridgeData.error?.includes("contract")) {
        console.log("\n💡 This error suggests Circle SDK may not support contract calls via 'data' field.");
        console.log("   The CCTP implementation is ready, but we may need to use REST API directly.");
      }
      
      if (bridgeData.details?.note) {
        console.log(`\n💡 Note: ${bridgeData.details.note}`);
      }
    }
  } catch (error: any) {
    console.error(`\n❌ Error testing bridge: ${error.message}`);
    console.error(error);
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ Bridge Test Completed!\n");
}

// Run the test
testBridgeArcToBase().catch(console.error);

