-- Migration 004: Missing Tables for Complete Migration
-- Creates tables for conversation contexts and address history

-- Conversation Contexts Table
-- Stores AI conversation history for persistence across sessions
CREATE TABLE IF NOT EXISTS conversation_contexts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  session_id TEXT NOT NULL,
  conversation_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, session_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_conversation_contexts_user_session 
  ON conversation_contexts(user_id, session_id);

-- Address History Table
-- Stores transaction history per address for risk scoring
CREATE TABLE IF NOT EXISTS address_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  address TEXT NOT NULL,
  chain TEXT NOT NULL,
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  transaction_count INTEGER DEFAULT 0,
  total_amount_sent TEXT DEFAULT '0',
  total_amount_received TEXT DEFAULT '0',
  risk_score INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, address, chain)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_address_history_user_address 
  ON address_history(user_id, address);
CREATE INDEX IF NOT EXISTS idx_address_history_user_chain 
  ON address_history(user_id, chain);

-- Update contacts table to add type column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'type'
  ) THEN
    ALTER TABLE contacts ADD COLUMN type TEXT DEFAULT 'contact';
  END IF;
END $$;

-- Add index for contact type
CREATE INDEX IF NOT EXISTS idx_contacts_type 
  ON contacts(user_id, type);

-- Enable Row Level Security
ALTER TABLE conversation_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE address_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversation_contexts
CREATE POLICY "Users can view their own conversation contexts"
  ON conversation_contexts FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own conversation contexts"
  ON conversation_contexts FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own conversation contexts"
  ON conversation_contexts FOR UPDATE
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own conversation contexts"
  ON conversation_contexts FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- RLS Policies for address_history
CREATE POLICY "Users can view their own address history"
  ON address_history FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own address history"
  ON address_history FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own address history"
  ON address_history FOR UPDATE
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own address history"
  ON address_history FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- Auto-update updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_conversation_contexts_updated_at
  BEFORE UPDATE ON conversation_contexts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_address_history_updated_at
  BEFORE UPDATE ON address_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

