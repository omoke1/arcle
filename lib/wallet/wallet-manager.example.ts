/**
 * WalletManager Usage Example
 * 
 * This file demonstrates how to use the WalletManager class
 * for real-time wallet monitoring and transaction management
 */

import { WalletManager } from './wallet-manager';

/**
 * Example: Basic wallet management with event listeners
 */
export async function exampleBasicUsage() {
  // Get user token from localStorage or your auth system
  const userToken = typeof window !== 'undefined' 
    ? localStorage.getItem('arcle_user_token') || ''
    : 'YOUR_USER_TOKEN';

  if (!userToken) {
    console.error('User token required');
    return;
  }

  // Create wallet manager instance
  const walletManager = new WalletManager(userToken);

  // Add event listeners for real-time updates
  walletManager.addEventListener('balanceUpdated', (data) => {
    console.log(`💰 Balance updated for wallet ${data.walletId}:`, {
      token: data.tokenKey,
      amount: data.amount,
      previousAmount: data.previousAmount
    });
  });

  walletManager.addEventListener('transactionCreated', (data) => {
    console.log(`📝 New transaction for wallet ${data.walletId}:`, data.transaction);
  });

  walletManager.addEventListener('transactionUpdated', (data) => {
    console.log(`🔄 Transactions updated for wallet ${data.walletId}`);
  });

  try {
    // Load all wallets (starts automatic polling)
    const wallets = await walletManager.loadWallets();
    console.log(`✅ Loaded ${wallets.length} wallets`);

    if (wallets.length > 0) {
      const wallet = wallets[0];
      console.log(`Using wallet: ${wallet.walletId} (${wallet.address})`);

      // Get wallet balances
      const balances = walletManager.getWallet(wallet.walletId)?.balances;
      if (balances) {
        console.log('Current balances:');
        balances.forEach((amount, tokenKey) => {
          console.log(`  ${tokenKey}: ${amount}`);
        });
      }

      // Example: Create a transaction
      // Note: This requires a challenge flow in production
      /*
      const challengeId = await walletManager.createTransaction({
        walletId: wallet.walletId,
        tokenId: 'YOUR_TOKEN_ID',  // Or use blockchain + tokenAddress
        amounts: ['0.01'],
        destinationAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        feeLevel: 'MEDIUM'
      });
      console.log(`Transaction initiated with challenge ID: ${challengeId}`);
      */
    }

    // Keep running to receive updates
    // In a real app, you'd clean up when the component unmounts
    // walletManager.dispose();
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Example: React hook integration
 */
export function useWalletManager(userToken: string | null) {
  // In a React component, you would:
  // 1. Create WalletManager instance in useEffect
  // 2. Set up event listeners
  // 3. Load wallets
  // 4. Clean up on unmount
  
  /*
  useEffect(() => {
    if (!userToken) return;

    const walletManager = new WalletManager(userToken);
    
    walletManager.addEventListener('balanceUpdated', (data) => {
      // Update React state
      setBalance(data.amount);
    });

    walletManager.loadWallets().then(wallets => {
      setWallets(wallets);
    });

    return () => {
      walletManager.dispose();
    };
  }, [userToken]);
  */
}

