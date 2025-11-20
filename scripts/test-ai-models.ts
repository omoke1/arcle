/**
 * Test AI Models Individually
 * 
 * Run this script to test both Gemini and Groq API keys
 * Usage: npx tsx scripts/test-ai-models.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const GOOGLE_AI_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

interface TestResult {
  model: string;
  status: 'success' | 'failed' | 'no_key';
  message: string;
  response?: string;
  error?: string;
}

/**
 * Test Google Gemini API
 */
async function testGemini(): Promise<TestResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  
  if (!apiKey) {
    return {
      model: 'Google Gemini Pro',
      status: 'no_key',
      message: '❌ No API key found. Set GOOGLE_AI_API_KEY in .env.local',
    };
  }

  console.log('\n🧪 Testing Google Gemini Pro...');
  console.log(`   API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}`);

  try {
    const response = await fetch(`${GOOGLE_AI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Say 'Hello from Gemini!' in a friendly way.",
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 100,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        model: 'Google Gemini Pro',
        status: 'failed',
        message: `❌ API call failed (${response.status})`,
        error: errorText,
      };
    }

    const data = await response.json();
    const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

    return {
      model: 'Google Gemini Pro',
      status: 'success',
      message: '✅ Working perfectly!',
      response: generatedText,
    };
  } catch (error: any) {
    return {
      model: 'Google Gemini Pro',
      status: 'failed',
      message: '❌ Connection failed',
      error: error.message,
    };
  }
}

/**
 * Test Groq API (Llama 3.1)
 */
async function testGroq(): Promise<TestResult> {
  const apiKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;
  
  if (!apiKey) {
    return {
      model: 'Groq Llama 3.1 8B',
      status: 'no_key',
      message: '❌ No API key found. Set GROQ_API_KEY in .env.local',
    };
  }

  console.log('\n🧪 Testing Groq Llama 3.1 8B...');
  console.log(`   API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}`);

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
            content: "You are a helpful assistant. Respond in one sentence.",
          },
          {
            role: "user",
            content: "Say 'Hello from Llama!' in a friendly way.",
          },
        ],
        temperature: 0.7,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        model: 'Groq Llama 3.1 8B',
        status: 'failed',
        message: `❌ API call failed (${response.status})`,
        error: errorText,
      };
    }

    const data = await response.json();
    const generatedText = data?.choices?.[0]?.message?.content || "No response";

    return {
      model: 'Groq Llama 3.1 8B',
      status: 'success',
      message: '✅ Working perfectly!',
      response: generatedText,
    };
  } catch (error: any) {
    return {
      model: 'Groq Llama 3.1 8B',
      status: 'failed',
      message: '❌ Connection failed',
      error: error.message,
    };
  }
}

/**
 * Test both models and display results
 */
async function testAllModels() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           ARCLE AI Models Test Suite                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Check environment files
  console.log('\n📁 Checking environment files...');
  const fs = require('fs');
  const envLocalExists = fs.existsSync('.env.local');
  const envExists = fs.existsSync('.env');
  
  console.log(`   .env.local: ${envLocalExists ? '✅ Found' : '❌ Not found'}`);
  console.log(`   .env: ${envExists ? '✅ Found' : '❌ Not found'}`);

  // Test Gemini
  const geminiResult = await testGemini();
  
  // Test Groq
  const groqResult = await testGroq();

  // Display results
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                     TEST RESULTS                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  console.log('\n1️⃣  Google Gemini Pro (Response Generation)');
  console.log(`    Status: ${geminiResult.message}`);
  if (geminiResult.response) {
    console.log(`    Response: "${geminiResult.response}"`);
  }
  if (geminiResult.error) {
    console.log(`    Error: ${geminiResult.error}`);
  }

  console.log('\n2️⃣  Groq Llama 3.1 8B (Intent Classification)');
  console.log(`    Status: ${groqResult.message}`);
  if (groqResult.response) {
    console.log(`    Response: "${groqResult.response}"`);
  }
  if (groqResult.error) {
    console.log(`    Error: ${groqResult.error}`);
  }

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                        SUMMARY                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const geminiWorking = geminiResult.status === 'success';
  const groqWorking = groqResult.status === 'success';

  if (geminiWorking && groqWorking) {
    console.log('\n🎉 Both AI models are working perfectly!');
    console.log('\nYour ARCLE AI assistant is fully operational:');
    console.log('   ✅ Gemini Pro - Generating natural responses');
    console.log('   ✅ Llama 3.1 - Classifying user intents');
  } else if (geminiWorking || groqWorking) {
    console.log('\n⚠️  Partial functionality:');
    if (geminiWorking) {
      console.log('   ✅ Gemini Pro working - Natural language responses enabled');
      console.log('   ❌ Llama 3.1 not working - Using fallback intent classifier');
    }
    if (groqWorking) {
      console.log('   ✅ Llama 3.1 working - Fast intent classification enabled');
      console.log('   ❌ Gemini Pro not working - Using simple text responses');
    }
  } else {
    console.log('\n❌ Neither AI model is working');
    console.log('\nYour app will use fallback methods:');
    console.log('   - Rule-based intent classification');
    console.log('   - Simple text responses');
    console.log('\n💡 Add API keys to .env.local to enable AI features');
  }

  // Instructions
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    HOW TO FIX ISSUES                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  if (!geminiWorking) {
    console.log('\n🔧 To fix Gemini Pro:');
    console.log('   1. Get API key: https://makersuite.google.com/app/apikey');
    console.log('   2. Add to .env.local:');
    console.log('      GOOGLE_AI_API_KEY=your_key_here');
    console.log('   3. Restart dev server: npm run dev');
  }

  if (!groqWorking) {
    console.log('\n🔧 To fix Groq Llama:');
    console.log('   1. Get API key: https://console.groq.com/keys');
    console.log('   2. Add to .env.local:');
    console.log('      GROQ_API_KEY=your_key_here');
    console.log('   3. Restart dev server: npm run dev');
  }

  console.log('\n');
}

// Run tests
testAllModels().catch(console.error);

