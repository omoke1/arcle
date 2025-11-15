/**
 * Find Wallet ID by Address
 * 
 * Searches for a wallet ID that matches the given address
 */

import dotenv from "dotenv";
import { getCircleClient } from "../lib/circle-sdk";

dotenv.config();

const TARGET_ADDRESS = "0x78d4064b6ff337a157256800e782058f11e6c1d7"; // User's wallet address

async function findWalletByAddress() {
  console.log("🔍 Finding Wallet ID by Address\n");
  console.log("=".repeat(60));
  console.log(`Target Address: ${TARGET_ADDRESS}\n`);
  
  try {
    const client = getCircleClient();
    
    // List all wallets
    console.log("📋 Fetching all wallets...");
    const walletsResponse = await client.listWallets({});
    const wallets = walletsResponse.data?.wallets || [];
    
    console.log(`✅ Found ${wallets.length} wallet(s)\n`);
    
    if (wallets.length === 0) {
      console.log("❌ No wallets found. Please create a wallet first.");
      return;
    }
    
    // Search for matching address
    const normalizedTarget = TARGET_ADDRESS.toLowerCase();
    let found = false;
    
    for (const wallet of wallets) {
      const walletData = wallet as any;
      const addresses = [
        walletData.address,
        walletData.wallet?.address,
        walletData.data?.address,
      ].filter(Boolean);
      
      console.log(`\n📋 Wallet ID: ${walletData.id || walletData.walletId}`);
      console.log(`   Addresses found: ${addresses.length}`);
      
      for (const addr of addresses) {
        if (addr) {
          const normalizedAddr = addr.toLowerCase();
          console.log(`   - ${addr}`);
          
          if (normalizedAddr === normalizedTarget || normalizedAddr.startsWith(normalizedTarget)) {
            console.log(`\n✅ MATCH FOUND!`);
            console.log(`   Wallet ID: ${walletData.id || walletData.walletId}`);
            console.log(`   Address: ${addr}`);
            found = true;
            
            // Check balance
            try {
              const balanceResponse = await fetch(
                `http://localhost:3000/api/circle/balance?walletId=${walletData.id || walletData.walletId}&blockchain=ARC-TESTNET`
              );
              const balanceData = await balanceResponse.json();
              
              if (balanceData.success) {
                const balance = parseFloat(balanceData.data?.balance || "0");
                console.log(`   Balance: ${balance} USDC`);
              }
            } catch (e) {
              // Ignore balance check errors
            }
            
            break;
          }
        }
      }
      
      if (found) break;
    }
    
    if (!found) {
      console.log("\n⚠️  No matching wallet found for address:", TARGET_ADDRESS);
      console.log("\n💡 The address might be:");
      console.log("   1. Not in your Circle account");
      console.log("   2. Missing a character (should be 42 chars including 0x)");
      console.log("   3. On a different account");
      
      // Check if address is valid length
      if (TARGET_ADDRESS.length !== 42) {
        console.log(`\n⚠️  Address length is ${TARGET_ADDRESS.length}, expected 42`);
        console.log("   Valid Ethereum addresses are 42 characters (0x + 40 hex chars)");
      }
    }
    
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error(error);
  }
  
  console.log("\n" + "=".repeat(60));
}

findWalletByAddress().catch(console.error);

