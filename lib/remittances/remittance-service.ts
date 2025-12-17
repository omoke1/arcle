/**
 * Remittance Service
 * 
 * Manages international money transfers with currency conversion
 * Now uses Supabase database instead of localStorage
 */

import { convertCurrency } from "@/lib/fx/fx-rates";
import {
  createRemittance as createRemittanceDb,
  getAllRemittances as getAllRemittancesDb,
  getRemittanceById as getRemittanceByIdDb,
  updateRemittance as updateRemittanceDb,
  markRemittanceAsCompleted as markRemittanceAsCompletedDb,
  saveRemittanceRecipient as saveRemittanceRecipientDb,
  getAllRemittanceRecipients as getAllRemittanceRecipientsDb,
  getRemittanceRecipientByName as getRemittanceRecipientByNameDb,
  type Remittance as RemittanceDb,
  type RemittanceRecipient as RemittanceRecipientDb,
} from "@/lib/db/services/remittances";
import { getOrCreateSupabaseUser } from "@/lib/supabase-data";

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

// Removed localStorage - now using Supabase database

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
    userId: string; // Circle userId
  }
): Promise<Remittance> {
  // Get Supabase user_id from Circle userId
  const supabaseUserId = await getOrCreateSupabaseUser(remittance.userId);
  
  // Determine target currency
  const targetCurrency = remittance.recipientCurrency || getCurrencyForCountry(remittance.recipientCountry);
  
  // Convert amount (USDC to target currency) using real FX rates
  const conversion = await convertCurrency(remittance.amount, "USDC", targetCurrency);
  
  if (!conversion.success || !conversion.convertedAmount || !conversion.rate) {
    throw new Error("Failed to get exchange rate for remittance");
  }
  
  // Calculate fee (typically 0.5% - 2% for remittances)
  const feePercent = 0.01; // 1% fee
  const amountNum = parseFloat(remittance.amount);
  const fee = (amountNum * feePercent).toFixed(6);
  const totalAmount = (amountNum + parseFloat(fee)).toFixed(6);
  
  // Create remittance in database
  const dbRemittance = await createRemittanceDb({
    user_id: supabaseUserId,
    recipient_name: remittance.recipientName,
    recipient_address: remittance.recipientAddress,
    recipient_country: remittance.recipientCountry,
    recipient_currency: targetCurrency,
    amount: remittance.amount,
    converted_amount: conversion.convertedAmount,
    exchange_rate: conversion.rate,
    fee,
    total_amount: totalAmount,
    metadata: remittance.metadata,
  });
  
  // Convert database format to service format
  return {
    id: dbRemittance.id,
    remittanceNumber: dbRemittance.remittance_number,
    recipientName: dbRemittance.recipient_name,
    recipientAddress: dbRemittance.recipient_address,
    recipientCountry: dbRemittance.recipient_country,
    recipientCurrency: dbRemittance.recipient_currency,
    amount: dbRemittance.amount,
    convertedAmount: dbRemittance.converted_amount,
    exchangeRate: dbRemittance.exchange_rate,
    fee: dbRemittance.fee,
    totalAmount: dbRemittance.total_amount,
    status: dbRemittance.status,
    transactionHash: dbRemittance.transaction_hash,
    metadata: dbRemittance.metadata,
    createdAt: dbRemittance.created_at,
    completedAt: dbRemittance.completed_at,
  };
}

/**
 * Get all remittances for a user
 */
export async function getAllRemittances(userId: string): Promise<Remittance[]> {
  const supabaseUserId = await getOrCreateSupabaseUser(userId);
  const dbRemittances = await getAllRemittancesDb(supabaseUserId);
  
  // Convert database format to service format
  return dbRemittances.map(db => ({
    id: db.id,
    remittanceNumber: db.remittance_number,
    recipientName: db.recipient_name,
    recipientAddress: db.recipient_address,
    recipientCountry: db.recipient_country,
    recipientCurrency: db.recipient_currency,
    amount: db.amount,
    convertedAmount: db.converted_amount,
    exchangeRate: db.exchange_rate,
    fee: db.fee,
    totalAmount: db.total_amount,
    status: db.status,
    transactionHash: db.transaction_hash,
    metadata: db.metadata,
    createdAt: db.created_at,
    completedAt: db.completed_at,
  }));
}

/**
 * Get remittance by ID
 */
export async function getRemittanceById(id: string): Promise<Remittance | null> {
  const dbRemittance = await getRemittanceByIdDb(id);
  
  if (!dbRemittance) {
    return null;
  }
  
  // Convert database format to service format
  return {
    id: dbRemittance.id,
    remittanceNumber: dbRemittance.remittance_number,
    recipientName: dbRemittance.recipient_name,
    recipientAddress: dbRemittance.recipient_address,
    recipientCountry: dbRemittance.recipient_country,
    recipientCurrency: dbRemittance.recipient_currency,
    amount: dbRemittance.amount,
    convertedAmount: dbRemittance.converted_amount,
    exchangeRate: dbRemittance.exchange_rate,
    fee: dbRemittance.fee,
    totalAmount: dbRemittance.total_amount,
    status: dbRemittance.status,
    transactionHash: dbRemittance.transaction_hash,
    metadata: dbRemittance.metadata,
    createdAt: dbRemittance.created_at,
    completedAt: dbRemittance.completed_at,
  };
}

