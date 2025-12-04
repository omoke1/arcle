-- Migration 005: Limit Orders & Auto-Compound Strategies
-- Creates tables for limit orders and auto-compound strategies
-- These replace in-memory Map storage to ensure data persistence

-- Limit Orders Table
CREATE TABLE IF NOT EXISTS public.limit_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT UNIQUE NOT NULL,
  wallet_id TEXT NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
  from_token TEXT NOT NULL,
  to_token TEXT NOT NULL,
  amount TEXT NOT NULL,
  target_price TEXT NOT NULL,
  current_price TEXT,
  blockchain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'cancelled', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
  expires_at TIMESTAMP WITH TIME ZONE,
  executed_at TIMESTAMP WITH TIME ZONE,
  transaction_hash TEXT,
  slippage_tolerance NUMERIC(5, 2) NOT NULL DEFAULT 0.5
);

-- Indexes for limit orders
CREATE INDEX IF NOT EXISTS limit_orders_order_id_idx ON public.limit_orders(order_id);
CREATE INDEX IF NOT EXISTS limit_orders_wallet_id_idx ON public.limit_orders(wallet_id);
CREATE INDEX IF NOT EXISTS limit_orders_user_id_idx ON public.limit_orders(user_id);
CREATE INDEX IF NOT EXISTS limit_orders_status_idx ON public.limit_orders(status);
CREATE INDEX IF NOT EXISTS limit_orders_expires_at_idx ON public.limit_orders(expires_at);
CREATE INDEX IF NOT EXISTS limit_orders_next_compound_at_idx ON public.limit_orders(expires_at) WHERE status = 'pending';

-- Auto-Compound Strategies Table
CREATE TABLE IF NOT EXISTS public.compound_strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id TEXT UNIQUE NOT NULL,
  wallet_id TEXT NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  minimum_yield TEXT NOT NULL DEFAULT '10',
  reinvest_percentage INTEGER NOT NULL DEFAULT 100 CHECK (reinvest_percentage >= 0 AND reinvest_percentage <= 100),
  target_positions JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'stopped')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
  last_compounded_at TIMESTAMP WITH TIME ZONE,
  next_compound_at TIMESTAMP WITH TIME ZONE,
  total_compounded TEXT NOT NULL DEFAULT '0',
  compound_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now())
);

-- Indexes for compound strategies
CREATE INDEX IF NOT EXISTS compound_strategies_strategy_id_idx ON public.compound_strategies(strategy_id);
CREATE INDEX IF NOT EXISTS compound_strategies_wallet_id_idx ON public.compound_strategies(wallet_id);
CREATE INDEX IF NOT EXISTS compound_strategies_user_id_idx ON public.compound_strategies(user_id);
CREATE INDEX IF NOT EXISTS compound_strategies_status_idx ON public.compound_strategies(status);
CREATE INDEX IF NOT EXISTS compound_strategies_next_compound_at_idx ON public.compound_strategies(next_compound_at) WHERE status = 'active';

-- Compound History Table
CREATE TABLE IF NOT EXISTS public.compound_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id TEXT NOT NULL REFERENCES public.compound_strategies(strategy_id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
  yield_earned TEXT NOT NULL,
  reinvested TEXT NOT NULL,
  current_value TEXT NOT NULL DEFAULT '0',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now())
);

-- Indexes for compound history
CREATE INDEX IF NOT EXISTS compound_history_strategy_id_idx ON public.compound_history(strategy_id);
CREATE INDEX IF NOT EXISTS compound_history_date_idx ON public.compound_history(date DESC);

-- Auto-update updated_at triggers
CREATE OR REPLACE FUNCTION update_compound_strategies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_compound_strategies_updated_at
  BEFORE UPDATE ON public.compound_strategies
  FOR EACH ROW
  EXECUTE FUNCTION update_compound_strategies_updated_at();

-- Enable Row Level Security
ALTER TABLE public.limit_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compound_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compound_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for limit_orders
CREATE POLICY "Users can view their own limit orders"
  ON public.limit_orders FOR SELECT
  USING (auth.uid()::text = user_id::text OR user_id IS NULL);

CREATE POLICY "Users can insert their own limit orders"
  ON public.limit_orders FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text OR user_id IS NULL);

CREATE POLICY "Users can update their own limit orders"
  ON public.limit_orders FOR UPDATE
  USING (auth.uid()::text = user_id::text OR user_id IS NULL);

-- RLS Policies for compound_strategies
CREATE POLICY "Users can view their own compound strategies"
  ON public.compound_strategies FOR SELECT
  USING (auth.uid()::text = user_id::text OR user_id IS NULL);

CREATE POLICY "Users can insert their own compound strategies"
  ON public.compound_strategies FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text OR user_id IS NULL);

CREATE POLICY "Users can update their own compound strategies"
  ON public.compound_strategies FOR UPDATE
  USING (auth.uid()::text = user_id::text OR user_id IS NULL);

-- RLS Policies for compound_history
CREATE POLICY "Users can view compound history for their strategies"
  ON public.compound_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.compound_strategies cs
      WHERE cs.strategy_id = compound_history.strategy_id
      AND (auth.uid()::text = cs.user_id::text OR cs.user_id IS NULL)
    )
  );

