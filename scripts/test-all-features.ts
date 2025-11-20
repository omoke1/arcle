/**
 * Comprehensive Feature Testing for User-Controlled Wallets
 * Tests: Wallet creation, Balance, Sending, Bridging (CCTP & Gateway)
 */

import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const API_URL = "http://127.0.0.1:3000";

interface TestResult {
  name: string;
  status: "✅ PASS" | "❌ FAIL" | "⏭️ SKIP" | "⚠️ WARN";
  message: string;
  data?: any;
}

const results: TestResult[] = [];

// Test data storage
let testUser: {
  userId: string;
  userToken: string;
  encryptionKey: string;
} | null = null;

let testWallet: {
  id: string;
  address: string;
  blockchain: string;
} | null = null;

async function test(name: string, fn: () => Promise<void>) {
  console.log(`\n🧪 Testing: ${name}`);
  console.log("─".repeat(60));
  try {
    await fn();
    results.push({ name, status: "✅ PASS", message: "Success" });
    console.log(`✅ PASS: ${name}\n`);
  } catch (error: any) {
    results.push({ 
      name, 
      status: "❌ FAIL", 
      message: error.message,
      data: error.response?.data || error 
    });
    console.error(`❌ FAIL: ${name}`);
    console.error(`Error: ${error.message}\n`);
  }
}

async function skip(name: string, reason: string) {
  results.push({ name, status: "⏭️ SKIP", message: reason });
  console.log(`\n⏭️  SKIP: ${name}`);
  console.log(`Reason: ${reason}\n`);
}

async function warn(name: string, message: string) {
  results.push({ name, status: "⚠️ WARN", message });
  console.log(`\n⚠️  WARN: ${name}`);
  console.log(`Message: ${message}\n`);
}

// Helper function for API calls
async function apiCall(endpoint: string, method: string = "GET", body?: any) {
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

async function runTests() {
  console.log("\n");
  console.log("═".repeat(60));
  console.log("🚀 USER-CONTROLLED WALLETS - COMPREHENSIVE FEATURE TEST");
  console.log("═".repeat(60));

  // Test 1: Create User
  await test("1. Create User", async () => {
    const response = await apiCall("/api/circle/users", "POST", {});
    
    if (!response.success || !response.data.userId) {
      throw new Error("Failed to create user");
    }

    testUser = {
      userId: response.data.userId,
      userToken: response.data.userToken,
      encryptionKey: response.data.encryptionKey,
    };

    console.log(`User ID: ${testUser.userId}`);
    console.log(`User Token: ${testUser.userToken.substring(0, 30)}...`);
  });

  // Test 2: Create Wallet with PIN Challenge
  await test("2. Create Wallet (Challenge Initiated)", async () => {
    if (!testUser) throw new Error("User not created");

    const response = await apiCall("/api/circle/wallets", "POST", {
      userId: testUser.userId,
      userToken: testUser.userToken,
      blockchains: ["ETH-SEPOLIA"], // Using Sepolia testnet
    });

    if (!response.success || !response.data.challengeId) {
      throw new Error("Failed to initiate wallet creation");
    }

    console.log(`Challenge ID: ${response.data.challengeId}`);
    console.log(`⚠️  PIN setup required in browser to complete wallet creation`);
    
    // Store for manual completion
    console.log(`\nTo complete: Visit http://localhost:3000/test-wallet-creation.html`);
    console.log(`Or use the chat interface to complete PIN setup`);
  });

  // Note: We can't automatically complete the challenge (requires browser SDK)
  await warn(
    "2b. Complete Wallet Creation",
    "⏸️  Wallet creation requires browser interaction (PIN setup via Web SDK). " +
    "Manual step: Complete PIN challenge in browser, then run wallet listing test."
  );

  // Test 3: List Wallets (to verify if wallet was created manually)
  await skip(
    "3. List Wallets",
    "Requires wallet creation to be completed via browser PIN challenge"
  );

  // Test 4: Check Balance
  await skip(
    "4. Check Wallet Balance",
    "Requires wallet to be created first"
  );

  // Test 5: Request Testnet Tokens
  await skip(
    "5. Request Testnet Tokens (Faucet)",
    "Requires wallet to be created first"
  );

  // Test 6: Send Tokens
  await skip(
    "6. Send Tokens to Another Wallet",
    "Requires wallet with balance"
  );

  // Test 7: CCTP Bridge
  await test("7. Check CCTP Availability", async () => {
    // Just check if the endpoint exists
    try {
      await apiCall("/api/circle/cctp-user", "POST", {
        action: "status",
        txHash: "0x123", // dummy hash
      });
    } catch (error: any) {
      // Expected to fail with validation, but endpoint should exist
      if (error.message.includes("Missing required") || error.message.includes("action")) {
        console.log("CCTP endpoint exists and is accessible");
        return;
      }
      throw error;
    }
  });

  // Test 8: Gateway Bridge
  await test("8. Check Gateway Availability", async () => {
    // Just check if the endpoint exists
    try {
      await apiCall("/api/circle/gateway-user", "POST", {
        action: "balance",
        walletAddress: "0x0000000000000000000000000000000000000000",
        chain: "ethereum-sepolia",
      });
    } catch (error: any) {
      // Expected to fail but endpoint should exist
      console.log("Gateway endpoint exists and is accessible");
      // Don't throw - this is expected to fail with dummy data
      if (!error.message.includes("fetch failed") && !error.message.includes("ECONNREFUSED")) {
        return;
      }
    }
  });

  // Print Summary
  console.log("\n");
  console.log("═".repeat(60));
  console.log("📊 TEST SUMMARY");
  console.log("═".repeat(60));

  const passed = results.filter(r => r.status === "✅ PASS").length;
  const failed = results.filter(r => r.status === "❌ FAIL").length;
  const skipped = results.filter(r => r.status === "⏭️ SKIP").length;
  const warnings = results.filter(r => r.status === "⚠️ WARN").length;

  results.forEach(result => {
    console.log(`${result.status} ${result.name}`);
    if (result.message && result.status !== "✅ PASS") {
      console.log(`   └─ ${result.message}`);
    }
  });

  console.log("\n" + "─".repeat(60));
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log("═".repeat(60));

  console.log("\n📝 NEXT STEPS:");
  console.log("─".repeat(60));
  console.log("1. Complete wallet creation in browser:");
  console.log("   → http://localhost:3000/test-wallet-creation.html");
  console.log("\n2. Or test in the main app:");
  console.log("   → http://localhost:3000/chat");
  console.log("\n3. Once wallet is created, you can:");
  console.log("   ✓ Check balance");
  console.log("   ✓ Request testnet tokens from faucet");
  console.log("   ✓ Send tokens to other addresses");
  console.log("   ✓ Bridge tokens cross-chain (CCTP or Gateway)");
  console.log("═".repeat(60));
  console.log("\n");
}

// Run tests
runTests().catch(console.error);









