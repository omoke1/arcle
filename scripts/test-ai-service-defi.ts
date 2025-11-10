/**
 * Test AIService DeFi Features Directly
 */

import { AIService } from "@/lib/ai/ai-service";
import { IntentClassifier } from "@/lib/ai/intent-classifier";

// Test wallet context
const testContext = {
  hasWallet: true,
  balance: "1000",
  walletAddress: "0xf4f6488b48b08066e77b4be9dd02716d22be202c",
  walletId: "014a2423-d596-5925-a09f-32031a9829ad",
};

async function testFeature(name: string, message: string, expectedIntent: string) {
  console.log(`\n🧪 Testing: ${name}`);
  console.log(`   Message: "${message}"`);
  
  try {
    // First test intent classification
    const intent = IntentClassifier.classify(message);
    console.log(`   Intent: ${intent.intent} (expected: ${expectedIntent})`);
    
    if (intent.intent !== expectedIntent) {
      console.log(`   ⚠️  Intent mismatch! Expected ${expectedIntent}, got ${intent.intent}`);
    }
    
    // Then test AI service response
    const response = await AIService.processMessage(message, testContext);
    
    if (response.message) {
      console.log(`   ✅ Response received`);
      console.log(`   Message: ${response.message.substring(0, 150)}...`);
      console.log(`   Requires Confirmation: ${response.requiresConfirmation || false}`);
    } else {
      console.log(`   ⚠️  No message in response`);
    }
  } catch (error: any) {
    console.error(`   ❌ Error:`, error.message);
    console.error(`   Stack:`, error.stack);
  }
}

async function main() {
  console.log("🚀 Testing DeFi Features via AIService\n");
  console.log("=".repeat(60));
  
  // Test all DeFi features
  await testFeature("Yield Farming", "Earn yield on $1000 with low risk", "yield");
  await testFeature("Arbitrage", "Find arbitrage opportunities", "arbitrage");
  await testFeature("Rebalancing", "Rebalance my portfolio", "rebalance");
  await testFeature("Split Payment", "Split $100 between 3 people", "split_payment");
  await testFeature("Batch", "Batch these transactions", "batch");
  await testFeature("Savings", "Create a savings account with $1000, low risk", "savings");
  await testFeature("Trading", "Trade $100 USDC for ETH", "trade");
  await testFeature("Limit Order", "Create a limit buy order for $100 USDC at $1.00", "limit_order");
  await testFeature("Liquidity", "Find best liquidity for $1000 USDC to ETH", "liquidity");
  await testFeature("Auto-Compound", "Enable auto-compound", "compound");
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ All DeFi Features Tested!");
}

main().catch(console.error);

