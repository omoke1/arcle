-- Remittances Migration
-- Creates tables for remittances and remittance recipients

-- Remittances Table
CREATE TABLE IF NOT EXISTS remittances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  remittance_number TEXT UNIQUE NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_address TEXT, -- Wallet address if available
  recipient_country TEXT NOT NULL,
  recipient_currency TEXT NOT NULL, -- Target currency (e.g., MXN, EUR)
  amount TEXT NOT NULL, -- Amount in source currency (USDC)
  converted_amount TEXT NOT NULL, -- Amount in recipient currency
  exchange_rate NUMERIC(18, 8) NOT NULL,
  fee TEXT NOT NULL,
  total_amount TEXT NOT NULL, -- amount + fee
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  transaction_hash TEXT,
  metadata JSONB, -- Additional metadata (purpose, notes, complianceChecked, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Remittance Recipients Table
CREATE TABLE IF NOT EXISTS remittance_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT, -- Wallet address if available
  country TEXT NOT NULL,
  currency TEXT NOT NULL,
  preferred_currency TEXT,
  last_remittance_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_remittances_user_id ON remittances(user_id);
CREATE INDEX IF NOT EXISTS idx_remittances_status ON remittances(status);
CREATE INDEX IF NOT EXISTS idx_remittances_remittance_number ON remittances(remittance_number);
CREATE INDEX IF NOT EXISTS idx_remittances_created_at ON remittances(created_at);
CREATE INDEX IF NOT EXISTS idx_remittance_recipients_user_id ON remittance_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_remittance_recipients_name ON remittance_recipients(name);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_remittances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_remittance_recipients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_remittances_updated_at ON remittances;
CREATE TRIGGER update_remittances_updated_at
  BEFORE UPDATE ON remittances
  FOR EACH ROW
  EXECUTE FUNCTION update_remittances_updated_at();

DROP TRIGGER IF EXISTS update_remittance_recipients_updated_at ON remittance_recipients;
CREATE TRIGGER update_remittance_recipients_updated_at
  BEFORE UPDATE ON remittance_recipients
  FOR EACH ROW
  EXECUTE FUNCTION update_remittance_recipients_updated_at();

-- RLS Policies
ALTER TABLE remittances ENABLE ROW LEVEL SECURITY;
ALTER TABLE remittance_recipients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view own remittances" ON remittances;
DROP POLICY IF EXISTS "Users can create own remittances" ON remittances;
DROP POLICY IF EXISTS "Users can update own remittances" ON remittances;
DROP POLICY IF EXISTS "Service role can manage remittances" ON remittances;
DROP POLICY IF EXISTS "Users can view own remittance recipients" ON remittance_recipients;
DROP POLICY IF EXISTS "Users can create own remittance recipients" ON remittance_recipients;
DROP POLICY IF EXISTS "Users can update own remittance recipients" ON remittance_recipients;
DROP POLICY IF EXISTS "Service role can manage remittance recipients" ON remittance_recipients;

-- Users can view their own remittances
-- user_id is UUID, compare with auth.uid() (also UUID)
CREATE POLICY "Users can view own remittances"
  ON remittances FOR SELECT
  USING (auth.uid() = remittances.user_id);

-- Users can create their own remittances
CREATE POLICY "Users can create own remittances"
  ON remittances FOR INSERT
  WITH CHECK (auth.uid() = remittances.user_id);

-- Users can update their own remittances
CREATE POLICY "Users can update own remittances"
  ON remittances FOR UPDATE
  USING (auth.uid() = remittances.user_id);

-- Service role can manage all remittances (for API routes)
CREATE POLICY "Service role can manage remittances"
  ON remittances FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users can view their own remittance recipients
CREATE POLICY "Users can view own remittance recipients"
  ON remittance_recipients FOR SELECT
  USING (auth.uid() = remittance_recipients.user_id);

-- Users can create their own remittance recipients
CREATE POLICY "Users can create own remittance recipients"
  ON remittance_recipients FOR INSERT
  WITH CHECK (auth.uid() = remittance_recipients.user_id);

-- Users can update their own remittance recipients
CREATE POLICY "Users can update own remittance recipients"
  ON remittance_recipients FOR UPDATE
  USING (auth.uid() = remittance_recipients.user_id);

-- Service role can manage all remittance recipients (for API routes)
CREATE POLICY "Service role can manage remittance recipients"
  ON remittance_recipients FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

