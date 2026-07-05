const supabase = require('../config/db');
const {
  handleTextIntent, handleSizeRecommendation, handleCompare,
  handleVoiceTranscribe, handleCartAction,
  searchProducts, getCartItems, getWishlist, getOrders,
  getWalletInfo, getPersonalizedRecommendations, adminStats,
} = require('../services/chatbotService');
const { sendSuccess, sendError } = require('../utils/helpers');

async function saveToHistory(userId, message, reply, type) {
  try {
    await supabase.from('chat_history').insert({ user_id: userId, role: 'user', content: typeof message === 'string' ? message : JSON.stringify(message) });
    await supabase.from('chat_history').insert({ user_id: userId, role: 'assistant', content: typeof reply === 'string' ? reply : JSON.stringify(reply), metadata: { type } });
  } catch {}
}

function buildUserContext(req) {
  if (!req.user) return {};
  return { user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role } };
}

const chat = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) return sendError(res, 'Message is required', 400);
    const userContext = buildUserContext(req);
    const result = await handleTextIntent(message.trim(), userContext);
    if (req.user) saveToHistory(req.user.id, message, result.reply, result.type);
    sendSuccess(res, {
      reply: result.reply,
      type: result.type || 'text',
      products: result.products || null,
      navigation: result.navigation || null,
      quick_replies: result.quick_replies || [],
    });
  } catch (err) {
    console.error('AI chat error:', err.message);
    sendError(res, 'AI service temporarily unavailable. Please try again.');
  }
};

const sizeRecommendation = async (req, res) => {
  try {
    const { height, weight, age, gender, fit, workout } = req.body;
    const result = await handleSizeRecommendation({ height, weight, age, gender, fit, workout });
    sendSuccess(res, { reply: result.reply, type: 'text', quick_replies: result.quick_replies || [] });
  } catch (err) {
    sendError(res, 'Size recommendation failed. Please try again.');
  }
};

const compareProducts = async (req, res) => {
  try {
    const { products } = req.body;
    if (!products || !products.trim()) return sendError(res, 'Product names to compare are required', 400);
    const result = await handleCompare(products);
    sendSuccess(res, {
      reply: result.reply, type: 'text',
      products: result.products || [],
      quick_replies: result.quick_replies || [],
    });
  } catch (err) {
    sendError(res, 'Comparison failed. Please try again.');
  }
};

const fitness = async (req, res) => {
  try {
    const { query } = req.body;
    const result = await handleTextIntent(query || 'workout tip', buildUserContext(req));
    sendSuccess(res, { reply: result.reply, type: 'text', quick_replies: result.quick_replies || [] });
  } catch (err) {
    sendError(res, 'Fitness assistant unavailable.');
  }
};

const voiceTranscribe = async (req, res) => {
  try {
    if (!req.file && !req.body.audio) return sendError(res, 'Audio data required', 400);
    const audioBuffer = req.file ? req.file.buffer : Buffer.from(req.body.audio, 'base64');
    const result = await handleVoiceTranscribe(audioBuffer);
    sendSuccess(res, { text: result.text || '' });
  } catch (err) {
    sendError(res, 'Voice transcription failed.');
  }
};

const cartManagement = async (req, res) => {
  try {
    if (!req.user) return sendError(res, 'Authentication required', 401);
    const { action, product_id } = req.body;
    const result = await handleCartAction(action || 'show', req.user.id, product_id);
    sendSuccess(res, {
      reply: result.reply, type: 'text',
      products: result.products || null,
      navigation: result.navigation || null,
      quick_replies: result.quick_replies || [],
    });
  } catch (err) {
    sendError(res, 'Cart operation failed.');
  }
};

const wishlist = async (req, res) => {
  try {
    if (!req.user) return sendError(res, 'Authentication required', 401);
    const userContext = buildUserContext(req);
    const result = await handleTextIntent('wishlist', userContext);
    sendSuccess(res, {
      reply: result.reply, type: 'products',
      products: result.products || [],
      navigation: result.navigation || null,
      quick_replies: result.quick_replies || [],
    });
  } catch (err) {
    sendError(res, 'Wishlist operation failed.');
  }
};

