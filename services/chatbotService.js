const supabase = require('../config/db');
const { getEnv } = require('../config/env');

const AI_API_KEY = getEnv('AI_API_KEY');
const AI_API_URL = getEnv('AI_API_URL', 'https://api.openai.com/v1/chat/completions');
const AI_MODEL = getEnv('AI_MODEL', 'gpt-4o-mini');

const CATEGORY_MAP = {
  tshirt: 'T-Shirt', 't-shirt': 'T-Shirt', 't shirt': 'T-Shirt', shirt: 'T-Shirt',
  top: 'Top', hoodie: 'Hoodie', hoody: 'Hoodie', jogger: 'Joggers',
  pant: 'Joggers', pants: 'Joggers', short: 'Shorts', shorts: 'Shorts',
  legging: 'Leggings', leggings: 'Leggings', bra: 'Sports Bra',
  tank: 'Tank Top', vest: 'Tank Top', jacket: 'Jacket',
  bag: 'Gym Bag', cap: 'Cap', sock: 'Socks', compression: 'Compression Wear',
  'gym bag': 'Gym Bag',
};

const ESCALATION_MSG = 'I couldn\'t fully address your query. Would you like to contact our support team?\n\n📧 **Email:** support@gymsword.com\n💬 **WhatsApp:** +91-XXXXXXXXXX\n🌐 **Contact Page:** Visit /contact\n\nOr ask me something else!';

async function searchProducts(params) {
  let query = supabase.from('products').select('*', { count: 'exact' });
  if (params.search) query = query.or(`name.ilike.%${params.search}%,description.ilike.%${params.search}%`);
  if (params.category) query = query.eq('category_id', params.category);
  if (params.gender) query = query.eq('gender', params.gender);
  if (params.min_price) query = query.gte('price', params.min_price);
  if (params.max_price) query = query.lte('price', params.max_price);
  if (params.featured) query = query.eq('is_featured', true);
  if (params.best_sellers) query = query.eq('is_best_seller', true);
  if (params.trending) query = query.eq('is_trending', true);
  if (params.limit) query = query.limit(Math.min(parseInt(params.limit), 20));
  else query = query.limit(10);
  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(p => ({
    id: p.id, name: p.name, slug: p.slug, price: p.price,
    compare_price: p.compare_price, images: p.images, category: p.category_name || p.category,
    gender: p.gender, sizes: p.sizes, colors: p.colors, fabric: p.fabric,
    rating: p.rating, reviews_count: p.reviews_count, in_stock: (p.stock || p.stock_quantity || 0) > 0,
    tags: p.tags, description: p.description,
  }));
}

function buildQuickReplies(text) {
  const lower = text.toLowerCase();
  const replies = [];
  if (/\b(men|women|unisex)\b/.test(lower) || /\b(tshirt|shirt|top|hoodie|jogger|short|legging|bra)\b/.test(lower)) {
    replies.push('Show me more options', 'Compare with similar', 'What colors are available?');
  } else if (/\border\b|\btrack\b|\bdelivery\b|\bshipped\b/.test(lower)) {
    replies.push('Track my order', 'Cancel my order', 'Start a return');
  } else if (/\bsize\b|\bfit\b/.test(lower)) {
    replies.push('Get size recommendation', 'View size guide', 'Which size should I pick?');
  } else if (/\breturn\b|\bexchange\b|\brefund\b/.test(lower)) {
    replies.push('Start a return', 'Check return policy', 'Exchange an item');
  }
  if (replies.length < 3) {
    const defaults = ['Shop bestsellers', 'New arrivals', 'Track order', 'Contact support'];
    while (replies.length < 3) { const d = defaults.shift(); if (d && !replies.includes(d)) replies.push(d); }
  }
  return replies.slice(0, 4);
}

function guestGate(user) {
  if (user) return null;
  return { reply: 'Please sign in to access this feature.', type: 'navigation', navigation: { to: '/login' }, quick_replies: ['Sign In', 'Create Account', 'Browse Products'] };
}

function adminOnly(user) {
  if (!user || user.role !== 'admin') return { reply: 'This feature is available for admins only.', type: 'text', quick_replies: ['Shop products', 'New arrivals', 'Contact support'] };
  return null;
}

async function detectProductSearch(lower) {
  const colorKeywords = /(black|white|grey|gray|navy|blue|red|green|pink|purple|beige|brown|coral|olive|maroon|teal)/i;
  const categoryKeywords = /(tshirt|t.?shirt|shirt|top|hoodie|hoody|jogger|pant|short|legging|bra|tank|vest|jacket|bag|cap|sock|compression)/i;
  const genderKeywords = /\b(men|women|male|female|unisex|man|woman|boy|girl)\b/i;
  const pricePattern = /(?:under|below|less than|upto?|max|budget|within)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i;
  const priceRangePattern = /(?:₹|rs\.?|inr)?\s*(\d+)\s*(?:-|to)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i;
  const categoryMatch = lower.match(categoryKeywords);
  const colorMatch = lower.match(colorKeywords);
  const genderMatch = lower.match(genderKeywords);
  const priceMatch = lower.match(pricePattern);
  const priceRangeMatch = lower.match(priceRangePattern);
  if (!categoryMatch && !colorMatch && !genderMatch && !priceMatch && !priceRangeMatch) return null;

  const params = {};
  if (categoryMatch) {
    const cat = categoryMatch[0].replace(/\s+/g, '').toLowerCase();
    params.search = CATEGORY_MAP[cat] || categoryMatch[0];
  }
  if (colorMatch) params.search = params.search ? `${params.search} ${colorMatch[0]}` : colorMatch[0];
  if (genderMatch) {
    const g = genderMatch[0].toLowerCase();
    params.gender = g === 'men' || g === 'man' || g === 'male' ? 'men' : g === 'women' || g === 'woman' || g === 'female' ? 'women' : 'unisex';
  }
  if (priceMatch) params.max_price = parseFloat(priceMatch[1]);
  if (priceRangeMatch) {
    params.min_price = parseFloat(priceRangeMatch[1]);
    params.max_price = parseFloat(priceRangeMatch[2]);
  }
  return params;
}

