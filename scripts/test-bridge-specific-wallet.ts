/**
 * Test Cross-Chain Bridge: Specific Arc Wallet → Base
 * 
 * Tests bridging $2 USDC from a specific Arc wallet to Base
 */

import dotenv from "dotenv";
import { getCCTPAddresses, getDestinationDomain } from "../lib/cctp/cctp-contracts";

dotenv.config();

// User's Arc wallet address (note: may be missing a character, should be 42 chars including 0x)
const ARC_WALLET_ADDRESS = "0x78d4064b6ff337a157256800e782058f11e6c1d7"; // User's Arc wallet
const BASE_DESTINATION_ADDRESS = "0x37195b0fc7198a4fc8c7dafe3bcc5bcf8cb680a0"; // Base destination
const BRIDGE_AMOUNT = "2"; // $2 USDC
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

async function testBridgeSpecificWallet() {
  console.log("🌉 Testing Cross-Chain Bridge: Specific Arc Wallet → Base\n");
  console.log("=".repeat(60));
  console.log(`Arc Wallet: ${ARC_WALLET_ADDRESS}`);
  console.log(`Base Destination: ${BASE_DESTINATION_ADDRESS}`);
  console.log(`Amount: $${BRIDGE_AMOUNT} USDC\n`);
  console.log("=".repeat(60));
  
  // Step 1: Verify CCTP addresses
  console.log("\n📋 Step 1: Verifying CCTP Contract Addresses");
  console.log("-".repeat(60));
  
  try {
    const arcAddresses = getCCTPAddresses("ARC-TESTNET");
    console.log("✅ Arc Testnet CCTP Addresses:");
    console.log(`   TokenMessengerV2: ${arcAddresses.tokenMessenger}`);
    console.log(`   MessageTransmitterV2: ${arcAddresses.messageTransmitter}`);
    console.log(`   Domain ID: ${arcAddresses.domain}`);
    
    const baseDomain = getDestinationDomain("BASE-SEPOLIA");
    console.log(`\n✅ Base Sepolia Domain ID: ${baseDomain}`);
  } catch (error: any) {
    console.error(`❌ Error getting CCTP addresses: ${error.message}`);
    return;
  }
  
  // Step 2: Find wallet ID from address
  console.log("\n📋 Step 2: Finding Wallet ID from Address");
  console.log("-".repeat(60));
  
  // Check address format
  if (ARC_WALLET_ADDRESS.length !== 42) {
    console.log(`⚠️  Address length is ${ARC_WALLET_ADDRESS.length}, expected 42 characters`);
    console.log("   Valid Ethereum addresses are 42 characters (0x + 40 hex chars)");
    console.log("   Proceeding anyway...");
  }
  
  let walletId: string | undefined = process.env.TEST_WALLET_ID;
  
  try {
    // Try to get wallet ID from API by listing wallets
    console.log("   Fetching wallets from API...");
    const walletsResponse = await fetch(`${API_BASE_URL}/api/circle/wallets`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (walletsResponse.ok) {
      const walletsData = await walletsResponse.json();
      if (walletsData.success && walletsData.data?.wallets) {
        const wallets = walletsData.data.wallets;
        console.log(`   Found ${wallets.length} wallet(s)`);
        
        // Search for wallet with matching address (fuzzy match in case address is incomplete)
        const normalizedTarget = ARC_WALLET_ADDRESS.toLowerCase();
        const matchingWallet = wallets.find((w: any) => {
          const addresses = [
            w.address,
            w.wallet?.address,
            w.data?.address,
            w.addresses?.[0]?.address,
          ].filter(Boolean);
          
          return addresses.some((addr: string) => {
            const normalizedAddr = addr.toLowerCase();
            return normalizedAddr === normalizedTarget || 
                   normalizedAddr.startsWith(normalizedTarget) ||
                   normalizedTarget.startsWith(normalizedAddr);
          });
        });
        
        if (matchingWallet) {
          walletId = matchingWallet.id || matchingWallet.walletId || matchingWallet.data?.id;
          const foundAddr = matchingWallet.address || matchingWallet.wallet?.address || matchingWallet.data?.address;
          console.log(`✅ Found matching wallet!`);
          console.log(`   Wallet ID: ${walletId}`);
          console.log(`   Address: ${foundAddr}`);
        } else {
          console.log("⚠️  Wallet address not found in wallet list.");
          if (walletId) {
            console.log(`   Using wallet ID from environment: ${walletId}`);
          }
        }
      }
    }
  } catch (error: any) {
    console.log(`⚠️  Could not fetch wallets: ${error.message}`);
    if (walletId) {
      console.log(`   Using wallet ID from environment: ${walletId}`);
    }
  }
  
  if (!walletId) {
    console.log("\n❌ No wallet ID available. Please:");
    console.log("   1. Set TEST_WALLET_ID in .env file to the wallet ID for this address, OR");
    console.log("   2. Make sure the wallet is accessible via API");
    console.log("\n💡 Note: Circle API requires wallet ID, not address.");
    console.log("   You may need to find the wallet ID for address:", ARC_WALLET_ADDRESS);
    return;
  }
  
  console.log(`\n✅ Using Wallet ID: ${walletId}`);
  
  // Step 3: Check balance by address (more reliable)
  console.log("\n📋 Step 3: Checking Balance");
  console.log("-".repeat(60));
  
  let balance = 0;
  try {
    // First try by address (more direct)
    const balanceResponse = await fetch(
      `${API_BASE_URL}/api/circle/balance?address=${ARC_WALLET_ADDRESS}&blockchain=ARC-TESTNET`
    );
    const balanceData = await balanceResponse.json();
    
    if (balanceData.success) {
      balance = parseFloat(balanceData.data?.balance || "0");
      console.log(`✅ Current Balance: ${balance} USDC`);
      
      if (balance < parseFloat(BRIDGE_AMOUNT)) {
        console.log(`\n❌ Insufficient balance!`);
        console.log(`   Required: ${BRIDGE_AMOUNT} USDC`);
        console.log(`   Available: ${balance} USDC`);
        return;
      } else {
        console.log(`✅ Sufficient balance for bridge (${BRIDGE_AMOUNT} USDC)`);
      }
    } else {
      // Fallback to wallet ID
      console.log(`   Trying balance check by wallet ID...`);
      const balanceResponse2 = await fetch(
        `${API_BASE_URL}/api/circle/balance?walletId=${walletId}&blockchain=ARC-TESTNET`
      );
      const balanceData2 = await balanceResponse2.json();
      
      if (balanceData2.success) {
        balance = parseFloat(balanceData2.data?.balance || "0");
        console.log(`✅ Current Balance: ${balance} USDC`);
        
        if (balance < parseFloat(BRIDGE_AMOUNT)) {
          console.log(`\n❌ Insufficient balance!`);
          return;
        }
      } else {
        console.log(`⚠️  Could not check balance: ${balanceData2.error || "Unknown error"}`);
      }
    }
  } catch (error: any) {
    console.error(`❌ Error checking balance: ${error.message}`);
    return;
  }
  
  // Step 4: Test Bridge
  console.log("\n📋 Step 4: Testing Bridge");
  console.log("-".repeat(60));
  console.log(`   From: ARC-TESTNET (${ARC_WALLET_ADDRESS})`);
  console.log(`   To: BASE-SEPOLIA (${BASE_DESTINATION_ADDRESS})`);
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
      console.log("\n✅ Bridge Request Successful!");
      console.log(`   Bridge ID: ${bridgeData.data?.bridgeId || bridgeData.data?.id}`);
      console.log(`   Status: ${bridgeData.data?.status}`);
      console.log(`   Transaction Hash: ${bridgeData.data?.transactionHash || bridgeData.data?.txHash || "Pending"}`);
      
      if (bridgeData.data?.burnTxHash) {
        console.log(`   Burn TX: ${bridgeData.data.burnTxHash}`);
      }
      if (bridgeData.data?.mintTxHash) {
        console.log(`   Mint TX: ${bridgeData.data.mintTxHash}`);
      }
      
      if (bridgeData.data?.status === "pending" || bridgeData.data?.status === "attesting" || bridgeData.data?.status === "burning") {
        console.log("\n⏳ Bridge is in progress. This may take a few minutes.");
        console.log("   You can check the status on:");
        if (bridgeData.data?.transactionHash || bridgeData.data?.burnTxHash) {
          const txHash = bridgeData.data.transactionHash || bridgeData.data.burnTxHash;
          console.log(`   - Arc: https://testnet.arcscan.app/tx/${txHash}`);
        }
        console.log(`   - Base: https://sepolia.basescan.org/address/${BASE_DESTINATION_ADDRESS}`);
      } else if (bridgeData.data?.status === "completed") {
        console.log("\n🎉 Bridge completed successfully!");
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
          console.log(`\n   Error Response:`);
          console.log(JSON.stringify(bridgeData.details.errorResponse, null, 2));
        }
      }
      
      if (bridgeData.details?.note) {
        console.log(`\n💡 Note: ${bridgeData.details.note}`);
      }
      
      if (bridgeData.details?.resources) {
        console.log(`\n📚 Resources:`);
        bridgeData.details.resources.forEach((url: string) => {
          console.log(`   - ${url}`);
        });
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
testBridgeSpecificWallet().catch(console.error);

