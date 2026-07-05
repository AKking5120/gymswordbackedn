const supabase = require('../config/db');
const { sendSuccess, sendError, formatOrderNumber } = require('../utils/helpers');
const { formatProduct } = require('../utils/productHelpers');
const { sendVerificationOTP } = require('../services/emailService');

const DEFAULTS = {
  hero_headline: process.env.HERO_HEADLINE || 'Forge Your Legacy',
  hero_subheadline: process.env.HERO_SUBHEADLINE || 'Premium gymwear engineered for performance.',
  announcement_bar: process.env.ANNOUNCEMENT_BAR || '',
  coming_soon: process.env.COMING_SOON === 'true',
  show_prices: process.env.SHOW_PRICES !== 'false',
  enable_purchases: process.env.ENABLE_PURCHASES !== 'false',
  free_shipping_threshold: 999,
  standard_shipping_fee: 49,
  express_shipping_fee: 149,
  enable_cod: true,
  razorpay_key_id: '',
  razorpay_key_secret: '',
  default_meta_title: 'GymSword - Premium Gymwear',
  default_meta_description: 'Premium gymwear engineered for performance. Shop the latest activewear collections.',
  default_og_image: '',
  gst_percentage: 18,
  instagram_url: 'https://instagram.com/gymsword',
  facebook_url: 'https://facebook.com/gymsword',
  youtube_url: 'https://youtube.com/@gymsword',
  twitter_url: 'https://x.com/gymsword',
  pinterest_url: 'https://pinterest.com/gymsword',
  logo_url: '',
  primary_color: '#000000',
  accent_color: '#ffffff',
};

async function loadSettings() {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('data')
      .eq('id', 1)
      .single();
    if (error || !data) return { ...DEFAULTS };
    return { ...DEFAULTS, ...data.data };
  } catch {
    return { ...DEFAULTS };
  }
}

async function saveSettings(partial) {
  const current = await loadSettings();
  const merged = { ...current, ...partial };
  await supabase
    .from('settings')
    .upsert({ id: 1, data: merged, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  return merged;
}

const getStats = async (req, res) => {
  try {
    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('id, total_amount, status, created_at, user_id')
      .neq('status', 'cancelled');
    if (ordersErr) throw ordersErr;

    const total_revenue = orders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
    const total_orders  = orders.length;

    const { count: total_users } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'user');

    const { count: total_products } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true });

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const recentOrders = orders.filter(o => new Date(o.created_at) >= since);

    const trendMap = {};
    const orderCountMap = {};
    for (const o of recentOrders) {
      const day = new Date(o.created_at).toLocaleDateString('en-IN', { month: '2-digit', day: '2-digit' });
      trendMap[day] = (trendMap[day] || 0) + (parseFloat(o.total_amount) || 0);
      orderCountMap[day] = (orderCountMap[day] || 0) + 1;
    }
    const allDays = [...new Set([...Object.keys(trendMap), ...Object.keys(orderCountMap)])].sort();
    const revenue_trend = allDays.map(_id => ({
      _id,
      revenue: trendMap[_id] || 0,
      orders: orderCountMap[_id] || 0,
    }));

    const { data: orderItems } = await supabase
      .from('order_items')
      .select('product_id, quantity, orders!inner(status)');

    const { data: products } = await supabase
      .from('products')
      .select('id, name');

    const productMap = Object.fromEntries((products || []).map(p => [p.id, p.name]));
    const qtyMap = {};
    for (const item of (orderItems || [])) {
      if (item.orders?.status === 'cancelled') continue;
      qtyMap[item.product_id] = (qtyMap[item.product_id] || 0) + (item.quantity || 0);
    }
    const top_products = Object.entries(qtyMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id, qty]) => ({ name: productMap[id] || 'Unknown', qty }));

    const { data: recent } = await supabase
      .from('orders')
      .select('id, status, total_amount, users(email)')
      .order('created_at', { ascending: false })
      .limit(10);

    const recent_orders = (recent || []).map(o => ({
      id:           o.id,
      order_number: formatOrderNumber(o.id),
      status:       o.status,
      total:        parseFloat(o.total_amount) || 0,
      user_email:   o.users?.email || '',
    }));

    const { count: unverified_users } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'user')
      .eq('email_verified', false);

    sendSuccess(res, { data: {
      total_revenue,
      total_orders,
      total_users:    total_users    || 0,
      total_products: total_products || 0,
      unverified_users: unverified_users || 0,
      revenue_trend,
      top_products,
      recent_orders,
    } });
  } catch (err) {
    console.error('getStats error:', err);
    sendError(res, 'Failed to load stats');
  }
};

const getAdminSettings = async (req, res) => {
  try {
    const settings = await loadSettings();
    sendSuccess(res, { data: { ...settings, coming_soon_env: process.env.COMING_SOON === 'true' } });
  } catch (err) {
    console.error('getAdminSettings error:', err);
    sendError(res, 'Failed to load settings');
  }
};

