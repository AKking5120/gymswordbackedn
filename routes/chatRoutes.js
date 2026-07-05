const express = require('express');
const router = express.Router();
const { protect, protectOptional } = require('../middleware/authMiddleware');
const { chat, getHistory, deleteHistory } = require('../controllers/chatController');

router.post('/', protectOptional, chat);
router.get('/history', protect, getHistory);
router.delete('/history', protect, deleteHistory);

module.exports = router;
