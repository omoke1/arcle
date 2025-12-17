/**
 * Phone/Email Wallet Mapping Service
 * 
 * Maps phone numbers and email addresses to wallet addresses
 * Enables instant payments to phone/email without pre-registration
 */

import { getSupabaseAdmin, getSupabaseClient } from '../supabase';

export interface PhoneWalletMapping {
  id: string;
  phone?: string;
  email?: string;
  wallet_address: string;
  wallet_id: string;
  circle_user_id: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateMappingData {
  phone?: string;
  email?: string;
  wallet_address: string;
  wallet_id: string;
  circle_user_id: string;
  verified?: boolean;
}

/**
 * Normalize phone number (E.164 format)
 */
function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.replace(/[^\d]/g, '');
  }
  return trimmed.replace(/[^\d]/g, '');
}

/**
 * Create or update phone/email to wallet mapping
 */
export async function createOrUpdateMapping(
  data: CreateMappingData
): Promise<PhoneWalletMapping> {
  const supabase = getSupabaseAdmin();
  
  const normalizedPhone = data.phone ? normalizePhone(data.phone) : null;
  const normalizedEmail = data.email ? data.email.trim().toLowerCase() : null;
  
  // Check if mapping already exists
  let existing: PhoneWalletMapping | null = null;
  
  if (normalizedPhone) {
    const { data: phoneMapping } = await supabase
      .from('phone_wallet_mappings')
      .select('*')
      .eq('phone', normalizedPhone)
      .single();
    existing = phoneMapping;
  }
  
  if (!existing && normalizedEmail) {
    const { data: emailMapping } = await supabase
      .from('phone_wallet_mappings')
      .select('*')
      .eq('email', normalizedEmail)
      .single();
    existing = emailMapping;
  }
  
  if (existing) {
    // Update existing mapping
    const { data: updated, error } = await supabase
      .from('phone_wallet_mappings')
      .update({
        wallet_address: data.wallet_address,
        wallet_id: data.wallet_id,
        circle_user_id: data.circle_user_id,
        verified: data.verified ?? existing.verified,
        phone: normalizedPhone || existing.phone,
        email: normalizedEmail || existing.email,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();
    
    if (error) {
      console.error('[Phone Wallet Mappings] Error updating mapping:', error);
      throw new Error(`Failed to update mapping: ${error.message}`);
    }
    
    return updated;
  }
  
  // Create new mapping
  const { data: mapping, error } = await supabase
    .from('phone_wallet_mappings')
    .insert({
      phone: normalizedPhone,
      email: normalizedEmail,
      wallet_address: data.wallet_address,
      wallet_id: data.wallet_id,
      circle_user_id: data.circle_user_id,
      verified: data.verified ?? false,
    })
    .select()
    .single();
  
  if (error) {
    console.error('[Phone Wallet Mappings] Error creating mapping:', error);
    throw new Error(`Failed to create mapping: ${error.message}`);
  }
  
  return mapping;
}

/**
 * Get wallet mapping by phone
 */
export async function getMappingByPhone(
  phone: string
): Promise<PhoneWalletMapping | null> {
  const supabase = getSupabaseClient();
  const normalizedPhone = normalizePhone(phone);
  
  const { data, error } = await supabase
    .from('phone_wallet_mappings')
    .select('*')
    .eq('phone', normalizedPhone)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Phone Wallet Mappings] Error getting mapping by phone:', error);
    return null;
  }
  
  return data;
}

/**
 * Get wallet mapping by email
 */
export async function getMappingByEmail(
  email: string
): Promise<PhoneWalletMapping | null> {
  const supabase = getSupabaseClient();
  const normalizedEmail = email.trim().toLowerCase();
  
  const { data, error } = await supabase
    .from('phone_wallet_mappings')
    .select('*')
    .eq('email', normalizedEmail)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Phone Wallet Mappings] Error getting mapping by email:', error);
    return null;
  }
  
  return data;
}

/**
 * Get wallet mapping by wallet address
 */
export async function getMappingByWalletAddress(
  walletAddress: string
): Promise<PhoneWalletMapping | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('phone_wallet_mappings')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Phone Wallet Mappings] Error getting mapping by wallet address:', error);
    return null;
  }
  
  return data;
}

/**
 * Verify phone/email mapping (mark as verified)
 */
export async function verifyMapping(id: string): Promise<PhoneWalletMapping> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('phone_wallet_mappings')
    .update({
      verified: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('[Phone Wallet Mappings] Error verifying mapping:', error);
    throw new Error(`Failed to verify mapping: ${error.message}`);
  }
  
  return data;
}

