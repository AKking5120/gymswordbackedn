const { body, param, query } = require('express-validator');

const placeOrderValidation = [
  body('address_id').notEmpty().withMessage('Address ID is required').isInt().withMessage('Invalid address ID'),
  body('payment_method').notEmpty().withMessage('Payment method is required')
    .isIn(['cod', 'razorpay']).withMessage('Invalid payment method'),
  body('coupon_code').optional().trim(),
  body('discount_amount').optional().isFloat({ min: 0 }).withMessage('Invalid discount'),
  body('use_wallet_coins').optional().isInt({ min: 0 }).withMessage('Invalid wallet coins'),
  body('razorpay_payment_id').optional().trim(),
];

const cancelOrderValidation = [
  param('id').notEmpty().withMessage('Order ID is required').isInt(),
  body('reason').optional().trim().isLength({ max: 500 }),
];

const updateOrderStatusValidation = [
  param('id').notEmpty().withMessage('Order ID is required').isInt(),
  body('status').optional().isIn(['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned']),
  body('payment_status').optional().isIn(['pending', 'paid', 'failed', 'refunded']),
  body('tracking_number').optional().trim(),
  body('estimated_delivery').optional().trim(),
];

const trackOrderValidation = [
  param('orderNumber').trim().notEmpty().withMessage('Order number is required'),
  query('email').optional().isEmail().withMessage('Invalid email'),
];

module.exports = {
  placeOrderValidation,
  cancelOrderValidation,
  updateOrderStatusValidation,
  trackOrderValidation,
};
