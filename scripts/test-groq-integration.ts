/**
 * Test Groq Integration
 * 
 * Tests the actual Groq SDK integration in natural-language-generator.ts
 * Usage: npx tsx scripts/test-groq-integration.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Import the actual function we're testing
import { generateNaturalResponse } from '../lib/ai/natural-language-generator';
import type { GenerationContext } from '../lib/ai/natural-language-generator';

async function testGroqIntegration() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Testing Groq SDK Integration            ║');
  console.log('║   (Natural Language Generator)           ║');
  console.log('╚════════════════════════════════════════════╝\n');

  const apiKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;
  
  if (!apiKey) {
    console.log('❌ GROQ_API_KEY not found in environment');
    console.log('\n💡 To fix this:');
    console.log('   1. Go to: https://console.groq.com/keys');
    console.log('   2. Create/copy your API key');
    console.log('   3. Add to .env.local:');
    console.log('      GROQ_API_KEY=your_key_here');
    console.log('   4. Run this test again\n');
    return;
  }

  console.log(`✅ Found API key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}`);
  console.log('\n🔄 Testing natural language generation with Groq SDK...\n');

  // Test 1: Simple balance check
  console.log('📝 Test 1: Balance Check');
  console.log('─────────────────────────────────────────');
  try {
    const context1: GenerationContext = {
      intent: "balance",
      action: "check_balance",
      userMessage: "What's my balance?",
      context: {
        hasWallet: true,
        balance: "125.50",
        walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        walletId: "wallet-123"
      },
      data: {
        balance: "125.50",
        currency: "USDC"
      }
    };

    const response1 = await generateNaturalResponse(context1);
    console.log('✅ Response received!');
    console.log('\n📄 Generated Message:');
    console.log(response1.message);
    if (response1.reasoning) {
      console.log('\n💭 Reasoning:', response1.reasoning);
    }
    if (response1.suggestions && response1.suggestions.length > 0) {
      console.log('\n💡 Suggestions:', response1.suggestions);
    }
    console.log('\n');
  } catch (error: any) {
    console.log('❌ Test 1 Failed:', error.message);
    console.log('\n');
  }

  // Test 2: Send transaction
  console.log('📝 Test 2: Send Transaction');
  console.log('─────────────────────────────────────────');
  try {
    const context2: GenerationContext = {
      intent: "send",
      action: "send_transaction",
      userMessage: "Send $50 to Jake",
      context: {
        hasWallet: true,
        balance: "125.50",
        walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        walletId: "wallet-123"
      },
      data: {
        amount: "50",
        to: "0x1234567890123456789012345678901234567890",
        fee: "0.01",
        riskScore: 15
      }
    };

    const response2 = await generateNaturalResponse(context2);
    console.log('✅ Response received!');
    console.log('\n📄 Generated Message:');
    console.log(response2.message);
    if (response2.reasoning) {
      console.log('\n💭 Reasoning:', response2.reasoning);
    }
    if (response2.suggestions && response2.suggestions.length > 0) {
      console.log('\n💡 Suggestions:', response2.suggestions);
    }
    console.log('\n');
  } catch (error: any) {
    console.log('❌ Test 2 Failed:', error.message);
    console.log('\n');
  }

  // Test 3: Missing information
  console.log('📝 Test 3: Missing Information (Should Ask Question)');
  console.log('─────────────────────────────────────────');
  try {
    const context3: GenerationContext = {
      intent: "send",
      action: "send_transaction",
      userMessage: "Send money",
      context: {
        hasWallet: true,
        balance: "125.50",
        walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        walletId: "wallet-123"
      },
      isMissingInfo: true,
      missingFields: ["amount", "recipient"]
    };

    const response3 = await generateNaturalResponse(context3);
    console.log('✅ Response received!');
    console.log('\n📄 Generated Message:');
    console.log(response3.message);
    if (response3.followUpQuestions && response3.followUpQuestions.length > 0) {
      console.log('\n❓ Follow-up Questions:', response3.followUpQuestions);
    }
    console.log('\n');
  } catch (error: any) {
    console.log('❌ Test 3 Failed:', error.message);
    console.log('\n');
  }

  console.log('╔════════════════════════════════════════════╗');
  console.log('║   ✅ Integration Test Complete!            ║');
  console.log('╚════════════════════════════════════════════╝\n');
}

testGroqIntegration().catch(console.error);

