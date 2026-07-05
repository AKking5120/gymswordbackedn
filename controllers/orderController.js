const supabase = require('../config/db');
const { sendSuccess, sendError, formatOrderNumber } = require('../utils/helpers');
const { debitWallet } = require('../services/walletService');
const { createNotification } = require('../services/notificationService');
const { sendOrderConfirmation, sendShippingStatus } = require('../services/emailService');
const { generateInvoice } = require('../services/pdfService');

// POST /api/orders
const placeOrder = async (req, res) => {
  try {
    const { address_id, payment_method, coupon_code, discount_amount = 0, use_wallet_coins = 0, razorpay_payment_id } = req.body;

    if (!address_id || !payment_method)
      return sendError(res, 'address_id and payment_method are required', 400);

    if (payment_method === 'razorpay' && !razorpay_payment_id) {
      return sendError(res, 'Razorpay payment verification is required before placing order', 400);
    }

    // Get cart items
    const { data: cartItems, error: cartError } = await supabase
      .from('cart')
      .select('*, products(id, name, price, sale_price, stock, image_url)')
      .eq('user_id', req.user.id);

    if (cartError || !cartItems.length)
      return sendError(res, 'Cart is empty', 400);

    // Validate stock
    for (const item of cartItems) {
      if (item.quantity > item.products.stock) {
        return sendError(res, `Insufficient stock for ${item.products.name}`, 400);
      }
    }

    // Calculate totals
    let subtotal = cartItems.reduce((sum, item) => {
      const price = item.products.sale_price || item.products.price;
      return sum + price * item.quantity;
    }, 0);

    let walletDeduction = 0;
    if (use_wallet_coins > 0) {
      const maxWalletUse = Math.min(use_wallet_coins, req.user.wallet_coins, subtotal - discount_amount);
      walletDeduction = maxWalletUse;
    }

    const total_amount = Math.max(0, subtotal - discount_amount - walletDeduction);

    // Get address
    const { data: address } = await supabase
      .from('addresses')
      .select('*')
      .eq('id', address_id)
      .single();

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: req.user.id,
        total_amount,
        status: 'pending',
        coupon_code: coupon_code || null,
        discount_amount: discount_amount + walletDeduction,
        payment_method,
        payment_status: payment_method === 'cod' ? 'pending' : 'paid',
        razorpay_payment_id: razorpay_payment_id || null,
      })
      .select()
      .single();

    if (orderError) return sendError(res, orderError.message);

    // Increment coupon usage if a coupon was applied
    if (coupon_code) {
      const { data: usedCoupon } = await supabase
        .from('coupons')
        .select('id, used_count')
        .eq('code', coupon_code.toUpperCase())
        .single();
      if (usedCoupon) {
        await supabase
          .from('coupons')
          .update({ used_count: (usedCoupon.used_count || 0) + 1 })
          .eq('id', usedCoupon.id);
      }
    }

    // Create order items and update stock
    const orderItems = cartItems.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.products.sale_price || item.products.price,
    }));

    await supabase.from('order_items').insert(orderItems);

    // Reduce stock
    for (const item of cartItems) {
      await supabase
        .from('products')
        .update({ stock: item.products.stock - item.quantity })
        .eq('id', item.product_id);
    }

    // Deduct wallet coins if used
    if (walletDeduction > 0) {
      await debitWallet(req.user.id, walletDeduction, `Used for order #${order.id}`);
    }

    // Clear cart
    await supabase.from('cart').delete().eq('user_id', req.user.id);

    await createNotification(req.user.id, 'Order Placed!', `Your order #${order.id} has been placed successfully.`);

    // Send order confirmation email with invoice PDF (fire and forget)
    (async () => {
      try {
        const shipping = subtotal > 4999 ? 0 : 499;
        const tax = Math.max(0, (subtotal - discount_amount) * 0.18);
        const itemsForEmail = cartItems.map(i => ({
          name: i.products.name,
          price: i.products.sale_price || i.products.price,
          quantity: i.quantity,
          image_url: i.products.image_url,
        }));
        const addressStr = address ? `${address.full_name}\n${address.address_line1}${address.address_line2 ? ', '+address.address_line2 : ''}\n${address.city} - ${address.pincode}\n${address.state || ''}\nIndia` : '';
        const addressShort = address ? `${address.full_name}, ${address.address_line1}${address.address_line2 ? ', '+address.address_line2 : ''}, ${address.city}, ${address.state} - ${address.pincode}` : '';

        let invoiceBuffer = null;
        try {
          invoiceBuffer = await generateInvoice({
            id: order.id,
            order_number: formatOrderNumber ? formatOrderNumber(order.id) : `GS-${String(order.id).padStart(6, '0')}`,
            total_amount,
            subtotal,
            discount_amount: discount_amount + walletDeduction,
            shipping,
            tax,
            coupon_code: coupon_code || null,
            status: 'pending',
            created_at: order.created_at,
            address: addressStr,
            shipping_address: addressStr,
            billing_address: addressStr,
          }, itemsForEmail, { name: req.user.name, email: req.user.email });
        } catch (pdfErr) {
          console.error('Invoice PDF generation failed:', pdfErr.message);
        }

        await sendOrderConfirmation(
          { name: req.user.name, email: req.user.email },
          {
            id: order.id,
            order_number: `GS-${String(order.id).padStart(6, '0')}`,
            total_amount,
            subtotal,
            discount_amount: discount_amount + walletDeduction,
            coupon_code: coupon_code || null,
            shipping,
            tax,
            created_at: order.created_at,
            shipping_address: addressStr,
            billing_address: addressStr,
          },
          itemsForEmail,
          invoiceBuffer
        );
      } catch (emailErr) {
        console.error('Order confirmation email failed:', emailErr.message);
      }
    })();

    return sendSuccess(res, { data: { order, items: orderItems } }, 'Order placed successfully', 201);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /api/orders
