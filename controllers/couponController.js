const supabase = require('../config/db');
const { sendSuccess, sendError } = require('../utils/helpers');

// POST /api/coupons/validate
const validateCoupon = async (req, res) => {
  try {
    const { code, cart_total } = req.body;
    if (!code) return sendError(res, 'Coupon code required', 400);

    const { data: coupon, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (error || !coupon) return sendError(res, 'Invalid coupon code', 404);
    if (!coupon.is_active) return sendError(res, 'Coupon is no longer active', 400);
    if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) return sendError(res, 'Coupon has expired', 400);
    if (coupon.one_time_use && (coupon.used_count || 0) >= 1) return sendError(res, 'Coupon has already been used', 400);
    if (coupon.min_order && cart_total < coupon.min_order) return sendError(res, `Minimum order amount of ₹${coupon.min_order} required`, 400);

    let discount = 0;
    if (coupon.discount_type === 'percentage') {
      discount = (cart_total * coupon.discount_value) / 100;
    } else {
      discount = coupon.discount_value;
    }
    discount = Math.min(discount, cart_total);

    return sendSuccess(res, {
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      discount_amount: parseFloat(discount.toFixed(2)),
      final_total: parseFloat((cart_total - discount).toFixed(2)),
    }, 'Coupon applied');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// POST /api/coupons/use — called after successful order placement
const useCoupon = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return sendError(res, 'Coupon code required', 400);

    const { data: coupon } = await supabase.from('coupons').select('id, used_count').eq('code', code.toUpperCase()).single();
    if (!coupon) return sendError(res, 'Coupon not found', 404);

    const { error } = await supabase
      .from('coupons')
      .update({ used_count: (coupon.used_count || 0) + 1 })
      .eq('id', coupon.id);

    if (error) return sendError(res, error.message);
    return sendSuccess(res, {}, 'Coupon usage recorded');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /api/coupons (admin)
const getAllCoupons = async (req, res) => {
  try {
    const { data, error } = await supabase.from('coupons').select('*').order('id', { ascending: false });
    if (error) return sendError(res, error.message);
    return sendSuccess(res, { data: data || [] });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// POST /api/coupons (admin)
const createCoupon = async (req, res) => {
  try {
    const { code, discount_type, discount_value, min_order, one_time_use, expiry_date, is_active } = req.body;
    if (!code || !discount_type || discount_value == null) return sendError(res, 'code, discount_type, discount_value are required', 400);

    const payload = {
      code: code.toUpperCase(),
      discount_type,
      discount_value,
      min_order: min_order || 0,
      one_time_use: one_time_use || false,
      used_count: 0,
      expiry_date: expiry_date || null,
      is_active: is_active !== false,
    };

    const { data, error } = await supabase.from('coupons').insert(payload).select().single();
    if (error) return sendError(res, error.message);
    return sendSuccess(res, { data }, 'Coupon created', 201);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// PUT /api/coupons/:id (admin)
const updateCoupon = async (req, res) => {
  try {
    const { code, discount_type, discount_value, min_order, one_time_use, expiry_date, is_active } = req.body;
    const payload = {};
    if (code !== undefined) payload.code = code.toUpperCase();
    if (discount_type !== undefined) payload.discount_type = discount_type;
    if (discount_value !== undefined) payload.discount_value = discount_value;
    if (min_order !== undefined) payload.min_order = min_order;
    if (one_time_use !== undefined) payload.one_time_use = one_time_use;
    if (expiry_date !== undefined) payload.expiry_date = expiry_date;
    if (is_active !== undefined) payload.is_active = is_active;

    const { data, error } = await supabase.from('coupons').update(payload).eq('id', req.params.id).select().single();
    if (error) return sendError(res, error.message);
    return sendSuccess(res, { data }, 'Coupon updated');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// DELETE /api/coupons/:id (admin)
const deleteCoupon = async (req, res) => {
  try {
    const { error } = await supabase.from('coupons').delete().eq('id', req.params.id);
    if (error) return sendError(res, error.message);
    return sendSuccess(res, {}, 'Coupon deleted');
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = { validateCoupon, useCoupon, getAllCoupons, createCoupon, updateCoupon, deleteCoupon };
