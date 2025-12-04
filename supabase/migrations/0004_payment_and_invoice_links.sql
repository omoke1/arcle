-- Migration 004: Payment Links & Invoice Links
-- Creates tables for one-time payment links and invoice links
-- These replace in-memory Map storage to ensure data persistence

-- Payment Links Table
CREATE TABLE IF NOT EXISTS public.payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id TEXT UNIQUE NOT NULL,
  wallet_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount TEXT NOT NULL,
  description TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired')),
  payment_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now())
);

-- Indexes for payment links
CREATE INDEX IF NOT EXISTS payment_links_link_id_idx ON public.payment_links(link_id);
CREATE INDEX IF NOT EXISTS payment_links_user_id_idx ON public.payment_links(user_id);
CREATE INDEX IF NOT EXISTS payment_links_wallet_id_idx ON public.payment_links(wallet_id);
CREATE INDEX IF NOT EXISTS payment_links_status_idx ON public.payment_links(status);
CREATE INDEX IF NOT EXISTS payment_links_expires_at_idx ON public.payment_links(expires_at);

-- Invoice Links Table
CREATE TABLE IF NOT EXISTS public.invoice_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id TEXT UNIQUE NOT NULL,
  invoice_id TEXT NOT NULL,
  wallet_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USDC',
  description TEXT,
  items JSONB,
  expires_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  payment_hash TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now())
);

-- Indexes for invoice links
CREATE INDEX IF NOT EXISTS invoice_links_link_id_idx ON public.invoice_links(link_id);
CREATE INDEX IF NOT EXISTS invoice_links_invoice_id_idx ON public.invoice_links(invoice_id);
CREATE INDEX IF NOT EXISTS invoice_links_user_id_idx ON public.invoice_links(user_id);
CREATE INDEX IF NOT EXISTS invoice_links_wallet_id_idx ON public.invoice_links(wallet_id);
CREATE INDEX IF NOT EXISTS invoice_links_status_idx ON public.invoice_links(status);
CREATE INDEX IF NOT EXISTS invoice_links_expires_at_idx ON public.invoice_links(expires_at);

-- Auto-update updated_at triggers
CREATE OR REPLACE FUNCTION update_payment_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_invoice_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_payment_links_updated_at
  BEFORE UPDATE ON public.payment_links
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_links_updated_at();

CREATE TRIGGER update_invoice_links_updated_at
  BEFORE UPDATE ON public.invoice_links
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_links_updated_at();

-- Enable Row Level Security
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_links
CREATE POLICY "Users can view their own payment links"
  ON public.payment_links FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own payment links"
  ON public.payment_links FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own payment links"
  ON public.payment_links FOR UPDATE
  USING (auth.uid()::text = user_id::text);

-- RLS Policies for invoice_links
CREATE POLICY "Users can view their own invoice links"
  ON public.invoice_links FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own invoice links"
  ON public.invoice_links FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own invoice links"
  ON public.invoice_links FOR UPDATE
  USING (auth.uid()::text = user_id::text);

