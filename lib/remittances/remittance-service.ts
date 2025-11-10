/**
 * Remittance Service
 * 
 * Manages international money transfers with currency conversion
 */

import crypto from "crypto";
import { convertCurrency } from "@/lib/fx/fx-rates";

export interface Remittance {
  id: string;
  remittanceNumber: string;
  recipientName: string;
  recipientAddress?: string; // Wallet address if available
  recipientCountry: string;
  recipientCurrency: string; // Target currency (e.g., MXN, EUR)
  amount: string; // Amount in source currency (USDC)
  convertedAmount: string; // Amount in recipient currency
  exchangeRate: number;
  fee: string;
  totalAmount: string; // amount + fee
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: string;
  completedAt?: string;
  transactionHash?: string;
  metadata?: {
    purpose?: string;
    notes?: string;
    complianceChecked?: boolean;
  };
}

export interface RemittanceRecipient {
  id: string;
  name: string;
  address?: string;
  country: string;
  currency: string;
  preferredCurrency?: string;
  lastRemittanceDate?: string;
}

// Store remittances in localStorage
const REMITTANCES_STORAGE_KEY = "arcle_remittances";
const REMITTANCE_RECIPIENTS_STORAGE_KEY = "arcle_remittance_recipients";

// Country to currency mapping
const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  mexico: "MXN",
  "united states": "USD",
  canada: "CAD",
  "united kingdom": "GBP",
  germany: "EUR",
  france: "EUR",
  spain: "EUR",
  italy: "EUR",
  japan: "JPY",
  china: "CNY",
  india: "INR",
  brazil: "BRL",
  australia: "AUD",
  // Add more as needed
};

/**
 * Get currency for country
 */
export function getCurrencyForCountry(country: string): string {
  const countryLower = country.toLowerCase();
  
  // Direct match
  if (COUNTRY_CURRENCY_MAP[countryLower]) {
    return COUNTRY_CURRENCY_MAP[countryLower];
  }
  
  // Partial match
  for (const [key, currency] of Object.entries(COUNTRY_CURRENCY_MAP)) {
    if (countryLower.includes(key) || key.includes(countryLower)) {
      return currency;
    }
  }
  
  // Default to USD
  return "USD";
}

/**
 * Create a new remittance
 */
