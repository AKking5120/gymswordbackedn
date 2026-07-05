-- Run in Supabase Dashboard → SQL Editor
-- Stores visitor leads captured from the welcome popup.

CREATE TABLE IF NOT EXISTS public.visitor_leads (
  id BIGSERIAL PRIMARY KEY,
  name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visitor_leads_email_idx ON public.visitor_leads (email);
CREATE INDEX IF NOT EXISTS visitor_leads_created_at_idx ON public.visitor_leads (created_at DESC);
