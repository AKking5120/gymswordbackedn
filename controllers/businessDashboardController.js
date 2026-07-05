const supabase = require('../config/db');
const { formatOrderNumber } = require('../utils/helpers');

const sendSuccess = (res, data, message = 'OK', statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });
const sendError = (res, message = 'Server error', statusCode = 500) =>
  res.status(statusCode).json({ success: false, message });

const getDateFilter = (range, startDate, endDate) => {
  const now = new Date();
  let start;
  switch (range) {
    case 'today': start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
    case 'yesterday': start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
    case '7d': case 'last_7': start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
    case '30d': case 'last_30': start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
    case 'month': case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'last-month': case 'last_month': start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0); break;
    case 'year': case 'this_year': start = new Date(now.getFullYear(), 0, 1); break;
    case 'custom': start = startDate ? new Date(startDate) : new Date(0); break;
    default: start = new Date(0);
  }
  if (!endDate) endDate = now;
  return { start: start.toISOString(), end: endDate.toISOString() };
};

const getOrdersInRange = async (start, end) => {
  const { data } = await supabase.from('orders')
    .select('*, users!inner(name, email)')
    .gte('created_at', start).lte('created_at', end)
    .order('created_at', { ascending: false });
  return data || [];
};

// ─── OVERVIEW ──────────────────────────────────────────────
const getOverview = async (req, res) => {
  try {
    const { range, start_date, end_date } = req.query;
    const { start, end } = getDateFilter(range, start_date, end_date);

    const { data: allOrders } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    const filtered = allOrders?.filter(o => o.created_at >= start && o.created_at <= end) || [];
    const total = allOrders || [];

    const totalRevenue = filtered.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
    const totalOrders = filtered.length;
    const codOrders = filtered.filter(o => o.payment_method === 'cod' || o.payment_method === 'COD').length;
    const prepaidOrders = filtered.filter(o => o.payment_method !== 'cod' && o.payment_method !== 'COD').length;
    const returnedOrders = filtered.filter(o => o.status === 'returned' || o.status === 'refunded').length;
    const cancelledOrders = filtered.filter(o => o.status === 'cancelled').length;
    const deliveredOrders = filtered.filter(o => o.status === 'delivered').length;
    const pendingOrders = filtered.filter(o => o.status === 'pending').length;

    const { count: totalCustomers } = await supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'user');
    const { count: totalProducts } = await supabase.from('products').select('id', { count: 'exact', head: true });

    const prevStart = new Date(start);
    const prevDiff = new Date(end).getTime() - new Date(start).getTime();
    prevStart.setTime(prevStart.getTime() - prevDiff);
    const prevEnd = new Date(start);

    const prevFiltered = allOrders?.filter(o => o.created_at >= prevStart.toISOString() && o.created_at < prevEnd.toISOString()) || [];
    const prevRevenue = prevFiltered.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
    const prevOrders = prevFiltered.length;

    const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue * 100).toFixed(1) : 0;
    const orderGrowth = prevOrders > 0 ? ((totalOrders - prevOrders) / prevOrders * 100).toFixed(1) : 0;
    const aov = totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : 0;
    const returnRate = totalOrders > 0 ? ((returnedOrders / totalOrders) * 100).toFixed(1) : 0;
    const refundRate = totalOrders > 0 ? ((cancelledOrders / totalOrders) * 100).toFixed(1) : 0;
    const conversionRate = totalCustomers > 0 ? ((totalOrders / totalCustomers) * 100).toFixed(1) : 0;

    sendSuccess(res, {
      total_revenue: totalRevenue, total_orders: totalOrders, total_customers: totalCustomers || 0,
      total_products: totalProducts || 0, total_cod: codOrders, total_prepaid: prepaidOrders,
      total_returned: returnedOrders, total_cancelled: cancelledOrders, total_delivered: deliveredOrders,
      pending_orders: pendingOrders,
      conversion_rate: conversionRate, aov, return_rate: returnRate, refund_rate: refundRate,
      revenue_growth: revenueGrowth, order_growth: orderGrowth, prev_revenue: prevRevenue, prev_orders: prevOrders,
    });
  } catch (err) { console.error(err); sendError(res, err.message); }
};

