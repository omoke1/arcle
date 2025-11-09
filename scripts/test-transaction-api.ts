/**
 * Test Transaction API Endpoint
 * 
 * Tests the actual transaction API endpoint with validation
 * Run: npm run test-transaction-api
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function testTransactionAPI() {
  console.log('🧪 Testing Transaction API Endpoint\n');
  
  // Get wallet info from localStorage or env
  const walletId = process.env.TEST_WALLET_ID || '9a64b61c-3efd-5ae9-8fdb-48cc0fcd2e0e';
  const walletAddress = process.env.TEST_WALLET_ADDRESS || '0xc9511207a679c7c6206623f60e68948da1dcc9d1';
  const baseUrl = process.env.TEST_API_URL || 'http://localhost:3000';
  
  console.log(`Using wallet ID: ${walletId}`);
  console.log(`Using wallet address: ${walletAddress}`);
  console.log(`API URL: ${baseUrl}\n`);
  
  const testCases = [
    {
      name: 'Test 1: Same address (should be rejected)',
      walletAddress: walletAddress,
      destinationAddress: walletAddress, // Same as source
      amount: '1',
      expectedStatus: 400,
      expectedError: 'same wallet address',
    },
    {
      name: 'Test 2: Different address (should attempt transaction)',
      walletAddress: walletAddress,
      destinationAddress: '0x1234567890123456789012345678901234567890', // Different address
      amount: '0.01',
      expectedStatus: 200, // May fail with SDK error, but validation should pass
    },
    {
      name: 'Test 3: Case-insensitive same address (should be rejected)',
      walletAddress: walletAddress.toUpperCase(),
      destinationAddress: walletAddress.toLowerCase(), // Different case
      amount: '1',
      expectedStatus: 400,
      expectedError: 'same wallet address',
    },
  ];
  
  for (const testCase of testCases) {
    console.log(`\n${testCase.name}`);
    console.log(`  Source: ${testCase.walletAddress}`);
    console.log(`  Destination: ${testCase.destinationAddress}`);
    console.log(`  Amount: ${testCase.amount} USDC`);
    
    try {
      const response = await fetch(`${baseUrl}/api/circle/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletId: walletId,
          walletAddress: testCase.walletAddress,
          destinationAddress: testCase.destinationAddress,
          amount: testCase.amount,
          idempotencyKey: `test-${Date.now()}-${Math.random()}`,
        }),
      });
      
      const data = await response.json();
      
      console.log(`  Status: ${response.status}`);
      
      if (response.status === testCase.expectedStatus) {
        if (testCase.expectedError) {
          const errorMsg = data.error?.toLowerCase() || '';
          if (errorMsg.includes(testCase.expectedError.toLowerCase())) {
            console.log(`  ✅ PASS: Correctly rejected with expected error`);
          } else {
            console.log(`  ⚠️  PARTIAL: Status correct but error message doesn't match`);
            console.log(`     Expected: "${testCase.expectedError}"`);
            console.log(`     Got: "${data.error}"`);
          }
        } else {
          console.log(`  ✅ PASS: Status matches expected`);
        }
      } else {
        console.log(`  ❌ FAIL: Expected status ${testCase.expectedStatus}, got ${response.status}`);
        if (data.error) {
          console.log(`     Error: ${data.error}`);
        }
      }
      
      if (data.error) {
        console.log(`  Error message: ${data.error.substring(0, 100)}...`);
      }
      
    } catch (error: any) {
      console.log(`  ❌ ERROR: ${error.message}`);
    }
  }
  
  console.log('\n✅ API test complete!');
  console.log('\n💡 Note: Test 2 may fail with SDK authentication error, but validation should pass.');
}

testTransactionAPI().catch(console.error);




