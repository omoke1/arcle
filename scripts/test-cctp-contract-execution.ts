/**
 * Test CCTP Bridge with Contract Execution Method
 * 
 * Tests the new contract execution method for CCTP transfers
 */

import dotenv from "dotenv";
import { getCCTPAddresses, getDestinationDomain } from "../lib/cctp/cctp-contracts";

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

const ARC_WALLET_ADDRESS = process.env.TEST_ARC_WALLET_ADDRESS || "0x78d4064b6ff337a157256800e782058f11e6c1d7";
const BASE_DESTINATION_ADDRESS = process.env.TEST_BASE_DESTINATION || "0x37195b0fc7198a4fc8c7dafe3bcc5bcf8cb680a0";
const BRIDGE_AMOUNT = process.env.TEST_BRIDGE_AMOUNT || "2";

async function testCCTPContractExecution() {
  console.log("🌉 Testing CCTP Bridge with Contract Execution Method\n");
  console.log("=".repeat(60));
  console.log(`Arc Wallet: ${ARC_WALLET_ADDRESS}`);
  console.log(`Base Destination: ${BASE_DESTINATION_ADDRESS}`);
  console.log(`Amount: $${BRIDGE_AMOUNT} USDC\n`);

  try {
    // Step 1: Get wallet ID
    console.log("📋 Step 1: Getting Wallet ID");
    console.log("-".repeat(60));
    let walletId = process.env.TEST_WALLET_ID;
    
    if (!walletId) {
      console.log("   No TEST_WALLET_ID found, fetching from API...");
      try {
        const walletsResponse = await fetch(`${API_BASE_URL}/api/circle/wallets?blockchain=ARC-TESTNET`);
        const walletsData = await walletsResponse.json();
        
        if (walletsData.success && walletsData.data?.wallets) {
          // Find wallet by address
          const wallet = walletsData.data.wallets.find(
            (w: any) => w.address?.toLowerCase() === ARC_WALLET_ADDRESS.toLowerCase()
          );
          
          if (wallet) {
            walletId = wallet.id;
            console.log(`   ✅ Found wallet ID: ${walletId}`);
          } else {
            throw new Error(`Wallet with address ${ARC_WALLET_ADDRESS} not found.`);
          }
        } else {
          throw new Error("No wallets found. Please create a wallet first.");
        }
      } catch (error: any) {
        console.log(`   ⚠️  Could not fetch wallets: ${error.message}`);
        console.log(`   Make sure dev server is running: npm run dev`);
        throw error;
      }
    } else {
      console.log(`   ✅ Using wallet ID from env: ${walletId}`);
    }

    // Step 2: Check balance
    console.log("\n📋 Step 2: Checking Balance");
    console.log("-".repeat(60));
    const balanceResponse = await fetch(
      `${API_BASE_URL}/api/circle/balance?walletId=${walletId}&blockchain=ARC-TESTNET`
    );
    const balanceData = await balanceResponse.json();
    
    let balance = "0";
    if (balanceData.success && balanceData.data?.balance) {
      balance = parseFloat(balanceData.data.balance).toFixed(6);
    }
    
    console.log(`   Current Balance: ${balance} USDC`);
    
    if (parseFloat(balance) < parseFloat(BRIDGE_AMOUNT)) {
      console.log(`   ⚠️  Insufficient balance! Need ${BRIDGE_AMOUNT} USDC, have ${balance}`);
      console.log(`   Requesting testnet tokens...`);
      
      try {
        const faucetResponse = await fetch(`${API_BASE_URL}/api/circle/faucet`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            address: ARC_WALLET_ADDRESS,
            blockchain: "ARC-TESTNET",
            native: true,
            usdc: true,
          }),
        });
        const faucetData = await faucetResponse.json();
        if (faucetData.success) {
          console.log(`   ✅ Faucet request sent. Waiting 10 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 10000));
        } else {
          console.log(`   ⚠️  Faucet request failed: ${faucetData.error || "Unknown error"}`);
        }
      } catch (faucetError: any) {
        console.log(`   ⚠️  Faucet request failed: ${faucetError.message}`);
      }
    } else {
      console.log(`   ✅ Sufficient balance`);
    }

    // Step 3: Verify CCTP contract addresses
    console.log("\n📋 Step 3: Verifying CCTP Contract Addresses");
    console.log("-".repeat(60));
    try {
      const arcAddresses = getCCTPAddresses("ARC-TESTNET");
      const baseDomain = getDestinationDomain("BASE-SEPOLIA");
      
      console.log(`   ✅ Arc Testnet CCTP Addresses:`);
      console.log(`      TokenMessenger: ${arcAddresses.tokenMessenger}`);
      console.log(`      MessageTransmitter: ${arcAddresses.messageTransmitter}`);
      console.log(`      USDC: ${arcAddresses.usdc}`);
      console.log(`      Domain: ${arcAddresses.domain}`);
      console.log(`   ✅ Base Sepolia Domain: ${baseDomain}`);
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      throw error;
    }

    // Step 4: Test contract execution method via API
    console.log("\n📋 Step 4: Testing Contract Execution Method");
    console.log("-".repeat(60));
    
    const arcAddresses = getCCTPAddresses("ARC-TESTNET");
    const baseDomain = getDestinationDomain("BASE-SEPOLIA");
    
    console.log("   Testing contract execution endpoint via API...");
    console.log(`   Contract: ${arcAddresses.tokenMessenger}`);
    console.log(`   Function: depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)`);
    
    // Note: We'll test this through the bridge endpoint which uses contract execution
    console.log("   Will test via bridge endpoint which uses contract execution method");

    // Step 5: Execute full CCTP transfer via API
    console.log("\n📋 Step 5: Executing Full CCTP Transfer via API");
    console.log("-".repeat(60));
    console.log(`   From: ARC-TESTNET`);
    console.log(`   To: BASE-SEPOLIA`);
    console.log(`   Amount: ${BRIDGE_AMOUNT} USDC`);
    console.log(`   Destination: ${BASE_DESTINATION_ADDRESS}`);
    
    const bridgeResponse = await fetch(`${API_BASE_URL}/api/circle/bridge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
      console.log("\n✅ CCTP Bridge Request Successful!");
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
      console.log("\n❌ CCTP Bridge Request Failed:");
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
      
      if (bridgeData.details?.note) {
        console.log(`\n💡 Note: ${bridgeData.details.note}`);
      }
      
      throw new Error(bridgeData.error || bridgeData.message || "Bridge request failed");
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ CCTP Contract Execution Test Completed!\n");
    
  } catch (error: any) {
    console.error("\n❌ Test Failed:");
    console.error(`   Error: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    console.error(error.stack);
    process.exit(1);
  }
}

testCCTPContractExecution().catch(console.error);