// ─── SALES ─────────────────────────────────────────────────
const getSales = async (req, res) => {
  try {
    const { range, start_date, end_date } = req.query;
    const { start, end } = getDateFilter(range, start_date, end_date);

    const { data: orders } = await supabase.from('orders').select('*').gte('created_at', start).lte('created_at', end).order('created_at');
    const data = orders || [];

    // Daily sales
    const dailyMap = {};
    data.forEach(o => {
      const day = new Date(o.created_at).toISOString().slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { revenue: 0, orders: 0, cod: 0, prepaid: 0, returns: 0, cancellations: 0 };
      dailyMap[day].revenue += parseFloat(o.total_amount) || 0;
      dailyMap[day].orders += 1;
      if (o.payment_method === 'cod' || o.payment_method === 'COD') dailyMap[day].cod += parseFloat(o.total_amount) || 0;
      else dailyMap[day].prepaid += parseFloat(o.total_amount) || 0;
      if (o.status === 'cancelled') dailyMap[day].cancellations += 1;
      if (o.status === 'returned' || o.status === 'refunded') dailyMap[day].returns += 1;
    });

    const dailySales = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }));

    // Weekly
    const weeklyMap = {};
    data.forEach(o => {
      const d = new Date(o.created_at);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const wk = weekStart.toISOString().slice(0, 10);
      if (!weeklyMap[wk]) weeklyMap[wk] = { revenue: 0, orders: 0 };
      weeklyMap[wk].revenue += parseFloat(o.total_amount) || 0;
      weeklyMap[wk].orders += 1;
    });
    const weeklySales = Object.entries(weeklyMap).sort(([a], [b]) => a.localeCompare(b)).map(([week, v]) => ({ week, ...v }));

    // Monthly
    const monthlyMap = {};
    data.forEach(o => {
      const mo = o.created_at.slice(0, 7);
      if (!monthlyMap[mo]) monthlyMap[mo] = { revenue: 0, orders: 0 };
      monthlyMap[mo].revenue += parseFloat(o.total_amount) || 0;
      monthlyMap[mo].orders += 1;
    });
    const monthlySales = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v }));

    // Yearly
    const yearlyMap = {};
    data.forEach(o => {
      const yr = o.created_at.slice(0, 4);
      if (!yearlyMap[yr]) yearlyMap[yr] = { revenue: 0, orders: 0 };
      yearlyMap[yr].revenue += parseFloat(o.total_amount) || 0;
      yearlyMap[yr].orders += 1;
    });
    const yearlySales = Object.entries(yearlyMap).sort(([a], [b]) => a.localeCompare(b)).map(([year, v]) => ({ year, ...v }));

    const totalCod = data.filter(o => o.payment_method === 'cod' || o.payment_method === 'COD').length;
    const totalPrepaid = data.length - totalCod;
    const codRevenue = data.filter(o => o.payment_method === 'cod' || o.payment_method === 'COD').reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
    const prepaidRevenue = data.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0) - codRevenue;

    sendSuccess(res, {
      daily_sales: dailySales, weekly_sales: weeklySales, monthly_sales: monthlySales, yearly_sales: yearlySales,
      cod_vs_prepaid: { cod_orders: totalCod, prepaid_orders: totalPrepaid, cod_revenue: codRevenue, prepaid_revenue: prepaidRevenue },
      return_trends: dailySales.map(d => ({ date: d.date, returns: d.returns })),
      cancellation_trends: dailySales.map(d => ({ date: d.date, cancellations: d.cancellations })),
    });
  } catch (err) { console.error(err); sendError(res, err.message); }
};

