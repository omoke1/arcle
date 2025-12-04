/**
 * Subscriptions Service
 * 
 * Manages recurring payments and subscriptions
 */

import { getSupabaseAdmin, getSupabaseClient } from '../supabase';

export interface Subscription {
  id: string;
  user_id: string;
  wallet_id: string;
  merchant: string;
  amount: string;
  currency: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  day_of_month?: number;
  weekday?: number;
  next_charge_at: string;
  auto_renew: boolean;
  remind_before_ms?: number;
  paused: boolean;
  last_reminder_shown_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSubscriptionData {
  user_id: string;
  wallet_id: string;
  merchant: string;
  amount: string;
  currency: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  day_of_month?: number;
  weekday?: number;
  next_charge_at: string;
  auto_renew?: boolean;
  remind_before_ms?: number;
  paused?: boolean;
}

/**
 * Create a new subscription
 */
export async function createSubscription(data: CreateSubscriptionData): Promise<Subscription> {
  const supabase = getSupabaseAdmin();
  
  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .insert({
      ...data,
      auto_renew: data.auto_renew ?? true,
      paused: data.paused ?? false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[Subscriptions Service] Error creating subscription:', error);
    throw new Error(`Failed to create subscription: ${error.message}`);
  }

  return subscription;
}

/**
 * Get subscription by ID
 */
export async function getSubscriptionById(id: string): Promise<Subscription | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Subscriptions Service] Error getting subscription:', error);
    return null;
  }

  return data;
}

/**
 * Get all subscriptions for a user
 */
export async function getUserSubscriptions(user_id: string): Promise<Subscription[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Subscriptions Service] Error getting user subscriptions:', error);
    return [];
  }

  return data || [];
}

/**
 * Get active subscriptions (not paused, auto_renew enabled)
 */
export async function getActiveSubscriptions(user_id: string): Promise<Subscription[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user_id)
    .eq('paused', false)
    .eq('auto_renew', true)
    .order('next_charge_at', { ascending: true });

  if (error) {
    console.error('[Subscriptions Service] Error getting active subscriptions:', error);
    return [];
  }

  return data || [];
}

/**
 * Find subscriptions due for charge
 */
export async function findDueSubscriptions(
  now: Date = new Date(),
  user_id?: string
): Promise<Subscription[]> {
  const supabase = getSupabaseClient();
  const nowISO = now.toISOString();
  
  let query = supabase
    .from('subscriptions')
    .select('*')
    .eq('paused', false)
    .eq('auto_renew', true)
    .lte('next_charge_at', nowISO)
    .order('next_charge_at', { ascending: true });

  if (user_id) {
    query = query.eq('user_id', user_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Subscriptions Service] Error finding due subscriptions:', error);
    return [];
  }

  return data || [];
}

/**
 * Find subscriptions with due reminders
 */
export async function findDueReminders(
  remindBeforeMs: number = 2 * 24 * 60 * 60 * 1000, // 2 days default
  now: Date = new Date(),
  user_id?: string
): Promise<Subscription[]> {
  const supabase = getSupabaseClient();
  const nowISO = now.toISOString();
  const reminderWindowStart = new Date(now.getTime() + remindBeforeMs).toISOString();
  
  let query = supabase
    .from('subscriptions')
    .select('*')
    .eq('paused', false)
    .eq('auto_renew', true)
    .gte('next_charge_at', nowISO)
    .lte('next_charge_at', reminderWindowStart)
    .order('next_charge_at', { ascending: true });

  if (user_id) {
    query = query.eq('user_id', user_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Subscriptions Service] Error finding due reminders:', error);
    return [];
  }

  // Filter out subscriptions that already had reminders shown
  return (data || []).filter(sub => {
    if (!sub.last_reminder_shown_at) return true;
    const lastReminder = new Date(sub.last_reminder_shown_at);
    const reminderWindowStartDate = new Date(now.getTime() + remindBeforeMs);
    return lastReminder < reminderWindowStartDate;
  });
}

/**
 * Update subscription
 */
export async function updateSubscription(
  id: string,
  updates: Partial<CreateSubscriptionData> & {
    paused?: boolean;
    auto_renew?: boolean;
    next_charge_at?: string;
    last_reminder_shown_at?: string;
  }
): Promise<Subscription> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Subscriptions Service] Error updating subscription:', error);
    throw new Error(`Failed to update subscription: ${error.message}`);
  }

  return data;
}

/**
 * Schedule next charge
 */
export async function scheduleNextCharge(id: string): Promise<Subscription> {
  const subscription = await getSubscriptionById(id);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const nextChargeAt = new Date(subscription.next_charge_at);
  
  if (subscription.frequency === 'monthly') {
    nextChargeAt.setMonth(nextChargeAt.getMonth() + 1);
  } else if (subscription.frequency === 'weekly') {
    nextChargeAt.setDate(nextChargeAt.getDate() + 7);
  } else {
    nextChargeAt.setDate(nextChargeAt.getDate() + 1);
  }

  return await updateSubscription(id, {
    next_charge_at: nextChargeAt.toISOString(),
    last_reminder_shown_at: undefined, // Reset reminder tracking
  });
}

/**
 * Pause subscription
 */
export async function pauseSubscription(id: string): Promise<Subscription> {
  return await updateSubscription(id, { paused: true });
}

/**
 * Resume subscription
 */
export async function resumeSubscription(id: string): Promise<Subscription> {
  return await updateSubscription(id, { paused: false });
}

/**
 * Delete subscription
 */
export async function deleteSubscription(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Subscriptions Service] Error deleting subscription:', error);
    return false;
  }

  return true;
}

