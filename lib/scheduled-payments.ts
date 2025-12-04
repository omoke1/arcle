/**
 * Scheduled Payments System (Supabase-backed)
 */

export interface ScheduledPayment {
  id: string;
  amount: string;
  currency: "USDC" | "EURC";
  toAddress: string;
  scheduledFor: number;
  status: "pending" | "executed" | "cancelled" | "failed";
  walletId?: string;
  createdAt: number;
  executedAt?: number;
  transactionHash?: string;
  failureReason?: string;
}

export const SCHEDULE_UPDATED_EVENT = "arcle:scheduled-payments-updated";

interface ScheduledPaymentRecord {
  id: string;
  user_id: string;
  wallet_id: string;
  amount: string;
  currency: string;
  to_address: string;
  scheduled_for: string;
  status: string;
  executed_at?: string;
  transaction_hash?: string;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
}

function notifyScheduledPaymentsUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SCHEDULE_UPDATED_EVENT));
}

function mapScheduledPayment(record: ScheduledPaymentRecord): ScheduledPayment {
  return {
    id: record.id,
    amount: record.amount,
    currency: (record.currency as ScheduledPayment["currency"]) || "USDC",
    toAddress: record.to_address,
    scheduledFor: new Date(record.scheduled_for).getTime(),
    status: record.status as ScheduledPayment["status"],
    walletId: record.wallet_id,
    createdAt: new Date(record.created_at).getTime(),
    executedAt: record.executed_at ? new Date(record.executed_at).getTime() : undefined,
    transactionHash: record.transaction_hash || undefined,
    failureReason: record.failure_reason || undefined,
  };
}

async function handleResponse(response: Response) {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || response.statusText);
  }
  return response.json();
}

export async function listScheduledPayments(userId?: string): Promise<ScheduledPayment[]> {
  if (!userId) return [];
  const res = await fetch(`/api/schedules?userId=${encodeURIComponent(userId)}`, {
    method: "GET",
    cache: "no-store",
  });
  const data = await handleResponse(res);
  return (data.payments || []).map(mapScheduledPayment);
}

export async function createScheduledPayment(params: {
  userId: string;
  walletId: string;
  amount: string;
  currency?: "USDC" | "EURC";
  to: string;
  scheduledFor: number;
}): Promise<ScheduledPayment> {
  const res = await fetch("/api/schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: params.userId,
      walletId: params.walletId,
      amount: params.amount,
      currency: params.currency || "USDC",
      toAddress: params.to,
      scheduledFor: params.scheduledFor,
    }),
  });
  const data = await handleResponse(res);
  notifyScheduledPaymentsUpdated();
  return mapScheduledPayment(data.payment);
}

export async function findDuePayments(
  userId: string,
  before: number = Date.now()
): Promise<ScheduledPayment[]> {
  if (!userId) return [];
  const res = await fetch(
    `/api/schedules/due?userId=${encodeURIComponent(userId)}&before=${before}`,
    { method: "GET", cache: "no-store" }
  );
  const data = await handleResponse(res);
  return (data.payments || []).map(mapScheduledPayment);
}

async function updateScheduledPaymentRequest(
  scheduleId: string,
  payload: Record<string, any>
): Promise<ScheduledPayment> {
  const res = await fetch(`/api/schedules/${scheduleId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handleResponse(res);
  notifyScheduledPaymentsUpdated();
  return mapScheduledPayment(data.payment);
}

export async function markAsExecuted(
  id: string,
  transactionHash: string
): Promise<ScheduledPayment> {
  return await updateScheduledPaymentRequest(id, {
    status: "executed",
    transactionHash,
  });
}

export async function markAsFailed(
  id: string,
  failureReason: string
): Promise<ScheduledPayment> {
  return await updateScheduledPaymentRequest(id, {
    status: "failed",
    failureReason,
  });
}

export async function cancelScheduledPayment(id: string): Promise<ScheduledPayment> {
  return await updateScheduledPaymentRequest(id, { status: "cancelled" });
}

export async function deleteScheduledPayment(id: string): Promise<void> {
  await fetch(`/api/schedules/${id}`, { method: "DELETE" });
  notifyScheduledPaymentsUpdated();
}

/**
 * Parse date/time string to timestamp
 * Supports formats like:
 * - "tomorrow at 3pm"
 * - "next Monday at 9am"
 * - "2024-12-25 at 10:30"
 * - "in 2 days at 2pm"
 */
export function parseScheduleTime(
  dateStr: string,
  timeStr: string
): number | null {
  try {
    const now = new Date();
    let date = new Date(now);
    
    const lowerDate = dateStr.toLowerCase().trim();
    if (lowerDate === "today") {
      date = new Date(now);
    } else if (lowerDate === "tomorrow") {
      date = new Date(now);
      date.setDate(date.getDate() + 1);
    } else if (lowerDate.startsWith("next ")) {
      const dayName = lowerDate.replace("next ", "").trim();
      const dayMap: Record<string, number> = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6,
      };
      const targetDay = dayMap[dayName.toLowerCase()];
      if (targetDay !== undefined) {
        date = new Date(now);
        const currentDay = date.getDay();
        let daysAhead = targetDay - currentDay;
        if (daysAhead <= 0) daysAhead += 7;
        date.setDate(date.getDate() + daysAhead);
      }
    } else if (lowerDate.startsWith("in ")) {
      const match = lowerDate.match(/in (\d+)\s*(day|days|week|weeks)/);
      if (match) {
        const num = parseInt(match[1]);
        const unit = match[2];
        date = new Date(now);
        if (unit.includes("week")) {
          date.setDate(date.getDate() + num * 7);
        } else {
          date.setDate(date.getDate() + num);
        }
      }
    } else {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        date = parsed;
      }
    }
    
    const lowerTime = timeStr.toLowerCase().trim();
    const timeMatch = lowerTime.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const period = timeMatch[3];
      
      if (period === "pm" && hours !== 12) {
        hours += 12;
      } else if (period === "am" && hours === 12) {
        hours = 0;
      }
      
      date.setHours(hours, minutes, 0, 0);
    } else {
      date.setHours(now.getHours(), now.getMinutes(), 0, 0);
    }
    
    if (date.getTime() <= now.getTime()) {
      date.setDate(date.getDate() + 1);
    }
    
    return date.getTime();
  } catch (error) {
    console.error("Error parsing schedule time:", error);
    return null;
  }
}

