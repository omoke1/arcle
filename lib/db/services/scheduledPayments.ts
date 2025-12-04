/**
 * Scheduled Payments Service
 * 
 * Manages one-time scheduled payments
 */

import { getSupabaseAdmin, getSupabaseClient } from '../supabase';

export interface ScheduledPayment {
  id: string;
  user_id: string;
  wallet_id: string;
  amount: string;
  currency: string;
  to_address: string;
  scheduled_for: string;
  status: 'pending' | 'executed' | 'cancelled' | 'failed';
  executed_at?: string;
  transaction_hash?: string;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduledPaymentData {
  user_id: string;
  wallet_id: string;
  amount: string;
  currency: string;
  to_address: string;
  scheduled_for: string;
}

/**
 * Create a new scheduled payment
 */
export async function createScheduledPayment(
  data: CreateScheduledPaymentData
): Promise<ScheduledPayment> {
  const supabase = getSupabaseAdmin();
  
  const { data: payment, error } = await supabase
    .from('scheduled_payments')
    .insert({
      ...data,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[Scheduled Payments Service] Error creating scheduled payment:', error);
    throw new Error(`Failed to create scheduled payment: ${error.message}`);
  }

  return payment;
}

/**
 * Get scheduled payment by ID
 */
export async function getScheduledPaymentById(id: string): Promise<ScheduledPayment | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('scheduled_payments')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Scheduled Payments Service] Error getting scheduled payment:', error);
    return null;
  }

  return data;
}

/**
 * Get all scheduled payments for a user
 */
export async function getUserScheduledPayments(user_id: string): Promise<ScheduledPayment[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('scheduled_payments')
    .select('*')
    .eq('user_id', user_id)
    .order('scheduled_for', { ascending: true });

  if (error) {
    console.error('[Scheduled Payments Service] Error getting user scheduled payments:', error);
    return [];
  }

  return data || [];
}

/**
 * Get pending scheduled payments
 */
export async function getPendingScheduledPayments(user_id: string): Promise<ScheduledPayment[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('scheduled_payments')
    .select('*')
    .eq('user_id', user_id)
    .eq('status', 'pending')
    .order('scheduled_for', { ascending: true });

  if (error) {
    console.error('[Scheduled Payments Service] Error getting pending payments:', error);
    return [];
  }

  return data || [];
}

/**
 * Find payments due for execution
 */
export async function findDuePayments(
  now: Date = new Date(),
  user_id?: string
): Promise<ScheduledPayment[]> {
  const supabase = getSupabaseClient();
  const nowISO = now.toISOString();
  
  let query = supabase
    .from('scheduled_payments')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', nowISO)
    .order('scheduled_for', { ascending: true });

  if (user_id) {
    query = query.eq('user_id', user_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Scheduled Payments Service] Error finding due payments:', error);
    return [];
  }

  return data || [];
}

export async function findUserDuePayments(
  user_id: string,
  now: Date = new Date()
): Promise<ScheduledPayment[]> {
  return await findDuePayments(now, user_id);
}

/**
 * Update scheduled payment
 */
export async function updateScheduledPayment(
  id: string,
  updates: Partial<CreateScheduledPaymentData> & {
    status?: ScheduledPayment['status'];
    executed_at?: string;
    transaction_hash?: string;
    failure_reason?: string;
  }
): Promise<ScheduledPayment> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('scheduled_payments')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Scheduled Payments Service] Error updating scheduled payment:', error);
    throw new Error(`Failed to update scheduled payment: ${error.message}`);
  }

  return data;
}

/**
 * Mark payment as executed
 */
export async function markPaymentAsExecuted(
  id: string,
  transaction_hash: string
): Promise<ScheduledPayment> {
  return await updateScheduledPayment(id, {
    status: 'executed',
    executed_at: new Date().toISOString(),
    transaction_hash,
  });
}

/**
 * Mark payment as failed
 */
export async function markPaymentAsFailed(
  id: string,
  failure_reason: string
): Promise<ScheduledPayment> {
  return await updateScheduledPayment(id, {
    status: 'failed',
    failure_reason,
  });
}

/**
 * Cancel scheduled payment
 */
export async function cancelScheduledPayment(id: string): Promise<ScheduledPayment> {
  return await updateScheduledPayment(id, {
    status: 'cancelled',
  });
}

/**
 * Delete scheduled payment
 */
export async function deleteScheduledPayment(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('scheduled_payments')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Scheduled Payments Service] Error deleting scheduled payment:', error);
    return false;
  }

  return true;
}

