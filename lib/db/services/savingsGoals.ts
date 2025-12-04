/**
 * Savings Goals Service
 * 
 * Manages user savings goals with auto-save functionality
 */

import { getSupabaseAdmin, getSupabaseClient } from '../supabase';

export interface SavingsGoal {
  id: string;
  user_id: string;
  wallet_id: string;
  name: string;
  target_amount: string;
  current_amount: string;
  currency: string;
  deadline?: string;
  auto_save: boolean;
  auto_save_amount?: string;
  auto_save_frequency?: 'daily' | 'weekly' | 'monthly';
  is_completed: boolean;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSavingsGoalData {
  user_id: string;
  wallet_id: string;
  name: string;
  target_amount: string;
  currency: string;
  deadline?: string;
  auto_save?: boolean;
  auto_save_amount?: string;
  auto_save_frequency?: 'daily' | 'weekly' | 'monthly';
}

/**
 * Create a new savings goal
 */
export async function createSavingsGoal(data: CreateSavingsGoalData): Promise<SavingsGoal> {
  const supabase = getSupabaseAdmin();
  
  const { data: goal, error } = await supabase
    .from('savings_goals')
    .insert({
      ...data,
      current_amount: '0',
      auto_save: data.auto_save ?? false,
      is_completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[Savings Goals Service] Error creating savings goal:', error);
    throw new Error(`Failed to create savings goal: ${error.message}`);
  }

  return goal;
}

/**
 * Get savings goal by ID
 */
export async function getSavingsGoalById(id: string): Promise<SavingsGoal | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Savings Goals Service] Error getting savings goal:', error);
    return null;
  }

  return data;
}

/**
 * Get all savings goals for a user
 */
export async function getUserSavingsGoals(user_id: string): Promise<SavingsGoal[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Savings Goals Service] Error getting user savings goals:', error);
    return [];
  }

  return data || [];
}

/**
 * Get active savings goals (not completed)
 */
export async function getActiveSavingsGoals(user_id: string): Promise<SavingsGoal[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', user_id)
    .eq('is_completed', false)
    .order('deadline', { ascending: true });

  if (error) {
    console.error('[Savings Goals Service] Error getting active savings goals:', error);
    return [];
  }

  return data || [];
}

/**
 * Get completed savings goals
 */
export async function getCompletedSavingsGoals(user_id: string): Promise<SavingsGoal[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', user_id)
    .eq('is_completed', true)
    .order('completed_at', { ascending: false });

  if (error) {
    console.error('[Savings Goals Service] Error getting completed savings goals:', error);
    return [];
  }

  return data || [];
}

/**
 * Update savings goal
 */
export async function updateSavingsGoal(
  id: string,
  updates: Partial<CreateSavingsGoalData> & {
    current_amount?: string;
    is_completed?: boolean;
    completed_at?: string;
  }
): Promise<SavingsGoal> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('savings_goals')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Savings Goals Service] Error updating savings goal:', error);
    throw new Error(`Failed to update savings goal: ${error.message}`);
  }

  // Check if goal is completed
  if (data && !data.is_completed) {
    const current = parseFloat(data.current_amount);
    const target = parseFloat(data.target_amount);
    
    if (current >= target) {
      // Mark as completed
      return await markAsCompleted(id);
    }
  }

  return data;
}

/**
 * Add amount to savings goal
 */
export async function addToSavingsGoal(
  id: string,
  amount: string
): Promise<SavingsGoal> {
  const goal = await getSavingsGoalById(id);
  if (!goal) {
    throw new Error('Savings goal not found');
  }

  const current = parseFloat(goal.current_amount);
  const addAmount = parseFloat(amount);
  const newAmount = (current + addAmount).toFixed(2);

  return await updateSavingsGoal(id, {
    current_amount: newAmount,
  });
}

/**
 * Mark savings goal as completed
 */
export async function markAsCompleted(id: string): Promise<SavingsGoal> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('savings_goals')
    .update({
      is_completed: true,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Savings Goals Service] Error marking goal as completed:', error);
    throw new Error(`Failed to mark goal as completed: ${error.message}`);
  }

  return data;
}

/**
 * Get progress percentage
 */
export async function getProgress(id: string): Promise<number> {
  const goal = await getSavingsGoalById(id);
  if (!goal) {
    return 0;
  }

  const current = parseFloat(goal.current_amount);
  const target = parseFloat(goal.target_amount);

  if (target === 0) return 0;

  return Math.min(100, Math.round((current / target) * 100));
}

/**
 * Delete savings goal
 */
export async function deleteSavingsGoal(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('savings_goals')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Savings Goals Service] Error deleting savings goal:', error);
    return false;
  }

  return true;
}