const SIZE_TABLE = {
  xs: { chest: [33, 35], waist: [27, 29] },
  s: { chest: [36, 38], waist: [30, 32] },
  m: { chest: [39, 41], waist: [33, 35] },
  l: { chest: [42, 44], waist: [36, 38] },
  xl: { chest: [45, 47], waist: [39, 41] },
  xxl: { chest: [48, 50], waist: [42, 44] },
};

async function getCartItems(userId) {
  const { data } = await supabase.from('cart').select('*, products(name, price, images, compare_price, sizes, colors, rating)').eq('user_id', userId);
  return data || [];
}

async function getWishlist(userId) {
  const { data } = await supabase.from('wishlist').select('*, products(name, price, images, compare_price, sizes, colors, rating)').eq('user_id', userId);
  return data || [];
}

async function getOrders(userId) {
  const { data } = await supabase.from('orders').select('*, order_items(*, products(name, images, price))').eq('user_id', userId).order('created_at', { ascending: false }).limit(10);
  return data || [];
}

async function getOrderById(userId, orderId) {
  const { data } = await supabase.from('orders').select('*, order_items(*, products(name, images, price))').eq('id', orderId).eq('user_id', userId).single();
  return data;
}

async function getWalletInfo(userId) {
  const { data: user } = await supabase.from('users').select('wallet_coins, referral_code').eq('id', userId).single();
  if (!user) return null;
  const { data: transactions } = await supabase.from('wallet_transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10);
  const { data: referrals } = await supabase.from('referrals').select('reward_coins').eq('referrer_id', userId);
  const totalEarned = (referrals || []).reduce((s, r) => s + (r.reward_coins || 0), 0);
  return { wallet_coins: user.wallet_coins || 0, referral_code: user.referral_code || '', total_earned: totalEarned, referral_count: (referrals || []).length, transactions: transactions || [] };
}

async function getPersonalizedRecommendations(userId) {
  const { data: orders } = await supabase.from('orders').select('id').eq('user_id', userId).neq('status', 'cancelled').limit(5);
  if (!orders || orders.length === 0) return searchProducts({ best_sellers: true, limit: 6 });
  const orderIds = orders.map(o => o.id);
  const { data: items } = await supabase.from('order_items').select('product_id').in('order_id', orderIds);
  if (!items || items.length === 0) return searchProducts({ best_sellers: true, limit: 6 });
  const productIds = [...new Set(items.map(i => i.product_id))];
  const { data: products } = await supabase.from('products').select('*').in('id', productIds).limit(5);
  if (!products || products.length === 0) return searchProducts({ best_sellers: true, limit: 6 });
  const categories = [...new Set(products.map(p => p.category_id || p.category))].filter(Boolean);
  let query = supabase.from('products').select('*').limit(10);
  if (categories.length > 0) {
    query = supabase.from('products').select('*').in('category_id', categories.filter(c => !isNaN(c))).limit(10);
  }
  const { data: recs } = await query;
  return (recs || []).filter(p => !productIds.includes(p.id)).slice(0, 6).map(p => ({
    id: p.id, name: p.name, slug: p.slug, price: p.price,
    compare_price: p.compare_price, images: p.images, category: p.category_name || p.category,
    gender: p.gender, sizes: p.sizes, colors: p.colors, fabric: p.fabric,
    rating: p.rating, reviews_count: p.reviews_count, in_stock: (p.stock || 0) > 0,
  }));
}

async function adminStats() {
  const { data: orders } = await supabase.from('orders').select('id, total_amount, status, created_at').neq('status', 'cancelled');
  const total_revenue = (orders || []).reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
  const total_orders = (orders || []).length;
  const pending = (orders || []).filter(o => o.status === 'pending' || o.status === 'processing').length;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayOrders = (orders || []).filter(o => new Date(o.created_at) >= today);
  const todaySales = todayOrders.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
  const { data: lowStock } = await supabase.from('products').select('name, stock').lt('stock', 10).limit(10);
  const { data: topSelling } = await supabase.from('order_items').select('product_id, quantity').limit(10);
  const qtyMap = {};
  for (const item of (topSelling || [])) qtyMap[item.product_id] = (qtyMap[item.product_id] || 0) + (item.quantity || 0);
  const { data: allProds } = await supabase.from('products').select('id, name');
  const prodMap = Object.fromEntries((allProds || []).map(p => [p.id, p.name]));
  const top = Object.entries(qtyMap).sort(([, a], [, b]) => b - a).slice(0, 5).map(([id, qty]) => ({ name: prodMap[id] || 'Unknown', qty }));
  const { count: recentUsers } = await supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString());
  return { total_revenue, total_orders, pending_orders: pending, today_sales: todaySales, today_orders: todayOrders.length, low_stock: (lowStock || []).slice(0, 5), top_selling: top, recent_users: recentUsers || 0 };
}

