/**
 * Payment Roll Service
 * 
 * Manages automated payroll and recurring payments
 */

import crypto from "crypto";

export interface PaymentRoll {
  id: string;
  name: string;
  description?: string;
  recipients: PaymentRecipient[];
  frequency: "daily" | "weekly" | "biweekly" | "monthly" | "custom";
  nextPaymentDate: string; // ISO date string
  lastPaymentDate?: string;
  status: "active" | "paused" | "cancelled";
  createdAt: string;
  currency: string;
  totalAmount: string;
  metadata?: {
    category?: string;
    tags?: string[];
  };
}

export interface PaymentRecipient {
  id: string;
  name: string;
  address: string; // Wallet address
  amount: string;
  currency: string;
  description?: string;
}

export interface PaymentRollExecution {
  id: string;
  paymentRollId: string;
  executedAt: string;
  status: "pending" | "completed" | "failed";
  transactions: Array<{
    recipientId: string;
    transactionHash?: string;
    status: "pending" | "completed" | "failed";
    error?: string;
  }>;
}

// Store payment rolls in localStorage
const PAYMENT_ROLLS_STORAGE_KEY = "arcle_payment_rolls";
const PAYMENT_EXECUTIONS_STORAGE_KEY = "arcle_payment_executions";

/**
 * Create a new payment roll
 */
export function createPaymentRoll(roll: Omit<PaymentRoll, "id" | "createdAt" | "status" | "totalAmount">): PaymentRoll {
  const rolls = getAllPaymentRolls();
  
  // Calculate total amount
  const totalAmount = roll.recipients.reduce((sum, rec) => {
    return sum + parseFloat(rec.amount);
  }, 0).toFixed(6);
  
  const newRoll: PaymentRoll = {
    ...roll,
    id: crypto.randomUUID(),
    status: "active",
    createdAt: new Date().toISOString(),
    totalAmount,
  };
  
  rolls.push(newRoll);
  savePaymentRolls(rolls);
  
  return newRoll;
}

/**
 * Get all payment rolls
 */
