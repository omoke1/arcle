-- Migration 005: Local Accounts & Fiat Ledger
-- Creates core tables for local fiat accounts, ledger entries, transactions, and rails.

-- Local fiat account per user + currency (e.g. NGN)
CREATE TABLE IF NOT EXISTS local_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL, -- ISO currency code, e.g. NGN
  provider_account_id TEXT, -- ID from rail provider (virtual account / bank account)
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  display_name TEXT,
  daily_deposit_limit_minor BIGINT, -- minor units (e.g. kobo)
  daily_withdrawal_limit_minor BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, currency)
);

-- Double-entry style ledger entries for local accounts
CREATE TABLE IF NOT EXISTS local_ledger_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES local_accounts(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('credit', 'debit', 'reserve', 'release')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  balance_after_minor BIGINT NOT NULL,
  reference TEXT NOT NULL, -- business reference / idempotency key
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (account_id, reference)
);

-- High-level transactions that map to ledger activity (deposits, withdrawals, FX, commerce)
CREATE TABLE IF NOT EXISTS local_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES local_accounts(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  rail TEXT NOT NULL, -- e.g. 'mock', 'mono', 'flutterwave'
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  workflow_id TEXT, -- links to higher-level workflow (FX, commerce, etc.)
  external_id TEXT, -- provider transfer id / reference
  error_code TEXT,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rail configuration and limits
CREATE TABLE IF NOT EXISTS local_rails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL,
  supported_currencies TEXT[] NOT NULL,
  min_deposit_minor BIGINT,
  max_deposit_minor BIGINT,
  min_withdrawal_minor BIGINT,
  max_withdrawal_minor BIGINT,
  fee_bps INTEGER, -- basis points fee applied by this rail
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_local_accounts_user_currency
  ON local_accounts(user_id, currency);

CREATE INDEX IF NOT EXISTS idx_local_ledger_entries_account_created
  ON local_ledger_entries(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_local_transactions_account_created
  ON local_transactions(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_local_transactions_workflow
  ON local_transactions(workflow_id);

CREATE INDEX IF NOT EXISTS idx_local_rails_provider
  ON local_rails(provider);

-- Basic updated_at trigger for local_accounts and local_transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE event_object_table = 'local_accounts' 
      AND trigger_name = 'update_local_accounts_updated_at'
  ) THEN
    CREATE TRIGGER update_local_accounts_updated_at
      BEFORE UPDATE ON local_accounts
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE event_object_table = 'local_transactions' 
      AND trigger_name = 'update_local_transactions_updated_at'
  ) THEN
    CREATE TRIGGER update_local_transactions_updated_at
      BEFORE UPDATE ON local_transactions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;


