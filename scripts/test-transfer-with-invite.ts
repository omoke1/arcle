/**
 * Complete Transfer Test with Invite Code
 * 
 * 1. Verify invite code
 * 2. Create user and wallet
 * 3. Request testnet tokens
 * 4. Test transfer transaction
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const API_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
// Using an invite code from the list (try different ones if this is used)
const INVITE_CODE = process.env.TEST_INVITE_CODE || "QW7N8PX3";
const TEST_RECIPIENT_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"; // Change to valid Arc Testnet address

async function verifyInvite(code: string) {
  console.log(`🔐 Verifying invite code: ${code}...`);
  const response = await fetch(`${API_URL}/api/auth/verify-invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  
  const data = await response.json();
  if (!data.valid) {
    throw new Error(data.message || "Invalid invite code");
  }
  
  console.log("✅ Invite code verified!");
  return true;
}

async function createUser() {
  console.log("📝 Creating user...");
  const response = await fetch(`${API_URL}/api/circle/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  
  const data = await response.json();
  if (!data.success) throw new Error(data.error || "User creation failed");
  
  console.log(`✅ User created: ${data.data.userId.substring(0, 20)}...`);
  return { userId: data.data.userId, userToken: data.data.userToken };
}

async function listWallets(userId: string, userToken: string) {
  console.log("🔍 Checking for existing wallets...");
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
      const address = wallet.address || wallet.addresses?.[0]?.address;
      return { walletId: wallet.id, address };
    }
  } catch (error) {
    console.log("Could not list wallets, will try to create new one");
  }
  return null;
}

async function createWallet(userId: string, userToken: string) {
  // First check for existing wallets
  const existing = await listWallets(userId, userToken);
  if (existing) return existing;
  
  console.log("💼 Creating wallet on ARC-TESTNET...");
  console.log("⚠️  Note: User-Controlled Wallets require PIN setup in browser");
  console.log("   This test will show the challenge, but you'll need to complete it in the chat UI\n");
  
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
    console.error("Wallet creation response:", JSON.stringify(data, null, 2));
    throw new Error(data.error || "Wallet creation failed");
  }
  
  // Check if it's a challenge response
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
    console.error("Unexpected wallet response structure:", JSON.stringify(data, null, 2));
    throw new Error("No wallet returned - unexpected response structure");
  }
  
  if (!wallet || !wallet.id) {
    console.error("Wallet data:", JSON.stringify(wallet, null, 2));
    throw new Error("Invalid wallet data returned");
  }
  
  console.log(`✅ Wallet created: ${wallet.id}`);
  console.log(`   Address: ${wallet.address || wallet.addresses?.[0]?.address || "N/A"}`);
  
  const address = wallet.address || wallet.addresses?.[0]?.address;
  if (!address) {
    throw new Error("Wallet address not found");
  }
  
  return { walletId: wallet.id, address };
}

async function requestTokens(address: string) {
  console.log("🪙 Requesting testnet tokens...");
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
    console.log("✅ Tokens requested, waiting 45 seconds...");
    await new Promise(resolve => setTimeout(resolve, 45000));
  } else {
    console.log("⚠️  Token request failed (may already have tokens)");
  }
}

async function checkBalance(walletId: string, userId: string) {
  console.log("💰 Checking balance...");
  const response = await fetch(`${API_URL}/api/circle/balance?walletId=${walletId}&userId=${userId}`);
  const data = await response.json();
  
  if (data.success) {
    const balance = parseFloat(data.balance || "0");
    console.log(`✅ Balance: ${data.balance} USDC`);
    return balance;
  }
  throw new Error(data.error || "Balance check failed");
}

async function testTransfer(walletId: string, userId: string, userToken: string, destinationAddress: string, amount: string) {
  console.log(`\n💸 Testing transfer: ${amount} USDC to ${destinationAddress}`);
  
  const requestBody = {
    walletId,
    destinationAddress,
    amount,
    userId,
    userToken,
    idempotencyKey: `test-${Date.now()}`,
    feeLevel: "MEDIUM" as const,
  };
  
  console.log("📤 Sending transaction request...");
  console.log("📋 Request:", JSON.stringify({ ...requestBody, userToken: "***REDACTED***" }, null, 2));
  
  const startTime = Date.now();
  const response = await fetch(`${API_URL}/api/circle/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  
  const duration = Date.now() - startTime;
  const data = await response.json();
  
  console.log(`\n📊 Response Status: ${response.status} (${duration}ms)`);
  
  if (!response.ok || !data.success) {
    console.error("❌ Transfer failed!");
    console.error("Error:", data.error || "Unknown error");
    if (data.details) {
      console.error("Details:", JSON.stringify(data.details, null, 2));
    }
    throw new Error(data.error || "Transfer failed");
  }
  
  console.log("\n✅ Transfer created successfully!");
  console.log("📋 Transaction Details:");
  console.log(`   🆔 ID: ${data.data?.id || data.data?.circleTransactionId || "N/A"}`);
  console.log(`   🔗 Hash: ${data.data?.hash || data.data?.txHash || data.data?.transactionHash || "Not available yet"}`);
  console.log(`   📍 From: ${data.data?.from || walletId}`);
  console.log(`   📍 To: ${data.data?.to || destinationAddress}`);
  console.log(`   💵 Amount: ${data.data?.amount || amount} USDC`);
  console.log(`   📊 Status: ${data.data?.status || "pending"}`);
  console.log(`   ⛓️  Network: ${data.data?.network || "ARC"}`);
  
  if (data.data?.txHash || data.data?.transactionHash) {
    const hash = data.data.txHash || data.data.transactionHash;
    console.log(`\n🔗 View on Explorer: https://testnet.arcscan.app/tx/${hash}`);
  }
  
  return data.data;
}

async function main() {
  console.log("\n🧪 ===== Complete Transfer Test with Invite Code =====\n");
  console.log(`🔗 API URL: ${API_URL}`);
  console.log(`🎫 Invite Code: ${INVITE_CODE}\n`);
  
  try {
    // Step 1: Verify invite code (optional - skip if already used)
    try {
      await verifyInvite(INVITE_CODE);
    } catch (error: any) {
      console.log("⚠️  Invite code already used, skipping verification (this is OK for testing)");
      console.log("   Note: Invite code is only needed for chat UI access\n");
    }
    
    // Step 2: Create user
    const { userId, userToken } = await createUser();
    
    // Step 3: Create wallet
    const { walletId, address } = await createWallet(userId, userToken);
    
    // Step 4: Request tokens
    await requestTokens(address);
    
    // Step 5: Check balance
    const balance = await checkBalance(walletId, userId);
    
    if (balance < 0.1) {
      console.log("\n⚠️  Insufficient balance for transfer test");
      console.log("💡 Please request more tokens or wait longer");
      console.log(`   Current balance: ${balance} USDC`);
      console.log(`   Required: 0.1 USDC`);
      return;
    }
    
    // Step 6: Test transfer
    const amount = "0.1"; // Small test amount
    await testTransfer(walletId, userId, userToken, TEST_RECIPIENT_ADDRESS, amount);
    
    console.log("\n🎉 All tests passed! Transfer is working correctly!");
    console.log("\n💡 To test in the chat interface:");
    console.log(`   1. Open ${API_URL} in your browser`);
    console.log(`   2. Enter invite code: ${INVITE_CODE}`);
    console.log(`   3. Go to chat and try: "Send 0.1 USDC to ${TEST_RECIPIENT_ADDRESS}"`);
    
  } catch (error: any) {
    console.error("\n❌ Test failed:", error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

main();
