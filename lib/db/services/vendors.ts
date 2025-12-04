/**
 * Vendors & Vendor Orders Service
 *
 * Manages partner vendors, their inventory, and customer orders.
 * Backed by Supabase tables defined in `supabase/migrations/0006_vendors_and_dispatch.sql`.
 */

import { getSupabaseAdmin, getSupabaseClient } from '../supabase';

export type VendorType = 'restaurant' | 'retail' | 'service' | 'other';

export interface Vendor {
  id: string;
  name: string;
  type: VendorType;
  category: string | null;
  description: string | null;
  region: string | null;
  wallet_address: string | null;
  webhook_url: string | null;
  is_active: boolean;
  metadata: any | null;
  created_at: string;
  updated_at: string;
}

export interface VendorItem {
  id: string;
  vendor_id: string;
  name: string;
  sku: string | null;
  price: string;
  currency: string;
  category: string | null;
  image_url: string | null;
  description: string | null;
  is_available: boolean;
  prep_time_minutes: number | null;
  metadata: any | null;
  created_at: string;
  updated_at: string;
}

export type VendorOrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'dispatched'
  | 'delivered'
  | 'cancelled';

export type VendorPaymentStatus = 'pending' | 'paid' | 'refunded';

export interface VendorOrderItem {
  item_id: string;
  name: string;
  quantity: number;
  price: string;
}

export interface VendorOrder {
  id: string;
  vendor_id: string;
  user_id: string;
  order_number: string;
  status: VendorOrderStatus;
  items: VendorOrderItem[];
  subtotal: string;
  currency: string;
  delivery_address: string | null;
  delivery_latitude: string | null;
  delivery_longitude: string | null;
  payment_hash: string | null;
  payment_status: VendorPaymentStatus;
  dispatcher_id: string | null;
  estimated_delivery_time: string | null;
  delivered_at: string | null;
  metadata: any | null;
  created_at: string;
  updated_at: string;
}

export interface CreateVendorOrderData {
  vendor_id: string;
  user_id: string;
  order_number: string;
  items: VendorOrderItem[];
  subtotal: string;
  currency?: string;
  delivery_address?: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
  metadata?: any;
}

/**
 * Get all active vendors.
 */
export async function getActiveVendors(region?: string): Promise<Vendor[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('vendors')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (region) {
    query = query.eq('region', region);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Vendors Service] Error fetching active vendors:', error);
    return [];
  }

  return (data as Vendor[]) || [];
}

/**
 * Get a vendor by ID.
 */
export async function getVendorById(id: string): Promise<Vendor | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[Vendors Service] Error fetching vendor by id:', error);
    return null;
  }

  return data as Vendor;
}

/**
 * Get available items for a vendor.
 */
export async function getVendorItems(
  vendor_id: string,
  options?: { onlyAvailable?: boolean }
): Promise<VendorItem[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('vendor_items')
    .select('*')
    .eq('vendor_id', vendor_id)
    .order('name', { ascending: true });

  if (options?.onlyAvailable) {
    query = query.eq('is_available', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[Vendors Service] Error fetching vendor items:', error);
    return [];
  }

  return (data as VendorItem[]) || [];
}

/**
 * Create a new vendor order.
 */
export async function createVendorOrder(
  data: CreateVendorOrderData
): Promise<VendorOrder> {
  const supabase = getSupabaseAdmin();

  const payload: any = {
    vendor_id: data.vendor_id,
    user_id: data.user_id,
    order_number: data.order_number,
    status: 'pending',
    items: data.items,
    subtotal: data.subtotal,
    currency: data.currency || 'USDC',
    delivery_address: data.delivery_address ?? null,
    delivery_latitude:
      typeof data.delivery_latitude === 'number'
        ? data.delivery_latitude
        : null,
    delivery_longitude:
      typeof data.delivery_longitude === 'number'
        ? data.delivery_longitude
        : null,
    payment_status: 'pending',
    metadata: data.metadata ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: order, error } = await supabase
    .from('vendor_orders')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[Vendors Service] Error creating vendor order:', error);
    throw new Error(`Failed to create vendor order: ${error.message}`);
  }

  return order as VendorOrder;
}

/**
 * Update vendor order status and optional metadata fields.
 */
export async function updateVendorOrderStatus(params: {
  orderId: string;
  status: VendorOrderStatus;
  paymentStatus?: VendorPaymentStatus;
  paymentHash?: string;
  dispatcherId?: string | null;
  estimatedDeliveryTime?: string | null;
  deliveredAt?: string | null;
  metadataPatch?: Record<string, any>;
}): Promise<VendorOrder> {
  const {
    orderId,
    status,
    paymentStatus,
    paymentHash,
    dispatcherId,
    estimatedDeliveryTime,
    deliveredAt,
    metadataPatch,
  } = params;

  const supabase = getSupabaseAdmin();

  const updates: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (paymentStatus) updates.payment_status = paymentStatus;
  if (paymentHash) updates.payment_hash = paymentHash;
  if (typeof dispatcherId !== 'undefined') updates.dispatcher_id = dispatcherId;
  if (typeof estimatedDeliveryTime !== 'undefined') {
    updates.estimated_delivery_time = estimatedDeliveryTime;
  }
  if (typeof deliveredAt !== 'undefined') {
    updates.delivered_at = deliveredAt;
  }
  if (metadataPatch) {
    updates.metadata = metadataPatch;
  }

  const { data, error } = await supabase
    .from('vendor_orders')
    .update(updates)
    .eq('id', orderId)
    .select()
    .single();

  if (error) {
    console.error('[Vendors Service] Error updating vendor order:', error);
    throw new Error(`Failed to update vendor order: ${error.message}`);
  }

  return data as VendorOrder;
}

/**
 * Get recent orders for a user.
 */
export async function getUserVendorOrders(
  user_id: string,
  limit: number = 20
): Promise<VendorOrder[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('vendor_orders')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Vendors Service] Error fetching user vendor orders:', error);
    return [];
  }

  return (data as VendorOrder[]) || [];
}


