const express = require('express');
const router = express.Router();
const { getPublicSettings } = require('../controllers/adminController');
const { getPublicBanners } = require('../controllers/adminContentController');
const supabase = require('../config/db');

router.get('/public', getPublicSettings);
router.get('/banners', getPublicBanners);

// Newsletter subscription
router.post('/subscribe', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });
    const { error } = await supabase.from('subscribers').upsert({ email, is_active: true }, { onConflict: 'email' });
    if (error) return res.status(500).json({ success: false, message: error.message });
    res.json({ success: true, message: 'Subscribed successfully' });
  } catch { res.status(500).json({ success: false, message: 'Server error' }); }
});

// Public FAQs
router.get('/faqs', async (req, res) => {
  try {
    const { data } = await supabase.from('faqs').select('*').eq('is_active', true).order('position');
    res.json({ success: true, data: data || [] });
  } catch { res.status(500).json({ success: false, message: 'Server error' }); }
});

// Public blog posts
router.get('/blog', async (req, res) => {
  try {
    const { data: draft } = await supabase.from('blog_posts').select('*').eq('is_published', true).order('published_at', { ascending: false });
    // Fallback: if no published, return all
    const { data } = draft && draft.length ? { data: draft } : await supabase.from('blog_posts').select('*').order('created_at', { ascending: false }).limit(10);
    res.json({ success: true, data: data || [] });
  } catch { res.status(500).json({ success: false, message: 'Server error' }); }
});

// Active flash sales
router.get('/flash-sales/active', async (req, res) => {
  try {
    const now = new Date().toISOString();
    const { data } = await supabase.from('flash_sales').select('*')
      .eq('is_active', true).lte('starts_at', now).gte('ends_at', now).order('created_at');
    res.json({ success: true, data: data || [] });
  } catch { res.status(500).json({ success: false, message: 'Server error' }); }
});

module.exports = router;
