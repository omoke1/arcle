/**
 * Notifications Service
 * 
 * Manages user notifications
 */

import { getSupabaseAdmin, getSupabaseClient, isSupabaseConfigured } from '../supabase';

export interface Notification {
  id: string;
  user_id: string;
  type: 'transaction' | 'payment' | 'invoice' | 'remittance' | 'subscription' | 'system';
  title: string;
  message: string;
  action_url?: string;
  is_read: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  metadata?: any;
  created_at: string;
  read_at?: string;
}

export interface CreateNotificationData {
  user_id: string;
  type: Notification['type'];
  title: string;
  message: string;
  action_url?: string;
  priority?: Notification['priority'];
  metadata?: any;
}

/**
 * Create a new notification
 */
export async function createNotification(data: CreateNotificationData): Promise<Notification> {
  const supabase = getSupabaseAdmin();
  
  const { data: notification, error } = await supabase
    .from('notifications')
    .insert({
      ...data,
      is_read: false,
      priority: data.priority || 'normal',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[Notifications Service] Error creating notification:', error);
    throw new Error(`Failed to create notification: ${error.message}`);
  }

  return notification;
}

/**
 * Get notification by ID
 */
export async function getNotificationById(id: string): Promise<Notification | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Notifications Service] Error getting notification:', error);
    return null;
  }

  return data;
}

/**
 * Get all notifications for a user
 */
export async function getUserNotifications(
  user_id: string,
  limit: number = 50,
  offset: number = 0
): Promise<Notification[]> {
  if (!isSupabaseConfigured()) {
    console.warn('[Notifications Service] Supabase not configured');
    return [];
  }

  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Notifications Service] Error getting user notifications:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[Notifications Service] Exception getting user notifications:', error);
    return [];
  }
}

/**
 * Get unread notifications
 */
export async function getUnreadNotifications(
  user_id: string,
  limit: number = 50
): Promise<Notification[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user_id)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Notifications Service] Error getting unread notifications:', error);
    return [];
  }

  return data || [];
}

/**
 * Get notifications by type
 */
export async function getNotificationsByType(
  user_id: string,
  type: Notification['type'],
  limit: number = 50
): Promise<Notification[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user_id)
    .eq('type', type)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Notifications Service] Error getting notifications by type:', error);
    return [];
  }

  return data || [];
}

/**
 * Get unread count
 */
export async function getUnreadCount(user_id: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    return 0;
  }

  try {
    const supabase = getSupabaseClient();
    
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('is_read', false);

    if (error) {
      console.error('[Notifications Service] Error getting unread count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('[Notifications Service] Exception getting unread count:', error);
    return 0;
  }
}

/**
 * Mark notification as read
 */
export async function markAsRead(id: string): Promise<Notification> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  try {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[Notifications Service] Error marking notification as read:', error);
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }

    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to mark notification as read');
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(user_id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('user_id', user_id)
    .eq('is_read', false);

  if (error) {
    console.error('[Notifications Service] Error marking all as read:', error);
    return false;
  }

  return true;
}

/**
 * Delete notification
 */
export async function deleteNotification(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Notifications Service] Error deleting notification:', error);
    return false;
  }

  return true;
}

/**
 * Delete all read notifications
 */
export async function deleteAllRead(user_id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', user_id)
    .eq('is_read', true);

  if (error) {
    console.error('[Notifications Service] Error deleting read notifications:', error);
    return false;
  }

  return true;
}

