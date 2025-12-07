-- Migration 006: Vendors, Orders, Dispatchers & Dispatch Jobs
-- Creates tables for vendor/partner integration, order management, and dispatch logistics

-- Vendors/Partners Table
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('restaurant', 'retail', 'service', 'other')),
  category TEXT, -- e.g., 'food', 'shopping', 'services'
  description TEXT,
  region TEXT, -- e.g., 'Lagos', 'Abuja', 'Global'
  wallet_address TEXT, -- Vendor's wallet to receive payments
  webhook_url TEXT, -- Optional: for vendor system integration
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB, -- Store additional vendor info (hours, contact, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Vendor Items/Inventory Table
CREATE TABLE IF NOT EXISTS public.vendor_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT, -- Stock keeping unit
  price TEXT NOT NULL, -- Price in USDC (as string to preserve precision)
  currency TEXT NOT NULL DEFAULT 'USDC',
  category TEXT, -- e.g., 'pizza', 'drinks', 'appetizers'
  image_url TEXT,
  description TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  prep_time_minutes INTEGER, -- Estimated preparation time
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Dispatchers/Riders Table (created before vendor_orders to satisfy FK constraint)
CREATE TABLE IF NOT EXISTS public.dispatchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_available BOOLEAN NOT NULL DEFAULT true,
  current_latitude DECIMAL(10, 8), -- Current location
  current_longitude DECIMAL(11, 8),
  current_location_updated_at TIMESTAMPTZ,
  region TEXT, -- Preferred service region
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Vendor Orders Table
CREATE TABLE IF NOT EXISTS public.vendor_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_number TEXT UNIQUE NOT NULL, -- Human-readable order number
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'accepted', 'preparing', 'ready', 'dispatched', 'delivered', 'cancelled'
  )),
  items JSONB NOT NULL, -- Array of {item_id, name, quantity, price}
  subtotal TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USDC',
  delivery_address TEXT, -- Full address string
  delivery_latitude DECIMAL(10, 8), -- For map tracking
  delivery_longitude DECIMAL(11, 8),
  payment_hash TEXT, -- Transaction hash when payment is made
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  dispatcher_id UUID REFERENCES public.dispatchers(id) ON DELETE SET NULL,
  estimated_delivery_time TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  metadata JSONB, -- Store special instructions, customer notes, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Dispatch Jobs Table (links orders to dispatchers)
CREATE TABLE IF NOT EXISTS public.dispatch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.vendor_orders(id) ON DELETE CASCADE,
  dispatcher_id UUID NOT NULL REFERENCES public.dispatchers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN (
    'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'failed'
  )),
  estimated_arrival_time TIMESTAMPTZ,
  actual_arrival_time TIMESTAMPTZ,
  pickup_latitude DECIMAL(10, 8), -- Vendor location
  pickup_longitude DECIMAL(11, 8),
  delivery_latitude DECIMAL(10, 8), -- Customer location
  delivery_longitude DECIMAL(11, 8),
  current_latitude DECIMAL(10, 8), -- Real-time tracking
  current_longitude DECIMAL(11, 8),
  location_updates JSONB, -- Array of {lat, lng, timestamp} for tracking history
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS vendors_type_idx ON public.vendors(type);
CREATE INDEX IF NOT EXISTS vendors_is_active_idx ON public.vendors(is_active);
CREATE INDEX IF NOT EXISTS vendor_items_vendor_id_idx ON public.vendor_items(vendor_id);
CREATE INDEX IF NOT EXISTS vendor_items_is_available_idx ON public.vendor_items(is_available);
CREATE INDEX IF NOT EXISTS vendor_orders_vendor_id_idx ON public.vendor_orders(vendor_id);
CREATE INDEX IF NOT EXISTS vendor_orders_user_id_idx ON public.vendor_orders(user_id);
CREATE INDEX IF NOT EXISTS vendor_orders_status_idx ON public.vendor_orders(status);
CREATE INDEX IF NOT EXISTS vendor_orders_order_number_idx ON public.vendor_orders(order_number);
CREATE INDEX IF NOT EXISTS vendor_orders_dispatcher_id_idx ON public.vendor_orders(dispatcher_id);
CREATE INDEX IF NOT EXISTS dispatchers_is_available_idx ON public.dispatchers(is_available);
CREATE INDEX IF NOT EXISTS dispatch_jobs_order_id_idx ON public.dispatch_jobs(order_id);
CREATE INDEX IF NOT EXISTS dispatch_jobs_dispatcher_id_idx ON public.dispatch_jobs(dispatcher_id);
CREATE INDEX IF NOT EXISTS dispatch_jobs_status_idx ON public.dispatch_jobs(status);

-- Add foreign key constraint for dispatcher_id in vendor_orders (after dispatchers table exists)
-- This is already handled above, but we ensure the reference is correct

