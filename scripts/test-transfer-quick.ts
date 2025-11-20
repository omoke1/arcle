/**
 * Quick Transfer Test
 * Tests the transfer API with the user we just created
 */

import "dotenv/config";

const API_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

// Use the credentials from the previous test
const userId = "arcle-user-1763451719672-4ndmcyj";
const userToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdXRoTW9kZSI6IlBJTiIsImRldmVsb3BlckVudGl0eUVudmlyb25tZW50IjoiVEVTVCIsImVudGl0eUlkIjoiMjNmMzVmOWEtZGJlYi00ZjhhLTlmYWEtMTQ4YWY3MWI3NmVkIiwiZXhwIjoxNzYzNDU1MzIyLCJpYXQiOjE3NjM0NTE3MjIsImludGVybmFsVXNlcklkIjoiZDJiOTJlMmItYTBiMy01Y2VhLWFlYjItY2Y2ZGVlZDZkMmY3IiwiaXNzIjoiaHR0cHM6Ly9wcm9ncmFtbWFibGUtd2FsbGV0LmNpcmNsZS5jb20iLCJqdGkiOiI3MjA3ZmUyYS1hNGRkLTQ2NWItYWY0YS04MWNlYWZiMDQ1NmUiLCJzdWIiOiJhcmNsZS11c2VyLTE3NjM0NTE3MTk2NzItNG5kbWN5aiJ9.IfOGQYQcV9T7tmHtvy4Z0t0ntS0AN9IUGWvATyeAAfn-vCWjJFhqMP8cGbir4x5nP3MKdwjMcS4eVBz7mmiP3hvhfTq-rNKuTLXrQkoAc7Ei6x39Tt8mdeS3bgi0JoEs98RKr5Lt0ifTR_qA7iqnOkWiyUrY-t0evmgTMDKuNPkMiEJe5doiEZIQG_EEtJ4x7-PP2x5HVlnpIxSZsy6kp6tbwTdsjCe75qyAq6jL98EwdnszS5Y0-Krs-hkoINPa6kWSM5MWw6xkTX7SWMpf4IC6CBuFX8G3sUaN2TBJw0kvWfvHDZe8BZpEvzr-UjiBLK8XuYOtD3YWMhPO6rvoig";

async function testTransferAPI() {
  console.log("\n🧪 Testing Transfer API Endpoint\n");
  console.log("=".repeat(60));

  // Step 1: Check for existing wallets
  console.log("\n1️⃣ Checking for existing wallets...");
  try {
    const walletsResponse = await fetch(`${API_URL}/api/circle/wallets?userId=${userId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const walletsData = await walletsResponse.json();
    console.log("Response status:", walletsResponse.status);
    console.log("Response:", JSON.stringify(walletsData, null, 2));

    if (walletsData.success && walletsData.data?.wallets && walletsData.data.wallets.length > 0) {
      const wallet = walletsData.data.wallets[0];
      console.log(`\n✅ Found wallet: ${wallet.id}`);
      console.log(`   Address: ${wallet.address || wallet.addresses?.[0]?.address || "N/A"}`);
      console.log(`   State: ${wallet.state || "N/A"}`);

      // Step 2: Check balance
      console.log("\n2️⃣ Checking balance...");
      const balanceResponse = await fetch(`${API_URL}/api/circle/balance?walletId=${wallet.id}&userId=${userId}`);
      const balanceData = await balanceResponse.json();
      console.log("Balance response:", JSON.stringify(balanceData, null, 2));

      if (balanceData.success) {
        const balance = parseFloat(balanceData.balance || "0");
        console.log(`\n💰 Balance: ${balance} USDC`);

        // Step 3: Test transfer (if balance > 0)
        if (balance > 0.1) {
          console.log("\n3️⃣ Testing transfer...");
          const transferResponse = await fetch(`${API_URL}/api/circle/transactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              walletId: wallet.id,
              destinationAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0", // Fixed: added missing character
              amount: "0.1",
              userId,
              userToken,
              idempotencyKey: `test-${Date.now()}`,
            }),
          });

          const transferData = await transferResponse.json();
          console.log("\nTransfer response status:", transferResponse.status);
          console.log("Transfer response:", JSON.stringify(transferData, null, 2));

          if (transferData.success) {
            console.log("\n✅ Transfer created successfully!");
            console.log(`   Transaction ID: ${transferData.data?.id || "N/A"}`);
            console.log(`   Status: ${transferData.data?.status || "N/A"}`);
          } else {
            console.log("\n❌ Transfer failed:");
            console.log(`   Error: ${transferData.error || "Unknown"}`);
            console.log(`   Error Code: ${transferData.errorCode || "N/A"}`);
            console.log(`   Error Type: ${transferData.errorType || "N/A"}`);
            if (transferData.details) {
              console.log(`   Details:`, JSON.stringify(transferData.details, null, 2));
            }
          }
        } else {
          console.log("\n⚠️  Insufficient balance for transfer test");
          console.log(`   Current: ${balance} USDC`);
          console.log(`   Required: 0.1 USDC`);
        }
      } else {
        console.log("\n❌ Balance check failed:", balanceData.error);
      }
    } else {
      console.log("\n⚠️  No wallets found for this user");
      console.log("   Wallet creation requires PIN setup in browser");
      console.log("   Please create a wallet via the chat interface first");
    }
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    if (error.stack) console.error(error.stack);
  }
}

// Test transfer API with invalid wallet (to test error handling)
async function testErrorHandling() {
  console.log("\n\n🧪 Testing Error Handling\n");
  console.log("=".repeat(60));

  console.log("\n1️⃣ Testing with invalid wallet ID...");
  try {
    const response = await fetch(`${API_URL}/api/circle/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletId: "invalid-wallet-id",
        destinationAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0", // Fixed: added missing character
        amount: "0.1",
        userId,
        userToken,
      }),
    });

    const data = await response.json();
    console.log("Response status:", response.status);
    console.log("Response:", JSON.stringify(data, null, 2));

    if (!data.success) {
      console.log("\n✅ Error handling works correctly:");
      console.log(`   Error Code: ${data.errorCode || "N/A"}`);
      console.log(`   Error Type: ${data.errorType || "N/A"}`);
      console.log(`   Error: ${data.error || "N/A"}`);
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }

  console.log("\n2️⃣ Testing with missing fields...");
  try {
    const response = await fetch(`${API_URL}/api/circle/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletId: "test-wallet",
        // Missing destinationAddress and amount
      }),
    });

    const data = await response.json();
    console.log("Response status:", response.status);
    console.log("Response:", JSON.stringify(data, null, 2));

    if (!data.success && data.errorCode === "VALIDATION_ERROR") {
      console.log("\n✅ Validation error handling works correctly!");
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

async function main() {
  console.log("\n🧪 ===== Quick Transfer API Test =====\n");
  console.log(`🔗 API URL: ${API_URL}`);
  console.log(`👤 User ID: ${userId.substring(0, 30)}...\n`);

  await testTransferAPI();
  await testErrorHandling();

  console.log("\n✅ Test complete!\n");
}

main().catch(console.error);

