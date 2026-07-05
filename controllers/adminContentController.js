const supabase = require('../config/db');

const sendSuccess = (res, data, message = 'OK', statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

const sendError = (res, message = 'Server error', statusCode = 500) =>
  res.status(statusCode).json({ success: false, message });

// ─── CATEGORIES ───────────────────────────────────────────────

const getAdminCategories = async (req, res) => {
  try {
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (error) return sendError(res, error.message);
    // Attach product count per category
    const result = await Promise.all((data || []).map(async (cat) => {
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('category', cat.name);
      return { ...cat, product_count: count || 0 };
    }));
    sendSuccess(res, result);
  } catch (err) { sendError(res, err.message); }
};

const createCategory = async (req, res) => {
  try {
    const { name, product_type, gender, description, image_url } = req.body;
    if (!name) return sendError(res, 'Name is required', 400);
    const { data, error } = await supabase.from('categories').insert({ name, product_type, gender, description, image_url }).select();
    if (error) return sendError(res, error.message);
    sendSuccess(res, data[0], 'Category created', 201);
  } catch (err) { sendError(res, err.message); }
};

const updateCategory = async (req, res) => {
  try {
    const { name, product_type, gender, description, image_url } = req.body;
    const { data, error } = await supabase.from('categories').update({ name, product_type, gender, description, image_url }).eq('id', req.params.id).select();
    if (error) return sendError(res, error.message);
    if (!data?.length) return sendError(res, 'Category not found', 404);
    sendSuccess(res, data[0], 'Category updated');
  } catch (err) { sendError(res, err.message); }
};

const deleteCategory = async (req, res) => {
  try {
    const { data: cat } = await supabase.from('categories').select('name').eq('id', req.params.id).single();
    if (!cat) return sendError(res, 'Category not found', 404);
    // Reassign products to uncategorized
    await supabase.from('products').update({ category: 'Uncategorized', category_id: null }).eq('category', cat.name);
    const { error } = await supabase.from('categories').delete().eq('id', req.params.id);
    if (error) return sendError(res, error.message);
    sendSuccess(res, {}, 'Category deleted');
  } catch (err) { sendError(res, err.message); }
};

// ─── REVIEWS ──────────────────────────────────────────────────

const getAdminReviews = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    let query = supabase.from('reviews').select('*, users(name, email), products(name, image_url)', { count: 'exact' }).order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { data, error, count } = await query.range(offset, offset + parseInt(limit) - 1);
    if (error) return sendError(res, error.message);
    sendSuccess(res, { data, pagination: { total: count, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { sendError(res, err.message); }
};

const updateReviewStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) return sendError(res, 'Invalid status', 400);
    const { data, error } = await supabase.from('reviews').update({ status }).eq('id', req.params.id).select();
    if (error) return sendError(res, error.message);
    sendSuccess(res, data[0], `Review ${status}`);
  } catch (err) { sendError(res, err.message); }
};

const deleteReview = async (req, res) => {
  try {
    const { error } = await supabase.from('reviews').delete().eq('id', req.params.id);
    if (error) return sendError(res, error.message);
    sendSuccess(res, {}, 'Review deleted');
  } catch (err) { sendError(res, err.message); }
};

// ─── BANNERS ──────────────────────────────────────────────────

const getAdminBanners = async (req, res) => {
  try {
    const { data, error } = await supabase.from('banners').select('*').order('position', { ascending: true });
    if (error) {
      // Table might not exist
      return sendSuccess(res, []);
    }
    sendSuccess(res, data || []);
  } catch (err) { sendSuccess(res, []); }
};

const createBanner = async (req, res) => {
  try {
    const { title, subtitle, image_url, link, btn_text, position, is_active } = req.body;
    if (!title) return sendError(res, 'Title is required', 400);
    const { data, error } = await supabase.from('banners').insert({ title, subtitle, image_url, link, btn_text: btn_text || 'Shop Now', position: position || 0, is_active: is_active !== false }).select();
    if (error) return sendError(res, error.message);
    sendSuccess(res, data[0], 'Banner created', 201);
  } catch (err) { sendError(res, err.message); }
};

const updateBanner = async (req, res) => {
  try {
    const { title, subtitle, image_url, link, btn_text, position, is_active } = req.body;
    const { data, error } = await supabase.from('banners').update({ title, subtitle, image_url, link, btn_text, position, is_active }).eq('id', req.params.id).select();
    if (error) return sendError(res, error.message);
    if (!data?.length) return sendError(res, 'Banner not found', 404);
    sendSuccess(res, data[0], 'Banner updated');
  } catch (err) { sendError(res, err.message); }
};

const deleteBanner = async (req, res) => {
  try {
    const { error } = await supabase.from('banners').delete().eq('id', req.params.id);
    if (error) return sendError(res, error.message);
    sendSuccess(res, {}, 'Banner deleted');
  } catch (err) { sendError(res, err.message); }
};

// Public banners
const getPublicBanners = async (req, res) => {
  try {
    const { data, error } = await supabase.from('banners').select('*').eq('is_active', true).order('position', { ascending: true });
    if (error) return sendSuccess(res, []);
    sendSuccess(res, data || []);
  } catch (err) { sendSuccess(res, []); }
};

module.exports = {
  getAdminCategories, createCategory, updateCategory, deleteCategory,
  getAdminReviews, updateReviewStatus, deleteReview,
  getAdminBanners, createBanner, updateBanner, deleteBanner,
  getPublicBanners,
};
