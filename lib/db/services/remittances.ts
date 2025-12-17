/**
 * Remittances Database Service
 * 
 * Manages remittances and remittance recipients in Supabase
 */

import { getSupabaseAdmin, getSupabaseClient } from '../supabase';

export interface Remittance {
  id: string;
  user_id: string; // UUID as string
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
  metadata?: {
    purpose?: string;
    notes?: string;
    complianceChecked?: boolean;
  };
  created_at: string;
  completed_at?: string;
  updated_at: string;
}

export interface RemittanceRecipient {
  id: string;
  user_id: string;
  name: string;
  address?: string;
  country: string;
  currency: string;
  preferred_currency?: string;
  last_remittance_date?: string;
  created_at: string;
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
  metadata?: {
    purpose?: string;
    notes?: string;
    complianceChecked?: boolean;
  };
}

/**
 * Generate remittance number
 */
function generateRemittanceNumber(userId: string, existingCount: number): string {
  const year = new Date().getFullYear();
  const sequence = String(existingCount + 1).padStart(4, '0');
  return `REM-${year}-${sequence}`;
}

/**
 * Create a new remittance
 */
export async function createRemittance(data: CreateRemittanceData): Promise<Remittance> {
  const supabase = getSupabaseAdmin();
  
  // Get count of existing remittances for this user to generate number
  const { count } = await supabase
    .from('remittances')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', data.user_id);
  
  const remittanceNumber = generateRemittanceNumber(data.user_id, count || 0);
  
  const { data: remittance, error } = await supabase
    .from('remittances')
    .insert({
      user_id: data.user_id,
      remittance_number: remittanceNumber,
      recipient_name: data.recipient_name,
      recipient_address: data.recipient_address,
      recipient_country: data.recipient_country,
      recipient_currency: data.recipient_currency,
      amount: data.amount,
      converted_amount: data.converted_amount,
      exchange_rate: data.exchange_rate,
      fee: data.fee,
      total_amount: data.total_amount,
      status: 'pending',
      metadata: data.metadata || {},
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
 * Get all remittances for a user
 */
export async function getAllRemittances(userId: string): Promise<Remittance[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('remittances')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[Remittances Service] Error getting remittances:', error);
    return [];
  }
  
  return data || [];
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
export async function getRemittanceByNumber(remittanceNumber: string): Promise<Remittance | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('remittances')
    .select('*')
    .eq('remittance_number', remittanceNumber)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Remittances Service] Error getting remittance by number:', error);
    return null;
  }
  
  return data;
}

/**
 * Update remittance
 */
export async function updateRemittance(
  id: string,
  updates: Partial<Remittance>
): Promise<Remittance> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('remittances')
    .update(updates)
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
  transactionHash: string
): Promise<Remittance> {
  return await updateRemittance(id, {
    status: 'completed',
    completed_at: new Date().toISOString(),
    transaction_hash: transactionHash,
  });
}

/**
 * Create or update remittance recipient
 */
export async function saveRemittanceRecipient(
  userId: string,
  recipient: Omit<RemittanceRecipient, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<RemittanceRecipient> {
  const supabase = getSupabaseAdmin();
  
  // Check if recipient exists (by name and user_id)
  const { data: existing } = await supabase
    .from('remittance_recipients')
    .select('*')
    .eq('user_id', userId)
    .eq('name', recipient.name)
    .single();
  
  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('remittance_recipients')
      .update({
        ...recipient,
        last_remittance_date: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();
    
    if (error) {
      console.error('[Remittances Service] Error updating recipient:', error);
      throw new Error(`Failed to update recipient: ${error.message}`);
    }
    
    return data;
  }
  
  // Create new
  const { data, error } = await supabase
    .from('remittance_recipients')
    .insert({
      user_id: userId,
      ...recipient,
      last_remittance_date: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    console.error('[Remittances Service] Error creating recipient:', error);
    throw new Error(`Failed to create recipient: ${error.message}`);
  }
  
  return data;
}

/**
 * Get all remittance recipients for a user
 */
export async function getAllRemittanceRecipients(userId: string): Promise<RemittanceRecipient[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('remittance_recipients')
    .select('*')
    .eq('user_id', userId)
    .order('last_remittance_date', { ascending: false, nullsFirst: false });
  
  if (error) {
    console.error('[Remittances Service] Error getting recipients:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Get recipient by name
 */
export async function getRemittanceRecipientByName(
  userId: string,
  name: string
): Promise<RemittanceRecipient | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('remittance_recipients')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', name)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Remittances Service] Error getting recipient:', error);
    return null;
  }
  
  return data;
}
