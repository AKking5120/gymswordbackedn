const supabase = require('../config/db');
const { sendSuccess, sendError } = require('../utils/helpers');
const { formatProduct, writeProduct } = require('../utils/productHelpers');

// GET /api/products
const getProducts = async (req, res) => {
  try {
    const {
      category_id,
      category,
      collection,
      featured,
      trending,
      best_sellers,
      gender,
      product_type,
      min_price,
      max_price,
      search,
      q,
      sort,
      page = 1,
      limit = 12,
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const searchTerm = search || q;

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true);

    if (category_id) query = query.eq('category_id', category_id);
    if (category && category !== 'accessories' && category !== 'new' && category !== 'sale') query = query.eq('gender', category);
    if (product_type) query = query.eq('product_type', product_type);
    if (featured === 'true') query = query.eq('is_featured', true);
    if (trending === 'true') query = query.eq('is_trending', true);
    if (best_sellers === 'true') {
      const { data: salesData } = await supabase
        .from('order_items')
        .select('product_id, quantity, orders!inner(status)')
        .neq('orders.status', 'cancelled');
      const salesMap = {};
      (salesData || []).forEach(item => {
        if (item.orders?.status === 'cancelled') return;
        salesMap[item.product_id] = (salesMap[item.product_id] || 0) + (item.quantity || 0);
      });
      const topIds = Object.entries(salesMap).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([id]) => id);
      if (topIds.length > 0) query = query.in('id', topIds);
    }
    if (gender) query = query.eq('gender', gender);
    if (min_price) query = query.gte('price', min_price);
    if (max_price) query = query.lte('price', max_price);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      query = query.or(`name.ilike.%${term}%,gender.ilike.%${term}%,product_type.ilike.%${term}%,collection.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%`);
    }

    if (sort === 'price_asc' || sort === 'price-asc') query = query.order('price', { ascending: true });
    else if (sort === 'price_desc' || sort === 'price-desc') query = query.order('price', { ascending: false });
    else if (sort === 'newest') query = query.order('created_at', { ascending: false });
    else if (best_sellers !== 'true') query = query.order('created_at', { ascending: false });

    query = query.range(offset, offset + parseInt(limit) - 1);

    let { data, error, count } = await query;
    if (error && (/column products\.\w+ does not exist/i.test(error.message) || /PGRST204/.test(error.code || ''))) {
      // If product_type filter was requested but column doesn't exist, return empty
      if (product_type && /product_type/i.test(error.message)) {
        return sendSuccess(res, {
          data: [],
          pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), pages: 0 },
        });
      }
      let fallback = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('is_active', true);

      if (category_id) fallback = fallback.eq('category_id', category_id);
      if (category && category !== 'accessories' && category !== 'new' && category !== 'sale') fallback = fallback.eq('gender', category);
      if (gender) fallback = fallback.eq('gender', gender);
      if (min_price) fallback = fallback.gte('price', min_price);
      if (max_price) fallback = fallback.lte('price', max_price);
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        fallback = fallback.or(`name.ilike.%${term}%,gender.ilike.%${term}%,product_type.ilike.%${term}%,collection.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%`);
      }

      if (sort === 'price_asc' || sort === 'price-asc') fallback = fallback.order('price', { ascending: true });
      else if (sort === 'price_desc' || sort === 'price-desc') fallback = fallback.order('price', { ascending: false });
      else if (sort === 'newest') fallback = fallback.order('created_at', { ascending: false });
      else fallback = fallback.order('created_at', { ascending: false });

      fallback = fallback.range(offset, offset + parseInt(limit) - 1);
      ({ data, error, count } = await fallback);
    }
    if (error) return sendError(res, error.message);

    return sendSuccess(res, {
      data: (data || []).map(formatProduct),
      pagination: { total: count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(count / parseInt(limit)) },
    });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /api/products/:id
