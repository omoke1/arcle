/**
 * Bridge Test with User Credentials
 * 
 * Tests bridge functionality with actual user credentials
 * Automatically fetches wallet ID from wallet address if needed
 */

import "dotenv/config";

const API_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// User credentials
const WALLET_ID = "db1ecf04-ca46-5fc9-9b41-0fad40c046d8"; // This is the wallet ID
const USER_ID = "arcle-user-1763520465459-o8t779l"; // From JWT token subject
const USER_TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdXRoTW9kZSI6IlBJTiIsImRldmVsb3BlckVudGl0eUVudmlyb25tZW50IjoiVEVTVCIsImVudGl0eUlkIjoiMjNmMzVmOWEtZGJlYi00ZjhhLTlmYWEtMTQ4YWY3MWI3NmVkIiwiZXhwIjoxNzYzNjkxNTYxLCJpYXQiOjE3NjM2ODc5NjEsImludGVybmFsVXNlcklkIjoiNmU1Y2UxODgtMmZkYi01NDAyLTkwMDctYjg3MzQyYjRkOTk5IiwiaXNzIjoiaHR0cHM6Ly9wcm9ncmFtbWFibGUtd2FsbGV0LmNpcmNsZS5jb20iLCJqdGkiOiIxMDI2NjgwZS1hOTY5LTRjNzMtOGY0OC01ZGM4MmFiNWZhM2YiLCJzdWIiOiJhcmNsZS11c2VyLTE3NjM1MjA0NjU0NTktbzh0Nzc5bCJ9.AaIZhXfUhBIb_YjcF_cIzBUcoZHayW68Q8GhN7WZ4iSP1uL42wi81xXk-PY5m0PgXw4R3HWDU0hq0uuDnScPB-6Z_mzL-sNehzJdBkmgxakNcJ-dspue1nSGFR9ruXWoPglHchi0DqR4qyWLhfyhQc7bwAtC5cJCWMN1zXZuN2370uqEEB2yypC5sH3Arx8MjpXBf6O600TgcMZq9HDfQ6T4hI8C3Bv_J4jr3DSeM8elJb9EbqAh0rlQvbG3Pt9lyyo6UB5Eqejx3OZvjP6N5xKIbrhFMMO3aLpbnCo2mWleuSOU8BdAW4OvcABv6VIWz-wz-bluUVTDKG_uULBZiA";

// Test configuration
const TEST_CONFIG = {
  fromChain: "ARC-TESTNET",
  toChain: "BASE-SEPOLIA",
  amount: "0.1", // Small test amount
  destinationAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
};

/**
 * Verify wallet ID is valid
 */
async function verifyWalletId(walletId: string): Promise<boolean> {
  try {
    console.log(`\n🔍 Verifying wallet ID: ${walletId}...\n`);
    
    const response = await fetch(`${API_URL}/api/circle/wallets/${walletId}?userId=${USER_ID}&userToken=${USER_TOKEN}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      console.error(`❌ Failed to verify wallet: ${response.status}`);
      if (error) console.error(`   Error: ${error.error || JSON.stringify(error)}`);
      return false;
    }

    const data = await response.json();
    const wallet = data.data?.data?.wallet || data.data?.wallet || data.data;

    if (wallet) {
      console.log(`✅ Wallet verified!`);
      console.log(`   ID: ${wallet.id}`);
      if (wallet.addresses && wallet.addresses.length > 0) {
        wallet.addresses.forEach((addr: any) => {
          console.log(`   Address: ${addr.address} (${addr.chain})`);
        });
      }
      console.log();
      return true;
    }

    return false;
  } catch (error: any) {
    console.error(`❌ Error verifying wallet: ${error.message}`);
    return false;
  }
}

/**
 * Test bridge operation
 */
async function testBridge(walletId: string) {
  console.log("\n🌉 Testing Bridge Operation...\n");
  console.log(`From: ${TEST_CONFIG.fromChain}`);
  console.log(`To: ${TEST_CONFIG.toChain}`);
  console.log(`Amount: ${TEST_CONFIG.amount} USDC`);
  console.log(`Destination: ${TEST_CONFIG.destinationAddress}`);
  console.log(`Wallet ID: ${walletId}\n`);

  try {
    const startTime = Date.now();
    const idempotencyKey = `test-bridge-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const response = await fetch(`${API_URL}/api/circle/bridge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletId: walletId,
        amount: TEST_CONFIG.amount,
        fromChain: TEST_CONFIG.fromChain,
        toChain: TEST_CONFIG.toChain,
        destinationAddress: TEST_CONFIG.destinationAddress,
        userId: USER_ID,
        userToken: USER_TOKEN,
        idempotencyKey,
      }),
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    console.log(`📊 Response Status: ${response.status} (${duration}ms)\n`);

    if (data.success) {
      console.log("✅ Bridge initiated successfully!");
      console.log(`📋 Bridge Details:`);
      console.log(`   🆔 ID: ${data.data?.id || data.data?.bridgeId || "N/A"}`);
      console.log(`   🔗 Hash: ${data.data?.txHash || data.data?.transactionHash || "Not available yet"}`);
      console.log(`   📊 Status: ${data.data?.status || "pending"}`);
      
      if (data.data?.txHash || data.data?.transactionHash) {
        const hash = data.data.txHash || data.data.transactionHash;
        const explorerUrl = TEST_CONFIG.fromChain === "ARC-TESTNET" 
          ? `https://testnet.arcscan.app/tx/${hash}`
          : `https://sepolia.basescan.org/tx/${hash}`;
        console.log(`\n🔗 View on Explorer: ${explorerUrl}`);
      }

      if (data.message) {
        console.log(`\n💬 Message: ${data.message}`);
      }

      return true;
    } else {
      console.log("❌ Bridge failed!");
      console.log(`Error Code: ${data.errorCode || "UNKNOWN"}`);
      console.log(`Error Type: ${data.errorType || "UNKNOWN"}`);
      console.log(`Error: ${data.error || "Unknown error"}`);
      
      if (data.supportedChains) {
        console.log(`\nSupported Chains:`);
        data.supportedChains.slice(0, 10).forEach((chain: string) => {
          console.log(`   - ${chain}`);
        });
      }
      
      if (data.details) {
        console.log(`\nDetails:`, JSON.stringify(data.details, null, 2));
      }

      return false;
    }
  } catch (error: any) {
    console.error("❌ Bridge test error:", error.message);
    if (error.stack) console.error(error.stack);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log("\n🧪 ===== Bridge Test with Credentials =====\n");
  console.log(`🔗 API URL: ${API_URL}\n`);

  // Check if server is running
  try {
    const healthCheck = await fetch(`${API_URL}/api/health`).catch(() => null);
    if (!healthCheck || !healthCheck.ok) {
      console.log("⚠️  Server might not be running. Starting test anyway...\n");
    }
  } catch (e) {
    console.log("⚠️  Could not check server status. Starting test anyway...\n");
  }

  // Verify wallet ID
  const isValid = await verifyWalletId(WALLET_ID);
  
  if (!isValid) {
    console.log("\n⚠️  Could not verify wallet ID, but proceeding with test anyway...\n");
    console.log("   Make sure:");
    console.log("   1. Server is running: npm run dev");
    console.log("   2. Wallet ID is correct");
    console.log("   3. User credentials are valid\n");
  }

  // Test bridge
  const success = await testBridge(WALLET_ID);

  if (success) {
    console.log("\n✅ Bridge test completed successfully!\n");
    process.exit(0);
  } else {
    console.log("\n❌ Bridge test failed!\n");
    process.exit(1);
  }
}

// Run test
main();

