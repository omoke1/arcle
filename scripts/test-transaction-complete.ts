/**
 * Complete Transaction Test Script
 * 
 * 1. Creates user and wallet if needed
 * 2. Requests testnet tokens
 * 3. Tests transaction endpoint
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const API_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
const TEST_RECIPIENT_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"; // Change to valid Arc Testnet address

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

async function createWallet(userId: string, userToken: string) {
  console.log("💼 Creating wallet on ARC-TESTNET...");
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
  if (!data.success) throw new Error(data.error || "Wallet creation failed");
  
  const wallet = data.data.wallets?.[0];
  if (!wallet) throw new Error("No wallet returned");
  
  console.log(`✅ Wallet created: ${wallet.id}`);
  console.log(`   Address: ${wallet.address}`);
  return { walletId: wallet.id, address: wallet.address };
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

async function testTransaction(walletId: string, userId: string, userToken: string, destinationAddress: string, amount: string) {
  console.log(`\n💸 Testing transaction: ${amount} USDC to ${destinationAddress}`);
  
  const requestBody = {
    walletId,
    destinationAddress,
    amount,
    userId,
    userToken,
    idempotencyKey: `test-${Date.now()}`,
    feeLevel: "MEDIUM" as const,
  };
  
  console.log("📤 Sending request...");
  const startTime = Date.now();
  const response = await fetch(`${API_URL}/api/circle/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  
  const duration = Date.now() - startTime;
  const data = await response.json();
  
  console.log(`📊 Status: ${response.status} (${duration}ms)`);
  
  if (!response.ok || !data.success) {
    console.error("❌ Transaction failed!");
    console.error("Error:", data.error || "Unknown error");
    console.error("Details:", JSON.stringify(data.details || {}, null, 2));
    throw new Error(data.error || "Transaction failed");
  }
  
  console.log("✅ Transaction created successfully!");
  console.log(`   🆔 ID: ${data.data?.id || "N/A"}`);
  console.log(`   🔗 Hash: ${data.data?.txHash || data.data?.transactionHash || data.data?.hash || "Not available yet"}`);
  console.log(`   📊 Status: ${data.data?.status || "pending"}`);
  
  if (data.data?.txHash || data.data?.transactionHash) {
    const hash = data.data.txHash || data.data.transactionHash;
    console.log(`   🔗 Explorer: https://testnet.arcscan.app/tx/${hash}`);
  }
  
  return data.data;
}

async function main() {
  console.log("\n🧪 ===== Complete Transaction Test =====\n");
  console.log(`🔗 API URL: ${API_URL}\n`);
  
  try {
    // Step 1: Create user
    const { userId, userToken } = await createUser();
    
    // Step 2: Create wallet
    const { walletId, address } = await createWallet(userId, userToken);
    
    // Step 3: Request tokens
    await requestTokens(address);
    
    // Step 4: Check balance
    const balance = await checkBalance(walletId, userId);
    
    if (balance < 0.1) {
      console.log("⚠️  Insufficient balance for transaction test");
      console.log("💡 Please request more tokens or wait longer");
      return;
    }
    
    // Step 5: Test transaction
    const amount = "0.1"; // Small test amount
    await testTransaction(walletId, userId, userToken, TEST_RECIPIENT_ADDRESS, amount);
    
    console.log("\n🎉 All tests passed!");
    
  } catch (error: any) {
    console.error("\n❌ Test failed:", error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

main();