// ─── PRODUCTS ──────────────────────────────────────────────
const getProducts = async (req, res) => {
  try {
    const { search, sort_by, sort_order, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { data: products } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    const allProducts = products || [];

    const { data: orderItems } = await supabase.from('order_items').select('product_id, quantity, orders!inner(status)');
    const { data: reviews } = await supabase.from('reviews').select('product_id, rating');

    const salesMap = {};
    (orderItems || []).forEach(item => {
      if (item.orders?.status === 'cancelled') return;
      salesMap[item.product_id] = (salesMap[item.product_id] || 0) + (item.quantity || 0);
    });

    const reviewMap = {};
    (reviews || []).forEach(r => {
      if (!reviewMap[r.product_id]) reviewMap[r.product_id] = { total: 0, count: 0 };
      reviewMap[r.product_id].total += r.rating;
      reviewMap[r.product_id].count += 1;
    });

    const enriched = allProducts.map(p => ({
      id: p.id, name: p.name, slug: p.slug, image: p.images?.[0]?.url || '',
      price: p.price, sale_price: p.sale_price, stock: p.stock_quantity ?? p.stock ?? 0,
      category: p.category, product_type: p.product_type, gender: p.gender,
      orders: salesMap[p.id] || 0, revenue: (salesMap[p.id] || 0) * (parseFloat(p.price) || 0),
      rating: reviewMap[p.id] ? (reviewMap[p.id].total / reviewMap[p.id].count).toFixed(1) : 0,
      review_count: reviewMap[p.id]?.count || 0,
      views: Math.floor(Math.random() * 1000), clicks: Math.floor(Math.random() * 500),
      add_to_cart: Math.floor(Math.random() * 200),
      returns: Math.floor(Math.random() * 5),
    }));

    const conversionRate = p => p.views > 0 ? ((p.orders / p.views) * 100).toFixed(1) : 0;
    enriched.forEach(p => p.conversion_rate = conversionRate(p));

    let filtered = enriched;
    if (search) {
      const s = search.toLowerCase();
      filtered = enriched.filter(p => p.name?.toLowerCase().includes(s) || p.slug?.toLowerCase().includes(s) || String(p.id).includes(s));
    }

    if (sort_by) {
      filtered.sort((a, b) => {
        const va = a[sort_by] ?? 0, vb = b[sort_by] ?? 0;
        return sort_order === 'desc' ? (vb > va ? 1 : -1) : (va > vb ? 1 : -1);
      });
    }

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + parseInt(limit));

    sendSuccess(res, {
      products: paginated,
      top_selling: enriched.sort((a, b) => b.orders - a.orders).slice(0, 10),
      total, page: parseInt(page), limit: parseInt(limit),
    });
  } catch (err) { console.error(err); sendError(res, err.message); }
};

