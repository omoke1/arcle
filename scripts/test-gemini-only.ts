/**
 * Test Google Gemini ONLY
 * 
 * Quick test to verify Gemini API key
 * Usage: npx tsx scripts/test-gemini-only.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const GOOGLE_AI_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent";

async function testGemini() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║     Testing Google Gemini Pro Only        ║');
  console.log('╚════════════════════════════════════════════╝\n');

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  
  if (!apiKey) {
    console.log('❌ GOOGLE_AI_API_KEY not found in environment');
    console.log('\n💡 To fix this:');
    console.log('   1. Go to: https://makersuite.google.com/app/apikey');
    console.log('   2. Create/copy your API key');
    console.log('   3. Add to .env.local:');
    console.log('      GOOGLE_AI_API_KEY=your_key_here');
    console.log('   4. Run this test again\n');
    return;
  }

  console.log(`✅ Found API key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}`);
  console.log('\n🔄 Making test request to Gemini...\n');

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
                text: "You are ARCLE, a friendly AI wallet assistant. Say hello and introduce yourself in one fun sentence!",
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 150,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ API Request Failed (${response.status})`);
      console.log('\nError details:');
      console.log(errorText);
      
      if (response.status === 400) {
        console.log('\n💡 Possible issues:');
        console.log('   - Invalid API key format');
        console.log('   - API key not activated yet');
      } else if (response.status === 403) {
        console.log('\n💡 Possible issues:');
        console.log('   - API key doesn\'t have Gemini API enabled');
        console.log('   - Need to enable Gemini API in Google Cloud Console');
      } else if (response.status === 429) {
        console.log('\n💡 Rate limit reached. Try again in a moment.');
      }
      return;
    }

    const data = await response.json();
    const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

    console.log('✅ SUCCESS! Gemini Pro is working!\n');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║           GEMINI PRO RESPONSE              ║');
    console.log('╚════════════════════════════════════════════╝\n');
    console.log(generatedText);
    console.log('\n✨ Your AI response generation is fully functional!\n');

  } catch (error: any) {
    console.log('❌ Connection Error');
    console.log('\nError message:', error.message);
    console.log('\n💡 Possible issues:');
    console.log('   - No internet connection');
    console.log('   - Firewall blocking the request');
    console.log('   - Google API endpoint unreachable\n');
  }
}

testGemini().catch(console.error);

