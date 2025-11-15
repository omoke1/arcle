/**
 * Check Balance by Address
 * 
 * Checks USDC balance for a specific wallet address
 */

import dotenv from "dotenv";

dotenv.config();

const ARC_WALLET_ADDRESS = "0x78d4064b6ff337a157256800e782058f11e6c1d7";
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";

async function checkBalanceByAddress() {
  console.log("💰 Checking Balance by Address\n");
  console.log("=".repeat(60));
  console.log(`Address: ${ARC_WALLET_ADDRESS}\n`);
  
  // Check address format
  if (ARC_WALLET_ADDRESS.length !== 42) {
    console.log(`⚠️  Address length is ${ARC_WALLET_ADDRESS.length}, expected 42 characters`);
    console.log("   Valid Ethereum addresses are 42 characters (0x + 40 hex chars)");
  }
  
  try {
    // Try to check balance using address directly
    console.log("📋 Checking balance via API...");
    const balanceResponse = await fetch(
      `${API_BASE_URL}/api/circle/balance?address=${ARC_WALLET_ADDRESS}&blockchain=ARC-TESTNET`
    );
    
    const balanceData = await balanceResponse.json();
    
    if (balanceData.success) {
      const balance = parseFloat(balanceData.data?.balance || "0");
      console.log(`\n✅ Balance: ${balance} USDC`);
      
      if (balance >= 2) {
        console.log(`✅ Sufficient balance for $2 bridge!`);
      } else {
        console.log(`❌ Insufficient balance. Need 2 USDC, have ${balance} USDC`);
      }
      
      return balance;
    } else {
      console.log(`\n❌ Could not check balance: ${balanceData.error || "Unknown error"}`);
      return null;
    }
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    return null;
  }
}

checkBalanceByAddress().catch(console.error);

