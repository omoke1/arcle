/**
 * Test Transaction Creation with New Wallet
 * 
 * This script creates a new wallet and then tests transaction creation
 * Run: npm run test-transaction-with-new-wallet
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as crypto from 'crypto';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function testTransactionWithNewWallet() {
  try {
    console.log('🧪 Testing Transaction Creation with New Wallet\n');
    
    // Step 1: Create a new wallet
    console.log('📝 Step 1: Creating a new wallet...\n');
    const createWalletResponse = await fetch('http://localhost:3000/api/circle/wallets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        blockchains: ['ARC-TESTNET'],
      }),
    });

    const walletData = await createWalletResponse.json();
    
    console.log('Wallet creation response:', JSON.stringify(walletData, null, 2));
    
    if (!createWalletResponse.ok || !walletData.success) {
      throw new Error(`Failed to create wallet: ${walletData.error || 'Unknown error'}`);
    }

    // Handle different response formats
    const walletId = walletData.data?.id || walletData.data?.wallet?.id || walletData.data?.walletId;
    const walletAddress = walletData.data?.addresses?.[0]?.address || 
                         walletData.data?.wallet?.addresses?.[0]?.address ||
                         walletData.data?.address;
    
    if (!walletId) {
      console.error('Full response:', JSON.stringify(walletData, null, 2));
      throw new Error('Wallet created but no wallet ID returned. Response structure may have changed.');
    }

    console.log('✅ Wallet created successfully!');
    console.log(`   Wallet ID: ${walletId}`);
    console.log(`   Wallet Address: ${walletAddress || 'N/A'}\n`);

    // Wait a moment for wallet to be fully initialized
    console.log('⏳ Waiting 2 seconds for wallet initialization...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Test transaction creation
    console.log('📝 Step 2: Testing transaction creation...\n');
    const destinationAddress = '0x1234567890123456789012345678901234567890'; // Test address
    const amount = '0.01';

    console.log(`   Destination: ${destinationAddress}`);
    console.log(`   Amount: ${amount} USDC\n`);

    const transactionResponse = await fetch('http://localhost:3000/api/circle/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletId,
        walletAddress, // Include wallet address for SDK
        destinationAddress,
        amount,
        idempotencyKey: crypto.randomUUID(),
      }),
    });

    const transactionData = await transactionResponse.json();

    console.log(`📥 Response Status: ${transactionResponse.status}`);
    console.log(`📥 Response Data:`, JSON.stringify(transactionData, null, 2));

    if (!transactionResponse.ok || !transactionData.success) {
      console.error('\n❌ Transaction failed!');
      if (transactionData.error) {
        console.error(`Error: ${transactionData.error}`);
      }
      if (transactionData.details) {
        console.error(`Details:`, JSON.stringify(transactionData.details, null, 2));
      }
      return;
    }

    console.log('\n✅ Transaction created successfully!');
    console.log(`   Transaction ID: ${transactionData.data?.id}`);
    console.log(`   Status: ${transactionData.data?.status || 'N/A'}`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

testTransactionWithNewWallet();

