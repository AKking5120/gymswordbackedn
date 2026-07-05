-- Run in Supabase Dashboard -> SQL Editor
-- Adds a 5-digit random unique public_id to all users for admin tracking.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS public_id VARCHAR(10) UNIQUE;

-- Generate unique 5-digit IDs for existing users that don't have one
DO $$
DECLARE
  rec RECORD;
  new_id VARCHAR(10);
  id_exists BOOLEAN;
BEGIN
  FOR rec IN SELECT id FROM public.users WHERE public_id IS NULL LOOP
    LOOP
      new_id := LPAD(FLOOR(10000 + RANDOM() * 90000)::TEXT, 5, '0');
      SELECT EXISTS(SELECT 1 FROM public.users WHERE public_id = new_id) INTO id_exists;
      EXIT WHEN NOT id_exists;
    END LOOP;
    UPDATE public.users SET public_id = new_id WHERE id = rec.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_public_id_unique_idx ON public.users (public_id) WHERE public_id IS NOT NULL;
