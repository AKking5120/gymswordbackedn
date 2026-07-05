const slugify = (name) =>
  (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'product';

const BASE_COLUMNS = new Set([
  'name',
  'description',
  'gender',
  'price',
  'sale_price',
  'stock',
  'color',
  'sizes',
  'image_url',
  'is_active',
  'category_id',
]);

const EXTENDED_COLUMNS = new Set([
  ...BASE_COLUMNS,
  'short_description',
  'compare_at_price',
  'category',
  'collection',
  'product_type',
  'brand',
  'sku',
  'stock_quantity',
  'fabric',
  'weight',
  'images',
  'colors',
  'tags',
  'is_featured',
  'is_trending',
  'is_sale',
  'is_new_arrival',
  'enable_360_view',
  'enable_try_now',
  'rating',
  'review_count',
  'variants',
  'slug',
]);

const parseListField = (value) => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => parseListField(item));
  }
  if (value == null || value === '') return [];
  if (typeof value !== 'string') return [String(value).trim()].filter(Boolean);

  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      try {
        const parsed = JSON.parse(trimmed.replace(/'/g, '"'));
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
      } catch {
        // fall through to comma split
      }
    }
  }

  return trimmed
    .split(',')
    .map((item) => item.trim().replace(/^['"\[]+|['"\]]+$/g, ''))
    .filter(Boolean);
};

const normalizeSizes = (sizes) => {
  const list = parseListField(sizes);
  return list.length ? list.join(', ') : null;
};

const getAvailableStock = (product) =>
  Number(product?.stock_quantity ?? product?.stock ?? 0);

const toDbPayload = (body, { extended = true } = {}) => {
  const allowed = extended ? EXTENDED_COLUMNS : BASE_COLUMNS;
  const mapped = {
    name: body.name?.trim(),
    description: body.description || null,
    short_description: body.short_description || null,
    gender: body.gender || body.category || null,
    price: Number(body.price) || 0,
    sale_price: body.sale_price ?? null,
    compare_at_price: body.compare_at_price ?? null,
    stock: Number(body.stock_quantity ?? body.stock ?? 0),
    stock_quantity: Number(body.stock_quantity ?? body.stock ?? 0),
    color: Array.isArray(body.colors) ? body.colors.join(', ') : body.color || null,
    colors: Array.isArray(body.colors) && body.colors.length ? body.colors : null,
    sizes: normalizeSizes(body.sizes),
    image_url: body.images?.[0]?.url || body.image_url || null,
    images: body.images?.length ? body.images : null,
    is_active: body.is_active !== false,
    category_id: body.category_id ?? null,
    category: body.category || null,
    collection: body.collection || null,
    product_type: body.product_type || null,
    brand: body.brand || null,
    sku: body.sku || null,
    fabric: body.fabric || null,
    weight: body.weight || null,
    tags: Array.isArray(body.tags) && body.tags.length ? body.tags : null,
    is_featured: !!body.is_featured,
    is_trending: !!body.is_trending,
    is_sale: !!body.is_sale,
    is_new_arrival: !!body.is_new_arrival,
    enable_360_view: !!body.enable_360_view,
    enable_try_now: !!body.enable_try_now,
    rating: body.rating ?? 0,
    review_count: body.review_count ?? 0,
    variants: Array.isArray(body.variants) && body.variants.length ? body.variants : null,
    slug: body.slug || slugify(body.name),
  };

  const payload = {};
  for (const [key, value] of Object.entries(mapped)) {
    if (!allowed.has(key) || value === undefined) continue;
    payload[key] = value;
  }
  return payload;
};

const formatProduct = (product) => {
  if (!product) return product;

  const raw = typeof product.images === 'string' ? (() => { try { return JSON.parse(product.images); } catch { return []; } })() : product.images;
  const images = raw?.length
    ? raw
    : product.image_url
      ? [{ url: product.image_url, alt: product.name || '' }]
      : [];

  const colors = Array.isArray(product.colors) && product.colors.length
    ? product.colors
    : product.color
      ? product.color.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

  const sizes = parseListField(product.sizes);

  return {
    ...product,
    images,
    colors,
    sizes,
    category: product.category || product.gender || '',
    compare_at_price: product.compare_at_price ?? null,
    stock_quantity: product.stock_quantity ?? product.stock ?? 0,
    short_description: product.short_description || '',
    product_type: product.product_type || '',
    collection: product.collection || '',
    slug: product.slug || slugify(product.name),
    rating: Number(product.rating) || 0,
    review_count: Number(product.review_count) || 0,
    is_featured: !!product.is_featured,
    is_trending: !!product.is_trending,
    is_sale: !!product.is_sale,
    is_new_arrival: !!product.is_new_arrival,
    enable_360_view: product.enable_360_view !== undefined ? !!product.enable_360_view : true,
    enable_try_now: product.enable_try_now !== undefined ? !!product.enable_try_now : true,
    tags: product.tags || [],
    variants: product.variants || [],
  };
};

const isMissingColumnError = (error) =>
  error?.code === 'PGRST204' || /could not find the .* column/i.test(error?.message || '');

const writeProduct = async (supabase, body, id) => {
  let payload = toDbPayload(body, { extended: true });
  let query = id
    ? supabase.from('products').update(payload).eq('id', id).select().single()
    : supabase.from('products').insert(payload).select().single();

  let { data, error } = await query;
  if (error && isMissingColumnError(error)) {
    payload = toDbPayload(body, { extended: false });
    query = id
      ? supabase.from('products').update(payload).eq('id', id).select().single()
      : supabase.from('products').insert(payload).select().single();
    ({ data, error } = await query);
  }

  return { data, error };
};

module.exports = {
  slugify,
  parseListField,
  getAvailableStock,
  toDbPayload,
  formatProduct,
  isMissingColumnError,
  writeProduct,
};