async function handleTextIntent(text, userContext) {
  const lower = text.toLowerCase().trim();
  const user = userContext?.user;
  const isGuest = !user;

  // Guest gate for account features
  if (isGuest && /\b(order|track|wallet|wishlist|referral|membership|address|profile|cancel|return|exchange|my\s*)\b/.test(lower) && !/\b(policy|free|shipping|faq|guide|size)\b/.test(lower)) {
    return guestGate(user);
  }

  const intentKeywords = {
    greeting: /\b(hi|hello|hey|namaste|good\s*(morning|afternoon|evening)|sup|yo)\b/i,
    bestseller: /\b(best\s*sell(er|ing|ers|ings)s?|popular|trending|top\s*rated|most\s*popular)\b/i,
    newArrivals: /\b(new|latest|just\s*arrived|new.?drop|fresh|newly\s*added)\b/i,
    sizeGuide: /\b(size.?guide|measurement|sizing|how\s*to\s*measure)\b/i,
    sizeRecommend: /\b(size\s*recommend|what\s*size|which\s*size|recommend\s*size|suggest\s*size|find\s*my\s*size|size\s*for\s*me)\b/i,
    shipping: /\b(shipping|delivery|dispatch|how\s*long|when\s*will|free\s*shipping)\b/i,
    returns: /\b(return|refund|exchange|replace|return\s*policy)\b/i,
    coupon: /\b(coupon|discount|offer|promo|code|sale|deal|off)\b/i,
    payment: /\b(pay|payment|cod|card|upi|net\s*banking|emi)\b/i,
    contact: /\b(contact|support|email|phone|call|help|agent|human)\b/i,
    membership: /\b(membership|member|subscribe|subscription|premium|elite)\b/i,
    referral_ask: /\b(refer|referral|invite|share|earn|invite\s*friend)\b/i,
    compare: /\b(compare|vs|versus|difference|better|which\s*is\s*better)\b/i,
    fitness: /\b(workout\s*tip|exercise|fitness|nutrition|diet|protein|calorie|gain|loss|fat|muscle|gym\s*split|recovery|beginner\s*plan|home\s*workout)\b/i,
    recommendation: /\b(recommend|suggest|advise|what.*(buy|get|wear)|which.*(good|best)|routine)\b/i,
    cart: /\b(cart|bag|basket|my\s*items)\b/i,
    wishlist: /\b(wishlist|save|saved|favorite|liked|my\s*list)\b/i,
    wallet: /\b(wallet|coin|balance|reward|point)\b/i,
    trackOrder: /\b(track|where.*(order|package|parcel)|order.*status|delivery.*status)\b/i,
    cancelOrder: /\b(cancel\s*order|cancel\s*my)\b/i,
    adminAI: /\b(sales|revenue|today.*order|pending.*order|low\s*stock|top\s*selling|user.*count|analytics|dashboard)\b/i,
    compareProduct: /\b(compare\s*with|how\s*does\s*this|what.*better|vs\s*product)\b/i,
  };

  let intent = null;
  for (const [key, pattern] of Object.entries(intentKeywords)) {
    if (pattern.test(lower)) { intent = key; break; }
  }

  // --- ADMIN AI ---
  if (intent === 'adminAI') {
    const blocked = adminOnly(user);
    if (blocked) return blocked;
    const stats = await adminStats();
    return {
      reply: `📊 **GymSword Dashboard Summary**\n\n• **Revenue:** ₹${(stats.total_revenue).toLocaleString('en-IN')}\n• **Total Orders:** ${stats.total_orders}\n• **Pending Orders:** ${stats.pending_orders}\n• **Today's Sales:** ₹${(stats.today_sales).toLocaleString('en-IN')}\n• **Today's Orders:** ${stats.today_orders}\n• **New Users Today:** ${stats.recent_users}\n• **Low Stock Items:** ${stats.low_stock.length > 0 ? stats.low_stock.map(p => `\`${p.name}\``).join(', ') : 'None'}\n• **Top Selling:** ${stats.top_selling.map(p => `${p.name} (${p.qty})`).join(', ') || 'N/A'}`,
      type: 'text',
      quick_replies: ['Refresh stats', 'View all orders', 'Check inventory', 'Export report'],
    };
  }

  // --- SIZE RECOMMENDATION ---
  if (intent === 'sizeRecommend') {
    return {
      reply: '📏 **Find Your Perfect Size**\n\nI\'ll recommend the best size based on your body measurements. Please provide:\n\n1️⃣ **Height** (in cm)\n2️⃣ **Weight** (in kg)\n3️⃣ **Age**\n4️⃣ **Gender** (Men/Women)\n5️⃣ **Preferred Fit** (Regular/Oversized/Compression)\n6️⃣ **Workout Type** (Gym/Running/Yoga)\n\nExample: *"I\'m 175cm, 75kg, 28 years, male, want oversized fit for gym"*',
      type: 'text',
      quick_replies: ['175cm 75kg male oversized gym', '160cm 55kg female regular yoga', 'View size guide'],
    };
  }

  // --- FITNESS ASSISTANT ---
  if (intent === 'fitness') {
    const tips = {
      'workout tip': '**💪 Quick Workout Tips**\n\n• **Progressive Overload:** Increase weight/reps each week\n• **Rest:** 48h between training same muscle group\n• **Form First:** Never sacrifice form for weight\n• **Warm-up:** 5-10 min dynamic stretching before every session\n• **Cool-down:** 5 min static stretching after',
      'nutrition': '**🥗 Nutrition Basics**\n\n• **Protein:** 1.6-2.2g per kg bodyweight for muscle gain\n• **Carbs:** Fuel your workouts — eat complex carbs pre-workout\n• **Hydration:** 3-4 litres water daily\n• **Pre-workout:** Banana + coffee 30 min before\n• **Post-workout:** Protein shake within 30 min',
      'beginner': '**🏋️ Beginner Plan (3 days/week)**\n\n**Day 1 - Upper Body:** Bench press, Rows, Shoulder press, Bicep curls\n**Day 2 - Lower Body:** Squats, Deadlifts, Lunges, Calf raises\n**Day 3 - Full Body:** Pull-ups, Push-ups, Planks, Core work\n\nStart with light weights, focus on form!',
      'home workout': '**🏠 Home Workout (No Equipment)**\n\n• **Push-ups:** 3x12\n• **Squats:** 3x15\n• **Lunges:** 3x12 each leg\n• **Plank:** 3x45 seconds\n• **Burpees:** 3x10\n• **Mountain climbers:** 3x20\n\nRepeat 3-4x/week for best results.',
      'gym split': '**📅 Gym Split (Advanced)**\n\n• **Push Day:** Chest, Shoulders, Triceps\n• **Pull Day:** Back, Biceps, Rear Delts\n• **Leg Day:** Quads, Hamstrings, Glutes, Calves\n• **Rest or Accessory:** Core, Forearms, Cardio\n\nTrain 4-5x/week with proper recovery.',
      'recovery': '**🔄 Recovery Advice**\n\n• **Sleep 7-9h** — crucial for muscle repair\n• **Active recovery:** Light walk or stretching on rest days\n• **Foam rolling:** 10 min post-workout\n• **Hydration + Protein** within 30 min of training\n• **Deload week:** Every 4-6 weeks, reduce intensity by 50%',
    };
    let reply = tips['workout tip'];
    if (/\bnutrition\b|\bdiet\b|\bprotein\b|\bcalorie\b|\bear\b/.test(lower)) reply = tips['nutrition'];
    else if (/\bbeginner\b|\bstart\b|\bfirst\s*time\b|\bnew\b/.test(lower)) reply = tips['beginner'];
    else if (/\bhome\b|\bno\s*equipment\b/.test(lower)) reply = tips['home workout'];
    else if (/\bsplit\b|\bpush\b|\bpull\b|\bleg\s*day|ppl\b/.test(lower)) reply = tips['gym split'];
    else if (/\brecover\b|\brest\b|\bsleep\b|\bfoam\b|\bstretch\b/.test(lower)) reply = tips['recovery'];
    return {
      reply: reply + '\n\n> ⚠️ *These are general fitness tips only. Consult a professional for personalised advice.*',
      type: 'text',
      quick_replies: ['Workout tips', 'Nutrition basics', 'Beginner plan', 'Home workouts', 'Gym split', 'Recovery'],
    };
  }

  // Detect product search
  const productParams = await detectProductSearch(lower);
  if (productParams) {
    const products = await searchProducts(productParams);
    if (products.length > 0) {
      const count = products.length;
      return {
        reply: `I found **${count} product${count > 1 ? 's' : ''}** matching your search. Here's what I recommend:`,
        type: 'products',
        products: products.slice(0, 10),
        quick_replies: buildQuickReplies(text),
      };
    }
    return {
      reply: `I couldn't find an exact match for "${text}". Here are some popular products:`,
      type: 'products',
      products: await searchProducts({ best_sellers: true, limit: 6 }),
      quick_replies: ['Show all products', 'Browse by category', 'Contact support'],
    };
  }

  // --- INTENT HANDLERS ---
  if (intent === 'greeting') {
    const name = user?.name || '';
    return {
      reply: name
        ? `Welcome back, ${name.split(' ')[0]}! 💪 Ready to forge your next look? What are you shopping for today?`
        : 'Welcome to **GymSword** — where warriors forge their strength. ⚔️\n\nI\'m your personal shopping assistant. I can help you:\n\n👕 **Find products** — "Show me black hoodies"\n📏 **Size recommendation** — Tell me your measurements\n📦 **Order help** — Track, return, exchange\n💪 **Fitness tips** — Workouts, nutrition\n\nWhat brings you here today?',
      type: 'text',
      quick_replies: user
        ? ['Shop Bestsellers 🔥', 'New Arrivals ✨', 'Track My Order 📦', 'Size Recommendation 📏']
        : ['Shop Bestsellers 🔥', 'New Arrivals ✨', 'Help with Size 📏', 'Sign In'],
    };
  }

  if (intent === 'bestseller') {
    const products = await searchProducts({ best_sellers: true, limit: 8 });
    return {
      reply: 'Here are our **bestselling products** — forged by thousands of warriors like you:',
      type: 'products', products,
      quick_replies: ['View all products', 'New arrivals', 'Under ₹1000'],
    };
  }

  if (intent === 'newArrivals') {
    const products = await searchProducts({ limit: 8 });
    products.sort(() => Math.random() - 0.5);
    return {
      reply: '✨ Check out our **latest drops** — fresh gear for the modern warrior:',
      type: 'products', products: products.slice(0, 8),
      quick_replies: ['Shop bestsellers', 'Men collection', 'Women collection'],
    };
  }

  if (intent === 'sizeGuide') {
    return {
      reply: '📏 **GymSword Size Guide**\n\n| Size | Chest (in) | Waist (in) |\n|------|-----------|-----------|\n| XS | 34-36 | 28-30 |\n| S | 36-38 | 30-32 |\n| M | 38-40 | 32-34 |\n| L | 40-42 | 34-36 |\n| XL | 42-44 | 36-38 |\n| XXL | 44-46 | 38-40 |\n\nNeed a **personalised size recommendation**? Just ask!',
      type: 'text',
      navigation: { to: '/size-guide' },
      quick_replies: ['Get size recommendation', 'Which size is best for me?', 'Shop now'],
    };
  }

  if (intent === 'shipping') {
    return {
      reply: '🚚 **Shipping Information**\n\n• **Free shipping** on orders above ₹999\n• **Standard:** 5-8 business days\n• **Express:** 2-3 business days (₹149)\n• **COD:** Available on orders up to ₹5,000\n• Orders processed within 24 hours\n• You\'ll receive a tracking link once shipped',
      type: 'text',
      navigation: { to: '/shipping-policy' },
      quick_replies: ['Track my order', 'Start a return', 'View shipping policy'],
    };
  }

  if (intent === 'returns') {
    return {
      reply: '🔄 **Returns & Exchanges**\n\n• **15-day return window** from delivery\n• **Free size exchange** within 15 days\n• Items must be unworn with original tags\n• Refunds processed within 5-7 business days\n• **Return shipping:** Free for exchanges, ₹50 for refunds',
      type: 'text',
      navigation: { to: '/return-policy' },
      quick_replies: ['Start a return', 'Exchange an item', 'View return policy'],
    };
  }

  if (intent === 'coupon') {
    if (isGuest) return guestGate(user);
    try {
      const { data: coupons } = await supabase.from('coupons').select('code, discount_type, discount_value, min_order, expiry_date, is_active, one_time_use').eq('is_active', true).gte('expiry_date', new Date().toISOString()).limit(10);
      if (coupons && coupons.length > 0) {
        return {
          reply: '🎉 **Available Coupons**\n\n' + coupons.map(c =>
            `• **${c.code}** — ${c.discount_type === 'percentage' ? `${c.discount_value}% OFF` : `₹${c.discount_value} OFF`}${c.min_order > 0 ? ` (min ₹${c.min_order})` : ''}${c.one_time_use ? ' • One-time' : ''}`
          ).join('\n') + '\n\nUse a coupon at checkout!',
          type: 'text',
          navigation: { to: '/cart' },
          quick_replies: ['Apply a coupon', 'Shop deals', 'Check my cart'],
        };
      }
    } catch {}
    return {
      reply: '🎉 **Current Offers**\n\n• **NEW15** — 15% off your first order\n• **FREESHIP** — Free shipping\n• **WELCOME20** — 20% off for new members\n\nApply at checkout!',
      type: 'text',
      quick_replies: ['Apply a coupon', 'Shop deals', 'Membership benefits'],
    };
  }

  if (intent === 'payment') {
    return {
      reply: '💳 **Payment Options**\n\n• **Credit/Debit Cards** (Visa, Mastercard, RuPay)\n• **UPI** (Google Pay, PhonePe, Paytm)\n• **Net Banking**\n• **COD** — Cash on Delivery (up to ₹5,000)\n• **Wallet** — GymSword wallet for members\n\nAll transactions are 100% secure with Razorpay.',
      type: 'text',
      quick_replies: ['Apply a coupon', 'Check wallet balance', 'View my orders'],
    };
  }

  if (intent === 'contact') {
    return {
      reply: '📬 **Get in Touch**\n\n• **Email:** support@gymsword.com\n• **WhatsApp:** +91-XXXXXXXXXX\n• **Phone:** Mon-Sat, 10AM-7PM\n• **Contact Form:** Visit our Contact page\n\nWe typically respond within 24 hours.',
      type: 'text',
      navigation: { to: '/contact' },
      quick_replies: ['Contact support', 'Visit FAQ', 'Track my order'],
    };
  }

  if (intent === 'recommendation') {
    if (user) {
      const recs = await getPersonalizedRecommendations(user.id);
      if (recs.length > 0) {
        return {
          reply: '🎯 **Recommended for You** — Based on your purchase history and preferences:',
          type: 'products', products: recs,
          quick_replies: ['Shop bestsellers', 'Men collection', 'Women collection', 'New arrivals'],
        };
      }
    }
    return {
      reply: 'Let me help you find the perfect gear! 💪\n\nTo give you the best recommendations, tell me:\n\n1️⃣ **What type of workout?** (gym, running, yoga, cardio)\n2️⃣ **Your preferred fit?** (regular, oversized, compression)\n3️⃣ **Any budget in mind?**',
      type: 'text',
      quick_replies: ['Gym workout', 'Running & cardio', 'Yoga & flexibility', 'Under ₹1000'],
    };
  }

  if (intent === 'referral_ask' && !isGuest) {
    const wallet = await getWalletInfo(user.id);
    return {
      reply: `🤝 **Referral Program**\n\n• **Your Code:** \`${wallet.referral_code}\`\n• **Friends Referred:** ${wallet.referral_count}\n• **Coins Earned:** ${wallet.total_earned}\n\n**How it works:**\n• **You get:** ₹100 wallet credit per referral\n• **Your friend gets:** 15% off first order\n• **No limit** on referrals\n\nShare your code with friends!`,
      type: 'text',
      navigation: { to: '/account/referrals' },
      quick_replies: ['My referral link', 'Check wallet', 'Shop now'],
    };
  }

  if (intent === 'membership' && !isGuest) {
    const { data: userData } = await supabase.from('users').select('wallet_coins').eq('id', user.id).single();
    const coins = userData?.wallet_coins || 0;
    const level = coins >= 10000 ? 'Platinum' : coins >= 5000 ? 'Gold' : coins >= 2000 ? 'Silver' : 'Bronze';
    return {
      reply: `👑 **GymSword Membership**\n\n**Your Level:** ${level}\n**Wallet Coins:** ${coins}\n\n**Benefits:**\n• **Extra 10% off** on all products\n• **Free express shipping**\n• **Early access** to new drops\n• **Birthday gift**\n• **Exclusive member-only products**\n\nSpend more to unlock higher tiers!`,
      type: 'text',
      navigation: { to: '/membership' },
      quick_replies: ['Join membership', 'View benefits', 'Shop members-only'],
    };
  }

  // --- CART MANAGEMENT ---
  if (intent === 'cart') {
    if (isGuest) return guestGate(user);
    const cart = await getCartItems(user.id);
    if (cart.length === 0) {
      return { reply: 'Your **cart is empty**. Browse our collection and add some gear! 🛒', type: 'text', navigation: { to: '/shop' }, quick_replies: ['Shop now', 'New arrivals', 'Bestsellers'] };
    }
    const total = cart.reduce((s, i) => s + (parseFloat(i.products?.price || 0) * (i.quantity || 1)), 0);
    const itemsList = cart.slice(0, 5).map(i => `• **${i.products?.name}** × ${i.quantity} — ₹${(parseFloat(i.products?.price || 0) * (i.quantity || 1)).toLocaleString('en-IN')}`).join('\n');
    return {
      reply: `🛒 **Your Cart (${cart.length} item${cart.length > 1 ? 's' : ''})**\n\n${itemsList}\n\n**Total:** ₹${total.toLocaleString('en-IN')}`,
      type: 'text',
      products: cart.slice(0, 5).map(i => ({
        id: i.products?.id, name: i.products?.name, price: i.products?.price,
        compare_price: i.products?.compare_price, images: i.products?.images,
        rating: i.products?.rating, in_stock: true,
      })),
      navigation: { to: '/cart' },
      quick_replies: ['View cart', 'Proceed to checkout', 'Clear cart', 'Shop more'],
    };
  }

  // --- WISHLIST ---
  if (intent === 'wishlist') {
    if (isGuest) return guestGate(user);
    const wishlist = await getWishlist(user.id);
    if (wishlist.length === 0) {
      return { reply: 'Your **wishlist is empty**. Save items you love! ❤️', type: 'text', navigation: { to: '/shop' }, quick_replies: ['Shop now', 'New arrivals', 'Bestsellers'] };
    }
    return {
      reply: `❤️ **Your Wishlist (${wishlist.length} item${wishlist.length > 1 ? 's' : ''})**\n\nHere are your saved items:`,
      type: 'products',
      products: wishlist.map(w => ({
        id: w.products?.id, name: w.products?.name, price: w.products?.price,
        compare_price: w.products?.compare_price, images: w.products?.images,
        sizes: w.products?.sizes, colors: w.products?.colors,
        rating: w.products?.rating, in_stock: true,
      })),
      navigation: { to: '/wishlist' },
      quick_replies: ['View wishlist', 'Move to cart', 'Shop more', 'Clear wishlist'],
    };
  }

  // --- WALLET ---
  if (intent === 'wallet') {
    if (isGuest) return guestGate(user);
    const wallet = await getWalletInfo(user.id);
    return {
      reply: `💰 **Your Wallet**\n\n• **Balance:** ${wallet.wallet_coins} coins (₹${wallet.wallet_coins})\n• **Total Earned:** ${wallet.total_earned} coins\n• **Referral Code:** \`${wallet.referral_code}\`\n• **Referrals:** ${wallet.referral_count}\n\nUse coins at checkout for discounts!`,
      type: 'text',
      navigation: { to: '/account/wallet' },
      quick_replies: ['Refer a friend', 'View transactions', 'Shop now'],
    };
  }

  // --- ORDER TRACKING ---
  if (intent === 'trackOrder' || intent === 'cancelOrder') {
    if (isGuest) return guestGate(user);
    const orderMatch = lower.match(/(?:GS[-\s]?)?0*(\d{3,6})/i);
    if (orderMatch) {
      const orderId = orderMatch[1].replace(/^0+/, '');
      const order = await getOrderById(user.id, orderId);
      if (order) {
        if (intent === 'cancelOrder') {
          if (['cancelled', 'delivered', 'shipped'].includes(order.status)) {
            return { reply: `Order **GS-${String(order.id).padStart(6, '0')}** cannot be cancelled (status: ${order.status}).`, type: 'text', quick_replies: ['View my orders', 'Start a return', 'Contact support'] };
          }
          return {
            reply: `⚠️ **Cancel Order GS-${String(order.id).padStart(6, '0')}**\n\n• **Status:** ${order.status}\n• **Total:** ₹${order.total_amount}\n\nAre you sure you want to cancel this order? You can do this from your **My Orders** page.`,
            type: 'text',
            navigation: { to: `/my-orders` },
            quick_replies: ['Yes, cancel it', 'No, keep it', 'Need help'],
          };
        }
        return {
          reply: `📦 **Order GS-${String(order.id).padStart(6, '0')}**\n\n• **Status:** ${order.status.replace(/_/g, ' ').toUpperCase()}\n• **Total:** ₹${order.total_amount}\n• **Placed:** ${new Date(order.created_at).toLocaleDateString('en-IN')}\n${order.tracking_number ? `• **Tracking:** \`${order.tracking_number}\`` : ''}\n${order.estimated_delivery ? `• **Est. Delivery:** ${new Date(order.estimated_delivery).toLocaleDateString('en-IN')}` : ''}`,
          type: 'order_info',
          quick_replies: ['Cancel order', 'Return items', 'Download invoice', 'Need help'],
        };
      }
    }
    const orders = await getOrders(user.id);
    if (orders.length > 0) {
      const list = orders.map(o => `• **GS-${String(o.id).padStart(6, '0')}** — ${o.status.replace(/_/g, ' ')} — ₹${o.total_amount}`).join('\n');
      return {
        reply: `📋 **Your Recent Orders**\n\n${list}\n\nReply with an order number (e.g., "GS-000123") for details.`,
        type: 'text',
        navigation: { to: '/my-orders' },
        quick_replies: ['View all orders', 'Track latest order', 'Shop more'],
      };
    }
    return { reply: 'You haven\'t placed any orders yet. Browse our collection!', type: 'text', navigation: { to: '/shop' }, quick_replies: ['Shop now', 'New arrivals', 'Bestsellers'] };
  }

  // --- NAVIGATION ---
  const navMap = {
    'wishlist': '/wishlist', 'cart': '/cart', 'checkout': '/checkout',
    'men': '/shop/men', 'women': '/shop/women', 'unisex': '/shop/unisex',
    'shop': '/shop', 'home': '/', 'account': '/account', 'orders': '/my-orders',
    'profile': '/account/settings', 'address': '/account/addresses',
    'wallet': '/account/wallet', 'referrals': '/account/referrals',
    'about': '/about', 'contact': '/contact', 'faq': '/faq',
    'blog': '/blog', 'gift': '/gift-cards', 'membership': '/membership',
    'size guide': '/size-guide', 'shipping': '/shipping-policy',
    'return': '/return-policy', 'refund': '/refund-policy',
    'exchange': '/exchange-policy', 'size': '/size-guide',
  };
  for (const [key, path] of Object.entries(navMap)) {
    if (lower.includes(key)) {
      return {
        reply: `Taking you to the **${key.charAt(0).toUpperCase() + key.slice(1)}** page now. ⚡`,
        type: 'navigation',
        navigation: { to: path },
        quick_replies: ['Go back', 'Shop now', 'Need help'],
      };
    }
  }

  // --- ESCALATION + AI FALLBACK ---
  if (AI_API_KEY) {
    try {
      const messages = [{ role: 'user', content: text }];
      if (user) messages.unshift({ role: 'system', content: `User: ${user.name}, ${user.email}, role: ${user.role || 'customer'}` });
      const response = await fetch(AI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AI_API_KEY}` },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [{
            role: 'system', content: `You are GymSword AI — a luxury gymwear shopping concierge. Keep responses short, helpful, and on-brand. If you cannot answer, offer escalation.`
          }, ...messages],
          temperature: 0.7, max_tokens: 500, stream: false,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return { reply: content, type: 'text', quick_replies: buildQuickReplies(text) };
      }
    } catch {}
  }

  return {
    reply: ESCALATION_MSG,
    type: 'text',
    quick_replies: ['Contact support', 'Shop bestsellers', 'New arrivals', 'Help with size'],
  };
}

