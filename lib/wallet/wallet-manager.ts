/**
 * Wallet Manager
 * 
 * Comprehensive wallet management with real-time polling and event listeners
 * Uses Circle's User-Controlled Wallets SDK
 */

import { getUserCircleClient } from "@/lib/circle-user-sdk";

const POLLING_INTERVAL = 5000; // Poll for updates every 5 seconds

/**
 * Represents a wallet with its balance and transaction history
 */
export interface WalletData {
  walletId: string;
  address: string;
  blockchain: string;
  balances: Map<string, string>; // tokenAddress -> amount
  transactions: any[];
}

/**
 * Balance update event data
 */
export interface BalanceUpdateEvent {
  walletId: string;
  tokenKey: string;
  amount: string;
  previousAmount?: string;
}

/**
 * Transaction update event data
 */
export interface TransactionUpdateEvent {
  walletId: string;
  transactions: any[];
}

/**
 * Transaction created event data
 */
export interface TransactionCreatedEvent {
  walletId: string;
  transaction: any;
}

type WalletEvent = 'balanceUpdated' | 'transactionUpdated' | 'transactionCreated';

/**
 * Main class to handle wallet operations with real-time updates
 */
export class WalletManager {
  private userToken: string;
  private wallets: Map<string, WalletData> = new Map();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private listeners: Map<string, Function[]> = new Map();
  private client: ReturnType<typeof getUserCircleClient>;

  constructor(userToken: string) {
    this.userToken = userToken;
    this.client = getUserCircleClient();
    this.initializeListeners();
  }

  /**
   * Initialize event listeners
   */
  private initializeListeners(): void {
    this.listeners.set('balanceUpdated', []);
    this.listeners.set('transactionUpdated', []);
    this.listeners.set('transactionCreated', []);
  }

  /**
   * Add an event listener
   */
  public addEventListener(event: WalletEvent, callback: (data: any) => void): void {
    if (this.listeners.has(event)) {
      const eventListeners = this.listeners.get(event) || [];
      eventListeners.push(callback);
      this.listeners.set(event, eventListeners);
    }
  }

  /**
   * Remove an event listener
   */
  public removeEventListener(event: WalletEvent, callback: (data: any) => void): void {
    if (this.listeners.has(event)) {
      const eventListeners = this.listeners.get(event) || [];
      const filtered = eventListeners.filter(cb => cb !== callback);
      this.listeners.set(event, filtered);
    }
  }

