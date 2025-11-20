/**
 * Check Environment Variables
 * 
 * Quick check to see what AI API keys are configured
 * Usage: npx tsx scripts/check-env.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║        ARCLE Environment Variables Check             ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

// Check env files exist
console.log('📁 Environment Files:');
const envLocalExists = fs.existsSync('.env.local');
const envExists = fs.existsSync('.env');
const envExampleExists = fs.existsSync('.env.example');

console.log(`   .env.local:   ${envLocalExists ? '✅ Found' : '❌ Not found (create this for local secrets)'}`);
console.log(`   .env:         ${envExists ? '✅ Found' : '❌ Not found'}`);
console.log(`   .env.example: ${envExampleExists ? '✅ Found' : '⚠️  Not found'}`);

// Check AI API keys
console.log('\n🤖 AI Model API Keys:');

const geminiKey = process.env.GOOGLE_AI_API_KEY;
const groqKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;

if (geminiKey) {
  console.log(`   ✅ GOOGLE_AI_API_KEY: ${geminiKey.substring(0, 10)}...${geminiKey.substring(geminiKey.length - 5)}`);
  console.log(`      Length: ${geminiKey.length} characters`);
} else {
  console.log('   ❌ GOOGLE_AI_API_KEY: Not set');
  console.log('      Used for: Natural language response generation (Gemini Pro)');
}

if (groqKey) {
  console.log(`   ✅ GROQ_API_KEY: ${groqKey.substring(0, 10)}...${groqKey.substring(groqKey.length - 5)}`);
  console.log(`      Length: ${groqKey.length} characters`);
} else {
  console.log('   ❌ GROQ_API_KEY: Not set');
  console.log('      Used for: Fast intent classification (Llama 3.1)');
}

// Check Circle API keys
console.log('\n💰 Circle API Keys:');

const circleApiKey = process.env.CIRCLE_API_KEY || process.env.NEXT_PUBLIC_CIRCLE_API_KEY;
const circleAppId = process.env.NEXT_PUBLIC_CIRCLE_APP_ID;
const circleEntitySecret = process.env.CIRCLE_ENTITY_SECRET;

if (circleApiKey) {
  console.log(`   ✅ CIRCLE_API_KEY: ${circleApiKey.substring(0, 20)}...`);
} else {
  console.log('   ❌ CIRCLE_API_KEY: Not set');
}

if (circleAppId) {
  console.log(`   ✅ CIRCLE_APP_ID: ${circleAppId.substring(0, 15)}...`);
} else {
  console.log('   ⚠️  CIRCLE_APP_ID: Not set (required for User-Controlled Wallets)');
}

if (circleEntitySecret) {
  console.log(`   📦 CIRCLE_ENTITY_SECRET: Set (archived SDK only)`);
} else {
  console.log('   ℹ️  CIRCLE_ENTITY_SECRET: Not set (not needed for User-Controlled Wallets)');
}

// Summary
console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║                      SUMMARY                         ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

const geminiConfigured = !!geminiKey;
const groqConfigured = !!groqKey;
const circleConfigured = !!circleApiKey && !!circleAppId;

if (geminiConfigured && groqConfigured && circleConfigured) {
  console.log('🎉 All critical API keys are configured!');
  console.log('\nYour ARCLE platform is fully operational:');
  console.log('   ✅ AI response generation (Gemini)');
  console.log('   ✅ AI intent classification (Groq)');
  console.log('   ✅ Circle wallet operations');
} else {
  console.log('⚠️  Some API keys are missing:\n');
  
  if (!geminiConfigured) {
    console.log('   ❌ Gemini Pro (natural language responses)');
    console.log('      Get key: https://makersuite.google.com/app/apikey');
  }
  if (!groqConfigured) {
    console.log('   ❌ Groq Llama (fast intent classification)');
    console.log('      Get key: https://console.groq.com/keys');
  }
  if (!circleConfigured) {
    console.log('   ❌ Circle (wallet & USDC operations)');
    console.log('      Get keys: https://console.circle.com');
  }
}

// Instructions
console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║                  NEXT STEPS                          ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

if (!envLocalExists) {
  console.log('1. Create .env.local file:');
  console.log('   cp .env.example .env.local\n');
}

if (!geminiConfigured || !groqConfigured) {
  console.log('2. Add missing API keys to .env.local\n');
}

console.log('3. Test individual models:');
console.log('   npx tsx scripts/test-gemini-only.ts');
console.log('   npx tsx scripts/test-groq-only.ts\n');

console.log('4. Test all models together:');
console.log('   npx tsx scripts/test-ai-models.ts\n');

console.log('5. After adding keys, restart dev server:');
console.log('   npm run dev\n');