async function handleSizeRecommendation(details) {
  const { height, weight, age, gender, fit, workout } = details;
  if (!height || !weight) {
    return { reply: 'Please provide your height (cm) and weight (kg) for a size recommendation.', type: 'text', quick_replies: ['175cm 75kg male oversized', 'View size guide', 'Shop now'] };
  }
  const bmi = weight / Math.pow(height / 100, 2);
  let baseSize = 'M';
  if (bmi < 18.5) baseSize = 'XS';
  else if (bmi < 22) baseSize = 'S';
  else if (bmi < 25) baseSize = 'M';
  else if (bmi < 29) baseSize = 'L';
  else if (bmi < 33) baseSize = 'XL';
  else baseSize = 'XXL';

  if (gender === 'women' || gender === 'female') {
    if (baseSize === 'XS') baseSize = 'XS';
    else if (baseSize === 'S') baseSize = 'S';
    else if (baseSize === 'M') baseSize = 'M';
    else baseSize = 'L';
  }

  if (fit === 'oversized') {
    if (baseSize === 'XS') baseSize = 'S';
    else if (baseSize === 'S') baseSize = 'M';
    else if (baseSize === 'M') baseSize = 'L';
    else if (baseSize === 'L') baseSize = 'XL';
    else baseSize = 'XXL';
  } else if (fit === 'compression') {
    if (baseSize === 'XXL') baseSize = 'XL';
    else if (baseSize === 'XL') baseSize = 'L';
  }

  const sizeInfo = SIZE_TABLE[baseSize.toLowerCase()] || { chest: [38, 42], waist: [30, 34] };
  return {
    reply: `📏 **Recommended Size: ${baseSize.toUpperCase()}**\n\n**Based on your profile:**\n• Height: ${height}cm\n• Weight: ${weight}kg\n• Build: ${bmi < 18.5 ? 'Slim' : bmi < 25 ? 'Average' : bmi < 30 ? 'Athletic' : 'Large'}\n• Fit: ${fit || 'Regular'}\n• Workout: ${workout || 'General'}\n\n**Size ${baseSize.toUpperCase()} Details:**\n• Chest: ${sizeInfo.chest[0]}-${sizeInfo.chest[1]} in\n• Waist: ${sizeInfo.waist[0]}-${sizeInfo.waist[1]} in\n\n💡 **Tip:** For ${fit || 'regular'} fit in ${workout || 'gym'} wear, ${baseSize.toUpperCase()} should be perfect. Try it and if it doesn't fit perfectly, we offer free exchanges!`,
    type: 'text',
    quick_replies: ['Shop products in my size', 'View size guide', 'Start shopping'],
  };
}

