/**
 * Scheduled Payments System
 * 
 * Handles one-time scheduled payments (different from subscriptions which are recurring)
 */

export interface ScheduledPayment {
  id: string;
  amount: string;
  currency: "USDC" | "EURC";
  to: string; // Recipient address
  scheduledFor: number; // ms epoch timestamp
  status: "pending" | "executed" | "cancelled" | "failed";
  walletId?: string;
  walletAddress?: string;
  createdAt: number;
  executedAt?: number;
  transactionHash?: string;
  failureReason?: string;
}

const STORAGE_KEY = "arcle_scheduled_payments";

function readAll(): ScheduledPayment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeAll(items: ScheduledPayment[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/**
 * List all scheduled payments
 */
export function listScheduledPayments(): ScheduledPayment[] {
  return readAll().filter(p => p.status === "pending");
}

/**
 * Get all scheduled payments (including executed/cancelled)
 */
export function getAllScheduledPayments(): ScheduledPayment[] {
  return readAll();
}

/**
 * Create a new scheduled payment
 */
export function createScheduledPayment(
  payment: Omit<ScheduledPayment, "id" | "status" | "createdAt">
): ScheduledPayment {
  const all = readAll();
  const newPayment: ScheduledPayment = {
    id: crypto.randomUUID(),
    status: "pending",
    createdAt: Date.now(),
    ...payment,
  };
  all.push(newPayment);
  writeAll(all);
  return newPayment;
}

/**
 * Update a scheduled payment
 */
export function updateScheduledPayment(
  id: string,
  patch: Partial<ScheduledPayment>
): ScheduledPayment | null {
  const all = readAll();
  const idx = all.findIndex(p => p.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch };
  writeAll(all);
  return all[idx];
}

/**
 * Cancel a scheduled payment
 */
export function cancelScheduledPayment(id: string): boolean {
  const payment = updateScheduledPayment(id, { status: "cancelled" });
  return payment !== null;
}

/**
 * Delete a scheduled payment
 */
export function deleteScheduledPayment(id: string) {
  const all = readAll().filter(p => p.id !== id);
  writeAll(all);
}

/**
 * Find payments that are due for execution
 */
export function findDuePayments(now: number = Date.now()): ScheduledPayment[] {
  return readAll().filter(
    p => p.status === "pending" && p.scheduledFor <= now
  );
}

/**
 * Mark a payment as executed
 */
export function markAsExecuted(
  id: string,
  transactionHash: string
): ScheduledPayment | null {
  return updateScheduledPayment(id, {
    status: "executed",
    executedAt: Date.now(),
    transactionHash,
  });
}

/**
 * Mark a payment as failed
 */
export function markAsFailed(
  id: string,
  failureReason: string
): ScheduledPayment | null {
  return updateScheduledPayment(id, {
    status: "failed",
    failureReason,
  });
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
    
    // Parse date
    const lowerDate = dateStr.toLowerCase().trim();
    if (lowerDate === "today") {
      date = new Date(now);
    } else if (lowerDate === "tomorrow") {
      date = new Date(now);
      date.setDate(date.getDate() + 1);
    } else if (lowerDate.startsWith("next ")) {
      // "next Monday", "next Friday", etc.
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
        if (daysAhead <= 0) daysAhead += 7; // Next week
        date.setDate(date.getDate() + daysAhead);
      }
    } else if (lowerDate.startsWith("in ")) {
      // "in 2 days", "in 1 week"
      const match = lowerDate.match(/in (\d+)\s*(day|days|week|weeks)/);
      if (match) {
        const num = parseInt(match[1]);
        const unit = match[2];
        date = new Date(now);
        if (unit.includes("week")) {
          date.setDate(date.getDate() + (num * 7));
        } else {
          date.setDate(date.getDate() + num);
        }
      }
    } else {
      // Try to parse as ISO date or other format
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        date = parsed;
      }
    }
    
    // Parse time
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
      // Default to current time if not specified
      date.setHours(now.getHours(), now.getMinutes(), 0, 0);
    }
    
    // If the scheduled time is in the past, move to next day
    if (date.getTime() <= now.getTime()) {
      date.setDate(date.getDate() + 1);
    }
    
    return date.getTime();
  } catch (error) {
    console.error("Error parsing schedule time:", error);
    return null;
  }
}

