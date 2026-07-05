const express = require('express');
const router = express.Router();
const { protect, protectOptional } = require('../middleware/authMiddleware');
const {
  chat, sizeRecommendation, compareProducts, fitness, voiceTranscribe,
  cartManagement, wishlist, accountAssistant, couponAssistant,
  orderAssistant, getRecommendations, getHistory, deleteHistory, adminAI,
} = require('../controllers/aiController');

// Core chat
router.post('/chat', protectOptional, chat);

// Product search & recommendations
router.post('/product-search', protectOptional, chat);
router.post('/recommendation', protectOptional, getRecommendations);

// Size recommendation
router.post('/size-recommendation', protectOptional, sizeRecommendation);

// Product comparison
router.post('/compare', protectOptional, compareProducts);

// Fitness assistant
router.post('/fitness', protectOptional, fitness);

// Voice transcription
router.post('/voice-transcribe', protectOptional, voiceTranscribe);

// Cart management (auth required)
router.post('/cart', protect, cartManagement);

// Wishlist (auth required)
router.post('/wishlist', protect, wishlist);

// Account assistant (auth required)
router.get('/account', protect, accountAssistant);

// Coupon assistant (auth required)
router.post('/coupon', protect, couponAssistant);
router.get('/coupons', protect, couponAssistant);

// Order assistant (auth required)
router.post('/order', protect, orderAssistant);
router.get('/orders', protect, orderAssistant);

// History (auth required)
router.get('/history', protect, getHistory);
router.delete('/history', protect, deleteHistory);

// Admin AI (auth + admin only)
router.get('/admin', protect, adminAI);

module.exports = router;
