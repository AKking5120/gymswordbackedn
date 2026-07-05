-- Run in Supabase Dashboard -> SQL Editor
-- Creates wallet_transactions table if it doesn't exist

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  coins INTEGER NOT NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('credit', 'debit')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wallet_transactions_user_id_idx ON public.wallet_transactions (user_id);
