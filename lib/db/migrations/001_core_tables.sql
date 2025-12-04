-- ============================================
-- Core Tables Migration
-- Phase 1: Users, Wallets, Session Keys, Transactions
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. Users Table
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_user_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  wallet_id TEXT,
  wallet_address TEXT,
  encryption_key TEXT, -- Encrypted
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 2. Wallets Table
-- ============================================
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  circle_wallet_id TEXT UNIQUE NOT NULL,
  address TEXT NOT NULL,
  chain TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 3. Session Keys Table
-- ============================================
CREATE TABLE IF NOT EXISTS session_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
  circle_session_key_id TEXT UNIQUE NOT NULL,
  agent_id TEXT, -- 'inera', 'payments', 'invoice', etc.
  agent_name TEXT,
  agent_description TEXT,
  permissions JSONB NOT NULL,
  spending_limit TEXT,
  spending_used TEXT DEFAULT '0',
  expires_at TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'active', -- 'active', 'expired', 'revoked'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 4. Transactions Table
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
  transaction_hash TEXT UNIQUE NOT NULL,
  chain TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  currency TEXT NOT NULL, -- 'USDC', 'EURC'
  status TEXT NOT NULL, -- 'pending', 'completed', 'failed'
  type TEXT, -- 'transfer', 'bridge', 'cctp', 'payment', etc.
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_circle_user_id ON users(circle_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Wallets indexes
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_circle_wallet_id ON wallets(circle_wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);

-- Session Keys indexes
CREATE INDEX IF NOT EXISTS idx_session_keys_user_id ON session_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_session_keys_wallet_id ON session_keys(wallet_id);
CREATE INDEX IF NOT EXISTS idx_session_keys_agent_id ON session_keys(agent_id);
CREATE INDEX IF NOT EXISTS idx_session_keys_status ON session_keys(status);
CREATE INDEX IF NOT EXISTS idx_session_keys_circle_session_key_id ON session_keys(circle_session_key_id);

-- Transactions indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON transactions(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Users: Can view/update own data
-- Note: We'll use Circle user_id for authentication, not Supabase Auth
-- For now, we'll use service role key for all operations
-- TODO: Implement custom RLS policies based on Circle user_id

-- Wallets: Users can view their own wallets
CREATE POLICY "Users can view own wallets"
  ON wallets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = wallets.user_id
      -- TODO: Add Circle user_id check when RLS is properly configured
    )
  );

-- Session Keys: Users can view their own session keys
CREATE POLICY "Users can view own session keys"
  ON session_keys FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = session_keys.user_id
    )
  );

-- Transactions: Users can view their own transactions
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = transactions.user_id
    )
  );

-- ============================================
-- Functions & Triggers
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_keys_updated_at
  BEFORE UPDATE ON session_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