export async function createRemittance(
  remittance: Omit<Remittance, "id" | "remittanceNumber" | "createdAt" | "status" | "convertedAmount" | "exchangeRate" | "fee" | "totalAmount" | "recipientCurrency"> & {
    recipientCurrency?: string;
  }
): Promise<Remittance> {
  const remittances = getAllRemittances();
  
  // Generate remittance number
  const remittanceNumber = `REM-${new Date().getFullYear()}-${String(remittances.length + 1).padStart(4, "0")}`;
  
  // Determine target currency
  const targetCurrency = remittance.recipientCurrency || getCurrencyForCountry(remittance.recipientCountry);
  
  // Ensure recipientCurrency is set
  const remittanceWithCurrency = {
    ...remittance,
    recipientCurrency: targetCurrency,
  };
  
  // Convert amount (USDC to target currency)
  // Note: In production, this would use real FX rates
  // For now, we'll use approximate rates
  const conversion = await convertCurrency(remittance.amount, "USDC", targetCurrency);
  
  if (!conversion.success || !conversion.convertedAmount || !conversion.rate) {
    throw new Error("Failed to get exchange rate for remittance");
  }
  
  // Calculate fee (typically 0.5% - 2% for remittances)
  const feePercent = 0.01; // 1% fee
  const amountNum = parseFloat(remittance.amount);
  const fee = (amountNum * feePercent).toFixed(6);
  const totalAmount = (amountNum + parseFloat(fee)).toFixed(6);
  
  const newRemittance: Remittance = {
    ...remittanceWithCurrency,
    id: crypto.randomUUID(),
    remittanceNumber,
    convertedAmount: conversion.convertedAmount,
    exchangeRate: conversion.rate,
    fee,
    totalAmount,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  
  remittances.push(newRemittance);
  saveRemittances(remittances);
  
  return newRemittance;
}

/**
 * Get all remittances
 */
export function getAllRemittances(): Remittance[] {
  if (typeof window === "undefined") {
    return [];
  }
  
  try {
    const stored = localStorage.getItem(REMITTANCES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Get remittance by ID
 */
export function getRemittanceById(id: string): Remittance | null {
  const remittances = getAllRemittances();
  return remittances.find(rem => rem.id === id) || null;
}

/**
 * Update remittance
 */
export function updateRemittance(id: string, updates: Partial<Remittance>): Remittance | null {
  const remittances = getAllRemittances();
  const index = remittances.findIndex(rem => rem.id === id);
  
  if (index === -1) {
    return null;
  }
  
  remittances[index] = { ...remittances[index], ...updates };
  saveRemittances(remittances);
  
  return remittances[index];
}

/**
 * Mark remittance as completed
 */
export function markRemittanceAsCompleted(id: string, transactionHash: string): Remittance | null {
  return updateRemittance(id, {
    status: "completed",
    completedAt: new Date().toISOString(),
    transactionHash,
  });
}

/**
 * Save remittance recipient
 */
export function saveRemittanceRecipient(recipient: RemittanceRecipient): RemittanceRecipient {
  const recipients = getAllRemittanceRecipients();
  const existing = recipients.find(r => r.id === recipient.id);
  
  if (existing) {
    const index = recipients.findIndex(r => r.id === recipient.id);
    recipients[index] = { ...recipient, lastRemittanceDate: new Date().toISOString() };
  } else {
    recipients.push({ ...recipient, lastRemittanceDate: new Date().toISOString() });
  }
  
  saveRemittanceRecipients(recipients);
  return recipient;
}

/**
 * Get all remittance recipients
 */
export function getAllRemittanceRecipients(): RemittanceRecipient[] {
  if (typeof window === "undefined") {
    return [];
  }
  
  try {
    const stored = localStorage.getItem(REMITTANCE_RECIPIENTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Get recipient by name or address
 */
export function getRemittanceRecipientByName(name: string): RemittanceRecipient | null {
  const recipients = getAllRemittanceRecipients();
  return recipients.find(r => r.name.toLowerCase() === name.toLowerCase()) || null;
}

/**
 * Save functions
 */
function saveRemittances(remittances: Remittance[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REMITTANCES_STORAGE_KEY, JSON.stringify(remittances));
  } catch (error) {
    console.error("Error saving remittances:", error);
  }
}

function saveRemittanceRecipients(recipients: RemittanceRecipient[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REMITTANCE_RECIPIENTS_STORAGE_KEY, JSON.stringify(recipients));
  } catch (error) {
    console.error("Error saving remittance recipients:", error);
  }
}

/**
 * Parse remittance from natural language
 */
export function parseRemittanceFromText(text: string): Partial<Remittance> {
  const remittance: Partial<Remittance> = {};
  
  // Extract amount
  const amountMatch = text.match(/\$?(\d+(?:\.\d+)?)\s*(?:usdc|dollars?)?/i);
  if (amountMatch) {
    remittance.amount = amountMatch[1];
  }
  
  // Extract recipient name
  const recipientMatch = text.match(/(?:to|for)\s+([a-zA-Z\s]{2,50})(?:\s+in|\s+to|$)/i);
  if (recipientMatch) {
    remittance.recipientName = recipientMatch[1].trim();
  }
  
  // Extract country
  const countries = Object.keys(COUNTRY_CURRENCY_MAP);
  for (const country of countries) {
    if (text.toLowerCase().includes(country)) {
      remittance.recipientCountry = country;
      break;
    }
  }
  
  // Extract purpose/notes
  const purposeMatch = text.match(/for\s+([^,]+?)(?:,|$|to)/i);
  if (purposeMatch) {
    remittance.metadata = {
      purpose: purposeMatch[1].trim(),
    };
  }
  
  return remittance;
}

