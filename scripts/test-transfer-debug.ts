/**
 * Transfer Debug Test Script
 * 
 * Comprehensive test for USDC transfers with detailed error reporting
 * Tests the transaction creation flow and identifies failure points
 * 
 * Usage:
 *   npm run test:transfer:debug
 *   or
 *   tsx scripts/test-transfer-debug.ts
 */

import "dotenv/config";

const API_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

// Test configuration - can be overridden with environment variables
const TEST_CONFIG = {
  walletId: process.env.TEST_WALLET_ID || "",
  userId: process.env.TEST_USER_ID || "",
  userToken: process.env.TEST_USER_TOKEN || "",
  destinationAddress: process.env.TEST_DESTINATION_ADDRESS || "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  amount: process.env.TEST_AMOUNT || "0.1",
};

/**
 * Create a new user (returns userId and userToken)
 */
async function createUser(): Promise<{ userId: string; userToken: string }> {
  console.log("\n📝 Creating new user...");
  
  try {
    const response = await fetch(`${API_URL}/api/circle/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || "User creation failed");
    }
    
    console.log(`✅ User created successfully!`);
    console.log(`   User ID: ${data.data.userId}`);
    console.log(`   User Token: ${data.data.userToken.substring(0, 20)}...`);
    
    return {
      userId: data.data.userId,
      userToken: data.data.userToken,
    };
  } catch (error: any) {
    console.error(`❌ User creation failed: ${error.message}`);
    throw error;
  }
}

/**
 * List existing wallets for a user
 */
async function listWallets(userId: string): Promise<{ walletId: string; address: string } | null> {
  console.log("\n🔍 Checking for existing wallets...");
  
  try {
    const response = await fetch(`${API_URL}/api/circle/wallets?userId=${userId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    const data = await response.json();
    
    if (data.success && data.data?.wallets && data.data.wallets.length > 0) {
      const wallet = data.data.wallets.find((w: any) => 
        w.blockchain === "ARC-TESTNET" || w.blockchain === "ARC"
      ) || data.data.wallets[0];
      
      console.log(`✅ Found existing wallet: ${wallet.id}`);
      const address = wallet.address || wallet.addresses?.[0]?.address || "";
      return { walletId: wallet.id, address };
    }
    
    return null;
  } catch (error: any) {
    console.log("⚠️  Could not list wallets:", error.message);
    return null;
  }
}

/**
 * Create a new wallet
 */
async function createWallet(userId: string, userToken: string): Promise<{ walletId: string; address: string }> {
  // First check for existing wallets
  const existing = await listWallets(userId);
  if (existing) {
    return existing;
  }
  
  console.log("\n💼 Creating new wallet on ARC-TESTNET...");
  console.log("⚠️  Note: User-Controlled Wallets require PIN setup in browser");
  console.log("   For automated testing, the wallet will be created but PIN setup must be done in the chat UI\n");
  
  try {
    const response = await fetch(`${API_URL}/api/circle/wallets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        userToken,
        blockchains: ["ARC-TESTNET"],
      }),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || "Wallet creation failed");
    }
    
    // Handle challenge response (PIN setup required)
    if (data.data?.challengeId) {
      console.log("📋 Challenge created - PIN setup required:");
      console.log(`   Challenge ID: ${data.data.challengeId}`);
      console.log("\n💡 To complete wallet setup:");
      console.log("   1. Open the chat interface in your browser");
      console.log("   2. The wallet creation will complete automatically when you set up your PIN");
      console.log("   3. Then you can test transfers\n");
      
      throw new Error("Wallet creation requires browser-based PIN setup. Please use the chat interface to create a wallet first.");
    }
    
    // Handle different response structures
    let wallet;
    if (data.data?.wallets && Array.isArray(data.data.wallets) && data.data.wallets.length > 0) {
      wallet = data.data.wallets[0];
    } else if (data.data?.wallet) {
      wallet = data.data.wallet;
    } else if (data.data && data.data.id) {
      wallet = data.data;
    } else {
      throw new Error("No wallet returned - unexpected response structure");
    }
    
    if (!wallet || !wallet.id) {
      throw new Error("Invalid wallet data returned");
    }
    
    const address = wallet.address || wallet.addresses?.[0]?.address;
    if (!address) {
      throw new Error("Wallet address not found");
    }
    
    console.log(`✅ Wallet created successfully!`);
    console.log(`   Wallet ID: ${wallet.id}`);
    console.log(`   Address: ${address}`);
    
    return { walletId: wallet.id, address };
  } catch (error: any) {
    console.error(`❌ Wallet creation failed: ${error.message}`);
    throw error;
  }
}

/**
 * Request testnet tokens
 */
async function requestTokens(address: string): Promise<void> {
  console.log("\n🪙 Requesting testnet tokens...");
  
  try {
    const response = await fetch(`${API_URL}/api/circle/faucet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        blockchain: "ARC-TESTNET",
        native: true,
        usdc: true,
      }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log("✅ Tokens requested, waiting 45 seconds for distribution...");
      await new Promise(resolve => setTimeout(resolve, 45000));
    } else {
      console.log("⚠️  Token request failed (may already have tokens):", data.error);
    }
  } catch (error: any) {
    console.log("⚠️  Token request error:", error.message);
  }
}

/**
 * Check wallet balance
 */
async function checkBalance(walletId: string, userId: string): Promise<number> {
  console.log("\n💰 Checking wallet balance...");
  
  try {
    const response = await fetch(`${API_URL}/api/circle/balance?walletId=${walletId}&userId=${userId}`);
    const data = await response.json();
    
    if (data.success) {
      const balance = parseFloat(data.balance || "0");
      console.log(`✅ Balance: ${balance} USDC`);
      return balance;
    } else {
      console.error(`❌ Balance check failed: ${data.error}`);
      return 0;
    }
  } catch (error: any) {
    console.error(`❌ Balance check error: ${error.message}`);
    return 0;
  }
}

/**
 * Get wallet details
 */
async function getWalletDetails(walletId: string, userId: string, userToken: string) {
  console.log("\n🔍 Fetching wallet details...");
  
  try {
    const response = await fetch(`${API_URL}/api/circle/wallets?userId=${userId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    const data = await response.json();
    
    if (data.success && data.data?.wallets) {
      const wallet = data.data.wallets.find((w: any) => w.id === walletId);
      if (wallet) {
        console.log("✅ Wallet found:");
        console.log(`   ID: ${wallet.id}`);
        console.log(`   Address: ${wallet.address || wallet.addresses?.[0]?.address || "N/A"}`);
        console.log(`   Blockchain: ${wallet.blockchain || "N/A"}`);
        console.log(`   State: ${wallet.state || "N/A"}`);
        return wallet;
      }
    }
    
    console.error("❌ Wallet not found");
    return null;
  } catch (error: any) {
    console.error(`❌ Wallet fetch error: ${error.message}`);
    return null;
  }
}

/**
 * Test transaction creation with detailed error reporting
 */
async function testTransfer(
  walletId: string,
  userId: string,
  userToken: string,
  destinationAddress: string,
  amount: string
) {
  console.log("\n💸 Testing USDC Transfer");
  console.log("=".repeat(60));
  console.log(`From Wallet: ${walletId}`);
  console.log(`To Address: ${destinationAddress}`);
  console.log(`Amount: ${amount} USDC`);
  console.log("=".repeat(60));

  const requestBody = {
    walletId,
    destinationAddress,
    amount,
    userId,
    userToken,
    idempotencyKey: `test-debug-${Date.now()}`,
    feeLevel: "MEDIUM" as const,
  };

  console.log("\n📤 Request Details:");
  console.log(JSON.stringify({ ...requestBody, userToken: "***REDACTED***" }, null, 2));

  try {
    const startTime = Date.now();
    const response = await fetch(`${API_URL}/api/circle/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    console.log(`\n📊 Response Status: ${response.status} (${duration}ms)`);
    console.log(`📋 Response Headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      console.error("\n❌ HTTP Error Response:");
      console.error(`   Status: ${response.status} ${response.statusText}`);
      console.error(`   Error: ${data.error || "Unknown error"}`);
      console.error(`   Error Code: ${data.errorCode || "N/A"}`);
      console.error(`   Error Type: ${data.errorType || "N/A"}`);
      
      if (data.details) {
        console.error("\n📋 Error Details:");
        console.error(JSON.stringify(data.details, null, 2));
      }
      
      if (data.stack) {
        console.error("\n🔍 Stack Trace:");
        console.error(data.stack);
      }

      // Common error patterns
      if (data.error?.includes("challenge")) {
        console.log("\n💡 Challenge Required:");
        console.log("   This is expected for User-Controlled Wallets.");
        console.log("   The transaction requires user approval via challenge.");
        if (data.data?.challengeId) {
          console.log(`   Challenge ID: ${data.data.challengeId}`);
        }
      }

      if (data.error?.includes("balance") || data.error?.includes("insufficient")) {
        console.log("\n💡 Insufficient Balance:");
        console.log("   Check your wallet balance and ensure you have enough USDC.");
      }

      if (data.error?.includes("401") || data.error?.includes("unauthorized")) {
        console.log("\n💡 Authentication Error:");
        console.log("   Check your userToken - it may have expired.");
        console.log("   Try refreshing the user token.");
      }

      if (data.error?.includes("400") || data.error?.includes("bad request")) {
        console.log("\n💡 Validation Error:");
        console.log("   Check that all required fields are provided correctly.");
        console.log("   Verify the destination address format.");
      }

      return { success: false, error: data.error, details: data };
    }

    if (!data.success) {
      console.error("\n❌ Transaction Creation Failed:");
      console.error(`   Error: ${data.error || "Unknown error"}`);
      console.error(`   Error Code: ${data.errorCode || "N/A"}`);
      
      if (data.details) {
        console.error("\n📋 Error Details:");
        console.error(JSON.stringify(data.details, null, 2));
      }

      return { success: false, error: data.error, details: data };
    }

    // Success case
    console.log("\n✅ Transaction Created Successfully!");
    console.log("\n📋 Transaction Details:");
    
    const txData = data.data;
    console.log(`   🆔 Transaction ID: ${txData?.id || txData?.circleTransactionId || "N/A"}`);
    console.log(`   🔗 Hash: ${txData?.hash || txData?.txHash || txData?.transactionHash || "Not available yet"}`);
    console.log(`   📍 From: ${txData?.from || walletId}`);
    console.log(`   📍 To: ${txData?.to || destinationAddress}`);
    console.log(`   💵 Amount: ${txData?.amount || amount} USDC`);
    console.log(`   📊 Status: ${txData?.status || "pending"}`);
    console.log(`   ⛓️  Network: ${txData?.network || txData?.blockchain || "ARC-TESTNET"}`);

    // Check for challenge
    if (txData?.challengeId) {
      console.log(`\n🔐 Challenge Required:`);
      console.log(`   Challenge ID: ${txData.challengeId}`);
      console.log(`   This transaction requires user approval.`);
      console.log(`   Complete the challenge in the chat interface.`);
    }

    if (txData?.txHash || txData?.transactionHash) {
      const hash = txData.txHash || txData.transactionHash;
      console.log(`\n🔗 View on Explorer: https://testnet.arcscan.app/tx/${hash}`);
    }

    // Monitor transaction status
    if (txData?.id) {
      console.log("\n⏳ Monitoring transaction status...");
      await monitorTransaction(txData.id, userId, userToken);
    }

    return { success: true, data: txData };
  } catch (error: any) {
    console.error("\n❌ Transfer Test Error:");
    console.error(`   Message: ${error.message}`);
    if (error.stack) {
      console.error("\n🔍 Stack Trace:");
      console.error(error.stack);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Monitor transaction until completion
 */
async function monitorTransaction(
  transactionId: string,
  userId: string,
  userToken: string,
  maxAttempts: number = 30
) {
  console.log(`\n🔍 Monitoring transaction: ${transactionId}`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    
    try {
      const response = await fetch(
        `${API_URL}/api/circle/transactions?transactionId=${transactionId}&userId=${userId}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }
      );
      
      const data = await response.json();
      
      if (data.success && data.data) {
        const tx = Array.isArray(data.data) ? data.data[0] : data.data;
        const status = tx?.status || tx?.state || "unknown";
        
        console.log(`   Attempt ${attempt}/${maxAttempts}: Status = ${status}`);
        
        if (status === "COMPLETE" || status === "confirmed" || status === "success") {
          console.log("\n✅ Transaction confirmed!");
          if (tx?.txHash || tx?.hash) {
            console.log(`   Hash: ${tx.txHash || tx.hash}`);
            console.log(`   Explorer: https://testnet.arcscan.app/tx/${tx.txHash || tx.hash}`);
          }
          return;
        }
        
        if (status === "FAILED" || status === "failed") {
          console.log("\n❌ Transaction failed!");
          console.log(`   Error: ${tx?.error || "Unknown error"}`);
          return;
        }
      }
    } catch (error: any) {
      console.log(`   Attempt ${attempt}/${maxAttempts}: Error checking status - ${error.message}`);
    }
  }
  
  console.log("\n⏱️  Monitoring timeout - transaction may still be pending");
}

/**
 * Main test function
 */
async function main() {
  console.log("\n🧪 ===== USDC Transfer Debug Test =====\n");
  console.log(`🔗 API URL: ${API_URL}\n`);

  let userId = TEST_CONFIG.userId;
  let userToken = TEST_CONFIG.userToken;
  let walletId = TEST_CONFIG.walletId;
  let walletAddress = "";

  // Auto-create credentials if missing
  if (!userId || !userToken) {
    console.log("📋 Credentials not provided. Creating new user automatically...\n");
    console.log("💡 How to get credentials manually:");
    console.log("   1. Open the chat interface in your browser");
    console.log("   2. Open browser DevTools (F12)");
    console.log("   3. Go to Application > Local Storage");
    console.log("   4. Copy the values:");
    console.log("      - arcle_user_id → TEST_USER_ID");
    console.log("      - arcle_user_token → TEST_USER_TOKEN");
    console.log("      - arcle_wallet_id → TEST_WALLET_ID");
    console.log("\n   Or set environment variables:");
    console.log("   export TEST_USER_ID=your_user_id");
    console.log("   export TEST_USER_TOKEN=your_user_token");
    console.log("   export TEST_WALLET_ID=your_wallet_id\n");
    
    try {
      const userData = await createUser();
      userId = userData.userId;
      userToken = userData.userToken;
      
      console.log("\n✅ Credentials created! You can use these for future tests:");
      console.log(`   TEST_USER_ID=${userId}`);
      console.log(`   TEST_USER_TOKEN=${userToken}\n`);
    } catch (error: any) {
      console.error("\n❌ Failed to create user:", error.message);
      console.error("\n💡 Please create a user manually via the chat interface or API");
      process.exit(1);
    }
  }

  // Get or create wallet
  if (!walletId) {
    console.log("📋 Wallet ID not provided. Checking for existing wallets...\n");
    
    try {
      const wallet = await listWallets(userId);
      
      if (wallet) {
        walletId = wallet.walletId;
        walletAddress = wallet.address;
        console.log(`✅ Using existing wallet: ${walletId}\n`);
      } else {
        console.log("📋 No existing wallet found. Creating new wallet...\n");
        const newWallet = await createWallet(userId, userToken);
        walletId = newWallet.walletId;
        walletAddress = newWallet.address;
        
        console.log("\n✅ Wallet created! You can use this for future tests:");
        console.log(`   TEST_WALLET_ID=${walletId}\n`);
        
        // Request testnet tokens
        await requestTokens(walletAddress);
      }
    } catch (error: any) {
      if (error.message.includes("PIN setup")) {
        console.error("\n❌ Wallet creation requires PIN setup in browser");
        console.error("💡 Please create a wallet manually via the chat interface");
        console.error("   Then run this test again with TEST_WALLET_ID set\n");
      } else {
        console.error("\n❌ Failed to get/create wallet:", error.message);
      }
      process.exit(1);
    }
  }

  try {
    // Step 1: Get wallet details
    const wallet = await getWalletDetails(
      walletId,
      userId,
      userToken
    );

    if (!wallet) {
      console.error("\n❌ Could not retrieve wallet details");
      process.exit(1);
    }

    // Step 2: Check balance
    const balance = await checkBalance(walletId, userId);
    const amount = parseFloat(TEST_CONFIG.amount);

    if (balance < amount) {
      console.error(`\n❌ Insufficient balance`);
      console.error(`   Current: ${balance} USDC`);
      console.error(`   Required: ${amount} USDC`);
      console.error(`   Shortfall: ${amount - balance} USDC`);
      
      if (!walletAddress) {
        walletAddress = wallet.address || wallet.addresses?.[0]?.address || "";
      }
      
      if (walletAddress) {
        console.error("\n💡 Requesting testnet tokens automatically...");
        await requestTokens(walletAddress);
        
        // Check balance again
        const newBalance = await checkBalance(walletId, userId);
        if (newBalance < amount) {
          console.error(`\n❌ Still insufficient balance after token request`);
          console.error(`   Current: ${newBalance} USDC`);
          console.error(`   Required: ${amount} USDC`);
          console.error("\n💡 Please request more tokens manually:");
          console.error(`   POST ${API_URL}/api/circle/faucet`);
          console.error(`   Body: { "address": "${walletAddress}", "blockchain": "ARC-TESTNET", "usdc": true }`);
          process.exit(1);
        }
      } else {
        console.error("\n💡 Request testnet tokens:");
        console.error(`   POST ${API_URL}/api/circle/faucet`);
        console.error(`   Body: { "address": "${wallet.address}", "blockchain": "ARC-TESTNET", "usdc": true }`);
        process.exit(1);
      }
    }

    // Step 3: Test transfer
    const result = await testTransfer(
      walletId,
      userId,
      userToken,
      TEST_CONFIG.destinationAddress,
      TEST_CONFIG.amount
    );

    if (result.success) {
      console.log("\n🎉 Transfer test completed successfully!");
    } else {
      console.log("\n❌ Transfer test failed!");
      console.log("\n📋 Troubleshooting Tips:");
      console.log("   1. Verify wallet has sufficient balance");
      console.log("   2. Check that userToken is valid (not expired)");
      console.log("   3. Ensure destination address is valid for ARC-TESTNET");
      console.log("   4. Check network connectivity to Circle API");
      console.log("   5. Review error details above for specific issues");
      process.exit(1);
    }
  } catch (error: any) {
    console.error("\n❌ Test suite failed:", error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
main();

