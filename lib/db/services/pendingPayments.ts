/**
 * Pending Payments Service
 * 
 * Manages claimable phone/email payments
 */

import { getSupabaseAdmin, getSupabaseClient } from '../supabase';
import crypto from 'crypto';

export interface PendingPayment {
  id: string;
  sender_user_id: string;
  sender_wallet_id: string;
  recipient_phone?: string;
  recipient_email?: string;
  amount: string; // In smallest unit
  currency: string;
  status: 'pending' | 'claimed' | 'expired' | 'cancelled';
  claim_code: string;
  claimed_by_user_id?: string;
  claimed_by_wallet_id?: string;
  claim_tx_hash?: string;
  escrow_address?: string;
  escrow_deposit_tx_hash?: string;
  claimed_by_wallet_address?: string;
  expires_at: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
  claimed_at?: string;
}

export interface CreatePendingPaymentData {
  sender_user_id: string;
  sender_wallet_id: string;
  sender_circle_user_id: string;
  recipient_phone?: string;
  recipient_email?: string;
  amount: string; // In smallest unit
  currency?: string;
  expires_in_days?: number; // Default 30
  escrow_address?: string; // Escrow contract address
  escrow_deposit_tx_hash?: string; // Transaction hash of escrow deposit
  metadata?: any;
}

/**
 * Generate a unique claim code (8 characters, alphanumeric)
 */
function generateClaimCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Create a pending payment
 */
export async function createPendingPayment(
  data: CreatePendingPaymentData
): Promise<PendingPayment> {
  const supabase = getSupabaseAdmin();
  
  // Generate unique claim code
  let claimCode = generateClaimCode();
  let attempts = 0;
  const maxAttempts = 10;
  
  // Ensure claim code is unique
  while (attempts < maxAttempts) {
    const existing = await getPendingPaymentByClaimCode(claimCode);
    if (!existing) {
      break;
    }
    claimCode = generateClaimCode();
    attempts++;
  }
  
  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique claim code');
  }
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (data.expires_in_days || 30));
  
  const { data: pendingPayment, error } = await supabase
    .from('pending_payments')
    .insert({
      sender_user_id: data.sender_user_id,
      sender_wallet_id: data.sender_wallet_id,
      sender_circle_user_id: data.sender_circle_user_id,
      recipient_phone: data.recipient_phone,
      recipient_email: data.recipient_email,
      amount: data.amount,
      currency: data.currency || 'USDC',
      claim_code: claimCode,
      escrow_address: data.escrow_address,
      escrow_deposit_tx_hash: data.escrow_deposit_tx_hash,
      expires_at: expiresAt.toISOString(),
      metadata: data.metadata || {},
      status: 'pending',
    })
    .select()
    .single();
  
  if (error) {
    console.error('[Pending Payments Service] Error creating pending payment:', error);
    throw new Error(`Failed to create pending payment: ${error.message}`);
  }
  
  return pendingPayment;
}

/**
 * Get pending payment by claim code
 */
export async function getPendingPaymentByClaimCode(
  claimCode: string
): Promise<PendingPayment | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('pending_payments')
    .select('*')
    .eq('claim_code', claimCode.toUpperCase())
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Pending Payments Service] Error getting pending payment:', error);
    return null;
  }
  
  return data;
}

/**
 * Get pending payments for a phone number
 */
export async function getPendingPaymentsByPhone(
  phone: string
): Promise<PendingPayment[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('pending_payments')
    .select('*')
    .eq('recipient_phone', phone)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[Pending Payments Service] Error getting pending payments by phone:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Get pending payments for an email
 */
export async function getPendingPaymentsByEmail(
  email: string
): Promise<PendingPayment[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('pending_payments')
    .select('*')
    .eq('recipient_email', email.toLowerCase())
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[Pending Payments Service] Error getting pending payments by email:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Get pending payments sent by a user
 */
export async function getPendingPaymentsBySender(
  sender_user_id: string
): Promise<PendingPayment[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('pending_payments')
    .select('*')
    .eq('sender_user_id', sender_user_id)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[Pending Payments Service] Error getting pending payments by sender:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Claim a pending payment
 */
export async function claimPendingPayment(
  claimCode: string,
  claimed_by_user_id: string,
  claimed_by_wallet_id: string,
  claimed_by_wallet_address: string,
  claim_tx_hash: string
): Promise<PendingPayment> {
  const supabase = getSupabaseAdmin();
  
  // First verify the payment exists and is claimable
  const pending = await getPendingPaymentByClaimCode(claimCode);
  if (!pending) {
    throw new Error('Pending payment not found');
  }
  
  if (pending.status !== 'pending') {
    throw new Error(`Payment has already been ${pending.status}`);
  }
  
  if (new Date(pending.expires_at) < new Date()) {
    // Mark as expired
    await updatePendingPaymentStatus(pending.id, 'expired');
    throw new Error('Payment has expired');
  }
  
  // Update payment to claimed
  const { data, error } = await supabase
    .from('pending_payments')
    .update({
      status: 'claimed',
      claimed_by_user_id,
      claimed_by_wallet_id,
      claimed_by_wallet_address,
      claim_tx_hash: claim_tx_hash,
      claimed_at: new Date().toISOString(),
    })
    .eq('id', pending.id)
    .select()
    .single();
  
  if (error) {
    console.error('[Pending Payments Service] Error claiming pending payment:', error);
    throw new Error(`Failed to claim payment: ${error.message}`);
  }
  
  return data;
}

/**
 * Update pending payment status
 */
export async function updatePendingPaymentStatus(
  id: string,
  status: 'pending' | 'claimed' | 'expired' | 'cancelled'
): Promise<PendingPayment> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('pending_payments')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('[Pending Payments Service] Error updating pending payment status:', error);
    throw new Error(`Failed to update payment status: ${error.message}`);
  }
  
  return data;
}

/**
 * Update escrow information for a pending payment
 */
export async function updatePendingPaymentEscrow(
  id: string,
  escrowAddress: string,
  escrowDepositTxHash: string
): Promise<PendingPayment> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('pending_payments')
    .update({
      escrow_address: escrowAddress,
      escrow_deposit_tx_hash: escrowDepositTxHash,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Pending Payments Service] Error updating escrow info:', error);
    throw new Error(`Failed to update escrow info: ${error.message}`);
  }

  return data;
}

/**
 * Cancel a pending payment (sender can cancel before it's claimed)
 */
export async function cancelPendingPayment(
  id: string,
  sender_user_id: string
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  
  // Verify sender owns this payment
  const pending = await getPendingPaymentByClaimCode(id); // This won't work, need to get by id
  // Let's create a helper for this
  const { data: payment } = await supabase
    .from('pending_payments')
    .select('*')
    .eq('id', id)
    .eq('sender_user_id', sender_user_id)
    .single();
  
  if (!payment || payment.status !== 'pending') {
    return false;
  }
  
  const { error } = await supabase
    .from('pending_payments')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('sender_user_id', sender_user_id);
  
  if (error) {
    console.error('[Pending Payments Service] Error cancelling pending payment:', error);
    return false;
  }
  
  return true;
}

/**
 * Get pending payment by ID
 */
export async function getPendingPaymentById(id: string): Promise<PendingPayment | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('pending_payments')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Pending Payments Service] Error getting pending payment by ID:', error);
    return null;
  }
  
  return data;
}

/**
 * Mark expired payments (cleanup job)
 */
export async function markExpiredPayments(): Promise<number> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('pending_payments')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())
    .select();
  
  if (error) {
    console.error('[Pending Payments Service] Error marking expired payments:', error);
    return 0;
  }
  
  return data?.length || 0;
}

