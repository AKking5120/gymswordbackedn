const cloudinary = require('cloudinary').v2;
const supabase = require('../config/db');
const fs = require('fs');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const imagesDir = 'C:/Users/omdas/OneDrive/Pictures/stock img';

const FILE_CATEGORIES = {
  // MEN
  'GymSwordOversizedT-Shirt.webp': { gender: 'men', type: 'oversized-t-shirts', price: 1899 },
  'blackt-shirt.webp': { gender: 'men', type: 'oversized-t-shirts', price: 1499 },
  'PrintedGraphicTee.webp': { gender: 'men', type: 'oversized-t-shirts', price: 1699 },
  'tshirt1.png': { gender: 'men', type: 'oversized-t-shirts', price: 1299 },
  'oversize.png': { gender: 'men', type: 'oversized-t-shirts', price: 1599 },
  'Premiumimage1.png': { gender: 'men', type: 'oversized-t-shirts', price: 2199 },
  'Premimumimage2.png': { gender: 'men', type: 'oversized-t-shirts', price: 2299 },
  'Premimumimage3.png': { gender: 'men', type: 'oversized-t-shirts', price: 2399 },
  'Premimumimage4.png': { gender: 'men', type: 'oversized-t-shirts', price: 2499 },
  'CompressionTee.webp': { gender: 'men', type: 'compression-wear', price: 1799 },
  'polo.jpg.jpeg': { gender: 'men', type: 'regular-fit-t-shirts', price: 1999 },
  'ElitePerformanceHoodie.webp': { gender: 'men', type: 'hoodies', price: 3499 },
  'GymSwordWashedHoodie.jpg.jpeg': { gender: 'men', type: 'hoodies', price: 2999 },
  'Training Oversized Fleece Hoodie.webp': { gender: 'men', type: 'hoodies', price: 3299 },
  'Training Oversized Fleece Hoodie1.webp': { gender: 'men', type: 'hoodies', price: 3399 },
  'hoodie.jpg.jpeg': { gender: 'men', type: 'hoodies', price: 2799 },
  'sweatshirt1.png': { gender: 'men', type: 'hoodies', price: 2599 },
  'GymFlexJoggers.jsx.png': { gender: 'men', type: 'joggers', price: 2499 },
  'GymSwordightweightJoggers.webp': { gender: 'men', type: 'joggers', price: 2299 },
  'Premium rainingJoggers.webp': { gender: 'men', type: 'joggers', price: 2799 },
  'ActivewearShorts.jsx.png': { gender: 'men', type: 'shorts', price: 1599 },
  'CasualDenimShirt.webp': { gender: 'men', type: 'regular-fit-t-shirts', price: 2199 },
  'SignatureEmbroideryShirt.jpg.jpeg': { gender: 'men', type: 'regular-fit-t-shirts', price: 2599 },
  'DenimJacket.webp': { gender: 'men', type: 'jackets', price: 4499 },
  'DesignerBlazer.jpg.jpeg': { gender: 'men', type: 'jackets', price: 5499 },

  // WOMEN
  'LightweightHighSupportSportsBra.avif': { gender: 'women', type: 'sports-bras', price: 1999 },
  'RuchedSportsBra.webp': { gender: 'women', type: 'sports-bras', price: 1899 },
  'VitalSportsBra.webp': { gender: 'women', type: 'sports-bras', price: 2099 },
  'images-HighSupportV_NeckSportsBraGSBlackB3B3L_BB2J8049_3840x.webp': { gender: 'women', type: 'sports-bras', price: 2199 },
  'Crop Top.avif': { gender: 'women', type: 'crop-tops', price: 1499 },
  'Everyday Seamless Long Sleeve Crop Top.webp': { gender: 'women', type: 'crop-tops', price: 1799 },
  'Vital Sweetheart Neck Crop Top.webp': { gender: 'women', type: 'crop-tops', price: 1699 },
  'VitalSweetheartNeckCropTop.webp': { gender: 'women', type: 'crop-tops', price: 1699 },
  'soha-halter-neck-crop-top-422014.webp': { gender: 'women', type: 'crop-tops', price: 1599 },
  'Vital Tank With Shelf.webp': { gender: 'women', type: 'active-wear', price: 1599 },
  'VitalSeamlessLongSleeve Top.webp': { gender: 'women', type: 'active-wear', price: 1899 },
  'womenhoodie.webp': { gender: 'women', type: 'hoodies', price: 3199 },
  'BohoMaxiDress.jpg.jpeg': { gender: 'women', type: 'active-wear', price: 3999 },
  'light-pink-boho-maxi-dress_023039365_1_202601301506.webp': { gender: 'women', type: 'active-wear', price: 3799 },
  'nerita-boho-maxi-dress-d519985-aqua-100--v1-original.jpg.jpeg': { gender: 'women', type: 'active-wear', price: 4199 },

  // UNISEX
  'Adapt Animal X Whitney Short Sleeve Top.webp': { gender: 'unisex', type: 'oversized-t-shirts', price: 1899 },
};

