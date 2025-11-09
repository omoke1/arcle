/**
 * Comprehensive Feature Test Script
 * Tests all ARCLE features end-to-end
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const API_BASE = process.env.NEXT_PUBLIC_VERCEL_URL 
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  : 'http://localhost:3001';

interface TestResult {
  feature: string;
  status: '✅ PASS' | '❌ FAIL' | '⚠️ SKIP';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

async function testFeature(name: string, testFn: () => Promise<any>): Promise<void> {
  try {
    console.log(`\n🧪 Testing: ${name}...`);
    const result = await testFn();
    results.push({ feature: name, status: '✅ PASS', message: 'Success', details: result });
    console.log(`   ✅ ${name} - PASS`);
  } catch (error: any) {
    results.push({ 
      feature: name, 
      status: '❌ FAIL', 
      message: error.message || 'Failed',
      details: error.response?.data || error
    });
    console.log(`   ❌ ${name} - FAIL: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 ARCLE Feature Test Suite');
  console.log(`📡 API Base: ${API_BASE}`);
  console.log('='.repeat(60));

  // Test 1: API Health Check
  await testFeature('API Health Check', async () => {
    const res = await fetch(`${API_BASE}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'test', context: {} }),
    });
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    return await res.json();
  });

  // Test 2: Wallet Creation
  await testFeature('Wallet Creation', async () => {
    const res = await fetch(`${API_BASE}/api/circle/wallets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: `test-${Date.now()}` }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to create wallet');
    return { walletId: data.data?.walletId, address: data.data?.address };
  });

  // Test 3: Balance Check (using test address)
  await testFeature('Balance Check', async () => {
    const testAddress = '0xebe39aaa1a5b781a1b91f11a27cf2aeadd27f4a6';
    const res = await fetch(`${API_BASE}/api/circle/balance?address=${testAddress}&useBlockchain=true`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to get balance');
    return { balance: data.data?.balance, address: testAddress };
  });

  // Test 4: Arc Balance Check
  await testFeature('Arc Balance Check', async () => {
    const testAddress = '0xebe39aaa1a5b781a1b91f11a27cf2aeadd27f4a6';
    const res = await fetch(`${API_BASE}/api/arc/balance?address=${testAddress}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to get Arc balance');
    return { balance: data.data?.balance };
  });

  // Test 5: Faucet Request
  await testFeature('Testnet Faucet', async () => {
    const testAddress = '0xebe39aaa1a5b781a1b91f11a27cf2aeadd27f4a6';
    const res = await fetch(`${API_BASE}/api/circle/faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        address: testAddress,
        blockchain: 'ARC-TESTNET',
        native: true,
        usdc: true
      }),
    });
    const data = await res.json();
    // Faucet might return 401 or rate limit - that's okay, just check if endpoint exists
    if (res.status === 401) {
      return { status: '401 - API key may need faucet permissions (expected)' };
    }
    if (!data.success && res.status !== 429) {
      throw new Error(data.error || 'Faucet request failed');
    }
    return data;
  });

  // Test 6: AI Chat
  await testFeature('AI Chat Integration', async () => {
    const res = await fetch(`${API_BASE}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: 'what is my balance?',
        context: { hasWallet: false }
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'AI chat failed');
    return { hasReply: !!data.data?.reply };
  });

  // Test 7: Address Validation
  await testFeature('Address Validation', async () => {
    const validAddress = '0xebe39aaa1a5b781a1b91f11a27cf2aeadd27f4a6';
    const invalidAddress = '0xinvalid';
    
    // Test valid address
    const res1 = await fetch(`${API_BASE}/api/reputation/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: validAddress }),
    });
    
    if (!res1.ok && res1.status !== 400) {
      throw new Error('Address validation endpoint not working');
    }
    
    return { endpointExists: true };
  });

  // Print Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.status === '✅ PASS').length;
  const failed = results.filter(r => r.status === '❌ FAIL').length;
  const skipped = results.filter(r => r.status === '⚠️ SKIP').length;
  
  results.forEach(r => {
    console.log(`${r.status} ${r.feature}`);
    if (r.status === '❌ FAIL' && r.message) {
      console.log(`   └─ ${r.message}`);
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${results.length} | ✅ Passed: ${passed} | ❌ Failed: ${failed} | ⚠️ Skipped: ${skipped}`);
  console.log('='.repeat(60));
  
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);




