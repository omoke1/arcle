/**
 * Commerce Orders API
 * 
 * Endpoints for creating and managing vendor orders with payment integration.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createVendorOrder,
  getVendorById,
  type CreateVendorOrderData,
} from '@/lib/db/services/vendors';
import { getOrCreateSupabaseUser } from '@/lib/supabase-data';

/**
 * POST /api/commerce/orders
 * Create a new vendor order and process payment
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      vendor_id,
      user_id, // Circle user ID
      items,
      subtotal,
      currency = 'USDC',
      delivery_address,
      delivery_latitude,
      delivery_longitude,
      metadata,
    } = body;

    if (!vendor_id || !user_id || !items || !subtotal) {
      return NextResponse.json(
        { error: 'vendor_id, user_id, items, and subtotal are required' },
        { status: 400 }
      );
    }

    // Verify vendor exists
    const vendor = await getVendorById(vendor_id);
    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    // Convert Circle user ID to Supabase UUID
    let supabaseUserId: string;
    try {
      supabaseUserId = await getOrCreateSupabaseUser(user_id);
    } catch (error: any) {
      console.error('[Commerce Orders API] Error getting Supabase user:', error);
      return NextResponse.json(
        { error: 'Failed to resolve user ID', details: error.message },
        { status: 500 }
      );
    }

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create order
    const orderData: CreateVendorOrderData = {
      vendor_id,
      user_id: supabaseUserId,
      order_number: orderNumber,
      items: Array.isArray(items) ? items : [],
      subtotal: String(subtotal),
      currency,
      delivery_address: delivery_address || undefined,
      delivery_latitude: delivery_latitude ? parseFloat(String(delivery_latitude)) : undefined,
      delivery_longitude: delivery_longitude ? parseFloat(String(delivery_longitude)) : undefined,
      metadata: metadata || undefined,
    };

    const order = await createVendorOrder(orderData);

    // TODO: Process payment via Payments Agent
    // For now, we'll return the order and let the client handle payment
    // In production, this would:
    // 1. Call Payments Agent to send USDC to vendor.wallet_address
    // 2. Update order.payment_status = 'paid' and payment_hash
    // 3. Create notification for user
    // 4. Trigger vendor webhook if configured

    return NextResponse.json(
      {
        order,
        message: `Order ${orderNumber} created successfully! Payment processing can be initiated separately.`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[Commerce Orders API] Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/commerce/orders
 * Get orders for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id'); // Circle user ID

    if (!userId) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      );
    }

    // Convert Circle user ID to Supabase UUID
    let supabaseUserId: string;
    try {
      supabaseUserId = await getOrCreateSupabaseUser(userId);
    } catch (error: any) {
      console.error('[Commerce Orders API] Error getting Supabase user:', error);
      return NextResponse.json(
        { error: 'Failed to resolve user ID' },
        { status: 500 }
      );
    }

    const { getUserVendorOrders } = await import('@/lib/db/services/vendors');
    const orders = await getUserVendorOrders(supabaseUserId, 50);

    return NextResponse.json({ orders });
  } catch (error: any) {
    console.error('[Commerce Orders API] Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

