const cloudinary = require('cloudinary').v2;
const supabase = require('../config/db');
const fs = require('fs');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const dir = 'C:/Users/omdas/OneDrive/Pictures/stock img';

const posts = [
  { title: 'The Evolution of Gym Wear', excerpt: 'From basic cotton to high-performance fabrics — how gym wear has transformed over the decades.', image: 'hero.jpg.jpeg' },
  { title: '5 Reasons to Choose Oversized T-Shirts', excerpt: 'Comfort meets style. Discover why oversized tees are taking over the fitness fashion world.', image: 'GymSwordOversizedT-Shirt.webp' },
  { title: 'How to Style Your Hoodie for Any Occasion', excerpt: 'From gym to street — your hoodie is more versatile than you think.', image: 'ElitePerformanceHoodie.webp' },
  { title: 'The Ultimate Guide to Gym Joggers', excerpt: 'Find the perfect fit, fabric, and function for your training sessions.', image: 'GymFlexJoggers.jsx.png' },
  { title: 'Training Gear That Actually Works', excerpt: 'Science-backed activewear that enhances your performance and recovery.', image: 'ActivewearShorts.jsx.png' },
];

const body = '<p>%EXCERPT% At GymSword, we believe that what you wear matters as much as how you train. Our premium collection is engineered for those who demand the best — from the gym floor to the streets.</p><p>Every piece is crafted with precision, using moisture-wicking fabrics, ergonomic stitching, and a fit that moves with you. Whether you are lifting, running, or recovering, GymSword has you covered.</p><p>Stay tuned for more tips, guides, and insights on fitness fashion from the GymSword team.</p>';

async function run() {
  for (const post of posts) {
    const filePath = dir + '/' + post.image;
    if (!fs.existsSync(filePath)) { console.log('File not found:', post.image); continue; }

    try {
      const result = await cloudinary.uploader.upload(filePath, { folder: 'gymsword-blog' });
      const slug = post.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();

      const { error } = await supabase.from('blog_posts').insert({
        title: post.title,
        slug,
        content: body.replace('%EXCERPT%', post.excerpt),
        excerpt: post.excerpt,
        image_url: result.secure_url,
        author: 'GymSword Team',
        published_at: new Date(),
        is_published: true,
      });
      console.log((error ? '✗' : '✓') + ' ' + post.title);
    } catch (e) {
      console.log('✗ ' + post.title + ': ' + e.message);
    }
  }

  const { count } = await supabase.from('blog_posts').select('*', { count: 'exact', head: true });
  console.log('Total blog posts: ' + count);
}

run().catch(console.error);
