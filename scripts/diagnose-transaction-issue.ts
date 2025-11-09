/**
 * Diagnose Transaction Creation Issue
 * 
 * This script helps diagnose why transactions are failing
 * Run: npm run diagnose-transaction-issue
 */

import { circleConfig, circleApiRequest } from '../lib/circle';
import { getCircleClient } from '../lib/circle-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Verify API key is loaded
if (!circleConfig.apiKey) {
  console.error('❌ API Key not found in environment');
  console.error('   Make sure CIRCLE_API_KEY or NEXT_PUBLIC_CIRCLE_API_KEY is set in .env');
  process.exit(1);
}

console.log('✅ API Key loaded:', circleConfig.apiKey.substring(0, 20) + '...');
console.log('✅ Environment:', circleConfig.environment || 'sandbox');
console.log('');

async function diagnose() {
  console.log('🔍 Diagnosing Transaction Creation Issue\n');
  
  const walletId = process.env.TEST_WALLET_ID || '9a64b61c-3efd-5ae9-8fdb-48cc0fcd2e0e';
  
  console.log(`Wallet ID: ${walletId}\n`);
  
  // Test 1: Check if wallet exists
  console.log('Test 1: Checking if wallet exists...');
  try {
    const wallet = await circleApiRequest<any>(
      `/v1/w3s/wallets/${walletId}`,
      { method: 'GET' }
    );
    console.log('✅ Wallet exists');
    console.log('   Wallet data:', JSON.stringify(wallet.data, null, 2));
    
    if (wallet.data?.addresses) {
      console.log('   Addresses:', wallet.data.addresses);
    }
  } catch (error: any) {
    console.log('❌ Wallet not found or inaccessible');
    console.log('   Error:', error.message);
    console.log('   Status:', error.response?.status);
  }
  
  console.log('\n');
  
  // Test 2: Try to get entity public key
  console.log('Test 2: Attempting to fetch entity public key...');
  try {
    const client = getCircleClient();
    const publicKeyResponse = await client.getPublicKey();
    if (publicKeyResponse.data?.publicKey) {
      console.log('✅ Entity public key fetched successfully');
      console.log('   Public key (first 50 chars):', publicKeyResponse.data.publicKey.substring(0, 50) + '...');
    } else {
      console.log('⚠️ Public key response empty');
    }
  } catch (error: any) {
    console.log('❌ Failed to fetch entity public key');
    console.log('   Error:', error.message);
    console.log('   Status:', error.response?.status);
    console.log('   This is the root cause of transaction failures');
  }
  
  console.log('\n');
  
  // Test 3: Check wallet set
  console.log('Test 3: Checking wallet sets...');
  try {
    const client = getCircleClient();
    const walletSets = await client.listWalletSets();
    if (walletSets.data?.walletSets) {
      console.log('✅ Wallet sets found:', walletSets.data.walletSets.length);
      walletSets.data.walletSets.forEach((ws: any, i: number) => {
        console.log(`   ${i + 1}. ${ws.name || ws.id} (ID: ${ws.id})`);
      });
    }
  } catch (error: any) {
    console.log('❌ Failed to list wallet sets');
    console.log('   Error:', error.message);
  }
  
  console.log('\n');
  
  // Test 4: Check if we can list wallets
  console.log('Test 4: Checking if we can list wallets...');
  try {
    const wallets = await circleApiRequest<any>(
      `/v1/w3s/wallets?limit=10`,
      { method: 'GET' }
    );
    if (wallets.data?.wallets) {
      console.log('✅ Can list wallets:', wallets.data.wallets.length);
      wallets.data.wallets.forEach((w: any, i: number) => {
        console.log(`   ${i + 1}. Wallet ID: ${w.id}, State: ${w.state}`);
      });
    }
  } catch (error: any) {
    console.log('❌ Failed to list wallets');
    console.log('   Error:', error.message);
    console.log('   Status:', error.response?.status);
  }
  
  console.log('\n');
  console.log('📋 Summary:');
  console.log('   If Test 1 fails: Wallet doesn\'t exist or is inaccessible');
  console.log('   If Test 2 fails: This is why transactions fail - can\'t fetch entity public key');
  console.log('   If Test 3 fails: Entity Secret may not be registered');
  console.log('   If Test 4 fails: API key may not have proper permissions\n');
}

diagnose().catch(console.error);

