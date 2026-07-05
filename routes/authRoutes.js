const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createRateLimiter: rateLimiter } = require('../middleware/rateLimiter');
const {
  register, verifyEmail, resendOTP,
  login, sendLoginOTP, verifyLoginOTP,
  forgotPassword, verifyResetOTP, resetPassword, changePassword,
  getMe, updateProfile,
  getAddresses, addAddress, updateAddress, deleteAddress,
  getNotifications, markNotificationRead,
  getLoginHistory,
} = require('../controllers/authController');

// Public routes (with rate limiting on auth actions)
router.post('/register', rateLimiter(10, 60000), register);
router.post('/verify-email', rateLimiter(5, 60000), verifyEmail);
router.post('/resend-otp', rateLimiter(3, 60000), resendOTP);
router.post('/login', rateLimiter(10, 60000), login);
router.post('/send-login-otp', rateLimiter(5, 60000), sendLoginOTP);
router.post('/verify-login-otp', rateLimiter(5, 60000), verifyLoginOTP);
router.post('/forgot-password', rateLimiter(3, 60000), forgotPassword);
router.post('/verify-reset-otp', rateLimiter(5, 60000), verifyResetOTP);
router.post('/reset-password', rateLimiter(5, 60000), resetPassword);

// Authenticated routes
router.use(protect);
router.get('/me', getMe);
router.put('/profile', updateProfile);
router.post('/change-password', changePassword);
router.get('/login-history', getLoginHistory);

router.get('/addresses', getAddresses);
router.post('/addresses', addAddress);
router.put('/addresses/:id', updateAddress);
router.delete('/addresses/:id', deleteAddress);

router.get('/notifications', getNotifications);
router.put('/notifications/:id/read', markNotificationRead);

module.exports = router;
