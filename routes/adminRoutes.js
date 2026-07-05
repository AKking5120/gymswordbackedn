const express = require('express');
const router = express.Router();
const {
  getStats, getAdminSettings, updateAdminSettings, getAdminProducts,
  getCustomers, getAdminUsers, adminResendVerification,
  adminToggleDisableUser, adminGetLoginHistory, adminGetEmailLogs,
} = require('../controllers/adminController');
const { getAllOrders, updateOrderStatus } = require('../controllers/orderController');
const { getContactMessages, updateContactMessage, deleteContactMessage } = require('../controllers/contactController');
const { getAllCoupons, createCoupon, updateCoupon, deleteCoupon } = require('../controllers/couponController');
const { createProduct, updateProduct, deleteProduct } = require('../controllers/productController');
const { getAllReferrals } = require('../controllers/referralController');
const { uploadImage } = require('../controllers/uploadController');
const { getLeads, deleteLead } = require('../controllers/leadController');
const {
  getAdminCategories, createCategory, updateCategory, deleteCategory,
  getAdminReviews, updateReviewStatus, deleteReview,
  getAdminBanners, createBanner, updateBanner, deleteBanner,
} = require('../controllers/adminContentController');
const {
  getBlogPosts, createBlogPost, updateBlogPost, deleteBlogPost,
  getFAQs, createFAQ, updateFAQ, deleteFAQ,
  getReturnRequests, updateReturnRequest,
  getFlashSales, createFlashSale, updateFlashSale, deleteFlashSale,
  getSubscribers, exportSubscribers,
  exportData, getAdminStaff, updateStaffRole,
} = require('../controllers/adminFeaturesController');
const businessDash = require('../controllers/businessDashboardController');
const { protect } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/adminMiddleware');

router.use(protect, adminOnly);

// Core
router.get('/stats', getStats);
router.get('/settings', getAdminSettings);
router.patch('/settings', updateAdminSettings);
router.post('/uploads', uploadImage);

// Business Dashboard
router.get('/business-dashboard/overview', businessDash.getOverview);
router.get('/business-dashboard/sales', businessDash.getSales);
router.get('/business-dashboard/products', businessDash.getProducts);
router.get('/business-dashboard/customers', businessDash.getCustomers);
router.get('/business-dashboard/inventory', businessDash.getInventory);
router.get('/business-dashboard/traffic', businessDash.getTraffic);
router.get('/business-dashboard/orders', businessDash.getOrderAnalytics);
router.get('/business-dashboard/payments', businessDash.getPayments);
router.get('/business-dashboard/activities', businessDash.getRecentActivities);

// Orders
router.get('/orders', getAllOrders);
router.patch('/orders/:id/status', updateOrderStatus);

// Products
router.get('/products', getAdminProducts);
router.post('/products', createProduct);
router.patch('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

// Coupons
router.get('/coupons', getAllCoupons);
router.post('/coupons', createCoupon);
router.put('/coupons/:id', updateCoupon);
router.delete('/coupons/:id', deleteCoupon);

// Customers / Users
router.get('/customers', getCustomers);
router.get('/users', getAdminUsers);
router.post('/users/:id/resend-verification', adminResendVerification);
router.patch('/users/:id/disable', adminToggleDisableUser);
router.get('/users/:id/login-history', adminGetLoginHistory);

// Messages
router.get('/contact-messages', getContactMessages);
router.patch('/contact-messages/:id', updateContactMessage);
router.delete('/contact-messages/:id', deleteContactMessage);

// Leads
router.get('/leads', getLeads);
router.delete('/leads/:id', deleteLead);

// Referrals
router.get('/referrals', getAllReferrals);

// Categories
router.get('/categories', getAdminCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Reviews
router.get('/reviews', getAdminReviews);
router.patch('/reviews/:id/status', updateReviewStatus);
router.delete('/reviews/:id', deleteReview);

// Banners
router.get('/banners', getAdminBanners);
router.post('/banners', createBanner);
router.put('/banners/:id', updateBanner);
router.delete('/banners/:id', deleteBanner);

// Email Logs
router.get('/email-logs', adminGetEmailLogs);

// Blog
router.get('/blog', getBlogPosts);
router.post('/blog', createBlogPost);
router.put('/blog/:id', updateBlogPost);
router.delete('/blog/:id', deleteBlogPost);

// FAQ
router.get('/faqs', getFAQs);
router.post('/faqs', createFAQ);
router.put('/faqs/:id', updateFAQ);
router.delete('/faqs/:id', deleteFAQ);

// Return Requests
router.get('/returns', getReturnRequests);
router.patch('/returns/:id/status', updateReturnRequest);

// Flash Sales
router.get('/flash-sales', getFlashSales);
router.post('/flash-sales', createFlashSale);
router.put('/flash-sales/:id', updateFlashSale);
router.delete('/flash-sales/:id', deleteFlashSale);

// Subscribers
router.get('/subscribers', getSubscribers);
router.get('/subscribers/export', exportSubscribers);

// Export Data
router.get('/export/:type', exportData);

// Admin Staff
router.get('/staff', getAdminStaff);
router.patch('/staff/:id/role', updateStaffRole);

module.exports = router;
