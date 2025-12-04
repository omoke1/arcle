/**
 * Session Keys Service
 * 
 * Manages agent session keys in Supabase
 * Migrates from Vercel KV to Supabase
 */

import { getSupabaseAdmin, getSupabaseClient } from '../supabase';

export interface SessionKey {
  id: string;
  user_id: string;
  wallet_id?: string | null;
  circle_session_key_id: string;
  agent_id?: string;
  agent_name?: string;
  agent_description?: string;
  permissions: any; // JSONB
  spending_limit?: string;
  spending_used?: string;
  expires_at: string;
  status: 'active' | 'expired' | 'revoked';
  created_at: string;
  updated_at: string;
}

export interface CreateSessionKeyData {
  user_id: string;
  wallet_id?: string | null;
  circle_session_key_id: string;
  agent_id?: string;
  agent_name?: string;
  agent_description?: string;
  permissions: any;
  spending_limit?: string;
  spending_used?: string;
  expires_at: string;
  status?: 'active' | 'expired' | 'revoked';
}

/**
 * Create a new session key
 */
export async function createSessionKey(data: CreateSessionKeyData): Promise<SessionKey> {
  const supabase = getSupabaseAdmin();
  
  const { data: sessionKey, error } = await supabase
    .from('session_keys')
    .insert({
      ...data,
      status: data.status || 'active',
      spending_used: data.spending_used || '0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[Session Keys Service] Error creating session key:', error);
    throw new Error(`Failed to create session key: ${error.message}`);
  }

  return sessionKey;
}

/**
 * Get session key by Circle session key ID
 */
export async function getSessionKeyByCircleId(circle_session_key_id: string): Promise<SessionKey | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('session_keys')
    .select('*')
    .eq('circle_session_key_id', circle_session_key_id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Session Keys Service] Error getting session key:', error);
    return null;
  }

  return data;
}

/**
 * Get active session keys for a user
 */
export async function getActiveUserSessionKeys(user_id: string): Promise<SessionKey[]> {
  const supabase = getSupabaseClient();
  
  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('session_keys')
    .select('*')
    .eq('user_id', user_id)
    .eq('status', 'active')
    .gt('expires_at', now)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Session Keys Service] Error getting active session keys:', error);
    return [];
  }

  return data || [];
}

/**
 * Get session keys for a wallet
 */
export async function getWalletSessionKeys(wallet_id: string): Promise<SessionKey[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('session_keys')
    .select('*')
    .eq('wallet_id', wallet_id)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Session Keys Service] Error getting wallet session keys:', error);
    return [];
  }

  return data || [];
}

/**
 * Get session key for a specific agent
 */
export async function getAgentSessionKey(
  wallet_id: string,
  user_id: string,
  agent_id: string
): Promise<SessionKey | null> {
  const supabase = getSupabaseClient();
  
  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('session_keys')
    .select('*')
    .eq('wallet_id', wallet_id)
    .eq('user_id', user_id)
    .eq('agent_id', agent_id)
    .eq('status', 'active')
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Session Keys Service] Error getting agent session key:', error);
    return null;
  }

  return data;
}

/**
 * Update session key
 */
export async function updateSessionKey(
  id: string,
  updates: Partial<CreateSessionKeyData> & { status?: 'active' | 'expired' | 'revoked' }
): Promise<SessionKey> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('session_keys')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Session Keys Service] Error updating session key:', error);
    throw new Error(`Failed to update session key: ${error.message}`);
  }

  return data;
}

/**
 * Revoke session key
 */
export async function revokeSessionKey(id: string): Promise<SessionKey> {
  return await updateSessionKey(id, { status: 'revoked' });
}

/**
 * Mark session key as expired
 */
export async function expireSessionKey(id: string): Promise<SessionKey> {
  return await updateSessionKey(id, { status: 'expired' });
}

/**
 * Update spending used
 */
export async function updateSpendingUsed(
  id: string,
  spending_used: string
): Promise<SessionKey> {
  return await updateSessionKey(id, { spending_used });
}

/**
 * Delete session key
 */
export async function deleteSessionKey(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('session_keys')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Session Keys Service] Error deleting session key:', error);
    return false;
  }

  return true;
}

