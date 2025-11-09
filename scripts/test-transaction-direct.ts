/**
 * Test Transaction Creation Directly
 * 
 * This script tests the transaction API endpoint directly to see the exact error
 * Run: npm run test-transaction-direct
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as crypto from 'crypto';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function testTransaction() {
  try {
    // Use the wallet from the test
    const walletId = 'e9e286d9-00ea-5f09-8c33-5eafe69f8f44';
    const walletAddress = '0xfaa485a495021f31a3a76d0ceb2df512b043956c';
    const destinationAddress = '0x1234567890123456789012345678901234567890'; // Valid test address
    const amount = '0.01';

    console.log('🧪 Testing Transaction Creation\n');
    console.log(`Wallet ID: ${walletId}`);
    console.log(`Wallet Address: ${walletAddress}`);
    console.log(`Destination: ${destinationAddress}`);
    console.log(`Amount: ${amount} USDC\n`);

    const apiUrl = `http://localhost:3000/api/circle/transactions`;
    
    const requestBody = {
      walletId,
      walletAddress,
      destinationAddress,
      amount,
      idempotencyKey: crypto.randomUUID(),
    };

    console.log('📤 Request:', JSON.stringify(requestBody, null, 2));
    console.log('\n');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    console.log(`📥 Response Status: ${response.status}`);
    console.log(`📥 Response Data:`, JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('\n❌ Transaction failed!');
      if (data.error) {
        console.error(`Error: ${data.error}`);
      }
      if (data.details) {
        console.error(`Details:`, JSON.stringify(data.details, null, 2));
      }
    } else {
      console.log('\n✅ Transaction created successfully!');
      console.log(`Transaction ID: ${data.data?.id}`);
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

testTransaction();

