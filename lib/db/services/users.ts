/**
 * Users Service
 * 
 * Manages user accounts and Circle user IDs
 */

import { getSupabaseAdmin, getSupabaseClient } from '../supabase';

export interface User {
  id: string;
  circle_user_id: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
  wallet_id?: string;
  wallet_address?: string;
  encryption_key?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserData {
  circle_user_id: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
  wallet_id?: string;
  wallet_address?: string;
  encryption_key?: string;
}

/**
 * Create a new user
 */
export async function createUser(data: CreateUserData): Promise<User> {
  const supabase = getSupabaseAdmin();
  
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[Users Service] Error creating user:', error);
    throw new Error(`Failed to create user: ${error.message}`);
  }

  return user;
}

/**
 * Get user by Circle user ID
 */
export async function getUserByCircleId(circle_user_id: string): Promise<User | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('circle_user_id', circle_user_id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('[Users Service] Error getting user:', error);
    return null;
  }

  return data;
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Users Service] Error getting user:', error);
    return null;
  }

  return data;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Users Service] Error getting user:', error);
    return null;
  }

  return data;
}

/**
 * Update user
 */
export async function updateUser(id: string, updates: Partial<CreateUserData>): Promise<User> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('users')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Users Service] Error updating user:', error);
    throw new Error(`Failed to update user: ${error.message}`);
  }

  return data;
}

/**
 * Delete user (cascade deletes wallets, session keys, transactions)
 */
export async function deleteUser(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Users Service] Error deleting user:', error);
    return false;
  }

  return true;
}

/**
 * Get or create user by Circle user ID
 */
export async function getOrCreateUser(data: CreateUserData): Promise<User> {
  const existing = await getUserByCircleId(data.circle_user_id);
  if (existing) {
    return existing;
  }

  return await createUser(data);
}

