/**
 * Check Bridge Transaction Status
 * 
 * This script checks the status of a bridge transaction to verify it completed successfully.
 */

import dotenv from "dotenv";
import { getCircleClient } from "../lib/circle-sdk";
import { circleApiRequest } from "../lib/circle";
import { getCCTPAddresses, getDestinationDomain } from "../lib/cctp/cctp-contracts";
import { getCCTPStatus } from "../lib/cctp/cctp-implementation";

dotenv.config();

const BRIDGE_ID = process.env.BRIDGE_ID || "";
const TRANSACTION_HASH = process.env.TRANSACTION_HASH || "";
const SOURCE_CHAIN = process.env.SOURCE_CHAIN || "ARC-TESTNET";

async function checkBridgeStatus() {
  console.log("🔍 Checking Bridge Transaction Status...\n");

  if (!TRANSACTION_HASH && !BRIDGE_ID) {
    console.error("❌ Error: Please provide either BRIDGE_ID or TRANSACTION_HASH in .env");
    console.log("\nUsage:");
    console.log("  TRANSACTION_HASH=0x... npm run check-bridge-status");
    console.log("  or");
    console.log("  BRIDGE_ID=... npm run check-bridge-status");
    process.exit(1);
  }

  try {
    // If we have a transaction hash, check CCTP status
    if (TRANSACTION_HASH) {
      console.log(`📝 Transaction Hash: ${TRANSACTION_HASH}`);
      console.log(`🌐 Source Chain: ${SOURCE_CHAIN}\n`);

      const sourceDomainId = getDestinationDomain(SOURCE_CHAIN);
      console.log(`🔢 Source Domain ID: ${sourceDomainId}\n`);

      console.log("⏳ Checking CCTP status via V2 API...");
      const cctpStatus = await getCCTPStatus(TRANSACTION_HASH, sourceDomainId);
      
      console.log("\n📊 CCTP Status:");
      console.log(`   Status: ${cctpStatus.status}`);
      if (cctpStatus.attestation) {
        console.log(`   ✅ Attestation: ${cctpStatus.attestation.substring(0, 20)}...`);
      }
      if (cctpStatus.message) {
        console.log(`   📨 Message: ${cctpStatus.message.substring(0, 20)}...`);
      }

      if (cctpStatus.status === "attested" || cctpStatus.status === "completed") {
        console.log("\n✅ SUCCESS: Bridge transaction is attested and ready for minting!");
      } else if (cctpStatus.status === "pending") {
        console.log("\n⏳ PENDING: Bridge transaction is still being processed.");
      } else {
        console.log("\n❌ FAILED: Bridge transaction failed.");
      }
    }

    // If we have a bridge ID, check Circle Transfer API
    if (BRIDGE_ID) {
      console.log(`\n📝 Bridge ID: ${BRIDGE_ID}`);
      console.log("⏳ Checking Circle Transfer API status...\n");

      try {
        // Try developer endpoint
        const response = await circleApiRequest<any>(
          `/v1/w3s/developer/transfers/${BRIDGE_ID}`,
          { method: "GET" }
        );

        console.log("📊 Transfer Status:");
        console.log(`   Status: ${response.data?.status || "unknown"}`);
        console.log(`   Source: ${response.data?.source?.chain || "unknown"}`);
        console.log(`   Destination: ${response.data?.destination?.chain || "unknown"}`);
        console.log(`   Amount: ${response.data?.amount?.amount ? (BigInt(response.data.amount.amount) / 1_000_000n).toString() : "unknown"} USDC`);
        console.log(`   Transaction Hash: ${response.data?.transactionHash || "N/A"}`);

        if (response.data?.status === "complete") {
          console.log("\n✅ SUCCESS: Bridge transfer completed successfully!");
        } else if (response.data?.status === "pending") {
          console.log("\n⏳ PENDING: Bridge transfer is still processing.");
        } else if (response.data?.status === "failed") {
          console.log("\n❌ FAILED: Bridge transfer failed.");
          console.log(`   Error: ${response.data?.error?.message || "Unknown error"}`);
        }
      } catch (error: any) {
        console.log("⚠️  Developer endpoint not available, trying regular endpoint...");
        try {
          const response = await circleApiRequest<any>(
            `/v1/w3s/transfers/${BRIDGE_ID}`,
            { method: "GET" }
          );
          console.log("📊 Transfer Status:", response.data);
        } catch (err: any) {
          console.error("❌ Error checking transfer status:", err.message);
        }
      }
    }

    // Check recent transactions for the wallet
    console.log("\n\n🔍 Checking recent transactions...");
    const client = getCircleClient();
    const wallets = await client.listWallets({});
    
    if (wallets.data?.wallets && wallets.data.wallets.length > 0) {
      const walletId = wallets.data.wallets[0].id;
      console.log(`   Wallet ID: ${walletId}`);

      try {
        const txResponse = await circleApiRequest<any>(
          `/v1/w3s/developer/wallets/${walletId}/transactions?blockchain=${SOURCE_CHAIN}&limit=10`,
          { method: "GET" }
        );

        if (txResponse.data?.transactions && txResponse.data.transactions.length > 0) {
          console.log(`\n📋 Recent Transactions (${txResponse.data.transactions.length}):`);
          txResponse.data.transactions.slice(0, 5).forEach((tx: any, index: number) => {
            console.log(`\n   ${index + 1}. Transaction ${tx.id || tx.transactionHash || "unknown"}`);
            console.log(`      Status: ${tx.state || tx.status || "unknown"}`);
            console.log(`      Type: ${tx.type || "unknown"}`);
            if (tx.transactionHash) {
              console.log(`      Hash: ${tx.transactionHash}`);
            }
          });
        }
      } catch (err: any) {
        console.error("   ⚠️  Could not fetch transactions:", err.message);
      }
    }

  } catch (error: any) {
    console.error("\n❌ Error checking bridge status:", error.message);
    console.error(error);
    process.exit(1);
  }
}

checkBridgeStatus();

