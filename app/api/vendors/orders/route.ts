/**
 * Vendor Orders API
 * 
 * Endpoints for vendors to manage their orders.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getVendorOrderById,
  getVendorOrderByNumber,
  updateVendorOrderStatus,
  type VendorOrderStatus,
} from '@/lib/db/services/vendors';

/**
 * GET /api/vendors/orders
 * Get orders for a vendor (requires vendor_id query param)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get('vendor_id');
    const orderId = searchParams.get('order_id');
    const orderNumber = searchParams.get('order_number');
    const status = searchParams.get('status');

    if (orderId) {
      const order = await getVendorOrderById(orderId);
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      return NextResponse.json({ order });
    }

    if (orderNumber) {
      const order = await getVendorOrderByNumber(orderNumber);
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      return NextResponse.json({ order });
    }

    if (!vendorId) {
      return NextResponse.json({ error: 'vendor_id is required' }, { status: 400 });
    }

    // Get orders for vendor
    const { getVendorOrders } = await import('@/lib/db/services/vendors');
    const orderStatus = status || undefined;
    const orders = await getVendorOrders(vendorId, {
      status: orderStatus as any,
      limit: 50,
    });

    return NextResponse.json({ orders });
  } catch (error: any) {
    console.error('[Vendor Orders API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/vendors/orders
 * Update order status (accept, mark ready, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { order_id, order_number, status, payment_status, payment_hash } = body;

    if (!order_id && !order_number) {
      return NextResponse.json(
        { error: 'order_id or order_number is required' },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { error: 'status is required' },
        { status: 400 }
      );
    }

    // Get order first
    let order = order_id
      ? await getVendorOrderById(order_id)
      : await getVendorOrderByNumber(order_number);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Update order
    const updated = await updateVendorOrderStatus({
      orderId: order.id,
      status: status as VendorOrderStatus,
      paymentStatus: payment_status,
      paymentHash: payment_hash,
    });

    return NextResponse.json({ order: updated });
  } catch (error: any) {
    console.error('[Vendor Orders API] Error updating order:', error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}