export function getAllPaymentRolls(): PaymentRoll[] {
  if (typeof window === "undefined") {
    return [];
  }
  
  try {
    const stored = localStorage.getItem(PAYMENT_ROLLS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Get payment roll by ID
 */
export function getPaymentRollById(id: string): PaymentRoll | null {
  const rolls = getAllPaymentRolls();
  return rolls.find(roll => roll.id === id) || null;
}

/**
 * Update payment roll
 */
export function updatePaymentRoll(id: string, updates: Partial<PaymentRoll>): PaymentRoll | null {
  const rolls = getAllPaymentRolls();
  const index = rolls.findIndex(roll => roll.id === id);
  
  if (index === -1) {
    return null;
  }
  
  // Recalculate total if recipients changed
  if (updates.recipients) {
    const totalAmount = updates.recipients.reduce((sum, rec) => {
      return sum + parseFloat(rec.amount);
    }, 0).toFixed(6);
    updates.totalAmount = totalAmount;
  }
  
  rolls[index] = { ...rolls[index], ...updates };
  savePaymentRolls(rolls);
  
  return rolls[index];
}

/**
 * Delete payment roll
 */
export function deletePaymentRoll(id: string): boolean {
  const rolls = getAllPaymentRolls();
  const filtered = rolls.filter(roll => roll.id !== id);
  
  if (filtered.length === rolls.length) {
    return false;
  }
  
  savePaymentRolls(filtered);
  return true;
}

/**
 * Get payment rolls due for execution
 */
export function getDuePaymentRolls(): PaymentRoll[] {
  const rolls = getAllPaymentRolls();
  const now = new Date();
  
  return rolls.filter(roll => {
    if (roll.status !== "active") {
      return false;
    }
    
    const nextPayment = new Date(roll.nextPaymentDate);
    return nextPayment <= now;
  });
}

/**
 * Calculate next payment date based on frequency
 */
export function calculateNextPaymentDate(
  lastPaymentDate: string | Date,
  frequency: PaymentRoll["frequency"]
): Date {
  const lastDate = typeof lastPaymentDate === "string" 
    ? new Date(lastPaymentDate) 
    : lastPaymentDate;
  
  const nextDate = new Date(lastDate);
  
  switch (frequency) {
    case "daily":
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case "weekly":
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case "biweekly":
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case "monthly":
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    default:
      nextDate.setDate(nextDate.getDate() + 30); // Default to monthly
  }
  
  return nextDate;
}

/**
 * Record payment roll execution
 */
export function recordPaymentRollExecution(execution: Omit<PaymentRollExecution, "id" | "executedAt">): PaymentRollExecution {
  const executions = getAllPaymentExecutions();
  
  const newExecution: PaymentRollExecution = {
    ...execution,
    id: crypto.randomUUID(),
    executedAt: new Date().toISOString(),
  };
  
  executions.push(newExecution);
  savePaymentExecutions(executions);
  
  // Update payment roll's last payment date and next payment date
  const roll = getPaymentRollById(execution.paymentRollId);
  if (roll && execution.status === "completed") {
    const nextDate = calculateNextPaymentDate(new Date(), roll.frequency);
    updatePaymentRoll(roll.id, {
      lastPaymentDate: newExecution.executedAt,
      nextPaymentDate: nextDate.toISOString(),
    });
  }
  
  return newExecution;
}

/**
 * Get all payment executions
 */
export function getAllPaymentExecutions(): PaymentRollExecution[] {
  if (typeof window === "undefined") {
    return [];
  }
  
  try {
    const stored = localStorage.getItem(PAYMENT_EXECUTIONS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Get executions for a payment roll
 */
export function getExecutionsForPaymentRoll(paymentRollId: string): PaymentRollExecution[] {
  const executions = getAllPaymentExecutions();
  return executions.filter(exec => exec.paymentRollId === paymentRollId);
}

/**
 * Save payment rolls to localStorage
 */
function savePaymentRolls(rolls: PaymentRoll[]): void {
  if (typeof window === "undefined") {
    return;
  }
  
  try {
    localStorage.setItem(PAYMENT_ROLLS_STORAGE_KEY, JSON.stringify(rolls));
  } catch (error) {
    console.error("Error saving payment rolls:", error);
  }
}

/**
 * Save payment executions to localStorage
 */
function savePaymentExecutions(executions: PaymentRollExecution[]): void {
  if (typeof window === "undefined") {
    return;
  }
  
  try {
    localStorage.setItem(PAYMENT_EXECUTIONS_STORAGE_KEY, JSON.stringify(executions));
  } catch (error) {
    console.error("Error saving payment executions:", error);
  }
}

/**
 * Parse payment roll from natural language
 */
export function parsePaymentRollFromText(text: string): Partial<PaymentRoll> {
  const roll: Partial<PaymentRoll> = {
    recipients: [],
  };
  
  // Extract frequency
  if (/\b(daily|every\s+day)\b/i.test(text)) {
    roll.frequency = "daily";
  } else if (/\b(weekly|every\s+week)\b/i.test(text)) {
    roll.frequency = "weekly";
  } else if (/\b(biweekly|every\s+2\s+weeks|every\s+two\s+weeks)\b/i.test(text)) {
    roll.frequency = "biweekly";
  } else if (/\b(monthly|every\s+month)\b/i.test(text)) {
    roll.frequency = "monthly";
  } else {
    roll.frequency = "monthly"; // Default
  }
  
  // Extract recipients (simple pattern matching)
  const recipientPattern = /(?:pay|send)\s+\$?(\d+(?:\.\d+)?)\s*(?:to|for)\s+([a-zA-Z0-9\s\-]{2,50})/gi;
  let match;
  while ((match = recipientPattern.exec(text)) !== null) {
    roll.recipients!.push({
      id: crypto.randomUUID(),
      name: match[2].trim(),
      address: "", // Will need to be filled from contacts
      amount: match[1],
      currency: "USDC",
    });
  }
  
  // Extract name/description
  const nameMatch = text.match(/(?:payroll|payment\s+roll|pay)\s+(?:for|to)\s+([^,]+?)(?:,|$)/i);
  if (nameMatch) {
    roll.name = nameMatch[1].trim();
  } else {
    roll.name = `Payment Roll ${new Date().toLocaleDateString()}`;
  }
  
  return roll;
}