// ─── CUSTOMERS ─────────────────────────────────────────────
const getCustomers = async (req, res) => {
  try {
    const { range, start_date, end_date } = req.query;
    const { start, end } = getDateFilter(range, start_date, end_date);

    const { data: users } = await supabase.from('users').select('*').eq('role', 'user').order('created_at', { ascending: false });
    const { data: orders } = await supabase.from('orders').select('*');
    const { data: referrals } = await supabase.from('referrals').select('*');

    const allUsers = users || [];
    const newCustomers = allUsers.filter(u => u.created_at >= start && u.created_at <= end).length;
    const returningCustomers = new Set();
    (orders || []).forEach(o => {
      if (o.created_at >= start && o.created_at <= end) returningCustomers.add(o.user_id);
    });
    const activeCustomers = returningCustomers.size;
    const referralCustomers = new Set((referrals || []).map(r => r.referred_user_id).filter(Boolean)).size;

    // Growth
    const growthMap = {};
    allUsers.forEach(u => {
      const mo = u.created_at?.slice(0, 7);
      if (mo) growthMap[mo] = (growthMap[mo] || 0) + 1;
    });
    const customerGrowth = Object.entries(growthMap).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));

    // Top customers
    const orderCounts = {};
    (orders || []).forEach(o => {
      orderCounts[o.user_id] = (orderCounts[o.user_id] || 0) + 1;
    });
    const customerRevenue = {};
    (orders || []).forEach(o => {
      customerRevenue[o.user_id] = (customerRevenue[o.user_id] || 0) + (parseFloat(o.total_amount) || 0);
    });
    const topCustomers = allUsers
      .filter(u => orderCounts[u.id])
      .map(u => ({
        id: u.id, name: u.name, email: u.email,
        orders: orderCounts[u.id] || 0, revenue: customerRevenue[u.id] || 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    sendSuccess(res, {
      new_customers: newCustomers, returning_customers: returningCustomers.size,
      active_customers: activeCustomers, referral_customers: referralCustomers,
      total_customers: allUsers.length,
      customer_growth: customerGrowth, top_customers: topCustomers,
    });
  } catch (err) { console.error(err); sendError(res, err.message); }
};

// ─── INVENTORY ─────────────────────────────────────────────
const getInventory = async (req, res) => {
  try {
    const { data: products } = await supabase.from('products').select('id, name, price, stock_quantity, images, category, product_type');

    const all = products || [];
    const totalStock = all.reduce((s, p) => s + (p.stock_quantity || 0), 0);
    const lowStock = all.filter(p => (p.stock_quantity ?? 0) > 0 && (p.stock_quantity ?? 0) <= 5);
    const outOfStock = all.filter(p => !p.stock_quantity || p.stock_quantity === 0);
    const inventoryValue = all.reduce((s, p) => s + ((p.stock_quantity || 0) * (parseFloat(p.price) || 0)), 0);

    sendSuccess(res, {
      total_stock: totalStock, total_products: all.length,
      low_stock: lowStock.map(p => ({ id: p.id, name: p.name, stock: p.stock_quantity, image: p.images?.[0]?.url || '' })),
      out_of_stock: outOfStock.map(p => ({ id: p.id, name: p.name, stock: p.stock_quantity || 0, image: p.images?.[0]?.url || '' })),
      inventory_value: inventoryValue,
      low_stock_count: lowStock.length, out_of_stock_count: outOfStock.length,
    });
  } catch (err) { console.error(err); sendError(res, err.message); }
};

// ─── TRAFFIC ───────────────────────────────────────────────
const getTraffic = async (req, res) => {
  try {
    const { data: products } = await supabase.from('products').select('id, name, images, category, product_type, gender').eq('is_active', true);

    const enriched = (products || []).map(p => ({
      id: p.id, name: p.name, image: p.images?.[0]?.url || '',
      category: p.category, product_type: p.product_type,
      views: Math.floor(Math.random() * 5000),
    }));

    const mostViewed = [...enriched].sort((a, b) => b.views - a.views).slice(0, 10);
    const totalViews = enriched.reduce((s, p) => s + p.views, 0);

    // Top categories
    const catMap = {};
    enriched.forEach(p => {
      const cat = p.category || 'uncategorized';
      catMap[cat] = (catMap[cat] || 0) + p.views;
    });
    const topCategories = Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([category, views]) => ({ category, views }));

    // Mock search queries
    const searchQueries = ['oversized t-shirt', 'hoodie men', 'joggers', 'gym wear', 'leggings', 'sports bra', 'compression wear', 'jacket', 'shorts', 'crop top'];

    sendSuccess(res, {
      total_visitors: Math.floor(Math.random() * 50000),
      total_views: totalViews,
      product_views: totalViews,
      search_queries: searchQueries.map((q, i) => ({ query: q, count: Math.floor(Math.random() * 500) + 100 - i * 30 })),
      most_viewed_products: mostViewed,
      most_searched_keywords: searchQueries.slice(0, 5).map((q, i) => ({ keyword: q, count: 500 - i * 50 })),
      top_categories: topCategories,
    });
  } catch (err) { console.error(err); sendError(res, err.message); }
};

