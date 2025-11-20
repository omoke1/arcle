/**
 * Test Transaction from Chat UI
 * 
 * Simulates the exact request that the chat UI sends
 * This will help us debug the 500 error
 */

import "dotenv/config";

const API_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

// Get credentials from environment or prompt
const credentials = {
  walletId: process.env.TEST_WALLET_ID || "",
  userId: process.env.TEST_USER_ID || "",
  userToken: process.env.TEST_USER_TOKEN || "",
  walletAddress: process.env.TEST_WALLET_ADDRESS || "",
};

async function testTransaction() {
  console.log("\n🧪 Testing Transaction (Chat UI Simulation)\n");
  console.log("=".repeat(80));

  // Validate credentials
  if (!credentials.walletId || !credentials.userId || !credentials.userToken) {
    console.error("❌ Missing credentials!");
    console.error("\nPlease set environment variables:");
    console.error("  TEST_WALLET_ID=your_wallet_id");
    console.error("  TEST_USER_ID=your_user_id");
    console.error("  TEST_USER_TOKEN=your_user_token");
    console.error("  TEST_WALLET_ADDRESS=your_wallet_address (optional but recommended)\n");
    console.error("💡 Get these from browser DevTools > Application > Local Storage");
    process.exit(1);
  }

  console.log("📋 Using credentials:");
  console.log(`   Wallet ID: ${credentials.walletId}`);
  console.log(`   User ID: ${credentials.userId.substring(0, 30)}...`);
  console.log(`   Has User Token: ${!!credentials.userToken}`);
  console.log(`   Wallet Address: ${credentials.walletAddress || "Not provided"}\n`);

  // Step 1: Check wallet exists and get address if needed
  console.log("1️⃣ Checking wallet...");
  try {
    const walletResponse = await fetch(
      `${API_URL}/api/circle/wallets?userId=${credentials.userId}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    const walletData = await walletResponse.json();
    
    if (walletData.success && walletData.data?.data?.wallets) {
      const wallet = walletData.data.data.wallets.find(
        (w: any) => w.id === credentials.walletId
      );
      
      if (wallet) {
        console.log("✅ Wallet found!");
        console.log(`   State: ${wallet.state || "N/A"}`);
        console.log(`   Blockchain: ${wallet.blockchain || "N/A"}`);
        const address = wallet.address || wallet.addresses?.[0]?.address;
        if (address) {
          console.log(`   Address: ${address}`);
          if (!credentials.walletAddress) {
            credentials.walletAddress = address;
            console.log("   ✅ Using wallet address from API");
          }
        }
      } else {
        console.error("❌ Wallet not found in user's wallets");
        console.error("   Make sure the walletId belongs to this userId");
      }
    } else {
      console.error("❌ Could not fetch wallets:", walletData.error);
    }
  } catch (error: any) {
    console.error("❌ Error checking wallet:", error.message);
  }

  // Step 2: Check balance
  console.log("\n2️⃣ Checking balance...");
  try {
    // Try with userToken instead of userId (might be more reliable)
    const balanceUrl = `${API_URL}/api/circle/balance?walletId=${credentials.walletId}&userId=${credentials.userId}&userToken=${encodeURIComponent(credentials.userToken)}`;
    const balanceResponse = await fetch(balanceUrl);
    const balanceData = await balanceResponse.json();
    
    if (balanceData.success) {
      const balance = parseFloat(balanceData.balance || "0");
      console.log(`✅ Balance: ${balance} USDC`);
      
      if (balance < 0.1) {
        console.warn("\n⚠️  Low balance detected. Proceeding with test anyway...");
        console.warn("   The transaction will likely fail with insufficient balance error,");
        console.warn("   but this will still validate the API structure.\n");
        // Continue with test to validate API structure
      } else {
        console.log(`✅ Sufficient balance for test transfer (${balance} USDC)`);
      }
    } else {
      console.error("❌ Balance check failed:", balanceData.error);
      console.log("   Proceeding with test anyway to validate API structure...");
    }
  } catch (error: any) {
    console.error("❌ Error checking balance:", error.message);
    console.log("   Proceeding with test anyway to validate API structure...");
  }

  // Step 3: Test transaction (exact format from chat UI)
  console.log("\n3️⃣ Testing transaction (Chat UI format)...");
  const testDestination = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"; // Valid 42-char address
  const testAmount = "0.1";

  const requestBody = {
    walletId: credentials.walletId,
    walletAddress: credentials.walletAddress, // This is what chat UI sends
    destinationAddress: testDestination,
    amount: testAmount,
    userId: credentials.userId,
    userToken: credentials.userToken,
    idempotencyKey: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`,
  };

  console.log("\n📤 Request Body:");
  console.log(JSON.stringify({
    ...requestBody,
    userToken: "***REDACTED***",
  }, null, 2));

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

    console.log(`\n📊 Response Status: ${response.status} (${duration}ms)`);
    console.log("\n📥 Response Body:");
    console.log(JSON.stringify(data, null, 2));

    if (response.status === 500) {
      console.error("\n❌ 500 Internal Server Error!");
      console.error("\n🔍 Error Analysis:");
      console.error("   This usually means:");
      console.error("   1. Circle SDK error (check server logs)");
      console.error("   2. Missing or invalid userToken");
      console.error("   3. Wallet not properly initialized");
      console.error("   4. TokenId not found");
      console.error("   5. Network/RPC error");
      console.error("\n💡 Check the server console logs for detailed error information");
    } else if (data.success) {
      console.log("\n✅ Transaction created successfully!");
      console.log(`   Transaction ID: ${data.data?.id || "N/A"}`);
      console.log(`   Status: ${data.data?.status || "N/A"}`);
    } else {
      console.error("\n❌ Transaction failed:");
      console.error(`   Error: ${data.error || "Unknown"}`);
      console.error(`   Error Code: ${data.errorCode || "N/A"}`);
      console.error(`   Error Type: ${data.errorType || "N/A"}`);
      if (data.details) {
        console.error(`   Details:`, JSON.stringify(data.details, null, 2));
      }
    }
  } catch (error: any) {
    console.error("\n❌ Request failed:");
    console.error(`   Error: ${error.message}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack}`);
    }
  }
}

// Run test
testTransaction().catch(console.error);