// Products with special flags
const SPECIAL_FLAGS = {
  'GymSwordOversizedT-Shirt.webp': { is_featured: true, is_new_arrival: true, stock: 45 },
  'ElitePerformanceHoodie.webp': { is_featured: true, is_trending: true, stock: 30 },
  'DenimJacket.webp': { is_featured: true, stock: 15 },
  'VitalSportsBra.webp': { is_featured: true, is_trending: true, stock: 50 },
  'BohoMaxiDress.jpg.jpeg': { is_featured: true, is_new_arrival: true, stock: 25 },
  'CompressionTee.webp': { is_trending: true, stock: 60 },
  'Crop Top.avif': { is_trending: true, stock: 40 },
  'GymFlexJoggers.jsx.png': { is_sale: true, price: 2499, stock: 20 },
  'blackt-shirt.webp': { is_new_arrival: true, stock: 100 },
  'PrintedGraphicTee.webp': { is_sale: true, stock: 35 },
  'Premium rainingJoggers.webp': { is_new_arrival: true, stock: 28 },
  'LightweightHighSupportSportsBra.avif': { is_new_arrival: true, stock: 55 },
  'womenhoodie.webp': { is_trending: true, stock: 22 },
  'Adapt Animal X Whitney Short Sleeve Top.webp': { is_new_arrival: true, stock: 33 },
  'RuchedSportsBra.webp': { is_sale: true, stock: 18 },
  'DesignerBlazer.jpg.jpeg': { is_trending: true, stock: 10 },
  // Out of stock
  'sweatshirt1.png': { stock: 0 },
  'nerita-boho-maxi-dress-d519985-aqua-100--v1-original.jpg.jpeg': { stock: 0 },
  'VitalSeamlessLongSleeve Top.webp': { stock: 0 },
  // Low stock (for low stock alerts)
  'SignatureEmbroideryShirt.jpg.jpeg': { stock: 3 },
  'soha-halter-neck-crop-top-422014.webp': { stock: 2 },
  'Premimumimage4.png': { stock: 4 },
};

function makeName(filename) {
  return filename
    .replace(/\.(jpg|jpeg|png|gif|webp|avif)$/i, '')
    .replace(/\.jsx/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function run() {
  const cats = Object.entries(FILE_CATEGORIES);
  console.log(`Processing ${cats.length} products...`);

  for (const [filename, config] of cats) {
    const filePath = `${imagesDir}/${filename}`;
    if (!fs.existsSync(filePath)) {
      console.log(`✗ File not found: ${filename}`);
      continue;
    }

    try {
      const result = await cloudinary.uploader.upload(filePath, { folder: 'gymsword' });
      const name = makeName(filename);
      const flags = SPECIAL_FLAGS[filename] || {};
      const stock = flags.stock !== undefined ? flags.stock : Math.floor(Math.random() * 100) + 20;
      const price = flags.price || config.price || 1999;
      const salePrice = flags.is_sale ? Math.round(price * 0.7) : null;

      const product = {
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
        price,
        sale_price: salePrice,
        stock_quantity: stock,
        images: JSON.stringify([{ url: result.secure_url, alt: name }]),
        description: `Premium quality ${name.toLowerCase()} — engineered for peak performance.`,
        is_active: true,
        category: config.gender,
        product_type: config.type,
        gender: config.gender,
        is_featured: flags.is_featured || false,
        is_trending: flags.is_trending || false,
        is_sale: flags.is_sale || false,
        is_new_arrival: flags.is_new_arrival || false,
        rating: Math.floor(Math.random() * 20 + 30) / 10,
        review_count: Math.floor(Math.random() * 80) + 5,
      };

      const { error } = await supabase.from('products').insert(product);
      const icon = error ? `✗ ${error.message}` : `✓`;
      console.log(`${icon} ${name} [${config.gender}/${config.type}] ${stock === 0 ? '🔥 OUT OF STOCK' : ''} ${flags.is_featured ? '⭐' : ''} ${flags.is_trending ? '📈' : ''} ${flags.is_sale ? '🏷️' : ''} ${flags.is_new_arrival ? '🆕' : ''}`);
    } catch (e) {
      console.log(`✗ Error for ${filename}: ${e.message}`);
    }
  }

  const { count } = await supabase.from('products').select('*', { count: 'exact', head: true });
  console.log(`\nTotal products: ${count}`);
}

run().catch(console.error);
