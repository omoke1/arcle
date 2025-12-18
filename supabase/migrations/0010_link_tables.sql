-- Migration: Link Tables (Users, Access, Wallets)
-- Description: Formalizes the schema to strictly link Identity, Access, and Assets.
-- Depends on: 0001_init.sql

-- 1. Update public.users to link to auth.users and store Circle User ID
ALTER TABLE public.users ALTER COLUMN wallet_address DROP NOT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS circle_user_id text UNIQUE;

-- Add Foreign Key to auth.users if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'users_id_fkey') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

-- 2. Create public.user_access table (Permanent Beta Access)
CREATE TABLE IF NOT EXISTS public.user_access (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  access_code text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage user_access" ON public.user_access
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can read own access" ON public.user_access
  FOR SELECT USING (auth.uid() = user_id);

-- 3. Create public.wallets table (Circle Wallet Link)
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  wallet_id text UNIQUE NOT NULL, -- Circle Wallet ID
  address text NOT NULL,
  network text DEFAULT 'ETH-SEPOLIA',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage wallets" ON public.wallets
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can read own wallet" ON public.wallets
  FOR SELECT USING (auth.uid() = user_id);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_circle_id ON public.users(circle_user_id);
