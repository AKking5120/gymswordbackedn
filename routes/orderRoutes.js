const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');
const { placeOrder, getUserOrders, getOrderById, getAllOrders, updateOrderStatus, getOrderTracking, getOrderHistory, getPublicOrderTracking, getInvoiceDownload, cancelOrder } = require('../controllers/orderController');

// Public routes (no auth required)
router.get('/track/:orderNumber', getPublicOrderTracking);
router.get('/invoice/:orderNumber', getInvoiceDownload);

router.use(protect);
router.post('/', placeOrder);
router.get('/', getUserOrders);
router.get('/admin/all', adminOnly, getAllOrders);
router.get('/admin/track/:orderNumber', adminOnly, getOrderTracking);
router.put('/admin/:id/status', adminOnly, updateOrderStatus);
router.get('/:id/history', getOrderHistory);
router.put('/:id/cancel', cancelOrder);
router.get('/:id', getOrderById);

module.exports = router;
