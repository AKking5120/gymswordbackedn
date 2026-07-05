const supabase = require('../config/db');

const sendSuccess = (res, data, message = 'OK', statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });
const sendError = (res, message = 'Server error', statusCode = 500) =>
  res.status(statusCode).json({ success: false, message });

// ─── BLOG ──────────────────────────────────────────────────────
const getBlogPosts = async (req, res) => {
  try {
    const { data } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false });
    sendSuccess(res, data || []);
  } catch { sendError(res); }
};
const createBlogPost = async (req, res) => {
  try {
    const { title, content, excerpt, image_url, author, is_published } = req.body;
    if (!title) return sendError(res, 'Title required', 400);
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();
    const { data, error } = await supabase.from('blog_posts').insert({
      title, slug, content, excerpt, image_url, author: author || 'Admin',
      is_published: is_published || false,
      published_at: is_published ? new Date().toISOString() : null,
    }).select();
    if (error) return sendError(res, error.message);
    sendSuccess(res, data[0], 'Blog post created', 201);
  } catch { sendError(res); }
};
const updateBlogPost = async (req, res) => {
  try {
    const { title, content, excerpt, image_url, author, is_published } = req.body;
    const updates = { title, content, excerpt, image_url, author, updated_at: new Date().toISOString() };
    if (is_published !== undefined) {
      updates.is_published = is_published;
      if (is_published) updates.published_at = new Date().toISOString();
    }
    const { data, error } = await supabase.from('blog_posts').update(updates).eq('id', req.params.id).select();
    if (error) return sendError(res, error.message);
    sendSuccess(res, data[0], 'Updated');
  } catch { sendError(res); }
};
const deleteBlogPost = async (req, res) => {
  try {
    await supabase.from('blog_posts').delete().eq('id', req.params.id);
    sendSuccess(res, {}, 'Deleted');
  } catch { sendError(res); }
};

// ─── FAQ ───────────────────────────────────────────────────────
const getFAQs = async (req, res) => {
  try {
    const { data } = await supabase.from('faqs').select('*').order('position').order('created_at');
    sendSuccess(res, data || []);
  } catch { sendError(res); }
};
const createFAQ = async (req, res) => {
  try {
    const { question, answer, category, position } = req.body;
    if (!question || !answer) return sendError(res, 'Question and answer required', 400);
    const { data, error } = await supabase.from('faqs').insert({ question, answer, category: category || 'General', position: position || 0 }).select();
    if (error) return sendError(res, error.message);
    sendSuccess(res, data[0], 'FAQ created', 201);
  } catch { sendError(res); }
};
const updateFAQ = async (req, res) => {
  try {
    const { question, answer, category, position, is_active } = req.body;
    const { data, error } = await supabase.from('faqs').update({ question, answer, category, position, is_active, updated_at: new Date().toISOString() }).eq('id', req.params.id).select();
    if (error) return sendError(res, error.message);
    sendSuccess(res, data[0], 'Updated');
  } catch { sendError(res); }
};
const deleteFAQ = async (req, res) => {
  try { await supabase.from('faqs').delete().eq('id', req.params.id); sendSuccess(res, {}, 'Deleted'); }
  catch { sendError(res); }
};

// ─── RETURN REQUESTS ──────────────────────────────────────────
const getReturnRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    let query = supabase.from('return_requests').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { data, error, count } = await query.range(offset, offset + parseInt(limit) - 1);
    if (error) return sendError(res, error.message);
    sendSuccess(res, { data: data || [], pagination: { total: count, page: parseInt(page), limit: parseInt(limit) } });
  } catch { sendError(res); }
};
const updateReturnRequest = async (req, res) => {
  try {
    const { status, admin_note } = req.body;
    if (!['pending', 'approved', 'rejected', 'completed'].includes(status)) return sendError(res, 'Invalid status', 400);
    const { data, error } = await supabase.from('return_requests').update({ status, admin_note, updated_at: new Date().toISOString() }).eq('id', req.params.id).select();
    if (error) return sendError(res, error.message);
    sendSuccess(res, data[0], `Return ${status}`);
  } catch { sendError(res); }
};

