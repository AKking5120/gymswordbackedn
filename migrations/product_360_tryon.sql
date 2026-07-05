-- Run in Supabase Dashboard → SQL Editor
-- Adds enable_360_view and enable_try_now columns to products table.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS enable_360_view BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS enable_try_now BOOLEAN DEFAULT false;
