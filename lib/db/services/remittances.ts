/**
 * Remittances Service
 * 
 * Manages cross-border payments with currency conversion
 */

import { getSupabaseAdmin, getSupabaseClient } from '../supabase';

export interface Remittance {
  id: string;
  user_id: string;
  remittance_number: string;
  recipient_name: string;
  recipient_address?: string;
  recipient_country: string;
  recipient_currency: string;
  amount: string;
  converted_amount: string;
  exchange_rate: number;
  fee: string;
  total_amount: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transaction_hash?: string;
  metadata?: any;
  created_at: string;
  completed_at?: string;
  updated_at: string;
}

export interface CreateRemittanceData {
  user_id: string;
  recipient_name: string;
  recipient_address?: string;
  recipient_country: string;
  recipient_currency: string;
  amount: string;
  converted_amount: string;
  exchange_rate: number;
  fee: string;
  total_amount: string;
  metadata?: any;
}

/**
 * Generate remittance number
 */
function generateRemittanceNumber(userId: string, existingCount: number): string {
  const year = new Date().getFullYear();
  const count = existingCount + 1;
  return `REM-${year}-${String(count).padStart(4, '0')}`;
}

/**
 * Create a new remittance
 */
export async function createRemittance(data: CreateRemittanceData): Promise<Remittance> {
  const supabase = getSupabaseAdmin();
  
  // Get existing remittance count for this user
  const { count } = await supabase
    .from('remittances')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', data.user_id);
  
  const remittanceNumber = generateRemittanceNumber(data.user_id, count || 0);
  
  const { data: remittance, error } = await supabase
    .from('remittances')
    .insert({
      ...data,
      remittance_number: remittanceNumber,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[Remittances Service] Error creating remittance:', error);
    throw new Error(`Failed to create remittance: ${error.message}`);
  }

  return remittance;
}

/**
 * Get remittance by ID
 */
export async function getRemittanceById(id: string): Promise<Remittance | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('remittances')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Remittances Service] Error getting remittance:', error);
    return null;
  }

  return data;
}

/**
 * Get remittance by remittance number
 */
export async function getRemittanceByNumber(remittance_number: string): Promise<Remittance | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('remittances')
    .select('*')
    .eq('remittance_number', remittance_number)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Remittances Service] Error getting remittance:', error);
    return null;
  }

  return data;
}

/**
 * Get all remittances for a user
 */
export async function getUserRemittances(
  user_id: string,
  limit: number = 50,
  offset: number = 0
): Promise<Remittance[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('remittances')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[Remittances Service] Error getting user remittances:', error);
    return [];
  }

  return data || [];
}

/**
 * Get remittances by status
 */
export async function getRemittancesByStatus(
  user_id: string,
  status: Remittance['status']
): Promise<Remittance[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('remittances')
    .select('*')
    .eq('user_id', user_id)
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Remittances Service] Error getting remittances by status:', error);
    return [];
  }

  return data || [];
}

/**
 * Update remittance
 */
export async function updateRemittance(
  id: string,
  updates: Partial<CreateRemittanceData> & { 
    status?: Remittance['status'];
    completed_at?: string;
    transaction_hash?: string;
  }
): Promise<Remittance> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('remittances')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Remittances Service] Error updating remittance:', error);
    throw new Error(`Failed to update remittance: ${error.message}`);
  }

  return data;
}

/**
 * Mark remittance as completed
 */
export async function markRemittanceAsCompleted(
  id: string,
  transaction_hash: string
): Promise<Remittance> {
  return await updateRemittance(id, {
    status: 'completed',
    completed_at: new Date().toISOString(),
    transaction_hash,
  });
}

/**
 * Delete remittance
 */
export async function deleteRemittance(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('remittances')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Remittances Service] Error deleting remittance:', error);
    return false;
  }

  return true;
}

