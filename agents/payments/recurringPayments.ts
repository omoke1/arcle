/**
 * Recurring/Subscription Payments
 * 
 * Handles recurring payments and subscriptions
 */

import { INERAAgent } from '@/agents/inera';
import {
  listSubscriptions,
  addSubscription,
  scheduleNext,
  pauseSubscription as pauseSubscriptionApi,
  resumeSubscription as resumeSubscriptionApi,
  removeSubscription,
  type Subscription,
} from '@/lib/subscriptions';
import type { ExecutionResult } from '@/lib/wallet/sessionKeys/delegateExecution';

export interface RecurringPaymentParams {
  walletId: string;
  userId: string;
  userToken: string;
  merchant: string;
  amount: string;
  currency?: 'USDC' | 'EURC';
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfMonth?: number; // For monthly
  weekday?: number; // 0-6 for weekly
  autoRenew?: boolean;
  remindBeforeMs?: number;
}

/**
 * Create a recurring payment/subscription
 */
export async function createRecurringPayment(params: RecurringPaymentParams): Promise<Subscription> {
  const nextChargeAt = calculateNextChargeDate(params);

  return await addSubscription({
    userId: params.userId,
    walletId: params.walletId,
    merchant: params.merchant,
    amount: params.amount,
    currency: params.currency || "USDC",
    frequency: params.frequency,
    dayOfMonth: params.dayOfMonth,
    weekday: params.weekday,
    nextChargeAt,
    autoRenew: params.autoRenew !== false,
    remindBeforeMs: params.remindBeforeMs || 48 * 60 * 60 * 1000,
    paused: false,
  });
}

/**
 * Execute a recurring payment
 */
export async function executeRecurringPayment(
  subscription: Subscription,
  walletId: string,
  userId: string,
  userToken: string,
  destinationAddress: string
): Promise<ExecutionResult> {
  const inera = new INERAAgent();
  
  const result = await inera.executePayment({
    walletId,
    userId,
    userToken,
    amount: subscription.amount,
    destinationAddress,
  });

  if (result.success) {
    await scheduleNext(subscription);
  }

  return result;
}

/**
 * Calculate next charge date based on frequency
 */
function calculateNextChargeDate(params: RecurringPaymentParams): number {
  const now = Date.now();
  
  switch (params.frequency) {
    case 'daily':
      return now + 24 * 60 * 60 * 1000; // Next day
      
    case 'weekly':
      const currentDay = new Date(now).getDay();
      const targetDay = params.weekday ?? currentDay;
      const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;
      return now + daysUntilTarget * 24 * 60 * 60 * 1000;
      
    case 'monthly':
      const currentDate = new Date(now);
      const targetDayOfMonth = params.dayOfMonth ?? currentDate.getDate();
      const nextMonth = new Date(currentDate);
      nextMonth.setMonth(currentDate.getMonth() + 1);
      nextMonth.setDate(targetDayOfMonth);
      return nextMonth.getTime();
      
    default:
      return now + 30 * 24 * 60 * 60 * 1000; // Default to 30 days
  }
}

/**
 * Get all subscriptions for a user
 */
export async function getUserSubscriptions(userId: string): Promise<Subscription[]> {
  return await listSubscriptions(userId);
}

/**
 * Pause a subscription
 */
export async function pauseSubscription(subscriptionId: string): Promise<Subscription> {
  return await pauseSubscriptionApi(subscriptionId);
}

/**
 * Resume a subscription
 */
export async function resumeSubscription(subscriptionId: string): Promise<Subscription> {
  return await resumeSubscriptionApi(subscriptionId);
}

/**
 * Cancel a subscription
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await removeSubscription(subscriptionId);
}

