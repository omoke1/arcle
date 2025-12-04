/**
 * Contacts Service
 * 
 * Manages user contacts (phone, email, wallet addresses)
 */

import { getSupabaseAdmin, getSupabaseClient } from '../supabase';

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  wallet_address?: string;
  notes?: string;
  tags?: string[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateContactData {
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  wallet_address?: string;
  notes?: string;
  tags?: string[];
  is_favorite?: boolean;
}

/**
 * Create a new contact
 */
export async function createContact(data: CreateContactData): Promise<Contact> {
  const supabase = getSupabaseAdmin();
  
  const { data: contact, error } = await supabase
    .from('contacts')
    .insert({
      ...data,
      is_favorite: data.is_favorite ?? false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[Contacts Service] Error creating contact:', error);
    throw new Error(`Failed to create contact: ${error.message}`);
  }

  return contact;
}

/**
 * Get contact by ID
 */
export async function getContactById(id: string): Promise<Contact | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Contacts Service] Error getting contact:', error);
    return null;
  }

  return data;
}

/**
 * Get all contacts for a user
 */
export async function getUserContacts(user_id: string): Promise<Contact[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', user_id)
    .order('is_favorite', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    console.error('[Contacts Service] Error getting user contacts:', error);
    return [];
  }

  return data || [];
}

/**
 * Get favorite contacts
 */
export async function getFavoriteContacts(user_id: string): Promise<Contact[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', user_id)
    .eq('is_favorite', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('[Contacts Service] Error getting favorite contacts:', error);
    return [];
  }

  return data || [];
}

/**
 * Search contacts by name, email, phone, or wallet address
 */
export async function searchContacts(
  user_id: string,
  query: string
): Promise<Contact[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', user_id)
    .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%,wallet_address.ilike.%${query}%`)
    .order('name', { ascending: true });

  if (error) {
    console.error('[Contacts Service] Error searching contacts:', error);
    return [];
  }

  return data || [];
}

/**
 * Get contact by email
 */
export async function getContactByEmail(
  user_id: string,
  email: string
): Promise<Contact | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', user_id)
    .eq('email', email.toLowerCase())
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Contacts Service] Error getting contact by email:', error);
    return null;
  }

  return data;
}

/**
 * Get contact by phone
 */
export async function getContactByPhone(
  user_id: string,
  phone: string
): Promise<Contact | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', user_id)
    .eq('phone', phone)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Contacts Service] Error getting contact by phone:', error);
    return null;
  }

  return data;
}

/**
 * Get contact by wallet address
 */
export async function getContactByWalletAddress(
  user_id: string,
  wallet_address: string
): Promise<Contact | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', user_id)
    .eq('wallet_address', wallet_address.toLowerCase())
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Contacts Service] Error getting contact by wallet address:', error);
    return null;
  }

  return data;
}

/**
 * Update contact
 */
export async function updateContact(
  id: string,
  updates: Partial<CreateContactData>
): Promise<Contact> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('contacts')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Contacts Service] Error updating contact:', error);
    throw new Error(`Failed to update contact: ${error.message}`);
  }

  return data;
}

/**
 * Toggle favorite status
 */
export async function toggleFavorite(id: string): Promise<Contact> {
  const contact = await getContactById(id);
  if (!contact) {
    throw new Error('Contact not found');
  }

  return await updateContact(id, {
    is_favorite: !contact.is_favorite,
  });
}

/**
 * Delete contact
 */
export async function deleteContact(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Contacts Service] Error deleting contact:', error);
    return false;
  }

  return true;
}