  /**
   * Trigger an event
   */
  private triggerEvent(event: WalletEvent, data: any): void {
    if (this.listeners.has(event)) {
      const eventListeners = this.listeners.get(event) || [];
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Load user wallets
   */
  public async loadWallets(): Promise<WalletData[]> {
    try {
      const response = await this.client.listWallets({
        userToken: this.userToken
      });

      if (response.data?.wallets) {
        for (const wallet of response.data.wallets) {
          if (wallet.id) {
            // Handle different wallet response structures
            const walletAddress = (wallet as any).address || 
                                 ((wallet as any).addresses && Array.isArray((wallet as any).addresses) && (wallet as any).addresses[0]?.address) ||
                                 '';
            
            const walletData: WalletData = {
              walletId: wallet.id,
              address: walletAddress,
              blockchain: wallet.blockchain || 'ARC-TESTNET',
              balances: new Map(),
              transactions: []
            };
            
            this.wallets.set(wallet.id, walletData);
            
            // Start polling for this wallet
            await this.loadWalletBalances(wallet.id);
            await this.loadWalletTransactions(wallet.id);
            this.startPolling(wallet.id);
          }
        }
      }
      
      return Array.from(this.wallets.values());
    } catch (error) {
      console.error('Error loading wallets:', error);
      throw error;
    }
  }

  /**
   * Load wallet balances
   */
  public async loadWalletBalances(walletId: string): Promise<Map<string, string>> {
    try {
      const walletData = this.wallets.get(walletId);
      if (!walletData) {
        throw new Error(`Wallet with ID ${walletId} not found`);
      }

      const response = await this.client.getWalletTokenBalance({
        userToken: this.userToken,
        walletId: walletId,
        includeAll: true
      });

      if (response.data?.tokenBalances) {
        const oldBalances = new Map(walletData.balances);
        walletData.balances.clear();
        
        for (const balance of response.data.tokenBalances) {
          if (balance.amount) {
            // Use token address as key if available, otherwise use token ID or index
            const token = balance.token as any;
            const tokenKey = token?.address || 
                           token?.id || 
                           `token-${response.data.tokenBalances.indexOf(balance)}`;
            const amount = balance.amount;
            
            walletData.balances.set(tokenKey, amount);
            
            // Check if balance changed
            if (!oldBalances.has(tokenKey) || oldBalances.get(tokenKey) !== amount) {
              this.triggerEvent('balanceUpdated', {
                walletId,
                tokenKey,
                amount,
                previousAmount: oldBalances.get(tokenKey)
              } as BalanceUpdateEvent);
            }
          }
        }
        
        this.wallets.set(walletId, walletData);
        return walletData.balances;
      }
      
      return new Map();
    } catch (error) {
      console.error(`Error loading balances for wallet ${walletId}:`, error);
      throw error;
    }
  }

  /**
   * Load wallet transactions
   */
  public async loadWalletTransactions(walletId: string): Promise<any[]> {
    try {
      const walletData = this.wallets.get(walletId);
      if (!walletData) {
        throw new Error(`Wallet with ID ${walletId} not found`);
      }

      const response = await this.client.listTransactions({
        userToken: this.userToken,
        walletIds: [walletId]
      });

      if (response.data?.transactions) {
        const knownTxIds = new Set(walletData.transactions.map(tx => {
          const txObj = tx as any;
          return txObj.id || txObj.transaction?.id;
        }));
        const newTransactions = response.data.transactions.filter(tx => {
          const txObj = tx as any;
          const txId = txObj.id || txObj.transaction?.id;
          return txId && !knownTxIds.has(txId);
        });
        
        // Add new transactions
        if (newTransactions.length > 0) {
          walletData.transactions = [...newTransactions, ...walletData.transactions];
          this.triggerEvent('transactionUpdated', {
            walletId,
            transactions: walletData.transactions
          } as TransactionUpdateEvent);
          
          // Notify about each new transaction
          newTransactions.forEach(tx => {
            this.triggerEvent('transactionCreated', {
              walletId,
              transaction: tx
            } as TransactionCreatedEvent);
          });
        }
        
        // Update existing transactions (status changes)
        for (const tx of response.data.transactions) {
          const txObj = tx as any;
          const txId = txObj.id || txObj.transaction?.id;
          if (txId) {
            const existingTxIndex = walletData.transactions.findIndex(t => {
              const tObj = t as any;
              return (tObj.id || tObj.transaction?.id) === txId;
            });
            if (existingTxIndex >= 0) {
              const existingTx = walletData.transactions[existingTxIndex] as any;
              // Check if transaction state changed
              const existingState = existingTx.state || existingTx.transaction?.state;
              const newState = txObj.state || txObj.transaction?.state;
              
              if (existingState !== newState) {
                walletData.transactions[existingTxIndex] = tx;
                this.triggerEvent('transactionUpdated', {
                  walletId,
                  transactions: walletData.transactions
                } as TransactionUpdateEvent);
              }
            }
          }
        }
        
        this.wallets.set(walletId, walletData);
        return walletData.transactions;
      }
      
      return [];
    } catch (error) {
      console.error(`Error loading transactions for wallet ${walletId}:`, error);
      throw error;
    }
  }

  /**
   * Start polling for updates
   */
  private startPolling(walletId: string): void {
    if (this.pollingIntervals.has(walletId)) {
      clearInterval(this.pollingIntervals.get(walletId)!);
    }
    
    const interval = setInterval(async () => {
      try {
        await this.loadWalletBalances(walletId);
        await this.loadWalletTransactions(walletId);
      } catch (error) {
        console.error(`Error during polling for wallet ${walletId}:`, error);
      }
    }, POLLING_INTERVAL);
    
    this.pollingIntervals.set(walletId, interval);
  }

  /**
   * Stop polling for updates
   */
  public stopPolling(walletId?: string): void {
    if (walletId && this.pollingIntervals.has(walletId)) {
      clearInterval(this.pollingIntervals.get(walletId)!);
      this.pollingIntervals.delete(walletId);
    } else if (!walletId) {
      // Stop all polling intervals
      this.pollingIntervals.forEach((interval) => clearInterval(interval));
      this.pollingIntervals.clear();
    }
  }

  /**
   * Get wallet data
   */
  public getWallet(walletId: string): WalletData | undefined {
    return this.wallets.get(walletId);
  }

  /**
   * Get all wallets
   */
  public getAllWallets(): WalletData[] {
    return Array.from(this.wallets.values());
  }

  /**
   * Create a transaction
   */
  public async createTransaction(params: {
    walletId: string;
    tokenId?: string;
    blockchain?: string;
    tokenAddress?: string;
    amounts: string[];
    destinationAddress: string;
    feeLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    refId?: string;
  }): Promise<string> {
    try {
      const { walletId, tokenId, blockchain, tokenAddress, amounts, destinationAddress, feeLevel = 'MEDIUM', refId } = params;
      
      // Prepare transaction parameters
      const txParams: any = {
        userToken: this.userToken,
        walletId,
        amounts,
        destinationAddress,
        fee: {
          type: 'level',
          config: {
            feeLevel
          }
        }
      };
      
      // Add either tokenId or blockchain/tokenAddress
      if (tokenId) {
        txParams.tokenId = tokenId;
      } else if (blockchain && tokenAddress) {
        txParams.blockchain = blockchain;
        txParams.tokenAddress = tokenAddress;
      } else {
        throw new Error('Either tokenId or blockchain/tokenAddress must be provided');
      }
      
      // Add optional refId if provided
      if (refId) {
        txParams.refId = refId;
      }
      
      // Create the transaction
      const response = await this.client.createTransaction(txParams);
      
      if (response.data?.challengeId) {
        // In a real application, you would handle the challenge flow here
        console.log(`Transaction initiated with challenge ID: ${response.data.challengeId}`);
        
        // Immediately poll for updates to catch the new transaction
        setTimeout(async () => {
          await this.loadWalletTransactions(walletId);
          await this.loadWalletBalances(walletId);
        }, 1000);
        
        return response.data.challengeId;
      } else {
        throw new Error('Failed to create transaction: No challenge ID returned');
      }
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  }

  /**
   * Get transaction details
   */
  public async getTransactionDetails(transactionId: string): Promise<any> {
    try {
      const response = await this.client.getTransaction({
        userToken: this.userToken,
        id: transactionId
      });
      
      if (response.data?.transaction) {
        return response.data.transaction;
      }
      
      throw new Error('Transaction not found');
    } catch (error) {
      console.error(`Error getting transaction ${transactionId}:`, error);
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.stopPolling();
    this.listeners.clear();
    this.wallets.clear();
  }
}