const getUserOrders = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*, products(name, image_url, price))')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) return sendError(res, error.message);

    const orders = (data || []).map(o => {
      const items = (o.order_items || []).map(i => ({
        name: i.products?.name || 'Product',
        image: i.products?.image_url || '',
        qty: i.quantity,
        size: null,
        color: null,
        price: parseFloat(i.price) || 0,
      }));
      const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
      return {
        id: o.id,
        order_number: `GS-${String(o.id).padStart(6, '0')}`,
        created_at: o.created_at,
        status: o.status,
        total: parseFloat(o.total_amount) || 0,
        items,
        itemCount: items.length,
      };
    });

    return sendSuccess(res, { data: orders });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /api/orders/:id
const getOrderById = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, users(email), order_items(*, products(name, image_url, price))')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error) {
      console.error('getOrderById query error:', error.message, error.details, error.hint);
      return sendError(res, `Order not found: ${error.message}`, 404);
    }
    if (!data) return sendError(res, 'Order not found', 404);

    const { data: addresses } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', data.user_id)
      .limit(1);

    const addr = addresses?.[0] || {};

    const items = (data.order_items || []).map(i => ({
      product_id: i.product_id,
      name: i.products?.name || 'Product',
      image: i.products?.image_url || '',
      qty: i.quantity,
      size: null,
      color: null,
      price: parseFloat(i.price) || 0,
    }));

    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const discount = parseFloat(data.discount_amount) || 0;
    const shipping = subtotal > 4999 ? 0 : 499;
    const tax = Math.max(0, (subtotal - discount) * 0.18);
    const total = parseFloat(data.total_amount) || 0;

    const result = {
      id: data.id,
      order_number: `GS-${String(data.id).padStart(6, '0')}`,
      user_email: data.users?.email || '',
      created_at: data.created_at,
      status: data.status,
      payment_method: data.payment_method,
      payment_status: data.payment_status,
      cancel_reason: data.cancel_reason || null,
      cancel_comment: data.cancel_comment || null,
      cancelled_at: data.cancelled_at || null,
      tracking_number: data.tracking_number || null,
      estimated_delivery: data.estimated_delivery || null,
      items,
      subtotal,
      discount,
      shipping,
      tax,
      total,
      address: {
        full_name: addr.full_name || '',
        line1: addr.address_line1 || '',
        line2: addr.address_line2 || '',
        city: addr.city || '',
        state: addr.state || '',
        postal_code: addr.pincode || '',
        country: addr.country || 'India',
      },
    };

    return sendSuccess(res, { data: result });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /api/orders/admin/all (admin)
const getAllOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('orders')
      .select('*, users(name, email), order_items(*, products(name))', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) return sendError(res, error.message);

    return sendSuccess(res, {
      data,
      pagination: { total: count, page: parseInt(page), limit: parseInt(limit) },
    });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /api/orders/admin/track/:orderNumber (admin)
const getOrderTracking = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    
    // Extract order ID from order number (format: GS-XXXXXX)
    const orderId = orderNumber.replace('GS-', '').replace(/^0+/, '');
    
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, users(name, email), order_items(*, products(name, image_url, price)), order_history(*)')
      .eq('id', orderId)
      .single();

    if (error || !order) return sendError(res, 'Order not found', 404);

    return sendSuccess(res, { data: order });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /api/orders/:id/history (get order history)
