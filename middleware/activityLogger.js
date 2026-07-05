const supabase = require('../config/db');

const ACTIVITY_TYPES = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  REGISTER: 'register',
  ORDER_PLACED: 'order_placed',
  ORDER_CANCELLED: 'order_cancelled',
  ORDER_UPDATED: 'order_updated',
  PAYMENT_VERIFIED: 'payment_verified',
  PROFILE_UPDATED: 'profile_updated',
  PASSWORD_CHANGED: 'password_changed',
  COUPON_USED: 'coupon_used',
  WALLET_CREDITED: 'wallet_credited',
  WALLET_DEBITED: 'wallet_debited',
  ADMIN_ACTION: 'admin_action',
  PRODUCT_CREATED: 'product_created',
  PRODUCT_UPDATED: 'product_updated',
  PRODUCT_DELETED: 'product_deleted',
};

async function logActivity({ userId, type, description, metadata = null, ip = null }) {
  try {
    await supabase.from('activity_logs').insert({
      user_id: userId,
      activity_type: type,
      description,
      metadata: metadata ? JSON.stringify(metadata) : null,
      ip_address: ip,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}

const activityLogger = (type, getDescription) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = async function (body) {
      if (res.statusCode < 400 && req.user) {
        const description = typeof getDescription === 'function'
          ? getDescription(req, body)
          : getDescription;
        await logActivity({
          userId: req.user.id,
          type,
          description,
          ip: req.ip,
        });
      }
      return originalJson(body);
    };
    next();
  };
};

module.exports = { logActivity, activityLogger, ACTIVITY_TYPES };
