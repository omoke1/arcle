/**
 * Find Gateway Contract Addresses
 * 
 * Queries Gateway API to find contract addresses for supported chains
 */

import { GATEWAY_API_V1_INFO } from "../lib/gateway/gateway-contracts";

async function findGatewayAddresses() {
  console.log("🔍 Finding Gateway Contract Addresses\n");
  console.log("=".repeat(60));
  
  try {
    console.log("📋 Querying Gateway API info endpoint...");
    const response = await fetch(GATEWAY_API_V1_INFO);
    
    if (!response.ok) {
      throw new Error(`Gateway API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log("\n✅ Gateway API Info:");
    console.log(JSON.stringify(data, null, 2));
    
    if (data.domains) {
      console.log("\n📋 Supported Chains:");
      console.log("-".repeat(60));
      
      for (const domain of data.domains) {
        console.log(`\n${domain.chain} ${domain.network || ""} (Domain ${domain.domain})`);
        if (domain.walletContract) {
          console.log(`  Gateway Wallet: ${domain.walletContract.address}`);
        }
        if (domain.minterContract) {
          console.log(`  Gateway Minter: ${domain.minterContract.address}`);
        }
        if (domain.usdc) {
          console.log(`  USDC: ${domain.usdc.address}`);
        }
        
        // Check for Base Sepolia specifically
        if (domain.chain === "Base" && (domain.network === "Sepolia" || domain.network === "sepolia")) {
          console.log("\n🎯 Found Base Sepolia!");
          console.log(`  Domain: ${domain.domain}`);
          if (domain.walletContract) {
            console.log(`  Gateway Wallet: ${domain.walletContract.address}`);
          }
          if (domain.minterContract) {
            console.log(`  Gateway Minter: ${domain.minterContract.address}`);
          }
        }
      }
    }
    
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(error);
  }
  
  console.log("\n" + "=".repeat(60));
}

findGatewayAddresses().catch(console.error);

