-- Pending Payments & Phone/Email Wallet Mapping Migration
-- Creates tables for claimable phone/email payments with escrow support

-- Phone/Email to Wallet Mapping Table
-- Maps phone numbers and emails to wallet addresses for instant payments
CREATE TABLE IF NOT EXISTS phone_wallet_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  wallet_address TEXT NOT NULL,
  wallet_id TEXT NOT NULL,
  circle_user_id TEXT NOT NULL,
  verified BOOLEAN DEFAULT false, -- Phone/email verification status
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phone_or_email_required CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_phone_wallet_mappings_phone ON phone_wallet_mappings(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_phone_wallet_mappings_email ON phone_wallet_mappings(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_phone_wallet_mappings_wallet ON phone_wallet_mappings(wallet_address);
CREATE INDEX IF NOT EXISTS idx_phone_wallet_mappings_circle_user ON phone_wallet_mappings(circle_user_id);

-- Pending Payments Table (updated for escrow)
CREATE TABLE IF NOT EXISTS pending_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id TEXT NOT NULL,
  sender_wallet_id TEXT NOT NULL,
  sender_circle_user_id TEXT NOT NULL,
  recipient_phone TEXT,
  recipient_email TEXT,
  amount TEXT NOT NULL, -- Amount in smallest unit (e.g., 1000000 for 1 USDC)
  currency TEXT NOT NULL DEFAULT 'USDC',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'expired', 'cancelled')),
  claim_code TEXT UNIQUE, -- Unique code for claiming
  escrow_address TEXT, -- Escrow contract address where funds are held
  escrow_deposit_tx_hash TEXT, -- Transaction hash of escrow deposit
  claimed_by_user_id TEXT, -- User who claimed this payment
  claimed_by_wallet_id TEXT, -- Wallet that received the funds
  claimed_by_wallet_address TEXT, -- Wallet address that received funds
  claim_tx_hash TEXT, -- Transaction hash of claim (withdrawal from escrow)
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ
);

-- Indexes for pending payments
CREATE INDEX IF NOT EXISTS idx_pending_payments_phone ON pending_payments(recipient_phone) WHERE recipient_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pending_payments_email ON pending_payments(recipient_email) WHERE recipient_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pending_payments_claim_code ON pending_payments(claim_code) WHERE claim_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pending_payments_status ON pending_payments(status);
CREATE INDEX IF NOT EXISTS idx_pending_payments_sender ON pending_payments(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_pending_payments_expires ON pending_payments(expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_pending_payments_escrow ON pending_payments(escrow_address) WHERE escrow_address IS NOT NULL;

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_phone_wallet_mappings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_pending_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_phone_wallet_mappings_updated_at ON phone_wallet_mappings;
CREATE TRIGGER update_phone_wallet_mappings_updated_at
  BEFORE UPDATE ON phone_wallet_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_phone_wallet_mappings_updated_at();

DROP TRIGGER IF EXISTS update_pending_payments_updated_at ON pending_payments;
CREATE TRIGGER update_pending_payments_updated_at
  BEFORE UPDATE ON pending_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_pending_payments_updated_at();

-- RLS Policies
ALTER TABLE phone_wallet_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_payments ENABLE ROW LEVEL SECURITY;

-- Phone/Email mappings: Anyone can read (for claim verification), but only verified users can create
CREATE POLICY "Anyone can view phone wallet mappings"
  ON phone_wallet_mappings FOR SELECT
  USING (true);

CREATE POLICY "Users can create phone wallet mappings"
  ON phone_wallet_mappings FOR INSERT
  WITH CHECK (true); -- Verification happens in application logic

CREATE POLICY "Users can update own phone wallet mappings"
  ON phone_wallet_mappings FOR UPDATE
  USING (true); -- Verification happens in application logic

-- Pending payments policies (same as before)
CREATE POLICY "Senders can view own pending payments"
  ON pending_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id::TEXT = pending_payments.sender_user_id
      AND users.circle_user_id = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY "Recipients can view pending payments by claim code"
  ON pending_payments FOR SELECT
  USING (true);

CREATE POLICY "Users can create pending payments"
  ON pending_payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id::TEXT = pending_payments.sender_user_id
      AND users.circle_user_id = current_setting('app.current_user_id', true)
    )
  );

CREATE POLICY "Users can update own pending payments"
  ON pending_payments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id::TEXT = pending_payments.sender_user_id
      AND users.circle_user_id = current_setting('app.current_user_id', true)
    )
  );
