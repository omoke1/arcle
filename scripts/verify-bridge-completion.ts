/**
 * Verify Bridge Completion
 * 
 * This script checks if a bridge transaction completed successfully by:
 * 1. Checking the transaction hash on the source chain
 * 2. Checking CCTP attestation status
 * 3. Checking for mint transaction on destination chain
 */

import dotenv from "dotenv";
import { getCircleClient } from "../lib/circle-sdk";
import { circleApiRequest } from "../lib/circle";
import { getCCTPStatus } from "../lib/cctp/cctp-implementation";
import { getDestinationDomain } from "../lib/cctp/cctp-contracts";

dotenv.config();

const TRANSACTION_HASH = process.env.TRANSACTION_HASH || "";
const WALLET_ID = process.env.WALLET_ID || "";
const SOURCE_CHAIN = process.env.SOURCE_CHAIN || "ARC-TESTNET";
const DESTINATION_CHAIN = process.env.DESTINATION_CHAIN || "BASE-SEPOLIA";

async function verifyBridgeCompletion() {
  console.log("🔍 Verifying Bridge Completion...\n");

  if (!TRANSACTION_HASH) {
    console.error("❌ Error: Please provide TRANSACTION_HASH in .env");
    console.log("\nUsage:");
    console.log("  TRANSACTION_HASH=0x... npm run verify-bridge-completion");
    process.exit(1);
  }

  console.log(`📝 Transaction Hash: ${TRANSACTION_HASH}`);
  console.log(`🌐 Source Chain: ${SOURCE_CHAIN}`);
  console.log(`🌐 Destination Chain: ${DESTINATION_CHAIN}\n`);

  try {
    // Step 1: Check CCTP Status
    console.log("⏳ Step 1: Checking CCTP Attestation Status...");
    const sourceDomainId = getDestinationDomain(SOURCE_CHAIN);
    const cctpStatus = await getCCTPStatus(TRANSACTION_HASH, sourceDomainId);
    
    console.log(`\n📊 CCTP Status:`);
    console.log(`   Status: ${cctpStatus.status}`);
    if (cctpStatus.attestation) {
      console.log(`   ✅ Attestation: Received (${cctpStatus.attestation.substring(0, 20)}...)`);
    } else {
      console.log(`   ⏳ Attestation: Pending`);
    }
    if (cctpStatus.message) {
      console.log(`   📨 Message: ${cctpStatus.message.substring(0, 20)}...`);
    }

    // Step 2: Check transaction on source chain
    console.log(`\n⏳ Step 2: Checking transaction on ${SOURCE_CHAIN}...`);
    if (WALLET_ID) {
      try {
        const client = getCircleClient();
        const txResponse = await circleApiRequest<any>(
          `/v1/w3s/developer/wallets/${WALLET_ID}/transactions?blockchain=${SOURCE_CHAIN}&limit=20`,
          { method: "GET" }
        );

        if (txResponse.data?.transactions) {
          const burnTx = txResponse.data.transactions.find((tx: any) => 
            tx.transactionHash === TRANSACTION_HASH || 
            tx.id === TRANSACTION_HASH ||
            tx.txHash === TRANSACTION_HASH
          );

          if (burnTx) {
            console.log(`\n📋 Burn Transaction Found:`);
            console.log(`   ID: ${burnTx.id || "N/A"}`);
            console.log(`   Hash: ${burnTx.transactionHash || burnTx.txHash || "N/A"}`);
            console.log(`   Status: ${burnTx.state || burnTx.status || "unknown"}`);
            console.log(`   Type: ${burnTx.type || "unknown"}`);
            
            if (burnTx.state === "COMPLETED" || burnTx.status === "complete") {
              console.log(`   ✅ Burn transaction confirmed on ${SOURCE_CHAIN}`);
            } else {
              console.log(`   ⏳ Burn transaction status: ${burnTx.state || burnTx.status}`);
            }
          } else {
            console.log(`   ⚠️  Transaction not found in recent transactions`);
            console.log(`   (This is normal if the transaction is very recent)`);
          }
        }
      } catch (err: any) {
        console.log(`   ⚠️  Could not check transaction: ${err.message}`);
      }
    }

    // Step 3: Check for mint transaction on destination chain
    console.log(`\n⏳ Step 3: Checking for mint transaction on ${DESTINATION_CHAIN}...`);
    if (WALLET_ID && cctpStatus.status === "attested") {
      try {
        const client = getCircleClient();
        const txResponse = await circleApiRequest<any>(
          `/v1/w3s/developer/wallets/${WALLET_ID}/transactions?blockchain=${DESTINATION_CHAIN}&limit=20`,
          { method: "GET" }
        );

        if (txResponse.data?.transactions) {
          // Look for recent mint transactions (contract execution transactions)
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          const recentMints = txResponse.data.transactions
            .filter((tx: any) => {
              if (tx.type === "CONTRACT_EXECUTION") return true;
              if (tx.state === "COMPLETED" && tx.createdAt) {
                return new Date(tx.createdAt) > fiveMinutesAgo;
              }
              return false;
            })
            .slice(0, 3);

          if (recentMints.length > 0) {
            console.log(`\n📋 Recent Transactions on ${DESTINATION_CHAIN}:`);
            recentMints.forEach((tx: any, index: number) => {
              console.log(`\n   ${index + 1}. ${tx.type || "Transaction"}`);
              console.log(`      Hash: ${tx.transactionHash || tx.txHash || "N/A"}`);
              console.log(`      Status: ${tx.state || tx.status || "unknown"}`);
              if (tx.state === "COMPLETED") {
                console.log(`      ✅ Completed`);
              }
            });
          } else {
            console.log(`   ⏳ No recent mint transactions found yet`);
            console.log(`   (Mint may still be processing)`);
          }
        }
      } catch (err: any) {
        console.log(`   ⚠️  Could not check destination transactions: ${err.message}`);
      }
    } else if (cctpStatus.status !== "attested") {
      console.log(`   ⏳ Waiting for attestation before mint can occur`);
    }

    // Summary
    console.log(`\n\n📊 VERIFICATION SUMMARY:`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    if (cctpStatus.status === "attested" || cctpStatus.status === "completed") {
      console.log(`✅ SUCCESS: Bridge transaction is attested!`);
      console.log(`   • Burn transaction: ${TRANSACTION_HASH}`);
      console.log(`   • Attestation: Received`);
      console.log(`   • Next: Mint transaction should be processing or completed`);
      console.log(`\n✅ You can report to Circle team: CCTP bridge is working!`);
    } else if (cctpStatus.status === "pending") {
      console.log(`⏳ PENDING: Bridge transaction is still being processed`);
      console.log(`   • Burn transaction: ${TRANSACTION_HASH}`);
      console.log(`   • Attestation: Waiting (this can take 30-60 seconds)`);
      console.log(`\n💡 Wait a bit longer and check again`);
    } else {
      console.log(`❌ FAILED: Bridge transaction failed`);
      console.log(`   • Check server logs for error details`);
    }
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  } catch (error: any) {
    console.error("\n❌ Error verifying bridge:", error.message);
    console.error(error);
    process.exit(1);
  }
}

verifyBridgeCompletion();

