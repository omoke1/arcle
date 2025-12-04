/**
 * Invoices Service
 * 
 * Manages invoice creation, tracking, and payment
 */

import { getSupabaseAdmin, getSupabaseClient } from '../supabase';

export interface Invoice {
  id: string;
  user_id: string;
  invoice_number: string;
  recipient: string;
  recipient_address?: string;
  amount: string;
  currency: string;
  description?: string;
  due_date: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  paid_at?: string;
  payment_hash?: string;
  early_payment_discount?: any;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface CreateInvoiceData {
  user_id: string;
  recipient: string;
  recipient_address?: string;
  amount: string;
  currency: string;
  description?: string;
  due_date: string;
  early_payment_discount?: any;
  metadata?: any;
}

/**
 * Generate invoice number
 */
function generateInvoiceNumber(userId: string, existingCount: number): string {
  const year = new Date().getFullYear();
  const count = existingCount + 1;
  return `INV-${year}-${String(count).padStart(4, '0')}`;
}

/**
 * Create a new invoice
 */
export async function createInvoice(data: CreateInvoiceData): Promise<Invoice> {
  const supabase = getSupabaseAdmin();
  
  // Get existing invoice count for this user to generate invoice number
  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', data.user_id);
  
  const invoiceNumber = generateInvoiceNumber(data.user_id, count || 0);
  
  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      ...data,
      invoice_number: invoiceNumber,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[Invoices Service] Error creating invoice:', error);
    throw new Error(`Failed to create invoice: ${error.message}`);
  }

  return invoice;
}

/**
 * Get invoice by ID
 */
export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Invoices Service] Error getting invoice:', error);
    return null;
  }

  return data;
}

/**
 * Get invoice by invoice number
 */
export async function getInvoiceByNumber(invoice_number: string): Promise<Invoice | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('invoice_number', invoice_number)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Invoices Service] Error getting invoice:', error);
    return null;
  }

  return data;
}

/**
 * Get all invoices for a user
 */
export async function getUserInvoices(
  user_id: string,
  limit: number = 50,
  offset: number = 0
): Promise<Invoice[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[Invoices Service] Error getting user invoices:', error);
    return [];
  }

  return data || [];
}

/**
 * Get invoices by status
 */
export async function getInvoicesByStatus(
  user_id: string,
  status: Invoice['status']
): Promise<Invoice[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', user_id)
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Invoices Service] Error getting invoices by status:', error);
    return [];
  }

  return data || [];
}

/**
 * Get overdue invoices
 */
export async function getOverdueInvoices(user_id: string): Promise<Invoice[]> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', user_id)
    .lt('due_date', now)
    .in('status', ['sent', 'draft'])
    .order('due_date', { ascending: true });

  if (error) {
    console.error('[Invoices Service] Error getting overdue invoices:', error);
    return [];
  }

  // Update status to overdue
  if (data && data.length > 0) {
    const ids = data.map(inv => inv.id);
    await supabase
      .from('invoices')
      .update({ status: 'overdue' })
      .in('id', ids);
    
    return data.map(inv => ({ ...inv, status: 'overdue' as const }));
  }

  return data || [];
}

/**
 * Update invoice
 */
export async function updateInvoice(
  id: string,
  updates: Partial<CreateInvoiceData> & { 
    status?: Invoice['status'];
    paid_at?: string;
    payment_hash?: string;
  }
): Promise<Invoice> {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('invoices')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Invoices Service] Error updating invoice:', error);
    throw new Error(`Failed to update invoice: ${error.message}`);
  }

  return data;
}

/**
 * Mark invoice as paid
 */
export async function markInvoiceAsPaid(
  id: string,
  payment_hash: string
): Promise<Invoice> {
  return await updateInvoice(id, {
    status: 'paid',
    paid_at: new Date().toISOString(),
    payment_hash,
  });
}

/**
 * Delete invoice
 */
export async function deleteInvoice(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Invoices Service] Error deleting invoice:', error);
    return false;
  }

  return true;
}

