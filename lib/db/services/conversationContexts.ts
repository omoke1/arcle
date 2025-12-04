/**
 * Conversation Contexts Service
 * 
 * Manages AI conversation history persistence in Supabase
 */

import { getSupabaseAdmin } from '@/lib/db/supabase';
import type { ConversationContext } from '@/lib/ai/conversation-context';

export interface ConversationContextRecord {
  id: string;
  user_id: string;
  session_id: string;
  conversation_history: any[];
  created_at: string;
  updated_at: string;
}

/**
 * Get conversation context for a user and session
 */
export async function getConversationContext(
  userId: string,
  sessionId: string
): Promise<ConversationContext | null> {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('conversation_contexts')
      .select('*')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw error;
    }

    if (!data) return null;

    return {
      sessionId: data.session_id,
      conversationHistory: data.conversation_history || [],
    };
  } catch (error) {
    console.error('[Conversation Contexts] Error getting context:', error);
    return null;
  }
}

/**
 * Save conversation context
 */
export async function saveConversationContext(
  userId: string,
  sessionId: string,
  context: ConversationContext
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    
    const { error } = await supabase
      .from('conversation_contexts')
      .upsert({
        user_id: userId,
        session_id: sessionId,
        conversation_history: context.conversationHistory,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,session_id',
      });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('[Conversation Contexts] Error saving context:', error);
    throw error;
  }
}

/**
 * Delete conversation context
 */
export async function deleteConversationContext(
  userId: string,
  sessionId: string
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    
    const { error } = await supabase
      .from('conversation_contexts')
      .delete()
      .eq('user_id', userId)
      .eq('session_id', sessionId);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('[Conversation Contexts] Error deleting context:', error);
    throw error;
  }
}

/**
 * Get all conversation contexts for a user
 */
export async function getUserConversationContexts(
  userId: string
): Promise<ConversationContextRecord[]> {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('conversation_contexts')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('[Conversation Contexts] Error getting user contexts:', error);
    return [];
  }
}

