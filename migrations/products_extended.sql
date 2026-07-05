-- Run in Supabase Dashboard → SQL Editor
-- Adds columns expected by the GymSword admin UI and storefront.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS collection TEXT,
  ADD COLUMN IF NOT EXISTS product_type TEXT,
  ADD COLUMN IF NOT EXISTS brand TEXT DEFAULT 'GymSword',
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fabric TEXT,
  ADD COLUMN IF NOT EXISTS weight TEXT,
  ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS colors JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_trending BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_sale BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_new_arrival BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb;

-- Backfill legacy rows into the new shape.
UPDATE public.products
SET
  slug = COALESCE(slug, lower(regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'))),
  category = COALESCE(category, gender),
  stock_quantity = COALESCE(stock_quantity, stock, 0),
  images = CASE
    WHEN images IS NULL OR images = '[]'::jsonb THEN
      CASE WHEN image_url IS NOT NULL THEN jsonb_build_array(jsonb_build_object('url', image_url, 'alt', name))
      ELSE '[]'::jsonb END
    ELSE images
  END,
  colors = CASE
    WHEN colors IS NULL OR colors = '[]'::jsonb THEN
      CASE WHEN color IS NOT NULL AND color <> '' THEN to_jsonb(string_to_array(color, ','))
      ELSE '[]'::jsonb END
    ELSE colors
  END
WHERE slug IS NULL OR category IS NULL OR stock_quantity IS NULL OR images = '[]'::jsonb;

CREATE INDEX IF NOT EXISTS products_category_idx ON public.products (category);
CREATE INDEX IF NOT EXISTS products_product_type_idx ON public.products (product_type);
CREATE INDEX IF NOT EXISTS products_collection_idx ON public.products (collection);
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_unique_idx ON public.products (slug) WHERE slug IS NOT NULL;
