const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getWallet } = require('../controllers/walletController');

router.use(protect);
router.get('/', getWallet);

module.exports = router;
