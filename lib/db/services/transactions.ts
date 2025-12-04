/**
 * Transactions Service
 * 
 * Manages transaction history
 */

import { getSupabaseAdmin, getSupabaseClient } from '../supabase';

export interface Transaction {
  id: string;
  user_id: string;
  wallet_id: string;
  transaction_hash: string;
  chain: string;
  from_address: string;
  to_address: string;
  amount: string;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  type?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface CreateTransactionData {
  user_id: string;
  wallet_id: string;
  transaction_hash: string;
  chain: string;
  from_address: string;
  to_address: string;
  amount: string;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  type?: string;
  metadata?: any;
}

/**
 * Create a new transaction
 */
export async function createTransaction(data: CreateTransactionData): Promise<Transaction> {
  const supabase = getSupabaseAdmin();
  
  const { data: transaction, error } = await supabase
    .from('transactions')
    .insert({
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[Transactions Service] Error creating transaction:', error);
    throw new Error(`Failed to create transaction: ${error.message}`);
  }

  return transaction;
}

/**
 * Get transaction by hash
 */
export async function getTransactionByHash(transaction_hash: string): Promise<Transaction | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('transaction_hash', transaction_hash)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Transactions Service] Error getting transaction:', error);
    return null;
  }

  return data;
}

/**
 * Get transactions for a user
 */
export async function getUserTransactions(
  user_id: string,
  limit: number = 50,
  offset: number = 0
): Promise<Transaction[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[Transactions Service] Error getting user transactions:', error);
    return [];
  }

  return data || [];
}

/**
 * Get transactions for a wallet
 */
export async function getWalletTransactions(
  wallet_id: string,
  limit: number = 50,
  offset: number = 0
): Promise<Transaction[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('wallet_id', wallet_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[Transactions Service] Error getting wallet transactions:', error);
    return [];
  }

  return data || [];
}

/**
 * Get transactions by status
 */
export async function getTransactionsByStatus(
  user_id: string,
  status: 'pending' | 'completed' | 'failed',
  limit: number = 50
): Promise<Transaction[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user_id)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Transactions Service] Error getting transactions by status:', error);
    return [];
  }

  return data || [];
}

/**
 * Get transactions by type
 */
export async function getTransactionsByType(
  user_id: string,
  type: string,
  limit: number = 50
): Promise<Transaction[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user_id)
    .eq('type', type)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Transactions Service] Error getting transactions by type:', error);
    return [];
  }

  return data || [];
}

/**
 * Update transaction
 */
export async function updateTransaction(
  id: string,
  updates: Partial<CreateTransactionData>
): Promise<Transaction> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('transactions')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Transactions Service] Error updating transaction:', error);
    throw new Error(`Failed to update transaction: ${error.message}`);
  }

  return data;
}

/**
 * Update transaction status
 */
export async function updateTransactionStatus(
  transaction_hash: string,
  status: 'pending' | 'completed' | 'failed'
): Promise<Transaction | null> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('transactions')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('transaction_hash', transaction_hash)
    .select()
    .single();

  if (error) {
    console.error('[Transactions Service] Error updating transaction status:', error);
    return null;
  }

  return data;
}

/**
 * Get or create transaction
 */
export async function getOrCreateTransaction(data: CreateTransactionData): Promise<Transaction> {
  const existing = await getTransactionByHash(data.transaction_hash);
  if (existing) {
    return existing;
  }

  return await createTransaction(data);
}

