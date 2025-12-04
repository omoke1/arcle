/**
 * SafeLocks Service
 * 
 * Manages time-locked funds (savings with unlock dates)
 */

import { getSupabaseAdmin, getSupabaseClient } from '../supabase';

export interface SafeLock {
  id: string;
  user_id: string;
  wallet_id: string;
  name: string;
  amount: string;
  currency: string;
  unlock_date: string;
  status: 'locked' | 'unlocked' | 'cancelled';
  auto_unlock: boolean;
  early_unlock_allowed: boolean;
  early_unlock_fee_percent: number;
  transaction_hash?: string;
  unlocked_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSafeLockData {
  user_id: string;
  wallet_id: string;
  name: string;
  amount: string;
  currency: string;
  unlock_date: string;
  auto_unlock?: boolean;
  early_unlock_allowed?: boolean;
  early_unlock_fee_percent?: number;
}

/**
 * Create a new safe lock
 */
export async function createSafeLock(data: CreateSafeLockData): Promise<SafeLock> {
  const supabase = getSupabaseAdmin();
  
  const { data: safeLock, error } = await supabase
    .from('safe_locks')
    .insert({
      ...data,
      status: 'locked',
      auto_unlock: data.auto_unlock ?? true,
      early_unlock_allowed: data.early_unlock_allowed ?? false,
      early_unlock_fee_percent: data.early_unlock_fee_percent ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[SafeLocks Service] Error creating safe lock:', error);
    throw new Error(`Failed to create safe lock: ${error.message}`);
  }

  return safeLock;
}

/**
 * Get safe lock by ID
 */
export async function getSafeLockById(id: string): Promise<SafeLock | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('safe_locks')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[SafeLocks Service] Error getting safe lock:', error);
    return null;
  }

  return data;
}

/**
 * Get all safe locks for a user
 */
export async function getUserSafeLocks(user_id: string): Promise<SafeLock[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('safe_locks')
    .select('*')
    .eq('user_id', user_id)
    .order('unlock_date', { ascending: true });

  if (error) {
    console.error('[SafeLocks Service] Error getting user safe locks:', error);
    return [];
  }

  return data || [];
}

/**
 * Get active safe locks (locked status)
 */
export async function getActiveSafeLocks(user_id: string): Promise<SafeLock[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('safe_locks')
    .select('*')
    .eq('user_id', user_id)
    .eq('status', 'locked')
    .order('unlock_date', { ascending: true });

  if (error) {
    console.error('[SafeLocks Service] Error getting active safe locks:', error);
    return [];
  }

  return data || [];
}

/**
 * Find safe locks ready to unlock
 */
export async function findReadyToUnlock(now: Date = new Date()): Promise<SafeLock[]> {
  const supabase = getSupabaseClient();
  const nowISO = now.toISOString();
  
  const { data, error } = await supabase
    .from('safe_locks')
    .select('*')
    .eq('status', 'locked')
    .eq('auto_unlock', true)
    .lte('unlock_date', nowISO)
    .order('unlock_date', { ascending: true });

  if (error) {
    console.error('[SafeLocks Service] Error finding ready to unlock:', error);
    return [];
  }

  return data || [];
}

/**
 * Update safe lock
 */
export async function updateSafeLock(
  id: string,
  updates: Partial<CreateSafeLockData> & {
    status?: SafeLock['status'];
    unlocked_at?: string;
    transaction_hash?: string;
  }
): Promise<SafeLock> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('safe_locks')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[SafeLocks Service] Error updating safe lock:', error);
    throw new Error(`Failed to update safe lock: ${error.message}`);
  }

  return data;
}

/**
 * Unlock safe lock
 */
export async function unlockSafeLock(
  id: string,
  transaction_hash: string
): Promise<SafeLock> {
  return await updateSafeLock(id, {
    status: 'unlocked',
    unlocked_at: new Date().toISOString(),
    transaction_hash,
  });
}

/**
 * Early unlock (with fee calculation)
 */
export async function earlyUnlock(
  id: string,
  transaction_hash: string
): Promise<{ safeLock: SafeLock; fee: string }> {
  const safeLock = await getSafeLockById(id);
  if (!safeLock) {
    throw new Error('Safe lock not found');
  }

  if (!safeLock.early_unlock_allowed) {
    throw new Error('Early unlock not allowed for this safe lock');
  }

  if (safeLock.status !== 'locked') {
    throw new Error('Safe lock is not locked');
  }

  // Calculate fee
  const amount = parseFloat(safeLock.amount);
  const feePercent = safeLock.early_unlock_fee_percent;
  const fee = (amount * feePercent) / 100;

  const updated = await updateSafeLock(id, {
    status: 'unlocked',
    unlocked_at: new Date().toISOString(),
    transaction_hash,
  });

  return {
    safeLock: updated,
    fee: fee.toFixed(2),
  };
}

/**
 * Cancel safe lock
 */
export async function cancelSafeLock(id: string): Promise<SafeLock> {
  const safeLock = await getSafeLockById(id);
  if (!safeLock) {
    throw new Error('Safe lock not found');
  }

  if (safeLock.status !== 'locked') {
    throw new Error('Only locked safe locks can be cancelled');
  }

  return await updateSafeLock(id, {
    status: 'cancelled',
  });
}

/**
 * Delete safe lock
 */
export async function deleteSafeLock(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('safe_locks')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[SafeLocks Service] Error deleting safe lock:', error);
    return false;
  }

  return true;
}

