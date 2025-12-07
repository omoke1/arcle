/**
 * Vendor Inventory API
 * 
 * Endpoints for vendors to manage their inventory/items.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getVendorById,
  getVendorItems,
} from '@/lib/db/services/vendors';
import { getSupabaseAdmin } from '@/lib/db/supabase';
import type { VendorItem } from '@/lib/db/services/vendors';

/**
 * GET /api/vendors/inventory
 * Get inventory for a vendor
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get('vendor_id');

    if (!vendorId) {
      return NextResponse.json(
        { error: 'vendor_id is required' },
        { status: 400 }
      );
    }

    const vendor = await getVendorById(vendorId);
    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const onlyAvailable = searchParams.get('only_available') === 'true';
    const items = await getVendorItems(vendorId, { onlyAvailable });

    return NextResponse.json({ vendor, items });
  } catch (error: any) {
    console.error('[Vendor Inventory API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vendors/inventory
 * Create a new inventory item
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      vendor_id,
      name,
      sku,
      price,
      currency = 'USDC',
      category,
      image_url,
      description,
      is_available = true,
      prep_time_minutes,
    } = body;

    if (!vendor_id || !name || !price) {
      return NextResponse.json(
        { error: 'vendor_id, name, and price are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('vendor_items')
      .insert({
        vendor_id,
        name,
        sku: sku || null,
        price: String(price),
        currency,
        category: category || null,
        image_url: image_url || null,
        description: description || null,
        is_available,
        prep_time_minutes: prep_time_minutes || null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      console.error('[Vendor Inventory API] Error creating item:', error);
      return NextResponse.json(
        { error: 'Failed to create item', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ item: data as VendorItem }, { status: 201 });
  } catch (error: any) {
    console.error('[Vendor Inventory API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create item' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/vendors/inventory
 * Update an inventory item
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_id, ...updates } = body;

    if (!item_id) {
      return NextResponse.json(
        { error: 'item_id is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const updateData: any = {
      updated_at: now,
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.price !== undefined) updateData.price = String(updates.price);
    if (updates.currency !== undefined) updateData.currency = updates.currency;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.image_url !== undefined) updateData.image_url = updates.image_url;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.is_available !== undefined) updateData.is_available = updates.is_available;
    if (updates.prep_time_minutes !== undefined) updateData.prep_time_minutes = updates.prep_time_minutes;

    const { data, error } = await supabase
      .from('vendor_items')
      .update(updateData)
      .eq('id', item_id)
      .select()
      .single();

    if (error) {
      console.error('[Vendor Inventory API] Error updating item:', error);
      return NextResponse.json(
        { error: 'Failed to update item', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ item: data as VendorItem });
  } catch (error: any) {
    console.error('[Vendor Inventory API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    );
  }
}