const updateAdminSettings = async (req, res) => {
  try {
    const allowed = ['hero_headline', 'hero_subheadline', 'announcement_bar',
                     'coming_soon', 'show_prices', 'enable_purchases',
                     'free_shipping_threshold', 'standard_shipping_fee', 'express_shipping_fee',
                     'enable_cod', 'razorpay_key_id', 'razorpay_key_secret',
                     'default_meta_title', 'default_meta_description', 'default_og_image',
                     'gst_percentage',
                     'instagram_url', 'facebook_url', 'youtube_url', 'twitter_url', 'pinterest_url',
                     'logo_url', 'primary_color', 'accent_color'];
    const update = {};
    for (const key of allowed) {
      if (key in req.body) update[key] = req.body[key];
    }
    if (update.coming_soon) {
      update.show_prices = false;
    }
    const merged = await saveSettings(update);
    sendSuccess(res, { data: merged }, 'Settings updated');
  } catch (err) {
    console.error('updateAdminSettings error:', err);
    sendError(res, 'Failed to update settings');
  }
};

const getPublicSettings = async (req, res) => {
  try {
    const settings = await loadSettings();
    let { hero_headline, hero_subheadline, announcement_bar,
          coming_soon, show_prices, enable_purchases } = settings;
    if (coming_soon) show_prices = false;
    sendSuccess(res, { data: { hero_headline, hero_subheadline, announcement_bar,
                       coming_soon, show_prices, enable_purchases } });
  } catch (err) {
    console.error('getPublicSettings error:', err);
    sendError(res, 'Failed to load settings');
  }
};

const getAdminProducts = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    sendSuccess(res, { data: (data || []).map(formatProduct) });
  } catch (err) {
    console.error('getAdminProducts error:', err);
    sendError(res, 'Failed to load products');
  }
};

const getCustomers = async (req, res) => {
  try {
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id, name, email, created_at, public_id, email_verified, is_disabled')
      .eq('role', 'user')
      .order('created_at', { ascending: false });
    if (usersErr) throw usersErr;

    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('user_id, total_amount, status')
      .neq('status', 'cancelled');
    if (ordersErr) throw ordersErr;

    const { data: referrals, error: referralsErr } = await supabase
      .from('referrals')
      .select('referrer_id');
    if (referralsErr) throw referralsErr;

    const stats = {};
    for (const order of orders || []) {
      if (!stats[order.user_id]) stats[order.user_id] = { order_count: 0, total_spent: 0 };
      stats[order.user_id].order_count += 1;
      stats[order.user_id].total_spent += parseFloat(order.total_amount) || 0;
    }

    const referralCounts = {};
    for (const ref of referrals || []) {
      referralCounts[ref.referrer_id] = (referralCounts[ref.referrer_id] || 0) + 1;
    }

    const customers = (users || []).map((user) => ({
      ...user,
      order_count: stats[user.id]?.order_count || 0,
      total_spent: stats[user.id]?.total_spent || 0,
      referral_count: referralCounts[user.id] || 0,
      public_id: user.public_id || user.id,
    }));

    sendSuccess(res, { data: customers });
  } catch (err) {
    console.error('getCustomers error:', err);
    sendError(res, 'Failed to load customers');
  }
};

const getAdminUsers = async (req, res) => {
  try {
    const { verified, disabled } = req.query;
    let query = supabase
      .from('users')
      .select('*')
      .eq('role', 'user')
      .order('created_at', { ascending: false });

    if (verified === 'true') query = query.eq('email_verified', true);
    if (verified === 'false') query = query.eq('email_verified', false);
    if (disabled === 'true') query = query.eq('is_disabled', true);
    if (disabled === 'false') query = query.eq('is_disabled', false);

    const { data, error } = await query;
    if (error) return sendError(res, error.message);
    const safe = (data || []).map(({ password, email_verification_otp, reset_otp, ...u }) => u);
    sendSuccess(res, { data: safe });
  } catch (err) {
    sendError(res, err.message);
  }
};

const adminResendVerification = async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, name, email, email_verified')
      .eq('id', req.params.id)
      .single();

    if (!user) return sendError(res, 'User not found', 404);
    if (user.email_verified) return sendError(res, 'Email already verified', 400);

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabase
      .from('users')
      .update({ email_verification_otp: otp, email_verification_expiry: expiry })
      .eq('id', user.id);

    sendVerificationOTP(user, otp).catch(e => console.error('Admin resend OTP failed:', e.message));
    sendSuccess(res, {}, 'Verification email resent');
  } catch (err) {
    sendError(res, err.message);
  }
};

const adminToggleDisableUser = async (req, res) => {
  try {
    const { disabled } = req.body;
    const { data: user } = await supabase
      .from('users')
      .select('id, is_disabled')
      .eq('id', req.params.id)
      .single();

    if (!user) return sendError(res, 'User not found', 404);

    await supabase
      .from('users')
      .update({ is_disabled: disabled !== false })
      .eq('id', user.id);

    sendSuccess(res, {}, disabled === false ? 'Account enabled' : 'Account disabled');
  } catch (err) {
    sendError(res, err.message);
  }
};

const adminGetLoginHistory = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('login_history')
      .select('*')
      .eq('user_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return sendError(res, error.message);
    sendSuccess(res, { data });
  } catch (err) {
    sendError(res, err.message);
  }
};

const adminGetEmailLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { data, error, count } = await supabase
      .from('email_logs')
      .select('*, users!inner(name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) return sendError(res, error.message);
    sendSuccess(res, { data, pagination: { total: count, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    sendError(res, err.message);
  }
};

module.exports = {
  getStats,
  getAdminSettings,
  updateAdminSettings,
  getPublicSettings,
  getAdminProducts,
  getCustomers,
  getAdminUsers,
  adminResendVerification,
  adminToggleDisableUser,
  adminGetLoginHistory,
  adminGetEmailLogs,
};
