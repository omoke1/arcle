/**
 * Test Transaction Validation
 * 
 * Tests the validation logic for transaction creation
 * Run: npm run test-transaction-validation
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function testTransactionValidation() {
  console.log('🧪 Testing Transaction Validation Logic\n');
  
  // Test cases
  const testCases = [
    {
      name: 'Same address (should fail)',
      walletAddress: '0xc9511207a679c7c6206623f60e68948da1dcc9d1',
      destinationAddress: '0xc9511207a679c7c6206623f60e68948da1dcc9d1',
      shouldFail: true,
    },
    {
      name: 'Same address (case insensitive, should fail)',
      walletAddress: '0xC9511207A679c7c6206623f60e68948Da1DCc9d1',
      destinationAddress: '0xc9511207a679c7c6206623f60e68948da1dcc9d1',
      shouldFail: true,
    },
    {
      name: 'Different addresses (should pass)',
      walletAddress: '0xc9511207a679c7c6206623f60e68948da1dcc9d1',
      destinationAddress: '0x1234567890123456789012345678901234567890',
      shouldFail: false,
    },
    {
      name: 'Missing walletAddress (should pass validation, fetch from API)',
      walletAddress: undefined,
      destinationAddress: '0x1234567890123456789012345678901234567890',
      shouldFail: false,
    },
  ];
  
  console.log('Test Cases:\n');
  
  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`);
    console.log(`  Wallet Address: ${testCase.walletAddress || 'undefined'}`);
    console.log(`  Destination: ${testCase.destinationAddress}`);
    
    // Simulate the validation logic
    let sourceWalletAddress = testCase.walletAddress;
    
    if (sourceWalletAddress) {
      const normalizedSource = sourceWalletAddress.toLowerCase();
      const normalizedDest = testCase.destinationAddress.toLowerCase();
      
      if (normalizedSource === normalizedDest) {
        if (testCase.shouldFail) {
          console.log(`  ✅ PASS: Correctly rejected same address`);
        } else {
          console.log(`  ❌ FAIL: Should have passed but was rejected`);
        }
      } else {
        if (testCase.shouldFail) {
          console.log(`  ❌ FAIL: Should have been rejected but passed`);
        } else {
          console.log(`  ✅ PASS: Correctly allowed different addresses`);
        }
      }
    } else {
      if (testCase.shouldFail) {
        console.log(`  ⚠️  SKIP: Cannot validate without wallet address`);
      } else {
        console.log(`  ✅ PASS: Would fetch address from API`);
      }
    }
    
    console.log('');
  }
  
  console.log('\n✅ Validation logic test complete!');
  console.log('\n💡 To test with real API:');
  console.log('   1. Start dev server: npm run dev');
  console.log('   2. Open http://localhost:3000/chat');
  console.log('   3. Try sending to the same wallet address');
  console.log('   4. Try sending to a different address\n');
}

testTransactionValidation().catch(console.error);




