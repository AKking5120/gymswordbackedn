const { body } = require('express-validator');

const passwordRules = [
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
];

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').trim().notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  ...passwordRules,
];

const loginValidation = [
  body('email').trim().notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const otpValidation = [
  body('email').trim().notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format').normalizeEmail(),
  body('otp').trim().notEmpty().withMessage('OTP is required')
    .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
    .isNumeric().withMessage('OTP must be numeric'),
];

const emailValidation = [
  body('email').trim().notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format').normalizeEmail(),
];

const changePasswordValidation = [
  body('current_password').notEmpty().withMessage('Current password is required'),
  ...passwordRules.map(rule => {
    if (rule && rule.builder && rule.builder.fields && rule.builder.fields[0] === 'password') {
      return body('new_password')
        .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
        .matches(/[A-Z]/).withMessage('New password must contain an uppercase letter')
        .matches(/[a-z]/).withMessage('New password must contain a lowercase letter')
        .matches(/[0-9]/).withMessage('New password must contain a number');
    }
    return rule;
  }),
  body('confirm_new_password').custom((value, { req }) => {
    if (value !== req.body.new_password) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
];

const resetPasswordValidation = [
  body('reset_token').notEmpty().withMessage('Reset token is required'),
  ...passwordRules.map(rule => {
    if (rule && rule.builder && rule.builder.fields && rule.builder.fields[0] === 'password') {
      return body('new_password')
        .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
        .matches(/[A-Z]/).withMessage('New password must contain an uppercase letter')
        .matches(/[a-z]/).withMessage('New password must contain a lowercase letter')
        .matches(/[0-9]/).withMessage('New password must contain a number');
    }
    return rule;
  }),
];

const addressValidation = [
  body('full_name').trim().notEmpty().withMessage('Full name is required'),
  body('mobile').trim().notEmpty().withMessage('Mobile is required'),
  body('address_line1').trim().notEmpty().withMessage('Address is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('state').trim().notEmpty().withMessage('State is required'),
  body('pincode').trim().notEmpty().withMessage('Pincode is required'),
];

module.exports = {
  registerValidation,
  loginValidation,
  otpValidation,
  emailValidation,
  changePasswordValidation,
  resetPasswordValidation,
  addressValidation,
};
