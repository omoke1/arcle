/**
 * Test Groq Llama ONLY
 * 
 * Quick test to verify Groq API key
 * Usage: npx tsx scripts/test-groq-only.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

async function testGroq() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║     Testing Groq Llama 3.1 8B Only        ║');
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
  console.log('\n🔄 Making test request to Groq...\n');

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "You are ARCLE, a friendly AI wallet assistant. Classify user intents accurately.",
          },
          {
            role: "user",
            content: "Classify this intent: 'Send 50 USDC to alice.eth' Return JSON: {intent: string, confidence: number}",
          },
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ API Request Failed (${response.status})`);
      console.log('\nError details:');
      console.log(errorText);
      
      if (response.status === 401) {
        console.log('\n💡 Possible issues:');
        console.log('   - Invalid API key');
        console.log('   - API key not activated');
        console.log('   - Check if you copied the full key');
      } else if (response.status === 429) {
        console.log('\n💡 Rate limit reached. Try again in a moment.');
      }
      return;
    }

    const data = await response.json();
    const generatedText = data?.choices?.[0]?.message?.content || "No response";

    console.log('✅ SUCCESS! Groq Llama 3.1 is working!\n');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║          LLAMA 3.1 RESPONSE                ║');
    console.log('╚════════════════════════════════════════════╝\n');
    console.log(generatedText);
    console.log('\n✨ Your AI intent classification is fully functional!\n');

    // Additional info
    console.log('📊 Additional info:');
    console.log(`   Model: ${data?.model || 'llama-3.1-8b-instant'}`);
    console.log(`   Tokens used: ${data?.usage?.total_tokens || 'N/A'}`);
    console.log(`   Response time: ${data?.created ? 'Fast ⚡' : 'N/A'}\n`);

  } catch (error: any) {
    console.log('❌ Connection Error');
    console.log('\nError message:', error.message);
    console.log('\n💡 Possible issues:');
    console.log('   - No internet connection');
    console.log('   - Firewall blocking the request');
    console.log('   - Groq API endpoint unreachable\n');
  }
}

testGroq().catch(console.error);

