/**
 * User-Controlled Wallet Test Script
 * 
 * Tests the complete flow for User-Controlled Wallets:
 * 1. Create user
 * 2. Create wallet
 * 3. Request testnet tokens
 * 4. Check balance
 * 5. Send transaction
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

// Configuration
const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY || "";
const CIRCLE_APP_ID = process.env.NEXT_PUBLIC_CIRCLE_APP_ID || "";

// Test recipient address (you can change this to your own address)
const TEST_RECIPIENT_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";

interface TestResults {
  userCreation: { success: boolean; userId?: string; userToken?: string; error?: string };
  walletCreation: { success: boolean; walletId?: string; address?: string; error?: string };
  tokenRequest: { success: boolean; message?: string; error?: string };
  balanceCheck: { success: boolean; balance?: string; error?: string };
  transaction: { success: boolean; txHash?: string; error?: string };
}

async function testUserControlledWallet(): Promise<TestResults> {
  const results: TestResults = {
    userCreation: { success: false },
    walletCreation: { success: false },
    tokenRequest: { success: false },
    balanceCheck: { success: false },
    transaction: { success: false },
  };

  console.log("\n🧪 ===== User-Controlled Wallet Test =====\n");

  // Verify environment variables
  if (!CIRCLE_API_KEY || !CIRCLE_APP_ID) {
    console.error("❌ Missing required environment variables:");
    if (!CIRCLE_API_KEY) console.error("   - CIRCLE_API_KEY");
    if (!CIRCLE_APP_ID) console.error("   - NEXT_PUBLIC_CIRCLE_APP_ID");
    process.exit(1);
  }

  console.log("✅ Environment variables configured");
  console.log(`   📱 App ID: ${CIRCLE_APP_ID}`);
  console.log(`   🔑 API Key: ${CIRCLE_API_KEY.substring(0, 10)}...`);

  // ===== STEP 1: Create User =====
  console.log("\n📝 Step 1: Creating user...");
  try {
    const apiUrl = process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000";
    console.log(`   🔗 API URL: ${apiUrl}/api/circle/users`);
    
    const response = await fetch(`${apiUrl}/api/circle/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    console.log(`   📊 Response Status: ${response.status} ${response.statusText}`);
    
    const data = await response.json();
    
    if (data.success && data.data) {
      results.userCreation.success = true;
      results.userCreation.userId = data.data.userId;
      results.userCreation.userToken = data.data.userToken;
      console.log("✅ User created successfully!");
      console.log(`   👤 User ID: ${data.data.userId}`);
      console.log(`   🎟️  User Token: ${data.data.userToken?.substring(0, 20)}...`);
    } else {
      throw new Error(data.error || "User creation failed");
    }
  } catch (error: any) {
    console.error("❌ User creation failed:");
    console.error(`   Error message: ${error.message}`);
    console.error(`   Error type: ${error.constructor.name}`);
    if (error.cause) {
      console.error(`   Error cause: ${error.cause}`);
    }
    results.userCreation.error = error.message;
    return results;
  }

  const { userId, userToken } = results.userCreation;
  if (!userId || !userToken) {
    console.error("❌ Missing user credentials");
    return results;
  }

  // ===== STEP 2: Create Wallet =====
  console.log("\n💼 Step 2: Creating wallet...");
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/circle/wallets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        userToken,
        blockchains: ["ARB-SEPOLIA"], // Using Arbitrum Sepolia testnet
      }),
    });

    const data = await response.json();
    
    if (data.success && data.data && data.data.wallets && data.data.wallets.length > 0) {
      const wallet = data.data.wallets[0];
      results.walletCreation.success = true;
      results.walletCreation.walletId = wallet.id;
      results.walletCreation.address = wallet.address;
      console.log("✅ Wallet created successfully!");
      console.log(`   💼 Wallet ID: ${wallet.id}`);
      console.log(`   📍 Address: ${wallet.address}`);
      console.log(`   ⛓️  Blockchain: ${wallet.blockchain}`);
    } else {
      throw new Error(data.error || "Wallet creation failed");
    }
  } catch (error: any) {
    console.error("❌ Wallet creation failed:", error.message);
    results.walletCreation.error = error.message;
    return results;
  }

  const { walletId, address } = results.walletCreation;
  if (!walletId || !address) {
    console.error("❌ Missing wallet information");
    return results;
  }

  // ===== STEP 3: Request Testnet Tokens =====
  console.log("\n🪙 Step 3: Requesting testnet tokens...");
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/circle/faucet`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        address,
        blockchain: "ARB-SEPOLIA",
        native: true,
        usdc: true,
        eurc: false,
      }),
    });

    const data = await response.json();
    
    if (data.success) {
      results.tokenRequest.success = true;
      results.tokenRequest.message = "Testnet tokens requested successfully";
      console.log("✅ Testnet tokens requested successfully!");
      console.log("   ⏳ Please wait 30-60 seconds for tokens to arrive...");
      
      // Wait for tokens to arrive
      await new Promise(resolve => setTimeout(resolve, 45000)); // 45 seconds
      console.log("   ✅ Wait complete, proceeding to balance check...");
    } else {
      throw new Error(data.error || "Token request failed");
    }
  } catch (error: any) {
    console.error("❌ Token request failed:", error.message);
    results.tokenRequest.error = error.message;
    // Continue anyway, maybe wallet already has tokens
  }

  // ===== STEP 4: Check Balance =====
  console.log("\n💰 Step 4: Checking wallet balance...");
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/circle/balance?walletId=${walletId}&userId=${userId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();
    
    if (data.success) {
      results.balanceCheck.success = true;
      results.balanceCheck.balance = data.balance || "0";
      console.log("✅ Balance retrieved successfully!");
      console.log(`   💵 USDC Balance: ${data.balance || "0"} USDC`);
      
      if (parseFloat(data.balance || "0") === 0) {
        console.log("   ⚠️  Balance is 0. Transaction test may fail.");
      }
    } else {
      throw new Error(data.error || "Balance check failed");
    }
  } catch (error: any) {
    console.error("❌ Balance check failed:", error.message);
    results.balanceCheck.error = error.message;
  }

  // ===== STEP 5: Send Transaction =====
  console.log("\n💸 Step 5: Sending test transaction...");
  console.log(`   📤 Sending 1 USDC to ${TEST_RECIPIENT_ADDRESS}`);
  
  const currentBalance = parseFloat(results.balanceCheck.balance || "0");
  if (currentBalance < 1) {
    console.log("   ⚠️  Insufficient balance for transaction. Skipping...");
    results.transaction.error = "Insufficient balance";
    return results;
  }

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/circle/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        userToken,
        walletId,
        to: TEST_RECIPIENT_ADDRESS,
        amount: "1",
        blockchain: "ARB-SEPOLIA",
      }),
    });

    const data = await response.json();
    
    if (data.success && data.data) {
      results.transaction.success = true;
      results.transaction.txHash = data.data.transactionHash || data.data.id;
      console.log("✅ Transaction initiated successfully!");
      console.log(`   🆔 Transaction ID: ${data.data.id || data.data.challengeId}`);
      if (data.data.transactionHash) {
        console.log(`   🔗 Transaction Hash: ${data.data.transactionHash}`);
      }
      console.log(`   ⏳ Status: ${data.data.state || data.data.status || "PENDING"}`);
    } else {
      throw new Error(data.error || "Transaction failed");
    }
  } catch (error: any) {
    console.error("❌ Transaction failed:", error.message);
    results.transaction.error = error.message;
  }

  return results;
}

// Run the test
testUserControlledWallet()
  .then((results) => {
    console.log("\n\n📊 ===== Test Results Summary =====\n");
    
    const steps = [
      { name: "User Creation", result: results.userCreation },
      { name: "Wallet Creation", result: results.walletCreation },
      { name: "Token Request", result: results.tokenRequest },
      { name: "Balance Check", result: results.balanceCheck },
      { name: "Transaction", result: results.transaction },
    ];

    let passed = 0;
    let failed = 0;

    steps.forEach((step) => {
      const status = step.result.success ? "✅ PASS" : "❌ FAIL";
      console.log(`${status} - ${step.name}`);
      if (step.result.error) {
        console.log(`        Error: ${step.result.error}`);
      }
      if (step.result.success) passed++;
      else failed++;
    });

    console.log(`\n📈 Score: ${passed}/${steps.length} tests passed`);
    
    if (failed === 0) {
      console.log("\n🎉 All tests passed! User-Controlled Wallets are working correctly!");
    } else {
      console.log(`\n⚠️  ${failed} test(s) failed. Please review the errors above.`);
    }

    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error during testing:");
    console.error(error);
    process.exit(1);
  });

