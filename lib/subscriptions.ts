export interface Subscription {
  id: string;
  merchant: string; // e.g., Netflix
  amount: string; // e.g., "15.00"
  currency: "USDC" | "EURC";
  frequency: "daily" | "weekly" | "monthly"; // MVP
  dayOfMonth?: number; // for monthly
  weekday?: number; // 0-6 for weekly
  nextChargeAt: number; // ms epoch
  autoRenew: boolean;
  remindBeforeMs: number; // e.g., 48h (2 days)
  paused: boolean;
  createdAt: number;
  lastReminderShownAt?: number; // Track when reminder was last shown
}

const STORAGE_KEY = "arcle_subscriptions";

function readAll(): Subscription[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeAll(items: Subscription[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function listSubscriptions(): Subscription[] {
  return readAll();
}

export function addSubscription(sub: Omit<Subscription, "id" | "createdAt">): Subscription {
  const all = readAll();
  const newSub: Subscription = { id: crypto.randomUUID(), createdAt: Date.now(), ...sub } as Subscription;
  all.push(newSub);
  writeAll(all);
  return newSub;
}

export function updateSubscription(id: string, patch: Partial<Subscription>): Subscription | null {
  const all = readAll();
  const idx = all.findIndex(s => s.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch };
  writeAll(all);
  return all[idx];
}

export function removeSubscription(id: string) {
  const all = readAll().filter(s => s.id !== id);
  writeAll(all);
}

export function findDueReminders(now = Date.now()): Subscription[] {
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000; // 2 days in milliseconds
  return readAll().filter(s => {
    if (s.paused || !s.autoRenew) return false;
    
    const timeUntilDue = s.nextChargeAt - now;
    // Must be within 2 days before due date, but not past due
    if (timeUntilDue <= 0 || timeUntilDue > TWO_DAYS_MS) return false;
    
    // Only show reminder if we haven't shown one yet, or if the last reminder was shown before the 2-day window
    const reminderWindowStart = s.nextChargeAt - TWO_DAYS_MS;
    if (s.lastReminderShownAt && s.lastReminderShownAt >= reminderWindowStart) {
      return false; // Already shown reminder for this cycle
    }
    
    return true;
  });
}

export function findDueCharges(now = Date.now()): Subscription[] {
  return readAll().filter(s => !s.paused && now >= s.nextChargeAt);
}

export function scheduleNext(sub: Subscription): Subscription {
  let next = sub.nextChargeAt;
  const d = new Date(next);
  if (sub.frequency === "monthly") {
    d.setMonth(d.getMonth() + 1);
  } else if (sub.frequency === "weekly") {
    d.setDate(d.getDate() + 7);
  } else {
    d.setDate(d.getDate() + 1);
  }
  // Reset reminder tracking when scheduling next charge
  return { ...sub, nextChargeAt: d.getTime(), lastReminderShownAt: undefined };
}