// ─── FLASH SALES ──────────────────────────────────────────────
const getFlashSales = async (req, res) => {
  try {
    const { data } = await supabase.from('flash_sales').select('*').order('created_at', { ascending: false });
    sendSuccess(res, data || []);
  } catch { sendError(res); }
};
const createFlashSale = async (req, res) => {
  try {
    const { title, discount_percent, starts_at, ends_at, product_types, is_active } = req.body;
    if (!title || !discount_percent || !starts_at || !ends_at) return sendError(res, 'Title, discount, dates required', 400);
    const { data, error } = await supabase.from('flash_sales').insert({
      title, discount_percent, starts_at, ends_at, product_types: product_types || [], is_active: is_active !== false,
    }).select();
    if (error) return sendError(res, error.message);
    sendSuccess(res, data[0], 'Flash sale created', 201);
  } catch { sendError(res); }
};
const updateFlashSale = async (req, res) => {
  try {
    const { title, discount_percent, starts_at, ends_at, product_types, is_active } = req.body;
    const { data, error } = await supabase.from('flash_sales').update({
      title, discount_percent, starts_at, ends_at, product_types, is_active, updated_at: new Date().toISOString(),
    }).eq('id', req.params.id).select();
    if (error) return sendError(res, error.message);
    sendSuccess(res, data[0], 'Updated');
  } catch { sendError(res); }
};
const deleteFlashSale = async (req, res) => {
  try { await supabase.from('flash_sales').delete().eq('id', req.params.id); sendSuccess(res, {}, 'Deleted'); }
  catch { sendError(res); }
};
const getActiveFlashSales = async (req, res) => {
  try {
    const now = new Date().toISOString();
    const { data } = await supabase.from('flash_sales').select('*')
      .eq('is_active', true).lte('starts_at', now).gte('ends_at', now).order('created_at');
    sendSuccess(res, data || []);
  } catch { sendError(res); }
};

// ─── SUBSCRIBERS ──────────────────────────────────────────────
const getSubscribers = async (req, res) => {
  try {
    const { data } = await supabase.from('subscribers').select('*').order('created_at', { ascending: false });
    sendSuccess(res, data || []);
  } catch { sendError(res); }
};
const exportSubscribers = async (req, res) => {
  try {
    const { data } = await supabase.from('subscribers').select('email, created_at').eq('is_active', true).order('created_at', { ascending: false });
    const csv = 'Email,Date Subscribed\n' + (data || []).map(s => `${s.email},${new Date(s.created_at).toISOString()}`).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=subscribers.csv');
    res.send(csv);
  } catch { sendError(res); }
};

// ─── EXPORT ────────────────────────────────────────────────────
const exportData = async (req, res) => {
  try {
    const { type } = req.params;
    let data, columns;
    if (type === 'products') {
      const { data: d } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      data = d || []; columns = ['name', 'price', 'sale_price', 'category', 'product_type', 'gender', 'stock_quantity', 'is_active', 'is_sale'];
    } else if (type === 'orders') {
      const { data: d } = await supabase.from('orders').select('*, users(email)').order('created_at', { ascending: false });
      data = (d || []).map(o => ({ order_number: `GS-${String(o.id).padStart(6, '0')}`, customer: o.users?.email || '', status: o.status, total: o.total_amount, payment_method: o.payment_method, created_at: o.created_at }));
      columns = ['order_number', 'customer', 'status', 'total', 'payment_method', 'created_at'];
    } else if (type === 'users') {
      const { data: d } = await supabase.from('users').select('id, name, email, role, wallet_coins, email_verified, is_disabled, created_at').neq('id', 0);
      data = d || []; columns = ['name', 'email', 'role', 'wallet_coins', 'email_verified', 'is_disabled', 'created_at'];
    } else return sendError(res, 'Invalid type', 400);

    const header = columns.join(',');
    const rows = data.map(row => columns.map(c => {
      const v = row[c]; if (v === null || v === undefined) return '';
      if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) return `"${v.replace(/"/g, '""')}"`;
      return String(v);
    }).join(','));
    const csv = header + '\n' + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-${Date.now()}.csv`);
    res.send(csv);
  } catch { sendError(res); }
};

// ─── ADMIN STAFF ──────────────────────────────────────────────
const getAdminStaff = async (req, res) => {
  try {
    const { data } = await supabase.from('users').select('id, name, email, role, created_at, is_disabled').in('role', ['admin', 'super_admin']).order('created_at');
    sendSuccess(res, data || []);
  } catch { sendError(res); }
};
const updateStaffRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'user', 'super_admin'].includes(role)) return sendError(res, 'Invalid role', 400);
    await supabase.from('users').update({ role }).eq('id', req.params.id);
    sendSuccess(res, {}, 'Role updated');
  } catch { sendError(res); }
};

module.exports = {
  getBlogPosts, createBlogPost, updateBlogPost, deleteBlogPost,
  getFAQs, createFAQ, updateFAQ, deleteFAQ,
  getReturnRequests, updateReturnRequest,
  getFlashSales, createFlashSale, updateFlashSale, deleteFlashSale, getActiveFlashSales,
  getSubscribers, exportSubscribers,
  exportData,
  getAdminStaff, updateStaffRole,
};
