-- ============================================
-- Supporting Tables Migration
-- Phase 3: Contacts, Settings, Notifications, Savings Goals, SafeLocks
-- ============================================

-- ============================================
-- 10. Contacts Table
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  wallet_address TEXT,
  notes TEXT,
  tags TEXT[],
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 11. Settings Table
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  currency_preference TEXT DEFAULT 'USD',
  language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  notifications_enabled BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  auto_approve_payments BOOLEAN DEFAULT false,
  auto_approve_limit TEXT DEFAULT '0',
  session_key_auto_renew BOOLEAN DEFAULT true,
  theme TEXT DEFAULT 'dark',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 12. Notifications Table
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'transaction', 'payment', 'invoice', 'remittance', 'subscription', 'system'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  is_read BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP
);

-- ============================================
-- 13. Savings Goals Table
-- ============================================
CREATE TABLE IF NOT EXISTS savings_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount TEXT NOT NULL,
  current_amount TEXT DEFAULT '0',
  currency TEXT NOT NULL,
  deadline TIMESTAMP,
  auto_save BOOLEAN DEFAULT false,
  auto_save_amount TEXT,
  auto_save_frequency TEXT, -- 'daily', 'weekly', 'monthly'
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 14. SafeLocks Table
-- ============================================
CREATE TABLE IF NOT EXISTS safe_locks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount TEXT NOT NULL,
  currency TEXT NOT NULL,
  unlock_date TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'locked', -- 'locked', 'unlocked', 'cancelled'
  auto_unlock BOOLEAN DEFAULT true,
  early_unlock_allowed BOOLEAN DEFAULT false,
  early_unlock_fee_percent DECIMAL DEFAULT 0,
  transaction_hash TEXT,
  unlocked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Contacts indexes
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_wallet_address ON contacts(wallet_address);
CREATE INDEX IF NOT EXISTS idx_contacts_is_favorite ON contacts(is_favorite);

-- Settings indexes
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);

-- Savings Goals indexes
CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON savings_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_wallet_id ON savings_goals(wallet_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_is_completed ON savings_goals(is_completed);
CREATE INDEX IF NOT EXISTS idx_savings_goals_deadline ON savings_goals(deadline);

-- SafeLocks indexes
CREATE INDEX IF NOT EXISTS idx_safe_locks_user_id ON safe_locks(user_id);
CREATE INDEX IF NOT EXISTS idx_safe_locks_wallet_id ON safe_locks(wallet_id);
CREATE INDEX IF NOT EXISTS idx_safe_locks_status ON safe_locks(status);
CREATE INDEX IF NOT EXISTS idx_safe_locks_unlock_date ON safe_locks(unlock_date);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE safe_locks ENABLE ROW LEVEL SECURITY;

-- Contacts: Users can view their own contacts
CREATE POLICY "Users can view own contacts"
  ON contacts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = contacts.user_id
    )
  );

-- Settings: Users can view their own settings
CREATE POLICY "Users can view own settings"
  ON settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = settings.user_id
    )
  );

-- Notifications: Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = notifications.user_id
    )
  );

-- Savings Goals: Users can view their own savings goals
CREATE POLICY "Users can view own savings goals"
  ON savings_goals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = savings_goals.user_id
    )
  );

-- SafeLocks: Users can view their own safe locks
CREATE POLICY "Users can view own safe locks"
  ON safe_locks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = safe_locks.user_id
    )
  );

-- ============================================
-- Auto-update Triggers
-- ============================================

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_savings_goals_updated_at
  BEFORE UPDATE ON savings_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_safe_locks_updated_at
  BEFORE UPDATE ON safe_locks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

