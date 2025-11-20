/**
 * Transaction Test Script
 * 
 * Tests the transaction endpoint with the current API format
 * Tests on ARC-TESTNET
 */

import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config({ path: ".env.local" });
dotenv.config();

// Configuration
const API_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  "http://localhost:3000";
const TEST_RECIPIENT_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"; // Change this to a valid Arc Testnet address

interface TestTransactionRequest {
  walletId: string;
  destinationAddress: string;
  amount: string;
  userId: string;
  userToken: string;
  idempotencyKey?: string;
  feeLevel?: "LOW" | "MEDIUM" | "HIGH";
}

async function testTransaction() {
  console.log("\n🧪 ===== Transaction Test =====\n");
  console.log(`🔗 API URL: ${API_URL}/api/circle/transactions\n`);

  // Get credentials from environment or prompt
  const userId = process.env.TEST_USER_ID || "";
  const userToken = process.env.TEST_USER_TOKEN || "";
  const walletId = process.env.TEST_WALLET_ID || "";
  const destinationAddress = process.env.TEST_DESTINATION_ADDRESS || TEST_RECIPIENT_ADDRESS;
  const amount = process.env.TEST_AMOUNT || "0.1"; // Small test amount

  // Validate required fields
  if (!userId || !userToken || !walletId) {
    console.error("❌ Missing required environment variables:");
    if (!userId) console.error("   - TEST_USER_ID");
    if (!userToken) console.error("   - TEST_USER_TOKEN");
    if (!walletId) console.error("   - TEST_WALLET_ID");
    console.error("\n💡 Add these to .env.local (used by dotenv) or export them before running the script:");
    console.error("   TEST_USER_ID=your_user_id");
    console.error("   TEST_USER_TOKEN=your_user_token");
    console.error("   TEST_WALLET_ID=your_wallet_id");
    console.error("\n   Need credentials? Run `npm run test:wallet` to create a test user & wallet, then copy the values.");
    process.exit(1);
  }

  console.log("✅ Test configuration:");
  console.log(`   👤 User ID: ${userId.substring(0, 20)}...`);
  console.log(`   🎟️  User Token: ${userToken.substring(0, 20)}...`);
  console.log(`   💼 Wallet ID: ${walletId}`);
  console.log(`   📍 Destination: ${destinationAddress}`);
  console.log(`   💵 Amount: ${amount} USDC`);
  console.log(`   ⛓️  Network: ARC-TESTNET\n`);

  // Build request
  const requestBody: TestTransactionRequest = {
    walletId,
    destinationAddress,
    amount,
    userId,
    userToken,
    idempotencyKey: process.env.TEST_IDEMPOTENCY_KEY || crypto.randomUUID(),
    feeLevel: "MEDIUM",
  };

  console.log("📤 Sending transaction request...");
  console.log("📋 Request body:", JSON.stringify(requestBody, null, 2).replace(userToken, "***REDACTED***"));
  console.log("");

  try {
    const startTime = Date.now();
    const response = await fetch(`${API_URL}/api/circle/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
    console.log(`⏱️  Response Time: ${duration}ms\n`);

    if (!response.ok) {
      console.error("❌ Transaction failed!");
      console.error("📋 Error Response:", JSON.stringify(data, null, 2));
      
      if (data.details) {
        console.error("\n🔍 Error Details:", JSON.stringify(data.details, null, 2));
      }
      
      process.exit(1);
    }

    if (data.success) {
      console.log("✅ Transaction created successfully!\n");
      console.log("📋 Response Data:");
      console.log(`   🆔 Transaction ID: ${data.data?.id || data.data?.circleTransactionId || "N/A"}`);
      console.log(`   🔗 Hash: ${data.data?.hash || data.data?.txHash || data.data?.transactionHash || "Not available yet"}`);
      console.log(`   📍 From: ${data.data?.from || walletId}`);
      console.log(`   📍 To: ${data.data?.to || destinationAddress}`);
      console.log(`   💵 Amount: ${data.data?.amount || amount} USDC`);
      console.log(`   📊 Status: ${data.data?.status || "pending"}`);
      console.log(`   ⛓️  Network: ${data.data?.network || "ARC"}`);
      
      if (data.data?.txHash || data.data?.transactionHash) {
        console.log(`\n🔗 View on Explorer: https://testnet.arcscan.app/tx/${data.data.txHash || data.data.transactionHash}`);
      }
      
      console.log("\n🎉 Test passed! Transaction was created successfully.");
      console.log("💡 Note: The transaction may take a few seconds to be confirmed on-chain.");
    } else {
      console.error("❌ Transaction failed!");
      console.error("📋 Error:", data.error || "Unknown error");
      if (data.details) {
        console.error("🔍 Details:", JSON.stringify(data.details, null, 2));
      }
      process.exit(1);
    }
  } catch (error: any) {
    console.error("❌ Request failed!");
    console.error("📋 Error:", error.message);
    if (error.stack) {
      console.error("📚 Stack:", error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testTransaction()
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });



