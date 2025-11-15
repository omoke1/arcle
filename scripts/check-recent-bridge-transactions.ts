/**
 * Check Recent Bridge Transactions
 * 
 * This script checks recent transactions to find bridge-related transactions
 * and verify their status.
 */

import dotenv from "dotenv";
import { getCircleClient } from "../lib/circle-sdk";
import { circleApiRequest } from "../lib/circle";
import { getCCTPStatus } from "../lib/cctp/cctp-implementation";
import { getDestinationDomain } from "../lib/cctp/cctp-contracts";

dotenv.config();

const WALLET_ID = process.env.WALLET_ID || "2aa7a32a-7e79-5bb3-9394-933dd6b0f923";
const SOURCE_CHAIN = process.env.SOURCE_CHAIN || "ARC-TESTNET";
const DESTINATION_CHAIN = process.env.DESTINATION_CHAIN || "BASE-SEPOLIA";

async function checkRecentBridgeTransactions() {
  console.log("🔍 Checking Recent Bridge Transactions...\n");
  console.log(`📝 Wallet ID: ${WALLET_ID}`);
  console.log(`🌐 Source Chain: ${SOURCE_CHAIN}`);
  console.log(`🌐 Destination Chain: ${DESTINATION_CHAIN}\n`);

  try {
    // Check recent transactions on source chain
    console.log(`⏳ Step 1: Checking recent transactions on ${SOURCE_CHAIN}...`);
    const sourceTxResponse = await circleApiRequest<any>(
      `/v1/w3s/developer/wallets/${WALLET_ID}/transactions?blockchain=${SOURCE_CHAIN}&limit=20`,
      { method: "GET" }
    );

    if (sourceTxResponse.data?.transactions && sourceTxResponse.data.transactions.length > 0) {
      console.log(`\n📋 Found ${sourceTxResponse.data.transactions.length} recent transactions on ${SOURCE_CHAIN}:`);
      
      // Look for contract execution transactions (CCTP burns)
      const contractExecutions = sourceTxResponse.data.transactions.filter((tx: any) => 
        tx.type === "CONTRACT_EXECUTION" || 
        (tx.state === "COMPLETED" && tx.transactionHash)
      );

      if (contractExecutions.length > 0) {
        console.log(`\n🔍 Found ${contractExecutions.length} potential bridge transactions:`);
        
        for (const tx of contractExecutions.slice(0, 5)) {
          console.log(`\n   Transaction:`);
          console.log(`      ID: ${tx.id || "N/A"}`);
          console.log(`      Hash: ${tx.transactionHash || tx.txHash || "N/A"}`);
          console.log(`      Status: ${tx.state || tx.status || "unknown"}`);
          console.log(`      Type: ${tx.type || "unknown"}`);
          console.log(`      Created: ${tx.createdAt || "N/A"}`);
          
          // If we have a transaction hash, check CCTP status
          const txHash = tx.transactionHash || tx.txHash;
          if (txHash && txHash.startsWith("0x")) {
            console.log(`\n   ⏳ Checking CCTP status for ${txHash}...`);
            try {
              const sourceDomainId = getDestinationDomain(SOURCE_CHAIN);
              const cctpStatus = await getCCTPStatus(txHash, sourceDomainId);
              
              console.log(`      CCTP Status: ${cctpStatus.status}`);
              if (cctpStatus.attestation) {
                console.log(`      ✅ Attestation: Received`);
                console.log(`      📨 Message: ${cctpStatus.message?.substring(0, 30)}...`);
              } else {
                console.log(`      ⏳ Attestation: Pending`);
              }
              
              if (cctpStatus.status === "attested" || cctpStatus.status === "completed") {
                console.log(`\n   ✅ SUCCESS: This bridge transaction is attested and ready for minting!`);
              }
            } catch (err: any) {
              console.log(`      ⚠️  Could not check CCTP status: ${err.message}`);
            }
          }
        }
      } else {
        console.log(`\n   ⚠️  No contract execution transactions found`);
      }
    } else {
      console.log(`\n   ⚠️  No transactions found on ${SOURCE_CHAIN}`);
    }

    // Check recent transactions on destination chain
    console.log(`\n\n⏳ Step 2: Checking recent transactions on ${DESTINATION_CHAIN}...`);
    try {
      const destTxResponse = await circleApiRequest<any>(
        `/v1/w3s/developer/wallets/${WALLET_ID}/transactions?blockchain=${DESTINATION_CHAIN}&limit=20`,
        { method: "GET" }
      );

      if (destTxResponse.data?.transactions && destTxResponse.data.transactions.length > 0) {
        console.log(`\n📋 Found ${destTxResponse.data.transactions.length} recent transactions on ${DESTINATION_CHAIN}:`);
        
        // Look for recent contract execution transactions (CCTP mints)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const recentMints = destTxResponse.data.transactions
          .filter((tx: any) => {
            if (tx.type === "CONTRACT_EXECUTION") return true;
            if (tx.state === "COMPLETED" && tx.createdAt) {
              return new Date(tx.createdAt) > tenMinutesAgo;
            }
            return false;
          })
          .slice(0, 5);

        if (recentMints.length > 0) {
          console.log(`\n🔍 Found ${recentMints.length} potential mint transactions:`);
          recentMints.forEach((tx: any, index: number) => {
            console.log(`\n   ${index + 1}. Transaction:`);
            console.log(`      ID: ${tx.id || "N/A"}`);
            console.log(`      Hash: ${tx.transactionHash || tx.txHash || "N/A"}`);
            console.log(`      Status: ${tx.state || tx.status || "unknown"}`);
            console.log(`      Type: ${tx.type || "unknown"}`);
            console.log(`      Created: ${tx.createdAt || "N/A"}`);
            if (tx.state === "COMPLETED") {
              console.log(`      ✅ Completed`);
            }
          });
        } else {
          console.log(`\n   ⏳ No recent mint transactions found yet`);
        }
      } else {
        console.log(`\n   ⚠️  No transactions found on ${DESTINATION_CHAIN}`);
      }
    } catch (err: any) {
      console.log(`   ⚠️  Could not check destination transactions: ${err.message}`);
    }

    // Summary
    console.log(`\n\n📊 VERIFICATION SUMMARY:`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Checked recent transactions on both chains`);
    console.log(`💡 Look for:`);
    console.log(`   • Contract execution transactions on ${SOURCE_CHAIN} (burns)`);
    console.log(`   • Contract execution transactions on ${DESTINATION_CHAIN} (mints)`);
    console.log(`   • CCTP attestation status for burn transactions`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  } catch (error: any) {
    console.error("\n❌ Error checking transactions:", error.message);
    console.error(error);
    process.exit(1);
  }
}

checkRecentBridgeTransactions();

