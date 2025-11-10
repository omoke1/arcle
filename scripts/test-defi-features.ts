/**
 * Test Script for DeFi Features
 * 
 * Tests all newly implemented DeFi capabilities
 */

const API_BASE = "http://localhost:3000";

// Test wallet info (you'll need to replace with actual test wallet)
const TEST_WALLET = {
  walletId: "test-wallet-id",
  walletAddress: "0x1234567890123456789012345678901234567890",
};

async function testFeature(name: string, testFn: () => Promise<any>): Promise<void> {
  console.log(`\n🧪 Testing: ${name}`);
  try {
    const result = await testFn();
    console.log(`✅ ${name} - Success:`, JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error(`❌ ${name} - Failed:`, error.message);
  }
}

async function main() {
  console.log("🚀 Starting DeFi Features Test Suite\n");
  console.log("=" .repeat(60));

  // 1. Test Yield Farming
  await testFeature("Yield Farming - Get Strategies", async () => {
    const response = await fetch(`${API_BASE}/api/defi/yield?action=strategies`);
    const data = await response.json();
    return data;
  });

  await testFeature("Yield Farming - Get Best Strategy", async () => {
    const response = await fetch(`${API_BASE}/api/defi/yield`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "best-strategy",
        amount: "1000",
        riskTolerance: "low",
      }),
    });
    const data = await response.json();
    return data;
  });

  // 2. Test Arbitrage
  await testFeature("Arbitrage - Scan Opportunities", async () => {
    const response = await fetch(
      `${API_BASE}/api/defi/arbitrage?walletAddress=${TEST_WALLET.walletAddress}&minProfitMargin=0.5`
    );
    const data = await response.json();
    return data;
  });

  // 3. Test Portfolio Rebalancing
  await testFeature("Portfolio Rebalancing - Analyze", async () => {
    const response = await fetch(
      `${API_BASE}/api/defi/rebalance?action=analyze&walletAddress=${TEST_WALLET.walletAddress}`
    );
    const data = await response.json();
    return data;
  });

  // 4. Test Split Payments
  await testFeature("Split Payments - Calculate Even Split", async () => {
    const response = await fetch(`${API_BASE}/api/defi/split-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "calculate-even",
        totalAmount: "100",
        numberOfRecipients: 3,
      }),
    });
    const data = await response.json();
    return data;
  });

  await testFeature("Split Payments - Calculate Percentage Split", async () => {
    const response = await fetch(`${API_BASE}/api/defi/split-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "calculate-percentage",
        totalAmount: "100",
        percentages: [50, 30, 20],
      }),
    });
    const data = await response.json();
    return data;
  });

  // 5. Test Batch Transactions
  await testFeature("Batch Transactions - Create Batch", async () => {
    const response = await fetch(`${API_BASE}/api/defi/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        transactions: [
          {
            id: "1",
            to: "0x1111111111111111111111111111111111111111",
            amount: "10",
          },
          {
            id: "2",
            to: "0x2222222222222222222222222222222222222222",
            amount: "20",
          },
        ],
      }),
    });
    const data = await response.json();
    return data;
  });

  await testFeature("Batch Transactions - Get History", async () => {
    const response = await fetch(`${API_BASE}/api/defi/batch`);
    const data = await response.json();
    return data;
  });

  console.log("\n" + "=".repeat(60));
  console.log("✅ DeFi Features Test Suite Complete!");
}

main().catch(console.error);