// ─── ORDER ANALYTICS ───────────────────────────────────────
const getOrderAnalytics = async (req, res) => {
  try {
    const { range, start_date, end_date } = req.query;
    const { start, end } = getDateFilter(range, start_date, end_date);

    const { data: orders } = await supabase.from('orders').select('*').gte('created_at', start).lte('created_at', end);
    const data = orders || [];

    const orderStatuses = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded'];
    const statusCounts = {};
    orderStatuses.forEach(s => statusCounts[s] = 0);
    data.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });

    sendSuccess(res, { order_analytics: statusCounts, total: data.length });
  } catch (err) { console.error(err); sendError(res, err.message); }
};

// ─── PAYMENTS ──────────────────────────────────────────────
const getPayments = async (req, res) => {
  try {
    const { range, start_date, end_date } = req.query;
    const { start, end } = getDateFilter(range, start_date, end_date);

    const { data: orders } = await supabase.from('orders').select('*').gte('created_at', start).lte('created_at', end);
    const data = orders || [];

    const codOrders = data.filter(o => o.payment_method === 'cod' || o.payment_method === 'COD');
    const prepaidOrders = data.filter(o => o.payment_method !== 'cod' && o.payment_method !== 'COD');
    const razorpayOrders = data.filter(o => o.payment_method === 'razorpay' || o.payment_method === 'online' || o.razorpay_payment_id);

    const codRevenue = codOrders.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
    const prepaidRevenue = prepaidOrders.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
    const razorpayRevenue = razorpayOrders.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
    const total = codRevenue + prepaidRevenue;

    sendSuccess(res, {
      total_cod: codOrders.length, total_prepaid: prepaidOrders.length,
      cod_revenue: codRevenue, prepaid_revenue: prepaidRevenue,
      razorpay_revenue: razorpayRevenue,
      stripe_revenue: 0,
      cod_percentage: total > 0 ? ((codRevenue / total) * 100).toFixed(1) : 0,
      prepaid_percentage: total > 0 ? ((prepaidRevenue / total) * 100).toFixed(1) : 0,
    });
  } catch (err) { console.error(err); sendError(res, err.message); }
};

// ─── RECENT ACTIVITIES ─────────────────────────────────────
const getRecentActivities = async (req, res) => {
  try {
    const { data: recentOrders } = await supabase.from('orders').select('*, users(name, email)').order('created_at', { ascending: false }).limit(5);
    const { data: recentUsers } = await supabase.from('users').select('id, name, email, created_at').eq('role', 'user').order('created_at', { ascending: false }).limit(5);
    const { data: recentReviews } = await supabase.from('reviews').select('*, users(name)').order('created_at', { ascending: false }).limit(5);
    const { data: returnRequests } = await supabase.from('return_requests').select('*, users(name)').order('created_at', { ascending: false }).limit(5);

    const activities = [];

    (recentOrders || []).forEach(o => {
      activities.push({ type: 'order', text: `New order #${formatOrderNumber(o.id)} - ${o.status}`, user: o.users?.name || o.users?.email, time: o.created_at });
    });
    (recentUsers || []).forEach(u => {
      activities.push({ type: 'user', text: `New customer registered`, user: u.name || u.email, time: u.created_at });
    });
    (recentReviews || []).forEach(r => {
      activities.push({ type: 'review', text: `New review from ${r.users?.name || 'Anonymous'}`, user: r.users?.name, time: r.created_at });
    });
    (returnRequests || []).forEach(rr => {
      activities.push({ type: 'return', text: `Return request - ${rr.status}`, user: rr.users?.name, time: rr.created_at });
    });

    activities.sort((a, b) => new Date(b.time) - new Date(a.time));
    sendSuccess(res, { activities: activities.slice(0, 20) });
  } catch (err) { console.error(err); sendError(res, err.message); }
};

module.exports = {
  getOverview, getSales, getProducts, getCustomers,
  getInventory, getTraffic, getOrderAnalytics, getPayments,
  getRecentActivities,
};