const accountAssistant = async (req, res) => {
  try {
    if (!req.user) return sendError(res, 'Authentication required', 401);
    const { data: userData } = await supabase.from('users').select('name, email, wallet_coins, referral_code, email_verified, created_at, is_disabled').eq('id', req.user.id).single();
    if (!userData) return sendError(res, 'User not found', 404);
    const wallet = await getWalletInfo(req.user.id);
    const { data: addresses } = await supabase.from('addresses').select('*').eq('user_id', req.user.id);
    const level = (wallet.wallet_coins || 0) >= 10000 ? 'Platinum' : (wallet.wallet_coins || 0) >= 5000 ? 'Gold' : (wallet.wallet_coins || 0) >= 2000 ? 'Silver' : 'Bronze';
    sendSuccess(res, {
      data: {
        name: userData.name, email: userData.email,
        wallet_coins: wallet.wallet_coins, referral_code: wallet.referral_code,
        membership_level: level, addresses: (addresses || []).length,
        email_verified: userData.email_verified, member_since: userData.created_at,
        referral_count: wallet.referral_count,
      },
    });
  } catch (err) {
    sendError(res, 'Failed to load account info.');
  }
};

const couponAssistant = async (req, res) => {
  try {
    if (!req.user) return sendError(res, 'Authentication required', 401);
    const { code, cart_total } = req.body;
    if (code) {
      const { data: coupon } = await supabase.from('coupons').select('*')
        .eq('code', code.toUpperCase()).eq('is_active', true).single();
      if (!coupon) return sendError(res, 'Invalid or expired coupon code', 400);
      if (new Date(coupon.expiry_date) < new Date()) return sendError(res, 'Coupon has expired', 400);
      if (coupon.one_time_use && coupon.used_count >= 1) return sendError(res, 'Coupon already used', 400);
      if ((coupon.min_order || 0) > (cart_total || 0)) return sendError(res, `Minimum order of ₹${coupon.min_order} required`, 400);
      let discount = coupon.discount_type === 'percentage' ? Math.round((cart_total || 0) * coupon.discount_value / 100) : coupon.discount_value;
      sendSuccess(res, {
        valid: true, code: coupon.code, discount_type: coupon.discount_type,
        discount_value: coupon.discount_value, discount_amount: discount,
        final_total: Math.max(0, (cart_total || 0) - discount),
      });
    } else {
      const { data: coupons } = await supabase.from('coupons').select('code, discount_type, discount_value, min_order, expiry_date')
        .eq('is_active', true).gte('expiry_date', new Date().toISOString()).limit(10);
      sendSuccess(res, { coupons: coupons || [] });
    }
  } catch (err) {
    sendError(res, 'Coupon validation failed.');
  }
};

const orderAssistant = async (req, res) => {
  try {
    if (!req.user) return sendError(res, 'Authentication required', 401);
    const { action, order_id } = req.body;
    if (order_id) {
      const order = await supabase.from('orders').select('*, order_items(*, products(name, images, price))').eq('id', order_id).eq('user_id', req.user.id).single();
      if (!order.data) return sendError(res, 'Order not found', 404);
      if (action === 'cancel') {
        if (['cancelled', 'delivered', 'shipped'].includes(order.data.status)) return sendError(res, 'Order cannot be cancelled', 400);
        await supabase.from('orders').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', order_id);
        sendSuccess(res, {}, 'Order cancelled successfully');
      } else {
        sendSuccess(res, { data: order.data });
      }
    } else {
      const orders = await supabase.from('orders').select('id, total_amount, status, created_at, order_number').eq('user_id', req.user.id).order('created_at', { ascending: false });
      sendSuccess(res, { data: orders.data || [] });
    }
  } catch (err) {
    sendError(res, 'Order operation failed.');
  }
};

const getRecommendations = async (req, res) => {
  try {
    let products;
    if (req.user) {
      products = await getPersonalizedRecommendations(req.user.id);
    } else {
      products = await searchProducts({ best_sellers: true, limit: 6 });
    }
    sendSuccess(res, { reply: 'Recommended for you:', type: 'products', products });
  } catch (err) {
    sendError(res, 'Failed to get recommendations.');
  }
};

const getHistory = async (req, res) => {
  try {
    const { data, error } = await supabase.from('chat_history').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(50);
    if (error) return sendError(res, error.message);
    sendSuccess(res, { data: data || [] });
  } catch (err) { sendError(res, err.message); }
};

const deleteHistory = async (req, res) => {
  try {
    await supabase.from('chat_history').delete().eq('user_id', req.user.id);
    sendSuccess(res, {}, 'Chat history deleted');
  } catch (err) { sendError(res, err.message); }
};

const adminAI = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') return sendError(res, 'Admin access required', 403);
    const stats = await adminStats();
    sendSuccess(res, { data: stats });
  } catch (err) { sendError(res, 'Failed to load admin stats.'); }
};

module.exports = {
  chat, sizeRecommendation, compareProducts, fitness, voiceTranscribe,
  cartManagement, wishlist, accountAssistant, couponAssistant,
  orderAssistant, getRecommendations, getHistory, deleteHistory, adminAI,
};
