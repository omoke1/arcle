/**
 * Address History Service
 * 
 * Manages transaction history per address for risk scoring
 */

import { getSupabaseAdmin } from '@/lib/db/supabase';

export interface AddressHistoryRecord {
  id: string;
  user_id: string;
  address: string;
  chain: string;
  first_seen_at: string;
  last_seen_at: string;
  transaction_count: number;
  total_amount_sent: string;
  total_amount_received: string;
  risk_score: number;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface AddressHistory {
  address: string;
  chain: string;
  firstSeenAt: number;
  lastSeenAt: number;
  transactionCount: number;
  totalAmountSent: string;
  totalAmountReceived: string;
  riskScore: number;
  metadata?: any;
}

/**
 * Get address history for a user, address, and chain
 */
export async function getAddressHistory(
  userId: string,
  address: string,
  chain: string
): Promise<AddressHistory | null> {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('address_history')
      .select('*')
      .eq('user_id', userId)
      .eq('address', address)
      .eq('chain', chain)
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
      address: data.address,
      chain: data.chain,
      firstSeenAt: new Date(data.first_seen_at).getTime(),
      lastSeenAt: new Date(data.last_seen_at).getTime(),
      transactionCount: data.transaction_count || 0,
      totalAmountSent: data.total_amount_sent || '0',
      totalAmountReceived: data.total_amount_received || '0',
      riskScore: data.risk_score || 0,
      metadata: data.metadata,
    };
  } catch (error) {
    console.error('[Address History] Error getting history:', error);
    return null;
  }
}

/**
 * Update address history with a new transaction
 */
export async function updateAddressHistory(
  userId: string,
  address: string,
  chain: string,
  transaction: {
    amount: string;
    isSent: boolean; // true if user sent to this address, false if received from
    timestamp: number;
  }
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    
    // Get existing history
    const existing = await getAddressHistory(userId, address, chain);
    
    const now = new Date().toISOString();
    const firstSeenAt = existing 
      ? new Date(existing.firstSeenAt).toISOString()
      : now;
    
    const transactionCount = (existing?.transactionCount || 0) + 1;
    const totalAmountSent = existing 
      ? (BigInt(existing.totalAmountSent || '0') + (transaction.isSent ? BigInt(transaction.amount) : 0n)).toString()
      : (transaction.isSent ? transaction.amount : '0');
    const totalAmountReceived = existing
      ? (BigInt(existing.totalAmountReceived || '0') + (!transaction.isSent ? BigInt(transaction.amount) : 0n)).toString()
      : (!transaction.isSent ? transaction.amount : '0');

    // Calculate risk score (simple heuristic - can be improved)
    const riskScore = calculateRiskScore({
      transactionCount,
      totalAmountSent,
      totalAmountReceived,
      firstSeenAt: new Date(firstSeenAt).getTime(),
      lastSeenAt: transaction.timestamp,
    });

    const { error } = await supabase
      .from('address_history')
      .upsert({
        user_id: userId,
        address,
        chain,
        first_seen_at: firstSeenAt,
        last_seen_at: new Date(transaction.timestamp).toISOString(),
        transaction_count: transactionCount,
        total_amount_sent: totalAmountSent,
        total_amount_received: totalAmountReceived,
        risk_score: riskScore,
        updated_at: now,
      }, {
        onConflict: 'user_id,address,chain',
      });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('[Address History] Error updating history:', error);
    throw error;
  }
}

/**
 * Calculate risk score based on address history
 * Simple heuristic - can be improved with ML
 */
function calculateRiskScore(params: {
  transactionCount: number;
  totalAmountSent: string;
  totalAmountReceived: string;
  firstSeenAt: number;
  lastSeenAt: number;
}): number {
  let score = 0;
  
  // More transactions = lower risk (more established)
  if (params.transactionCount > 10) score -= 20;
  else if (params.transactionCount > 5) score -= 10;
  else if (params.transactionCount === 1) score += 10; // First transaction
  
  // Time since first seen (longer = lower risk)
  const daysSinceFirstSeen = (params.lastSeenAt - params.firstSeenAt) / (1000 * 60 * 60 * 24);
  if (daysSinceFirstSeen > 30) score -= 15;
  else if (daysSinceFirstSeen > 7) score -= 5;
  else if (daysSinceFirstSeen < 1) score += 15; // Very new address
  
  // Large amounts = higher risk
  const totalSent = BigInt(params.totalAmountSent || '0');
  const totalReceived = BigInt(params.totalAmountReceived || '0');
  const largeAmount = BigInt('1000000000000'); // 1M USDC (6 decimals)
  if (totalSent > largeAmount || totalReceived > largeAmount) {
    score += 5;
  }
  
  // Clamp score between 0 and 100
  return Math.max(0, Math.min(100, 50 + score));
}

/**
 * Get all address history for a user
 */
export async function getUserAddressHistory(
  userId: string
): Promise<AddressHistoryRecord[]> {
  try {
    const supabase = getSupabaseAdmin();
    
    const { data, error } = await supabase
      .from('address_history')
      .select('*')
      .eq('user_id', userId)
      .order('last_seen_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('[Address History] Error getting user history:', error);
    return [];
  }
}

