export interface Subscription {
  id: string;
  userId: string;
  walletId: string;
  merchant: string;
  amount: string;
  currency: "USDC" | "EURC";
  frequency: "daily" | "weekly" | "monthly";
  dayOfMonth?: number;
  weekday?: number;
  nextChargeAt: number;
  autoRenew: boolean;
  remindBeforeMs?: number;
  paused: boolean;
  createdAt: number;
  lastReminderShownAt?: number;
}

export const SUBSCRIPTIONS_UPDATED_EVENT = "arcle:subscriptions-updated";

interface SubscriptionRecord {
  id: string;
  user_id: string;
  wallet_id: string;
  merchant: string;
  amount: string;
  currency: string;
  frequency: string;
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

function notifySubscriptionsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SUBSCRIPTIONS_UPDATED_EVENT));
}

function mapSubscription(record: SubscriptionRecord): Subscription {
  return {
    id: record.id,
    userId: record.user_id,
    walletId: record.wallet_id,
    merchant: record.merchant,
    amount: record.amount,
    currency: (record.currency as Subscription["currency"]) || "USDC",
    frequency: record.frequency as Subscription["frequency"],
    dayOfMonth: record.day_of_month ?? undefined,
    weekday: record.weekday ?? undefined,
    nextChargeAt: new Date(record.next_charge_at).getTime(),
    autoRenew: record.auto_renew,
    remindBeforeMs: record.remind_before_ms ?? undefined,
    paused: record.paused,
    createdAt: new Date(record.created_at).getTime(),
    lastReminderShownAt: record.last_reminder_shown_at
      ? new Date(record.last_reminder_shown_at).getTime()
      : undefined,
  };
}

async function handleResponse(response: Response) {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || response.statusText);
  }
  return response.json();
}

export async function listSubscriptions(userId?: string): Promise<Subscription[]> {
  if (!userId) return [];
  const res = await fetch(`/api/subscriptions?userId=${encodeURIComponent(userId)}`, {
    method: "GET",
    cache: "no-store",
  });
  const data = await handleResponse(res);
  return (data.subscriptions || []).map(mapSubscription);
}

export async function addSubscription(params: {
  userId: string;
  walletId: string;
  merchant: string;
  amount: string;
  currency?: "USDC" | "EURC";
  frequency: "daily" | "weekly" | "monthly";
  dayOfMonth?: number;
  weekday?: number;
  nextChargeAt: number;
  autoRenew?: boolean;
  remindBeforeMs?: number;
  paused?: boolean;
}): Promise<Subscription> {
  const res = await fetch("/api/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: params.userId,
      walletId: params.walletId,
      merchant: params.merchant,
      amount: params.amount,
      currency: params.currency || "USDC",
      frequency: params.frequency,
      dayOfMonth: params.dayOfMonth,
      weekday: params.weekday,
      nextChargeAt: params.nextChargeAt,
      autoRenew: params.autoRenew,
      remindBeforeMs: params.remindBeforeMs,
      paused: params.paused,
    }),
  });
  const data = await handleResponse(res);
  notifySubscriptionsUpdated();
  return mapSubscription(data.subscription);
}

export async function updateSubscription(
  id: string,
  updates: Partial<{
    merchant: string;
    amount: string;
    currency: "USDC" | "EURC";
    frequency: "daily" | "weekly" | "monthly";
    dayOfMonth?: number;
    weekday?: number;
    nextChargeAt?: number;
    autoRenew?: boolean;
    remindBeforeMs?: number;
    paused?: boolean;
    lastReminderShownAt?: number;
  }>
): Promise<Subscription> {
  const res = await fetch(`/api/subscriptions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await handleResponse(res);
  notifySubscriptionsUpdated();
  return mapSubscription(data.subscription);
}

export async function removeSubscription(id: string): Promise<void> {
  await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
  notifySubscriptionsUpdated();
}

export async function findDueReminders(userId: string): Promise<Subscription[]> {
  if (!userId) return [];
  const res = await fetch(
    `/api/subscriptions/due?userId=${encodeURIComponent(userId)}&type=reminder`,
    { cache: "no-store" }
  );
  const data = await handleResponse(res);
  return (data.subscriptions || []).map(mapSubscription);
}

export async function findDueCharges(userId: string): Promise<Subscription[]> {
  if (!userId) return [];
  const res = await fetch(
    `/api/subscriptions/due?userId=${encodeURIComponent(userId)}&type=charge`,
    { cache: "no-store" }
  );
  const data = await handleResponse(res);
  return (data.subscriptions || []).map(mapSubscription);
}

function calculateNextChargeAt(sub: Subscription): number {
  const current = new Date(sub.nextChargeAt);
  if (sub.frequency === "monthly") {
    current.setMonth(current.getMonth() + 1);
  } else if (sub.frequency === "weekly") {
    current.setDate(current.getDate() + 7);
  } else {
    current.setDate(current.getDate() + 1);
  }
  return current.getTime();
}

export async function scheduleNext(sub: Subscription): Promise<Subscription> {
  const nextChargeAt = calculateNextChargeAt(sub);
  return await updateSubscription(sub.id, {
    nextChargeAt,
    lastReminderShownAt: undefined,
  });
}

export async function pauseSubscription(id: string): Promise<Subscription> {
  return await updateSubscription(id, { paused: true });
}

export async function resumeSubscription(id: string): Promise<Subscription> {
  return await updateSubscription(id, { paused: false });
}
