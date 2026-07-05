const supabase = require('../config/db');
const { sendSuccess, sendError } = require('../utils/helpers');
const { getAvailableStock } = require('../utils/productHelpers');

// GET /api/cart
const getCart = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cart')
      .select('*, products(id, name, price, sale_price, image_url, stock)')
      .eq('user_id', req.user.id);

    if (error) return sendError(res, error.message);

    const total = data.reduce((sum, item) => {
      const price = item.products.sale_price || item.products.price;
      return sum + price * item.quantity;
    }, 0);

    return sendSuccess(res, { data, total });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// POST /api/cart
const addToCart = async (req, res) => {
  try {
    const { product_id, quantity = 1 } = req.body;
    if (!product_id) return sendError(res, 'product_id is required', 400);

    const { data: product } = await supabase
      .from('products')
      .select('id, stock, stock_quantity')
      .eq('id', product_id)
      .single();

    if (!product) return sendError(res, 'Product not found', 404);

    const availableStock = getAvailableStock(product);
    if (availableStock < 1) return sendError(res, 'This item is out of stock', 400);

    const { data: existing } = await supabase
      .from('cart')
      .select('id, quantity')
      .eq('user_id', req.user.id)
      .eq('product_id', product_id)
      .single();

    if (existing) {
      const newQty = existing.quantity + quantity;
      if (newQty > availableStock) return sendError(res, 'Not enough stock', 400);

      const { data, error } = await supabase
        .from('cart')
        .update({ quantity: newQty })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) return sendError(res, error.message);
      return sendSuccess(res, { data }, 'Cart updated');
    }

    if (quantity > availableStock) return sendError(res, 'Not enough stock', 400);

    const { data, error } = await supabase
      .from('cart')
      .insert({ user_id: req.user.id, product_id, quantity })
      .select()
      .single();

    if (error) return sendError(res, error.message);
    return sendSuccess(res, { data }, 'Added to cart', 201);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// PUT /api/cart/:id
const updateCartItem = async (req, res) => {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity < 1) return sendError(res, 'Quantity must be at least 1', 400);

    const { data: cartItem } = await supabase
      .from('cart')
      .select('product_id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!cartItem) return sendError(res, 'Cart item not found', 404);

    const { data: product } = await supabase
      .from('products')
      .select('stock, stock_quantity')
      .eq('id', cartItem.product_id)
      .single();

    if (quantity > getAvailableStock(product)) return sendError(res, 'Not enough stock', 400);

    const { data, error } = await supabase
      .from('cart')
      .update({ quantity })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) return sendError(res, error.message);
    return sendSuccess(res, { data }, 'Cart updated');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// DELETE /api/cart/:id
const removeFromCart = async (req, res) => {
  try {
    const { error } = await supabase
      .from('cart')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) return sendError(res, error.message);
    return sendSuccess(res, {}, 'Item removed from cart');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// DELETE /api/cart
const clearCart = async (req, res) => {
  try {
    const { error } = await supabase.from('cart').delete().eq('user_id', req.user.id);
    if (error) return sendError(res, error.message);
    return sendSuccess(res, {}, 'Cart cleared');
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = { getCart, addToCart, updateCartItem, removeFromCart, clearCart };
