-- ============================================
-- Feature Tables Migration
-- Phase 2: Invoices, Remittances, Subscriptions, Scheduled Payments, Sub Accounts
-- ============================================

-- ============================================
-- 5. Invoices Table
-- ============================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  invoice_number TEXT UNIQUE NOT NULL,
  recipient TEXT NOT NULL,
  recipient_address TEXT,
  amount TEXT NOT NULL,
  currency TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP NOT NULL,
  status TEXT NOT NULL, -- 'draft', 'sent', 'paid', 'overdue', 'cancelled'
  paid_at TIMESTAMP,
  payment_hash TEXT,
  early_payment_discount JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 6. Remittances Table
-- ============================================
CREATE TABLE IF NOT EXISTS remittances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  remittance_number TEXT UNIQUE NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_address TEXT,
  recipient_country TEXT NOT NULL,
  recipient_currency TEXT NOT NULL,
  amount TEXT NOT NULL,
  converted_amount TEXT NOT NULL,
  exchange_rate DECIMAL NOT NULL,
  fee TEXT NOT NULL,
  total_amount TEXT NOT NULL,
  status TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
  transaction_hash TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 7. Subscriptions Table
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
  merchant TEXT NOT NULL,
  amount TEXT NOT NULL,
  currency TEXT NOT NULL,
  frequency TEXT NOT NULL, -- 'daily', 'weekly', 'monthly'
  day_of_month INTEGER,
  weekday INTEGER,
  next_charge_at TIMESTAMP NOT NULL,
  auto_renew BOOLEAN DEFAULT true,
  remind_before_ms BIGINT,
  paused BOOLEAN DEFAULT false,
  last_reminder_shown_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 8. Scheduled Payments Table
-- ============================================
CREATE TABLE IF NOT EXISTS scheduled_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
  amount TEXT NOT NULL,
  currency TEXT NOT NULL,
  to_address TEXT NOT NULL,
  scheduled_for TIMESTAMP NOT NULL,
  status TEXT NOT NULL, -- 'pending', 'executed', 'cancelled', 'failed'
  executed_at TIMESTAMP,
  transaction_hash TEXT,
  failure_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 9. Sub Accounts Table
-- ============================================
CREATE TABLE IF NOT EXISTS sub_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  master_wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
  wallet_id TEXT NOT NULL,
  address TEXT NOT NULL,
  daily_spend_limit TEXT NOT NULL,
  per_transaction_limit TEXT NOT NULL,
  total_spent_today TEXT DEFAULT '0.00',
  last_reset_date TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  gas_sponsored BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- Remittances indexes
CREATE INDEX IF NOT EXISTS idx_remittances_user_id ON remittances(user_id);
CREATE INDEX IF NOT EXISTS idx_remittances_status ON remittances(status);
CREATE INDEX IF NOT EXISTS idx_remittances_remittance_number ON remittances(remittance_number);
CREATE INDEX IF NOT EXISTS idx_remittances_created_at ON remittances(created_at DESC);

-- Subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_wallet_id ON subscriptions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_charge_at ON subscriptions(next_charge_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_paused ON subscriptions(paused);

-- Scheduled Payments indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_user_id ON scheduled_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_wallet_id ON scheduled_payments(wallet_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_scheduled_for ON scheduled_payments(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_status ON scheduled_payments(status);

-- Sub Accounts indexes
CREATE INDEX IF NOT EXISTS idx_sub_accounts_user_id ON sub_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_accounts_master_wallet_id ON sub_accounts(master_wallet_id);
CREATE INDEX IF NOT EXISTS idx_sub_accounts_address ON sub_accounts(address);
CREATE INDEX IF NOT EXISTS idx_sub_accounts_is_active ON sub_accounts(is_active);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE remittances ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_accounts ENABLE ROW LEVEL SECURITY;

-- Invoices: Users can view their own invoices
CREATE POLICY "Users can view own invoices"
  ON invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = invoices.user_id
    )
  );

-- Remittances: Users can view their own remittances
CREATE POLICY "Users can view own remittances"
  ON remittances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = remittances.user_id
    )
  );

-- Subscriptions: Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = subscriptions.user_id
    )
  );

-- Scheduled Payments: Users can view their own scheduled payments
CREATE POLICY "Users can view own scheduled payments"
  ON scheduled_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = scheduled_payments.user_id
    )
  );

-- Sub Accounts: Users can view their own sub accounts
CREATE POLICY "Users can view own sub accounts"
  ON sub_accounts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = sub_accounts.user_id
    )
  );

-- ============================================
-- Auto-update Triggers
-- ============================================

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_remittances_updated_at
  BEFORE UPDATE ON remittances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduled_payments_updated_at
  BEFORE UPDATE ON scheduled_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sub_accounts_updated_at
  BEFORE UPDATE ON sub_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