/**
 * Update remittance
 */
export async function updateRemittance(id: string, updates: Partial<Remittance>): Promise<Remittance | null> {
  // Convert service format to database format
  const dbUpdates: any = {};
  if (updates.status) dbUpdates.status = updates.status;
  if (updates.transactionHash) dbUpdates.transaction_hash = updates.transactionHash;
  if (updates.completedAt) dbUpdates.completed_at = updates.completedAt;
  if (updates.metadata) dbUpdates.metadata = updates.metadata;
  
  const dbRemittance = await updateRemittanceDb(id, dbUpdates);
  
  if (!dbRemittance) {
    return null;
  }
  
  // Convert database format to service format
  return {
    id: dbRemittance.id,
    remittanceNumber: dbRemittance.remittance_number,
    recipientName: dbRemittance.recipient_name,
    recipientAddress: dbRemittance.recipient_address,
    recipientCountry: dbRemittance.recipient_country,
    recipientCurrency: dbRemittance.recipient_currency,
    amount: dbRemittance.amount,
    convertedAmount: dbRemittance.converted_amount,
    exchangeRate: dbRemittance.exchange_rate,
    fee: dbRemittance.fee,
    totalAmount: dbRemittance.total_amount,
    status: dbRemittance.status,
    transactionHash: dbRemittance.transaction_hash,
    metadata: dbRemittance.metadata,
    createdAt: dbRemittance.created_at,
    completedAt: dbRemittance.completed_at,
  };
}

/**
 * Mark remittance as completed
 */
export async function markRemittanceAsCompleted(id: string, transactionHash: string): Promise<Remittance | null> {
  const dbRemittance = await markRemittanceAsCompletedDb(id, transactionHash);
  
  if (!dbRemittance) {
    return null;
  }
  
  // Convert database format to service format
  return {
    id: dbRemittance.id,
    remittanceNumber: dbRemittance.remittance_number,
    recipientName: dbRemittance.recipient_name,
    recipientAddress: dbRemittance.recipient_address,
    recipientCountry: dbRemittance.recipient_country,
    recipientCurrency: dbRemittance.recipient_currency,
    amount: dbRemittance.amount,
    convertedAmount: dbRemittance.converted_amount,
    exchangeRate: dbRemittance.exchange_rate,
    fee: dbRemittance.fee,
    totalAmount: dbRemittance.total_amount,
    status: dbRemittance.status,
    transactionHash: dbRemittance.transaction_hash,
    metadata: dbRemittance.metadata,
    createdAt: dbRemittance.created_at,
    completedAt: dbRemittance.completed_at,
  };
}

/**
 * Save remittance recipient
 */
export async function saveRemittanceRecipient(
  userId: string,
  recipient: Omit<RemittanceRecipient, "id" | "lastRemittanceDate">
): Promise<RemittanceRecipient> {
  const supabaseUserId = await getOrCreateSupabaseUser(userId);
  
  const dbRecipient = await saveRemittanceRecipientDb(supabaseUserId, {
    name: recipient.name,
    address: recipient.address,
    country: recipient.country,
    currency: recipient.currency,
    preferred_currency: recipient.preferredCurrency,
  });
  
  // Convert database format to service format
  return {
    id: dbRecipient.id,
    name: dbRecipient.name,
    address: dbRecipient.address,
    country: dbRecipient.country,
    currency: dbRecipient.currency,
    preferredCurrency: dbRecipient.preferred_currency,
    lastRemittanceDate: dbRecipient.last_remittance_date,
  };
}

/**
 * Get all remittance recipients for a user
 */
export async function getAllRemittanceRecipients(userId: string): Promise<RemittanceRecipient[]> {
  const supabaseUserId = await getOrCreateSupabaseUser(userId);
  const dbRecipients = await getAllRemittanceRecipientsDb(supabaseUserId);
  
  // Convert database format to service format
  return dbRecipients.map(db => ({
    id: db.id,
    name: db.name,
    address: db.address,
    country: db.country,
    currency: db.currency,
    preferredCurrency: db.preferred_currency,
    lastRemittanceDate: db.last_remittance_date,
  }));
}

/**
 * Get recipient by name
 */
export async function getRemittanceRecipientByName(
  userId: string,
  name: string
): Promise<RemittanceRecipient | null> {
  const supabaseUserId = await getOrCreateSupabaseUser(userId);
  const dbRecipient = await getRemittanceRecipientByNameDb(supabaseUserId, name);
  
  if (!dbRecipient) {
    return null;
  }
  
  // Convert database format to service format
  return {
    id: dbRecipient.id,
    name: dbRecipient.name,
    address: dbRecipient.address,
    country: dbRecipient.country,
    currency: dbRecipient.currency,
    preferredCurrency: dbRecipient.preferred_currency,
    lastRemittanceDate: dbRecipient.last_remittance_date,
  };
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