const getOrderHistory = async (req, res) => {
  try {
    const { data: history, error } = await supabase
      .from('order_history')
      .select('*')
      .eq('order_id', req.params.id)
      .order('created_at', { ascending: true });

    if (error) return sendError(res, error.message);

    return sendSuccess(res, { data: history });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// PUT /api/orders/admin/:id/status (admin)
const updateOrderStatus = async (req, res) => {
  try {
    const { status, payment_status, tracking_number, estimated_delivery } = req.body;
    const updates = {};
    if (status) updates.status = status;
    if (payment_status) updates.payment_status = payment_status;
    if (tracking_number) updates.tracking_number = tracking_number;
    if (estimated_delivery) updates.estimated_delivery = estimated_delivery;

    const { data: order, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', req.params.id)
      .select('*, users(id, name, email)')
      .single();

    if (error) return sendError(res, error.message);

    // Add entry to order history
    if (status) {
      await supabase.from('order_history').insert({
        order_id: order.id,
        status: status,
        notes: req.body.notes || `Status changed to ${status}`,
        updated_by: req.user.id,
      });
    }

    await createNotification(order.users.id, 'Order Update', `Your order #${order.id} status changed to ${status || order.status}.`);

    // Send shipping status email (fire and forget)
    if (status && order.users?.email) {
      (async () => {
        try {
          const { data: orderItems } = await supabase
            .from('order_items')
            .select('*, products(name, image_url, price)')
            .eq('order_id', order.id);
          const itemsForEmail = (orderItems || []).map(i => ({
            name: i.products?.name || 'Product',
            price: i.price,
            quantity: i.quantity,
            image_url: i.products?.image_url,
          }));
          const subtotal = itemsForEmail.reduce((s, i) => s + i.price * i.quantity, 0);
          const shipping = subtotal > 4999 ? 0 : 499;
          await sendShippingStatus(
            { name: order.users.name, email: order.users.email },
            {
              id: order.id,
              order_number: `GS-${String(order.id).padStart(6, '0')}`,
              total_amount: order.total_amount,
              subtotal,
              discount_amount: order.discount_amount || 0,
              shipping,
              tracking_number,
              estimated_delivery,
            },
            status,
            itemsForEmail
          );
        } catch (emailErr) {
          console.error('Shipping status email failed:', emailErr.message);
        }
      })();
    }

    return sendSuccess(res, { data: order }, 'Order updated');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /api/orders/track/:orderNumber (public — no auth)
const getPublicOrderTracking = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { email } = req.query;

    const orderId = orderNumber.replace('GS-', '').replace(/^0+/, '');

    const { data: order, error } = await supabase
      .from('orders')
      .select('*, users!inner(id, name, email), order_items(*, products(name, image_url, price, description, sizes, colors)), order_history(*)')
      .eq('id', orderId)
      .single();

    if (error || !order) return sendError(res, 'Order not found', 404);

    if (email && order.users.email.toLowerCase() !== email.toLowerCase()) {
      return sendError(res, 'Order not found', 404);
    }

    const { data: addresses } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', order.user_id)
      .limit(1);

    const address = addresses?.[0] || null;

    const data = {
      id: order.id,
      order_number: `GS-${String(order.id).padStart(6, '0')}`,
      status: order.status,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      tracking_number: order.tracking_number,
      estimated_delivery: order.estimated_delivery,
      total_amount: order.total_amount,
      discount_amount: order.discount_amount,
      coupon_code: order.coupon_code,
      razorpay_payment_id: order.razorpay_payment_id,
      created_at: order.created_at,
      user: {
        name: order.users.name,
        email: order.users.email,
      },
      address: address ? {
        full_name: address.full_name,
        phone: address.phone,
        address_line1: address.address_line1,
        address_line2: address.address_line2,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        country: address.country || 'India',
      } : null,
      items: (order.order_items || []).map(i => ({
        id: i.id,
        product_id: i.product_id,
        name: i.products?.name || 'Product',
        price: i.price,
        quantity: i.quantity,
        image_url: i.products?.image_url,
        sizes: i.products?.sizes,
        colors: i.products?.colors,
      })),
      history: (order.order_history || [])
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .map(h => ({
          id: h.id,
          status: h.status,
          notes: h.notes,
          created_at: h.created_at,
        })),
    };

    return sendSuccess(res, { data });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /api/orders/invoice/:orderNumber (public — no auth)
const getInvoiceDownload = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { email } = req.query;

    const orderId = orderNumber.replace('GS-', '').replace(/^0+/, '');
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, users!inner(id, name, email), order_items(*, products(name, image_url, price))')
      .eq('id', orderId)
      .single();

    if (error || !order) return sendError(res, 'Order not found', 404);
    if (email && order.users.email.toLowerCase() !== email.toLowerCase()) {
      return sendError(res, 'Order not found', 404);
    }

    const items = (order.order_items || []).map(i => ({
      name: i.products?.name || 'Product',
      price: i.price,
      quantity: i.quantity,
      image_url: i.products?.image_url,
    }));

    const subtotal = items.reduce((s, i) => s + parseFloat(i.price) * (i.quantity || 1), 0);
    const shipping = subtotal > 4999 ? 0 : 499;
    const tax = Math.max(0, (order.discount_amount ? subtotal - parseFloat(order.discount_amount) : subtotal) * 0.18);

    const { data: addresses } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', order.user_id)
      .limit(1);

    const addr = addresses?.[0];
    const addressStr = addr
      ? `${addr.full_name}\n${addr.address_line1}${addr.address_line2 ? ', ' + addr.address_line2 : ''}\n${addr.city} - ${addr.pincode}\n${addr.state || ''}\nIndia`
      : '';

    const invoiceBuffer = await generateInvoice({
      id: order.id,
      order_number: `GS-${String(order.id).padStart(6, '0')}`,
      total_amount: order.total_amount,
      subtotal,
      discount_amount: parseFloat(order.discount_amount) || 0,
      shipping,
      tax,
      coupon_code: order.coupon_code || null,
      status: order.status,
      created_at: order.created_at,
      address: addressStr,
      shipping_address: addressStr,
      billing_address: addressStr,
      payment_method: order.payment_method,
      razorpay_payment_id: order.razorpay_payment_id,
      payment_status: order.payment_status,
    }, items, { name: order.users.name, email: order.users.email });

    res.setHeader('Content-Disposition', `attachment; filename="invoice-${orderNumber}.pdf"`);
    res.contentType('application/pdf').send(invoiceBuffer);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// PUT /api/orders/:id/cancel
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, comment } = req.body;

    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !order) return sendError(res, 'Order not found', 404);

    if (!['pending', 'confirmed', 'processing'].includes(order.status)) {
      return sendError(res, 'This order cannot be cancelled. It is already ' + order.status, 400);
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancel_reason: reason || 'No reason provided',
        cancel_comment: comment || null,
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) return sendError(res, updateError.message);

    // Restore stock
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('product_id, quantity')
      .eq('order_id', id);

    if (orderItems) {
      for (const item of orderItems) {
        const { data: product } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.product_id)
          .single();
        if (product) {
          await supabase
            .from('products')
            .update({ stock: product.stock + item.quantity })
            .eq('id', item.product_id);
        }
      }
    }

    // Refund wallet coins if used
    if (order.discount_amount > 0) {
      const walletRefund = Math.min(order.discount_amount, req.user.wallet_coins);
      if (walletRefund > 0) {
        const { creditWallet } = require('../services/walletService');
        await creditWallet(req.user.id, walletRefund, `Refund for cancelled order #${order.id}`);
      }
    }

    // Add order history
    await supabase.from('order_history').insert({
      order_id: order.id,
      status: 'cancelled',
      notes: reason || 'Cancelled by customer',
      updated_by: req.user.id,
    });

    await createNotification(req.user.id, 'Order Cancelled', `Your order #${order.id} has been cancelled.`);

    // Send cancellation email
    (async () => {
      try {
        const { sendShippingStatus } = require('../services/emailService');
        const { data: items } = await supabase
          .from('order_items')
          .select('*, products(name, image_url, price)')
          .eq('order_id', order.id);
        const itemsForEmail = (items || []).map(i => ({
          name: i.products?.name || 'Product',
          price: i.price,
          quantity: i.quantity,
          image_url: i.products?.image_url,
        }));
        await sendShippingStatus(
          { name: req.user.name, email: req.user.email },
          { id: order.id, order_number: `GS-${String(order.id).padStart(6, '0')}`, total_amount: order.total_amount, subtotal: 0, discount_amount: 0, shipping: 0 },
          'cancelled',
          itemsForEmail
        );
      } catch (e) { console.error('Cancel email failed:', e.message); }
    })();

    return sendSuccess(res, { data: { id: order.id, status: 'cancelled' } }, 'Order cancelled successfully');
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = { placeOrder, getUserOrders, getOrderById, getAllOrders, updateOrderStatus, getOrderTracking, getOrderHistory, getPublicOrderTracking, getInvoiceDownload, cancelOrder };
