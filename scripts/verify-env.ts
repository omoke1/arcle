/**
 * Verify All Environment Variables
 * 
 * Comprehensive check of all required environment variables for ARCLE platform
 * Usage: npx tsx scripts/verify-env.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║        ARCLE Platform Environment Variables Check            ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// Check env files exist
console.log('📁 Environment Files:');
const envLocalExists = fs.existsSync('.env.local');
const envExists = fs.existsSync('.env');

console.log(`   .env.local:   ${envLocalExists ? '✅ Found' : '❌ Not found'}`);
console.log(`   .env:         ${envExists ? '✅ Found' : '❌ Not found'}`);

// Required environment variables
interface EnvVar {
  name: string;
  required: boolean;
  description: string;
  clientSide?: boolean;
}

const requiredVars: EnvVar[] = [
  // Circle Configuration
  {
    name: 'NEXT_PUBLIC_CIRCLE_APP_ID',
    required: true,
    description: 'Circle App ID for User-Controlled Wallets (REQUIRED for PIN widget)',
    clientSide: true,
  },
  {
    name: 'CIRCLE_API_KEY',
    required: true,
    description: 'Circle API Key (TEST_API_KEY for testnet, LIVE_API_KEY for mainnet)',
  },
  {
    name: 'NEXT_PUBLIC_ENV',
    required: false,
    description: 'Environment: sandbox or production',
    clientSide: true,
  },
  
  // AI/LLM Configuration
  {
    name: 'GROQ_API_KEY',
    required: true,
    description: 'Groq API Key for Llama 3.3 70B (intent classification & natural language)',
  },
  {
    name: 'NEXT_PUBLIC_GROQ_API_KEY',
    required: true,
    description: 'Groq API Key exposed to client-side (same as GROQ_API_KEY)',
    clientSide: true,
  },
  {
    name: 'GOOGLE_AI_API_KEY',
    required: false,
    description: 'Google Gemini API Key (optional, fallback for natural language)',
  },
  
  // Arc Network Configuration
  {
    name: 'NEXT_PUBLIC_ARC_RPC_URL',
    required: false,
    description: 'Arc Network RPC URL',
    clientSide: true,
  },
  {
    name: 'NEXT_PUBLIC_ARC_CHAIN_ID',
    required: false,
    description: 'Arc Network Chain ID',
    clientSide: true,
  },
  {
    name: 'NEXT_PUBLIC_ARC_USDC_TESTNET_ADDRESS',
    required: false,
    description: 'USDC contract address on Arc testnet',
    clientSide: true,
  },
];

console.log('\n🔍 Checking Environment Variables:\n');

let allRequiredPresent = true;
const missing: string[] = [];
const present: string[] = [];
const warnings: string[] = [];

for (const envVar of requiredVars) {
  const value = process.env[envVar.name];
  const isPresent = !!value;
  
  if (isPresent) {
    const displayValue = envVar.name.includes('KEY') || envVar.name.includes('SECRET') || envVar.name.includes('APP_ID')
      ? `${value.substring(0, 20)}...${value.substring(value.length - 5)}`
      : value;
    
    console.log(`   ✅ ${envVar.name}`);
    console.log(`      Value: ${displayValue}`);
    if (envVar.clientSide) {
      console.log(`      ⚠️  Exposed to client-side (NEXT_PUBLIC_)`);
    }
    present.push(envVar.name);
  } else {
    if (envVar.required) {
      console.log(`   ❌ ${envVar.name} - REQUIRED`);
      console.log(`      ${envVar.description}`);
      missing.push(envVar.name);
      allRequiredPresent = false;
    } else {
      console.log(`   ⚠️  ${envVar.name} - Optional`);
      console.log(`      ${envVar.description}`);
      warnings.push(envVar.name);
    }
  }
  console.log('');
}

// Special checks
console.log('\n🔐 Security & Configuration Checks:\n');

// Check if App ID matches API key
const appId = process.env.NEXT_PUBLIC_CIRCLE_APP_ID;
const apiKey = process.env.CIRCLE_API_KEY || process.env.NEXT_PUBLIC_CIRCLE_API_KEY;

if (appId && apiKey) {
  console.log(`   ✅ Circle App ID and API Key both present`);
  console.log(`      App ID: ${appId.substring(0, 8)}...`);
  console.log(`      API Key type: ${apiKey.startsWith('TEST_API_KEY') ? 'TESTNET' : 'PRODUCTION'}`);
} else {
  console.log(`   ❌ Circle configuration incomplete`);
}

// Check GROQ keys match
const groqKey = process.env.GROQ_API_KEY;
const groqPublicKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;

if (groqKey && groqPublicKey) {
  if (groqKey === groqPublicKey) {
    console.log(`   ✅ GROQ_API_KEY and NEXT_PUBLIC_GROQ_API_KEY match`);
  } else {
    console.log(`   ⚠️  GROQ_API_KEY and NEXT_PUBLIC_GROQ_API_KEY don't match`);
    console.log(`      They should be the same value`);
  }
} else if (groqKey && !groqPublicKey) {
  console.log(`   ⚠️  GROQ_API_KEY set but NEXT_PUBLIC_GROQ_API_KEY missing`);
  console.log(`      Client-side code needs NEXT_PUBLIC_GROQ_API_KEY`);
}

// Summary
console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║                      SUMMARY                                 ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

if (allRequiredPresent) {
  console.log('🎉 All required environment variables are configured!\n');
  console.log('Your ARCLE platform should be fully operational:\n');
  console.log('   ✅ Circle wallet operations (App ID + API Key)');
  console.log('   ✅ AI intent classification (Groq)');
  console.log('   ✅ Natural language generation (Groq)');
  if (warnings.length > 0) {
    console.log(`\n   ⚠️  ${warnings.length} optional variable(s) not set (not critical)`);
  }
} else {
  console.log(`⚠️  ${missing.length} required environment variable(s) missing:\n`);
  for (const varName of missing) {
    const envVar = requiredVars.find(v => v.name === varName);
    console.log(`   ❌ ${varName}`);
    console.log(`      ${envVar?.description || 'Required for platform operation'}`);
  }
}

// Instructions
console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║                  FIX INSTRUCTIONS                           ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

if (missing.includes('NEXT_PUBLIC_CIRCLE_APP_ID')) {
  console.log('1. Get Circle App ID:');
  console.log('   npx tsx scripts/get-circle-app-id.ts\n');
  console.log('   Or get it from Circle Console:');
  console.log('   https://console.circle.com');
  console.log('   → Wallets > User Controlled > Configurator\n');
}

if (missing.includes('CIRCLE_API_KEY')) {
  console.log('2. Get Circle API Key from:');
  console.log('   https://console.circle.com');
  console.log('   → Settings > API Keys\n');
}

if (missing.includes('GROQ_API_KEY') || missing.includes('NEXT_PUBLIC_GROQ_API_KEY')) {
  console.log('3. Get Groq API Key from:');
  console.log('   https://console.groq.com/keys\n');
  console.log('   Then add BOTH to .env.local:');
  console.log('   GROQ_API_KEY=your_key_here');
  console.log('   NEXT_PUBLIC_GROQ_API_KEY=your_key_here\n');
}

console.log('4. After adding variables, restart your dev server:');
console.log('   npm run dev\n');

console.log('5. Verify again:');
console.log('   npx tsx scripts/verify-env.ts\n');