async function handleCompare(text) {
  const productNames = text.split(/vs|versus|and|,|\bor\b/).map(s => s.replace(/.*compare\s*/i, '').replace(/difference\s*(between)?\s*/i, '').trim()).filter(Boolean);
  const results = [];
  for (const name of productNames.slice(0, 3)) {
    const { data } = await supabase.from('products').select('*').ilike('name', `%${name}%`).limit(1).single();
    if (data) results.push(data);
  }
  if (results.length < 2) {
    return { reply: 'I need at least 2 products to compare. Please specify product names (e.g., "Compare hoodie vs t-shirt").', type: 'text', quick_replies: ['Compare hoodie vs t-shirt', 'Compare jogger vs short', 'Shop now'] };
  }
  const rows = results.map(p => ({
    name: p.name, price: `₹${p.price}`, fabric: p.fabric || 'Premium Cotton',
    sizes: Array.isArray(p.sizes) ? p.sizes.join(', ') : p.sizes || 'S-XXL',
    colors: Array.isArray(p.colors) ? p.colors.slice(0, 4).join(', ') : p.colors || 'Black, White',
    fit: p.product_type?.includes('Compression') ? 'Compression' : p.product_type?.includes('Oversized') ? 'Oversized' : 'Regular',
    rating: p.rating || 'N/A', features: p.tags?.slice(0, 3).join(', ') || 'Premium quality',
  }));
  const table = rows.map(r => `• **${r.name}** — ${r.price} | ${r.fabric} | ${r.sizes} | ${r.colors} | ${r.fit} | ★${r.rating}`).join('\n');
  const best = results.reduce((a, b) => ((b.rating || 0) > (a.rating || 0) ? b : a));
  return {
    reply: `📊 **Product Comparison**\n\n${table}\n\n**🏆 Recommendation:** Based on ratings and features, **${best.name}** is the top pick!`,
    type: 'text',
    products: results.map(p => ({
      id: p.id, name: p.name, price: p.price, compare_price: p.compare_price,
      images: p.images, rating: p.rating, in_stock: (p.stock || 0) > 0,
    })),
    quick_replies: ['View details', 'Add to cart', 'Compare more', 'Shop now'],
  };
}

