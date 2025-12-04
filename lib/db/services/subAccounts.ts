/**
 * Sub Accounts Service
 * 
 * Manages AI agent-controlled sub-wallets with budget limits
 */

import { getSupabaseAdmin, getSupabaseClient } from '../supabase';

export interface SubAccount {
  id: string;
  user_id: string;
  master_wallet_id: string;
  wallet_id: string;
  address: string;
  daily_spend_limit: string;
  per_transaction_limit: string;
  total_spent_today: string;
  last_reset_date: string;
  is_active: boolean;
  gas_sponsored: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSubAccountData {
  user_id: string;
  master_wallet_id: string;
  wallet_id: string;
  address: string;
  daily_spend_limit: string;
  per_transaction_limit: string;
  gas_sponsored?: boolean;
}

/**
 * Create a new sub-account
 */
export async function createSubAccount(data: CreateSubAccountData): Promise<SubAccount> {
  const supabase = getSupabaseAdmin();
  
  const { data: subAccount, error } = await supabase
    .from('sub_accounts')
    .insert({
      ...data,
      total_spent_today: '0.00',
      last_reset_date: new Date().toISOString(),
      is_active: true,
      gas_sponsored: data.gas_sponsored ?? false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[Sub Accounts Service] Error creating sub-account:', error);
    throw new Error(`Failed to create sub-account: ${error.message}`);
  }

  return subAccount;
}

/**
 * Get sub-account by ID
 */
export async function getSubAccountById(id: string): Promise<SubAccount | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('sub_accounts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Sub Accounts Service] Error getting sub-account:', error);
    return null;
  }

  return data;
}

/**
 * Get sub-account by address
 */
export async function getSubAccountByAddress(address: string): Promise<SubAccount | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('sub_accounts')
    .select('*')
    .eq('address', address.toLowerCase())
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Sub Accounts Service] Error getting sub-account:', error);
    return null;
  }

  return data;
}

/**
 * Get all sub-accounts for a user
 */
export async function getUserSubAccounts(user_id: string): Promise<SubAccount[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('sub_accounts')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Sub Accounts Service] Error getting user sub-accounts:', error);
    return [];
  }

  return data || [];
}

/**
 * Get sub-accounts for a master wallet
 */
export async function getMasterWalletSubAccounts(master_wallet_id: string): Promise<SubAccount[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('sub_accounts')
    .select('*')
    .eq('master_wallet_id', master_wallet_id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Sub Accounts Service] Error getting master wallet sub-accounts:', error);
    return [];
  }

  return data || [];
}

/**
 * Get active sub-accounts
 */
export async function getActiveSubAccounts(user_id: string): Promise<SubAccount[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('sub_accounts')
    .select('*')
    .eq('user_id', user_id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Sub Accounts Service] Error getting active sub-accounts:', error);
    return [];
  }

  return data || [];
}

/**
 * Update sub-account
 */
export async function updateSubAccount(
  id: string,
  updates: Partial<CreateSubAccountData> & {
    total_spent_today?: string;
    last_reset_date?: string;
    is_active?: boolean;
  }
): Promise<SubAccount> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('sub_accounts')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Sub Accounts Service] Error updating sub-account:', error);
    throw new Error(`Failed to update sub-account: ${error.message}`);
  }

  return data;
}

/**
 * Reset daily spending (call at start of new day)
 */
export async function resetDailySpending(id: string): Promise<SubAccount> {
  return await updateSubAccount(id, {
    total_spent_today: '0.00',
    last_reset_date: new Date().toISOString(),
  });
}

/**
 * Record transaction (update daily spending)
 */
export async function recordTransaction(id: string, amount: string): Promise<SubAccount> {
  const subAccount = await getSubAccountById(id);
  if (!subAccount) {
    throw new Error('Sub-account not found');
  }

  // Check if we need to reset (new day)
  const lastReset = new Date(subAccount.last_reset_date);
  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  
  let currentSpent = parseFloat(subAccount.total_spent_today);
  
  if (now.getTime() - lastReset.getTime() >= oneDay) {
    // Reset for new day
    currentSpent = 0;
    await resetDailySpending(id);
  }

  // Add transaction amount
  const newSpent = currentSpent + parseFloat(amount);
  
  return await updateSubAccount(id, {
    total_spent_today: newSpent.toFixed(2),
  });
}

/**
 * Check if transaction is within budget limits
 */
export async function checkBudgetLimits(
  id: string,
  amount: string
): Promise<{ allowed: boolean; reason?: string }> {
  const subAccount = await getSubAccountById(id);
  
  if (!subAccount || !subAccount.is_active) {
    return { allowed: false, reason: 'Sub-account not found or inactive' };
  }

  // Check if we need to reset (new day)
  const lastReset = new Date(subAccount.last_reset_date);
  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  
  let currentSpent = parseFloat(subAccount.total_spent_today);
  
  if (now.getTime() - lastReset.getTime() >= oneDay) {
    // Reset for new day
    currentSpent = 0;
    await resetDailySpending(id);
  }

  const amountNum = parseFloat(amount);
  const perTxLimit = parseFloat(subAccount.per_transaction_limit);
  const dailyLimit = parseFloat(subAccount.daily_spend_limit);

  // Check per-transaction limit
  if (amountNum > perTxLimit) {
    return {
      allowed: false,
      reason: `Amount exceeds per-transaction limit of ${subAccount.per_transaction_limit} USDC`,
    };
  }

  // Check daily limit
  if (currentSpent + amountNum > dailyLimit) {
    return {
      allowed: false,
      reason: `Transaction would exceed daily limit of ${subAccount.daily_spend_limit} USDC`,
    };
  }

  return { allowed: true };
}

/**
 * Deactivate sub-account
 */
export async function deactivateSubAccount(id: string): Promise<SubAccount> {
  return await updateSubAccount(id, { is_active: false });
}

/**
 * Activate sub-account
 */
export async function activateSubAccount(id: string): Promise<SubAccount> {
  return await updateSubAccount(id, { is_active: true });
}

/**
 * Delete sub-account
 */
export async function deleteSubAccount(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('sub_accounts')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Sub Accounts Service] Error deleting sub-account:', error);
    return false;
  }

  return true;
}

