const { body } = require('express-validator');

const createCouponValidation = [
  body('code').trim().notEmpty().withMessage('Coupon code is required')
    .isLength({ min: 3, max: 20 }).withMessage('Code must be 3-20 characters'),
  body('discount_type').notEmpty().isIn(['percentage', 'flat']).withMessage('Discount type must be percentage or flat'),
  body('discount_value').isFloat({ min: 0 }).withMessage('Discount value must be positive'),
  body('min_order').optional().isFloat({ min: 0 }),
  body('expiry_date').optional().isISO8601().withMessage('Invalid date'),
];

const validateCouponValidation = [
  body('code').trim().notEmpty().withMessage('Coupon code is required'),
  body('cart_total').isFloat({ min: 0 }).withMessage('Cart total is required'),
];

module.exports = {
  createCouponValidation,
  validateCouponValidation,
};