async function handleVoiceTranscribe(audioBuffer) {
  if (!AI_API_KEY) {
    return { reply: 'Voice transcription is not available. Please type your message.', type: 'text', quick_replies: ['Shop now', 'Help'] };
  }
  try {
    const blob = new Blob([audioBuffer], { type: 'audio/webm' });
    const form = new FormData();
    form.append('file', blob, 'audio.webm');
    form.append('model', 'whisper-1');
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AI_API_KEY}` },
      body: form,
    });
    if (response.ok) {
      const data = await response.json();
      return { text: data.text || '' };
    }
  } catch {}
  return { text: '' };
}

async function handleCartAction(action, userId, productId) {
  if (action === 'show') {
    const cart = await getCartItems(userId);
    if (cart.length === 0) return { reply: 'Your cart is empty.', type: 'text', quick_replies: ['Shop now', 'New arrivals'] };
    return { reply: `You have ${cart.length} item(s) in your cart.`, type: 'text', products: cart.map(c => ({ id: c.products?.id, name: c.products?.name, price: c.products?.price, images: c.products?.images })), navigation: { to: '/cart' }, quick_replies: ['View cart', 'Checkout', 'Shop more'] };
  }
  if (action === 'clear') {
    await supabase.from('cart').delete().eq('user_id', userId);
    return { reply: 'Cart cleared! Browse for more gear 🛒', type: 'text', quick_replies: ['Shop now', 'New arrivals'] };
  }
  return { reply: 'Cart updated!', type: 'text', quick_replies: ['View cart', 'Shop more'] };
}

module.exports = {
  handleTextIntent, handleSizeRecommendation, handleCompare,
  handleVoiceTranscribe, handleCartAction,
  searchProducts, getCartItems, getWishlist, getOrders, getWalletInfo,
  getPersonalizedRecommendations, adminStats,
};
