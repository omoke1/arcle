/**
 * Invoice Service
 * 
 * Manages invoice creation, tracking, and financing
 */

import crypto from "crypto";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  recipient: string; // Address or name
  recipientAddress?: string; // Wallet address if available
  amount: string;
  currency: string; // USDC, EURC, etc.
  description?: string;
  dueDate: string; // ISO date string
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  createdAt: string;
  paidAt?: string;
  paymentHash?: string;
  earlyPaymentDiscount?: {
    percentage: number;
    daysBeforeDue: number;
  };
  metadata?: {
    merchant?: string;
    category?: string;
    tags?: string[];
  };
}

// Store invoices in localStorage (in production, use a database)
const INVOICES_STORAGE_KEY = "arcle_invoices";

/**
 * Create a new invoice
 */
export function createInvoice(invoice: Omit<Invoice, "id" | "invoiceNumber" | "createdAt" | "status">): Invoice {
  const invoices = getAllInvoices();
  
  // Generate invoice number
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, "0")}`;
  
  const newInvoice: Invoice = {
    ...invoice,
    id: crypto.randomUUID(),
    invoiceNumber,
    status: "draft",
    createdAt: new Date().toISOString(),
  };
  
  invoices.push(newInvoice);
  saveInvoices(invoices);
  
  return newInvoice;
}

/**
 * Get all invoices
 */
export function getAllInvoices(): Invoice[] {
  if (typeof window === "undefined") {
    return [];
  }
  
  try {
    const stored = localStorage.getItem(INVOICES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Get invoice by ID
 */
export function getInvoiceById(id: string): Invoice | null {
  const invoices = getAllInvoices();
  return invoices.find(inv => inv.id === id) || null;
}

/**
 * Get invoice by invoice number
 */
export function getInvoiceByNumber(invoiceNumber: string): Invoice | null {
  const invoices = getAllInvoices();
  return invoices.find(inv => inv.invoiceNumber === invoiceNumber) || null;
}

/**
 * Update invoice
 */
export function updateInvoice(id: string, updates: Partial<Invoice>): Invoice | null {
  const invoices = getAllInvoices();
  const index = invoices.findIndex(inv => inv.id === id);
  
  if (index === -1) {
    return null;
  }
  
  invoices[index] = { ...invoices[index], ...updates };
  saveInvoices(invoices);
  
  return invoices[index];
}

/**
 * Delete invoice
 */
export function deleteInvoice(id: string): boolean {
  const invoices = getAllInvoices();
  const filtered = invoices.filter(inv => inv.id !== id);
  
  if (filtered.length === invoices.length) {
    return false; // Invoice not found
  }
  
  saveInvoices(filtered);
  return true;
}

/**
 * Mark invoice as paid
 */
export function markInvoiceAsPaid(id: string, paymentHash: string): Invoice | null {
  return updateInvoice(id, {
    status: "paid",
    paidAt: new Date().toISOString(),
    paymentHash,
  });
}

/**
 * Get invoices by status
 */
export function getInvoicesByStatus(status: Invoice["status"]): Invoice[] {
  const invoices = getAllInvoices();
  return invoices.filter(inv => inv.status === status);
}

/**
 * Get overdue invoices
 */
export function getOverdueInvoices(): Invoice[] {
  const invoices = getAllInvoices();
  const now = new Date();
  
  return invoices.filter(inv => {
    if (inv.status === "paid" || inv.status === "cancelled") {
      return false;
    }
    
    const dueDate = new Date(inv.dueDate);
    return dueDate < now;
  }).map(inv => {
    // Update status to overdue if not already
    if (inv.status !== "overdue") {
      updateInvoice(inv.id, { status: "overdue" });
      return { ...inv, status: "overdue" as const };
    }
    return inv;
  });
}

/**
 * Get outstanding invoices (sent but not paid)
 */
export function getOutstandingInvoices(): Invoice[] {
  const invoices = getAllInvoices();
  return invoices.filter(inv => 
    inv.status === "sent" || inv.status === "overdue"
  );
}

/**
 * Calculate early payment discount
 */
export function calculateEarlyPaymentDiscount(invoice: Invoice, daysBeforeDue: number): {
  discountAmount: string;
  finalAmount: string;
  savings: string;
} {
  if (!invoice.earlyPaymentDiscount) {
    return {
      discountAmount: "0.00",
      finalAmount: invoice.amount,
      savings: "0.00",
    };
  }
  
  const amount = parseFloat(invoice.amount);
  const discountPercent = invoice.earlyPaymentDiscount.percentage / 100;
  const discountAmount = amount * discountPercent;
  const finalAmount = amount - discountAmount;
  
  return {
    discountAmount: discountAmount.toFixed(6),
    finalAmount: finalAmount.toFixed(6),
    savings: discountAmount.toFixed(6),
  };
}

/**
 * Match payment to invoice
 */
export function matchPaymentToInvoice(
  recipientAddress: string,
  amount: string,
  currency: string
): Invoice | null {
  const invoices = getOutstandingInvoices();
  
  // Find matching invoice by recipient address and amount
  const match = invoices.find(inv => {
    const addressMatch = inv.recipientAddress?.toLowerCase() === recipientAddress.toLowerCase();
    const amountMatch = Math.abs(parseFloat(inv.amount) - parseFloat(amount)) < 0.01; // Allow small rounding
    const currencyMatch = inv.currency === currency;
    
    return addressMatch && amountMatch && currencyMatch;
  });
  
  return match || null;
}

/**
 * Save invoices to localStorage
 */
function saveInvoices(invoices: Invoice[]): void {
  if (typeof window === "undefined") {
    return;
  }
  
  try {
    localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(invoices));
  } catch (error) {
    console.error("Error saving invoices:", error);
  }
}

/**
 * Parse invoice from natural language
 */
export function parseInvoiceFromText(text: string): Partial<Invoice> {
  const invoice: Partial<Invoice> = {};
  
  // Extract amount
  const amountMatch = text.match(/\$?(\d+(?:\.\d+)?)\s*(?:usdc|eurc|dollars?|euros?)?/i);
  if (amountMatch) {
    invoice.amount = amountMatch[1];
  }
  
  // Extract currency
  if (/\b(usdc|usd|dollar)\b/i.test(text)) {
    invoice.currency = "USDC";
  } else if (/\b(eurc|eur|euro)\b/i.test(text)) {
    invoice.currency = "EURC";
  } else {
    invoice.currency = "USDC"; // Default
  }
  
  // Extract recipient
  const recipientMatch = text.match(/(?:to|for)\s+([a-zA-Z0-9\s\-]{2,50})/i);
  if (recipientMatch) {
    invoice.recipient = recipientMatch[1].trim();
  }
  
  // Extract due date
  const dateMatch = text.match(/(?:due|by)\s+(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|tomorrow|next\s+week|in\s+\d+\s+days?)/i);
  if (dateMatch) {
    // Simple date parsing (can be enhanced)
    invoice.dueDate = dateMatch[1];
  }
  
  // Extract description
  const descMatch = text.match(/for\s+([^,]+?)(?:,|$|due|to)/i);
  if (descMatch) {
    invoice.description = descMatch[1].trim();
  }
  
  return invoice;
}

