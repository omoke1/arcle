/**
 * Wallets Service
 * 
 * Manages wallet addresses and chains
 */

import { getSupabaseAdmin, getSupabaseClient } from '../supabase';

export interface Wallet {
  id: string;
  user_id: string;
  circle_wallet_id: string;
  address: string;
  chain: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateWalletData {
  user_id: string;
  circle_wallet_id: string;
  address: string;
  chain: string;
  is_active?: boolean;
}

/**
 * Create a new wallet
 */
export async function createWallet(data: CreateWalletData): Promise<Wallet> {
  const supabase = getSupabaseAdmin();
  
  const { data: wallet, error } = await supabase
    .from('wallets')
    .insert({
      ...data,
      is_active: data.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[Wallets Service] Error creating wallet:', error);
    throw new Error(`Failed to create wallet: ${error.message}`);
  }

  return wallet;
}

/**
 * Get wallet by Circle wallet ID
 */
export async function getWalletByCircleId(circle_wallet_id: string): Promise<Wallet | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('circle_wallet_id', circle_wallet_id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Wallets Service] Error getting wallet:', error);
    return null;
  }

  return data;
}

/**
 * Get wallet by address
 */
export async function getWalletByAddress(address: string): Promise<Wallet | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('address', address.toLowerCase())
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Wallets Service] Error getting wallet:', error);
    return null;
  }

  return data;
}

/**
 * Get all wallets for a user
 */
export async function getUserWallets(user_id: string): Promise<Wallet[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Wallets Service] Error getting user wallets:', error);
    return [];
  }

  return data || [];
}

/**
 * Get active wallets for a user
 */
export async function getActiveUserWallets(user_id: string): Promise<Wallet[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', user_id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Wallets Service] Error getting active wallets:', error);
    return [];
  }

  return data || [];
}

/**
 * Update wallet
 */
export async function updateWallet(id: string, updates: Partial<CreateWalletData>): Promise<Wallet> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('wallets')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Wallets Service] Error updating wallet:', error);
    throw new Error(`Failed to update wallet: ${error.message}`);
  }

  return data;
}

/**
 * Deactivate wallet
 */
export async function deactivateWallet(id: string): Promise<Wallet> {
  return await updateWallet(id, { is_active: false });
}

/**
 * Activate wallet
 */
export async function activateWallet(id: string): Promise<Wallet> {
  return await updateWallet(id, { is_active: true });
}

/**
 * Delete wallet
 */
export async function deleteWallet(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('wallets')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Wallets Service] Error deleting wallet:', error);
    return false;
  }

  return true;
}