const getProduct = async (req, res) => {
  try {
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', req.params.id)
      .eq('is_active', true)
      .single();

    if (error || !product) return sendError(res, 'Product not found', 404);

    const { data: reviews } = await supabase
      .from('reviews')
      .select('*, users(name)')
      .eq('product_id', req.params.id)
      .order('created_at', { ascending: false });

    const avgRating = reviews?.length
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

    return sendSuccess(res, { data: { ...formatProduct(product), reviews, avg_rating: avgRating } });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// POST /api/products (admin)
const createProduct = async (req, res) => {
  try {
    const { data, error } = await writeProduct(supabase, req.body);
    if (error) return sendError(res, error.message);
    return sendSuccess(res, { data: formatProduct(data) }, 'Product created', 201);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// PUT /api/products/:id (admin)
const updateProduct = async (req, res) => {
  try {
    const { data, error } = await writeProduct(supabase, req.body, req.params.id);
    if (error) return sendError(res, error.message);
    return sendSuccess(res, { data: formatProduct(data) }, 'Product updated');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// DELETE /api/products/:id (admin)
const deleteProduct = async (req, res) => {
  try {
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', req.params.id);

    if (error) return sendError(res, error.message);
    return sendSuccess(res, {}, 'Product deleted');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /api/categories
const getCategories = async (req, res) => {
  try {
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (error) return sendError(res, error.message);
    return sendSuccess(res, { data });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// POST /api/categories (admin)
const createCategory = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .insert({ name: req.body.name })
      .select()
      .single();

    if (error) return sendError(res, error.message);
    return sendSuccess(res, { data }, 'Category created', 201);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /api/products/:id/reviews
const getProductReviews = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, users(name)')
      .eq('product_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) return sendError(res, error.message);

    const reviews = (data || []).map((review) => ({
      id: review.id,
      rating: review.rating,
      title: review.title || '',
      body: review.comment || review.body || '',
      user_name: review.users?.name || 'Customer',
      created_at: review.created_at,
    }));

    return sendSuccess(res, { data: reviews });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /api/products/:id/related
const getRelatedProducts = async (req, res) => {
  try {
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, category, gender, product_type')
      .eq('id', req.params.id)
      .single();

    if (productError || !product) return sendError(res, 'Product not found', 404);

    const category = product.category || product.gender;
    let query = supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .neq('id', req.params.id)
      .limit(4);

    if (category) query = query.or(`category.eq.${category},gender.eq.${category}`);
    else if (product.product_type) query = query.eq('product_type', product.product_type);

    let { data, error } = await query.order('created_at', { ascending: false });
    if (error && /column products\.(category|product_type) does not exist/i.test(error.message)) {
      ({ data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .neq('id', req.params.id)
        .limit(4)
        .order('created_at', { ascending: false }));
    }

    if (error) return sendError(res, error.message);
    return sendSuccess(res, { data: (data || []).map(formatProduct) });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// POST /api/products/:id/reviews
const addReview = async (req, res) => {
  try {
    const { rating, comment, title, body } = req.body;
    const product_id = req.params.id;
    const reviewText = comment || [title, body].filter(Boolean).join('\n\n');

    if (!rating) return sendError(res, 'rating is required', 400);

    // Check if user already reviewed
    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('product_id', product_id)
      .single();

    if (existing) return sendError(res, 'You already reviewed this product', 409);

    const { data, error } = await supabase
      .from('reviews')
      .insert({ user_id: req.user.id, product_id, rating, comment: reviewText })
      .select()
      .single();

    if (error) return sendError(res, error.message);
    return sendSuccess(res, { data }, 'Review added', 201);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /api/products/wishlist
const getWishlist = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('wishlist')
      .select('*, products(*, categories(name))')
      .eq('user_id', req.user.id);

    if (error) return sendError(res, error.message);
    return sendSuccess(res, { data });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// POST /api/products/:id/wishlist
const toggleWishlist = async (req, res) => {
  try {
    const { data: existing } = await supabase
      .from('wishlist')
      .select('id')
      .eq('user_id', req.user.id)
      .eq('product_id', req.params.id)
      .single();

    if (existing) {
      await supabase.from('wishlist').delete().eq('id', existing.id);
      return sendSuccess(res, { wishlisted: false }, 'Removed from wishlist');
    }

    await supabase.from('wishlist').insert({ user_id: req.user.id, product_id: req.params.id });
    return sendSuccess(res, { wishlisted: true }, 'Added to wishlist', 201);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /api/products/search?q=
const searchProducts = async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    if (!q || !q.trim()) return sendSuccess(res, { data: [] });

    const searchTerm = q.trim();
    const maxResults = Math.min(parseInt(limit) || 10, 50);

    const term = searchTerm.toLowerCase();
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .or(`name.ilike.%${term}%,gender.ilike.%${term}%,category.ilike.%${term}%,product_type.ilike.%${term}%,collection.ilike.%${term}%,description.ilike.%${term}%,sku.ilike.%${term}%`)
      .order('created_at', { ascending: false })
      .limit(maxResults);

    let { data, error, count } = await query;

    if (error && /column products\.\w+ does not exist/i.test(error.message)) {
      query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .or(`name.ilike.%${term}%,gender.ilike.%${term}%,description.ilike.%${term}%`)
        .order('created_at', { ascending: false })
        .limit(maxResults);
      ({ data, error, count } = await query);
    }

    if (error) return sendError(res, error.message);

    // If no results from direct search, try searching in tags (JSON array)
    if (!data || data.length === 0) {
      try {
        const { data: tagResults } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .contains('tags', [searchTerm.toLowerCase()])
          .limit(maxResults);
        if (tagResults && tagResults.length > 0) {
          return sendSuccess(res, { data: tagResults.map(formatProduct), count: tagResults.length });
        }
      } catch { /* tags column might not exist */ }
    }

    return sendSuccess(res, {
      data: (data || []).map(formatProduct),
      count: count || 0,
    });
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = {
  getProducts, getProduct, createProduct, updateProduct, deleteProduct,
  getCategories, createCategory,
  getProductReviews, getRelatedProducts, addReview, getWishlist, toggleWishlist,
  searchProducts,
};
