const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const COMMON_PASSWORD = 'Test@123';
const PLACEHOLDER_IMG = '/uploads/placeholder.jpg';
const COLORS_PALETTE = ['Black', 'White', 'Charcoal', 'Navy', 'Olive', 'Burgundy', 'Grey', 'Forest Green', 'Steel Blue', 'Tan'];

// ─── Category Definitions ──────────────────────────────────────

const CATEGORIES = [
  { name: 'Oversized T-Shirts', product_type: 'oversized-t-shirts', gender: ['men', 'women'] },
  { name: 'Compression Wear', product_type: 'compression-wear', gender: ['men', 'women'] },
  { name: 'Active Wear', product_type: 'active-wear', gender: ['men', 'women'] },
  { name: 'Hoodies', product_type: 'hoodies', gender: ['men', 'women'] },
  { name: 'Joggers', product_type: 'joggers', gender: ['men'] },
  { name: 'Shorts', product_type: 'shorts', gender: ['men', 'women', 'unisex'] },
  { name: 'Tank Tops', product_type: 'tank-tops', gender: ['men', 'women'] },
  { name: 'Accessories', product_type: 'accessories', gender: ['unisex'] },
  { name: 'Track Pants', product_type: 'track-pants', gender: ['men', 'women'] },
  { name: 'Sports Bras', product_type: 'sports-bras', gender: ['women'] },
];

const SIZES_BY_TYPE = {
  'oversized-t-shirts': ['S', 'M', 'L', 'XL', 'XXL'],
  'compression-wear': ['S', 'M', 'L', 'XL'],
  'active-wear': ['S', 'M', 'L', 'XL'],
  'hoodies': ['S', 'M', 'L', 'XL', 'XXL'],
  'joggers': ['S', 'M', 'L', 'XL', 'XXL'],
  'shorts': ['S', 'M', 'L', 'XL'],
  'tank-tops': ['S', 'M', 'L', 'XL'],
  'accessories': ['One Size'],
  'track-pants': ['S', 'M', 'L', 'XL', 'XXL'],
  'sports-bras': ['S', 'M', 'L', 'XL'],
};

const COLLECTIONS = ['summer', 'winter', 'pro', 'essential', 'heritage', 'limited-edition'];

// ─── Product Generation ────────────────────────────────────────

const productNames = {
  'oversized-t-shirts': [
    'Oversized Drop Shoulder Tee', 'Classic Oversized Fit Tee', 'Raw Edge Oversized T-Shirt',
    'Heavyweight Oversized Tee', 'Minimalist Oversized Shirt', 'Boxy Fit Cotton Tee',
    'Relaxed Fit Logo Tee', ' oversized Jersey Tee', 'Premium Oversized Crew',
    'Streetwear Oversized Tee', 'Distressed Oversized T-Shirt', 'Essential Oversized Top',
    'Garment Dyed Oversized Tee', 'Washed Oversized T-Shirt', 'Graphic Print Oversized Tee',
    'Acid Wash Oversized Shirt', 'Retro Oversized Jersey', 'Vintage Oversized Tee',
    'Split Hem Oversized Tee', 'Contrast Stitch Oversized Shirt',
    'Pocket Oversized Tee', 'Panel Detail Oversized Shirt',
  ],
  'compression-wear': [
    'Pro Compression Top', 'Compression Fit Tee', 'Performance Compression Shirt',
    'Seamless Compression Top', 'Thermal Compression Layer', 'Moisture Wicking Compression Tee',
    'Athletic Fit Compression Tee', 'Recovery Compression Shirt', 'Core Compression Top',
    'Flex Compression Tee', 'Rash Guard Compression Top', 'Training Compression Tee',
    'Pro Fit Compression Vest', '4D Stretch Compression Tee', 'Coolmax Compression Shirt',
    'Ultra Compression Long Sleeve', 'Muscle Fit Compression Tee', 'Ripped Compression Top',
    'Aerodynamic Compression Tee', 'Breathable Compression Shirt',
  ],
  'active-wear': [
    'Performance Active Tee', 'Training Active Shirt', 'Quick Dry Active Top',
    'Sport Active Wear Tee', 'Flex Active Training Shirt', 'Core Active Performance Tee',
    'Endurance Active Top', 'Motion Active Tee', 'Stretch Active Fit Shirt',
    'Aeroready Active Tee', 'Dri-Fit Style Active Top', 'Climalite Active Tee',
    'HeatGear Active Compression', 'ColdGear Active Layer', 'All Day Active Tee',
    'Studio Active Crop Top', 'Yoga Active Fit Tee', 'Run Active Performance Shirt',
    'Gym Active Training Tee', 'Cross Training Active Top',
  ],
  'hoodies': [
    'Classic Pullover Hoodie', 'Premium Fleece Hoodie', 'Zip Up Tech Hoodie',
    'Oversized Comfort Hoodie', 'Heavyweight Hooded Sweatshirt', 'Essential Full Zip Hoodie',
    'Cropped Fit Hoodie', 'Athletic Hooded Jacket', 'Thermal Lined Hoodie',
    'Streetwear Pullover Hoodie', 'Color Block Hoodie', 'Terry Cloth Hoodie',
    'French Terry Hoodie', 'Brushed Fleece Hoodie', 'Graphic Print Hoodie',
    'Minimalist Zip Hoodie', 'Paneled Tech Hoodie', 'Performance Half Zip Hoodie',
    'Vintage Wash Hoodie', 'Layered Hoodie Jacket',
  ],
  'joggers': [
    'Premium Fleece Joggers', 'Classic Fit Jogger Pants', 'Tech Fabric Joggers',
    'Tapered Jogger Sweatpants', 'Training Joggers', 'Essentials Jogger Pants',
    'Performance Joggers', 'French Terry Joggers', 'Slim Fit Track Joggers',
    'Cuffed Jogger Sweatpants', 'Zipper Pocket Joggers', 'Relaxed Fit Joggers',
    'Woven Tech Joggers', 'Sustainable Cotton Joggers', 'Terry Jogger Pants',
    'Brushed Fleece Joggers', 'Streetwear Cargo Joggers', 'Elastic Waist Joggers',
    'Summer Weight Joggers', 'Layered Panel Joggers',
  ],
  'shorts': [
    'Performance Training Shorts', 'Classic Gym Shorts', 'Running Split Shorts',
    'Compression Shorts', 'Mesh Gym Shorts', 'Essential Casual Shorts',
    'Athletic Fit Shorts', 'Quick Dry Training Shorts', 'Terry Shorts',
    'Woven Running Shorts', 'Cargo Gym Shorts', 'Flex Waistband Shorts',
    'Drawstring Casual Shorts', 'Sport Training Shorts', 'Breathable Mesh Shorts',
    'Core Shorts', 'Pro Fit Training Shorts', 'Summer Active Shorts',
    'Printed Gym Shorts', 'Stretch Woven Shorts',
  ],
  'tank-tops': [
    'Classic Muscle Tank', 'Performance Sleeveless Tee', 'Racerback Tank Top',
    'Training Tank Top', 'Essential Sleeveless Top', 'Loose Fit Tank',
    'Compression Tank Top', 'Mesh Panel Tank', 'Drop Armhole Tank',
    'Core Sleeveless Tee', 'Breathable Tank Top', 'Active Racerback Tank',
    'Stringer Tank Top', 'V-Neck Muscle Tank', 'Strappy Back Tank',
    'Cotton Blend Tank', 'Open Back Tank Top', 'Layered Tank Top',
    'Cut Out Sleeveless Tee', 'Scoop Neck Tank Top',
  ],
  'accessories': [
    'Gym Training Gloves', 'Weight Lifting Belt', 'Sweatband Set',
    'Gym Sack Bag', 'Resistance Bands Set', 'Jump Rope Speed',
    'Gym Towel Premium', 'Shaker Bottle Pro', 'Duffel Gym Bag',
    'Knee Sleeves Pair', 'Wrist Wraps Pair', 'Lifting Straps',
    'Headband Terry', ' Gym Cap', 'Phone Armband',
    'Water Bottle Insulated', 'Foam Roller', 'Gym Keychain',
    'Gym Socks 3 Pack', 'Gym Backpack Premium', 'Dipping Belt Premium',
    'Gym Chalk Block',
  ],
  'track-pants': [
    'Essential Track Pants', 'Performance Track Pants', 'Slim Track Pants',
    'Woven Track Pants', 'Training Track Pants', 'Tapered Track Pants',
    'Tech Fabric Track Pants', 'Zipper Track Pants', 'Elastic Cuff Track Pants',
    'Sports Track Pants', 'Casual Track Pants', 'Stretch Track Pants',
    'Breathable Track Pants', 'Winter Track Pants', 'Summer Track Pants',
    'Running Track Pants', 'Yoga Track Pants', 'Warm Up Track Pants',
    'Cargo Track Pants', 'Pro Fit Track Pants',
  ],
  'sports-bras': [
    'High Support Sports Bra', 'Medium Impact Sports Bra', 'Low Impact Sports Bra',
    'Strappy Back Sports Bra', 'Racerback Sports Bra', 'Padded Sports Bra',
    'Wireless Sports Bra', 'Seamless Sports Bra', 'Breathable Sports Bra',
    'Zip Front Sports Bra', 'Cross Back Sports Bra', 'V-Neck Sports Bra',
    'Longline Sports Bra', 'Crop Sports Bra', 'Full Coverage Sports Bra',
    'Moisture Wicking Sports Bra', 'Compression Sports Bra', 'Adjustable Strap Sports Bra',
    'Training Sports Bra', 'Yoga Sports Bra',
  ],
};

// ─── User Data ──────────────────────────────────────────────

const INDIAN_CITIES = [
  { city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
  { city: 'Delhi', state: 'Delhi', pincode: '110001' },
  { city: 'Bangalore', state: 'Karnataka', pincode: '560001' },
  { city: 'Hyderabad', state: 'Telangana', pincode: '500001' },
  { city: 'Ahmedabad', state: 'Gujarat', pincode: '380001' },
  { city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
  { city: 'Kolkata', state: 'West Bengal', pincode: '700001' },
  { city: 'Pune', state: 'Maharashtra', pincode: '411001' },
  { city: 'Jaipur', state: 'Rajasthan', pincode: '302001' },
  { city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226001' },
];

const INDIAN_NAMES = [
  'Arjun Sharma', 'Priya Patel', 'Rahul Verma', 'Ananya Singh', 'Vikram Joshi',
  'Sneha Reddy', 'Aarav Kapoor', 'Diya Mehta', 'Rohan Desai', 'Isha Nair',
  'Karan Malhotra', 'Neha Gupta', 'Aditya Khanna', 'Pooja Saxena', 'Manish Kumar',
  'Kavya Chakraborty', 'Siddharth Rao', 'Riya Sengupta', 'Amit Trivedi', 'Tanvi Agarwal',
  'Rajesh Iyer', 'Meera Choudhury', 'Nikhil Bhat', 'Jhanvi Pillai', 'Deepak Srinivasan',
  'Anjali Menon', 'Suresh Babu', 'Lakshmi Krishnan', 'Praveen Raj', 'Geeta Nair',
  'Hariharan Nair', 'Shweta Mishra', 'Kiran Jain', 'Shruti Arora', 'Abhishek Yadav',
  'Nandini Bose', 'Gaurav Thakur', 'Tanya Chopra', 'Vivek Oberoi', 'Ishaani Kaur',
  'Rajat Bansal', 'Sana Khan', 'Pranav Kulkarni', 'Suhani Bhatnagar', 'Varun Dhawan',
  'Rashmi Tiwari', 'Mohit Chauhan', 'Preeti Jha', 'Nitin Shah', 'Anushka Das',
  'Yash Goenka', 'Mira Sethi', 'Aryan Khurana', 'Vani Kapoor', 'Kunal Sood',
  'Tara Subramanian', 'Imran Qureshi', 'Sonali Bose', 'Farhan Akhtar', 'Zara Khan',
  'Sameer Wagh', 'Kriti Suri', 'Rohit Malhotra', 'Leela Pillai', 'Pankaj Tripathi',
  'Ayesha Sheikh', 'Vijay Devarakonda', 'Kajal Aggarwal', 'Dhruv Rathee', 'Yami Gautam',
  'Ranveer Singh', 'Alia Bhat', 'Akshay Kumar', 'Deepika Padukone', 'Salman Khan',
  'Katrina Kaif', 'Hrithik Roshan', 'Kareena Kapoor', 'Rajkummar Rao', 'Kangana Ranaut',
  'Ayushmann Khurrana', 'Taapsee Pannu', 'Vicky Kaushal', 'Radhika Apte', 'Nawazuddin Siddiqui',
  'Richa Chadha', 'Pankaj Tripathi', 'Shefali Shah', 'Kay Kay Menon', 'Tisca Chopra',
  'Manoj Bajpayee', 'Sakshi Tanwar', 'Diljit Dosanjh', 'Mona Singh', 'R Madhavan',
  'Simran Bagga', 'Naseeruddin Shah', 'Shabana Azmi', 'Anupam Kher', 'Jaya Bachchan',
  'Amitabh Bachchan', 'Rekha Haryanvi', 'Dharmendra Singh', 'Hema Malini', 'Shah Rukh Khan',
  'Madhuri Dixit', 'Aamir Khan', 'Juhi Chawla', 'Akshaye Khanna', 'Twinkle Khanna',
];

const INDIAN_STREETS = [
  '123 Park Street', '456 Lake View Road', '789 MG Road', '321 Brigade Road',
  '654 Linking Road', '987 Commercial Street', '147 Connaught Place', '258 Marine Drive',
  '369 Carter Road', '741 Banjara Hills', '852 Jubilee Hills', '963 Koramangala',
  '159 Indiranagar', '753 BTM Layout', '951 JP Nagar', '753 Sector 62',
  '159 Golf Course Road', '357 DLF Phase 2', '852 Sakinaka', '456 Powai',
];

const PHONE_PREFIXES = ['98765', '87654', '76543', '99887', '88776', '77665', '98989', '87878', '76767', '99009'];

const REVIEW_TEXTS = [
  'Amazing quality! The fabric is super soft and comfortable. Worth every penny.',
  'Perfect fit and great material. Will definitely buy more from GymSword.',
  'Good product but size runs slightly larger than expected. Order one size down.',
  'Excellent build quality. Been using it for a month and still looks brand new.',
  'Love the design and comfort. My new favorite gym outfit!',
  'Great value for money. The material is breathable and perfect for workouts.',
  'Decent quality but the color faded slightly after a few washes.',
  'Absolutely love this! The fit is perfect and very stylish.',
  'Good for casual wear. Not ideal for intense workouts though.',
  'Super comfortable and looks great. Received many compliments!',
  'The fabric is premium quality. Feels great against the skin.',
  'Perfect for my daily gym sessions. Highly recommended!',
  'Nice product but delivery took longer than expected.',
  'Quality is top notch. GymSword never disappoints.',
  'Very impressed with the stitching and finish. Premium feel.',
  'Comfortable fit for both gym and casual outings. Versatile!',
  'Would give 6 stars if I could. Best gym wear I have ever purchased.',
  'The material is thick and durable. Seems like it will last long.',
  'Good product overall but could be slightly more affordable.',
  'Exceeded my expectations. The fabric quality is outstanding!',
  'Perfect oversized fit. Exactly what I was looking for.',
  'Very breathable fabric. Great for hot weather workouts.',
  'Stylish and functional. The zipper pockets are a game changer.',
  'Best purchase this month! The quality is incredible.',
  'Fits true to size. Very comfortable for long workout sessions.',
  'The color is exactly as shown in the picture. Love it!',
  'Great addition to my gym wardrobe. Will order more colors.',
  'Comfortable, stylish, and affordable. What more could you want?',
  'The fabric has a nice weight to it. Feels very premium.',
  'Perfect for layering or wearing alone. Very versatile piece.',
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function randFloat(min, max, decimals = 2) { return parseFloat((Math.random() * (max - min) + min).toFixed(decimals)); }

function generateSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function generateSKU(productType, index) {
  const prefix = productType.split('-').map(w => w[0]).join('').toUpperCase();
  return `${prefix}-${String(index).padStart(4, '0')}`;
}

function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

async function safeInsert(table, data) {
  try {
    const { error } = await supabase.from(table).insert(data);
    if (error) return null;
    return true;
  } catch { return null; }
}

// ─── Main Seed Function ────────────────────────────────────────

async function seed() {
  console.log('=== GYMSWORD SEED SCRIPT ===\n');
  const startTime = Date.now();

  const hashedPassword = await bcrypt.hash(COMMON_PASSWORD, 10);

  // ── 0. Clear existing data ──────────────────────────────────
  console.log('Clearing existing data...');
  const tables = [
    'visitor_leads', 'contact_messages', 'email_logs', 'login_history',
    'wallet_transactions', 'notifications', 'order_history', 'order_items',
    'orders', 'reviews', 'wishlist', 'cart', 'addresses', 'referrals',
    'products', 'categories', 'coupons',
  ];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', 0);
    if (error && error.code !== 'PGRST116') console.error(`  Clear ${table}:`, error.message);
  }
  // Clear users last (FK target)
  const { error: userClearErr } = await supabase.from('users').delete().neq('id', 0);
  if (userClearErr && userClearErr.code !== 'PGRST116') console.error('  Clear users:', userClearErr.message);
  console.log('  Done.\n');

  // ── 1. Categories ───────────────────────────────────────────
  console.log('Creating categories...');
  const { data: createdCategories, error: catErr } = await supabase
    .from('categories')
    .insert(CATEGORIES.map(c => ({ name: c.name })))
    .select();
  if (catErr) { console.error('  Category error:', catErr.message); return; }
  console.log(`  Created ${createdCategories.length} categories.\n`);

  // ── 2. Coupons ───────────────────────────────────────────────
  console.log('Creating coupons...');
  const coupons = [
    { code: 'WELCOME10', discount_type: 'percentage', discount_value: 10, min_order: 999, one_time_use: true, used_count: 0, is_active: true, expiry_date: '2027-12-31T23:59:59Z' },
    { code: 'GYM20', discount_type: 'percentage', discount_value: 20, min_order: 1999, one_time_use: false, used_count: 5, is_active: true, expiry_date: '2027-06-30T23:59:59Z' },
    { code: 'ACTIVE15', discount_type: 'percentage', discount_value: 15, min_order: 1499, one_time_use: false, used_count: 12, is_active: true, expiry_date: '2026-12-31T23:59:59Z' },
    { code: 'SUMMER25', discount_type: 'percentage', discount_value: 25, min_order: 2499, one_time_use: true, used_count: 3, is_active: true, expiry_date: '2026-09-30T23:59:59Z' },
    { code: 'FREESHIP', discount_type: 'flat', discount_value: 499, min_order: 999, one_time_use: false, used_count: 45, is_active: true, expiry_date: '2027-12-31T23:59:59Z' },
    { code: 'VIP30', discount_type: 'percentage', discount_value: 30, min_order: 3999, one_time_use: true, used_count: 1, is_active: true, expiry_date: '2026-08-31T23:59:59Z' },
    { code: 'FITNESS10', discount_type: 'percentage', discount_value: 10, min_order: 500, one_time_use: false, used_count: 28, is_active: true, expiry_date: '2026-11-30T23:59:59Z' },
    { code: 'MUSCLE20', discount_type: 'flat', discount_value: 200, min_order: 1499, one_time_use: true, used_count: 7, is_active: true, expiry_date: '2026-10-31T23:59:59Z' },
    { code: 'NEWYOU', discount_type: 'percentage', discount_value: 15, min_order: 999, one_time_use: true, used_count: 19, is_active: true, expiry_date: '2026-08-15T23:59:59Z' },
    { code: 'FLAT500', discount_type: 'flat', discount_value: 500, min_order: 2999, one_time_use: false, used_count: 0, is_active: false, expiry_date: '2025-12-31T23:59:59Z' },
  ];
  const { data: createdCoupons } = await supabase.from('coupons').insert(coupons).select();
  console.log(`  Created ${createdCoupons?.length || 0} coupons.\n`);

  // ── 3. Products ──────────────────────────────────────────────
  console.log('Creating 200+ products...');
  let allProducts = [];
  let productIndex = 1;

  for (const cat of CATEGORIES) {
    const names = productNames[cat.product_type] || productNames['oversized-t-shirts'];
    const categoryId = createdCategories.find(c => c.name === cat.name)?.id;
    const sizes = SIZES_BY_TYPE[cat.product_type] || ['M', 'L', 'XL'];

    for (let i = 0; i < names.length; i++) {
      const name = names[i].trim();
      const gender = pick(cat.gender);
      const basePrice = cat.product_type === 'accessories' ? randInt(299, 1499) : randInt(799, 3499);
      const hasSale = Math.random() < 0.3;
      const salePrice = hasSale ? Math.round(basePrice * randFloat(0.5, 0.85)) : null;
      const colors = [pick(COLORS_PALETTE), pick(COLORS_PALETTE), pick(COLORS_PALETTE)];
      const tags = [cat.product_type, gender, pick(['premium', 'essential', 'pro', 'classic', 'sport']), pick(['new', 'trending', 'featured'])];
      const stock = randInt(10, 200);

      allProducts.push({
        name,
        description: `Premium ${cat.name.toLowerCase()} from GymSword. Crafted with high-quality fabric for maximum comfort and performance during your workouts. Features ergonomic design and durable stitching for long-lasting wear.`,
        short_description: `Premium ${cat.name.toLowerCase()} for ${gender === 'unisex' ? 'everyone' : gender}. ${pick(['Maximum comfort', 'Built for performance', 'Everyday essential', 'Premium quality', 'Designed for the gym'])}.`,
        gender,
        price: basePrice,
        sale_price: salePrice,
        compare_at_price: hasSale ? basePrice + randInt(500, 2000) : null,
        stock: stock,
        stock_quantity: stock,
        sizes: JSON.stringify(sizes),
        colors: JSON.stringify([...new Set(colors)]),
        image_url: PLACEHOLDER_IMG,
        images: JSON.stringify(['/uploads/placeholder.jpg']),
        category_id: categoryId,
        category: cat.name,
        product_type: cat.product_type,
        collection: pick(COLLECTIONS),
        brand: 'GymSword',
        sku: generateSKU(cat.product_type, productIndex),
        slug: `${generateSlug(name)}-${productIndex}`,
        fabric: pick(['100% Cotton', 'Cotton Blend', 'Polyester Blend', 'Nylon Spandex', 'French Terry', 'Mesh']),
        weight: cat.product_type === 'accessories' ? null : pick(['150 GSM', '200 GSM', '250 GSM', '300 GSM', '350 GSM']),
        tags: JSON.stringify(tags),
        is_active: Math.random() < 0.95,
        is_featured: Math.random() < 0.15,
        is_trending: Math.random() < 0.2,
        is_sale: hasSale,
        is_new_arrival: Math.random() < 0.25,
        rating: randFloat(3.0, 5.0, 1),
        review_count: randInt(0, 120),
        variants: JSON.stringify([]),
      });
      productIndex++;
    }
  }

  // Insert in batches of 20
  let insertedProducts = [];
  for (let i = 0; i < allProducts.length; i += 20) {
    const batch = allProducts.slice(i, i + 20);
    const { data, error } = await supabase.from('products').insert(batch).select();
    if (error) { console.error(`  Batch ${i} product error:`, error.message); continue; }
    if (data) insertedProducts.push(...data);
  }
  console.log(`  Created ${insertedProducts.length} products.\n`);

  // ── 4. Users ────────────────────────────────────────────────
  console.log('Creating 100+ users...');
  const users = [];
  const adminUser = {
    name: 'Admin GymSword',
    email: 'admin@gymsword.com',
    password: hashedPassword,
    role: 'admin',
    email_verified: true,
    is_disabled: false,
    wallet_coins: 99999,
    referral_code: 'ADMIN001',
    public_id: '00001',
  };
  const { data: createdAdmin } = await supabase.from('users').insert(adminUser).select();
  if (createdAdmin) users.push(createdAdmin[0]);

  const usedEmails = new Set();
  const usedReferralCodes = new Set();
  usedEmails.add('admin@gymsword.com');
  usedReferralCodes.add('ADMIN001');

  for (let i = 0; i < 105; i++) {
    const name = INDIAN_NAMES[i % INDIAN_NAMES.length];
    const suffix = i >= INDIAN_NAMES.length ? `_${Math.floor(i / INDIAN_NAMES.length)}` : '';
    const email = `${name.toLowerCase().replace(/\s+/g, '.')}${suffix}@gmail.com`.replace(/[^a-z0-9.@]/g, '');

    if (usedEmails.has(email)) continue;
    usedEmails.add(email);

    let referralCode = generateReferralCode();
    while (usedReferralCodes.has(referralCode)) referralCode = generateReferralCode();
    usedReferralCodes.add(referralCode);

    const isDisabled = i > 95;
    const walletBase = randInt(0, 5000);

    const user = {
      name,
      email,
      password: hashedPassword,
      role: 'user',
      email_verified: i > 2 ? true : (Math.random() < 0.85),
      email_verification_otp: i > 2 ? null : String(randInt(100000, 999999)),
      email_verification_expiry: i > 2 ? null : new Date(Date.now() + 600000).toISOString(),
      is_disabled: isDisabled,
      wallet_coins: walletBase,
      referral_code: referralCode,
      public_id: String(10001 + i),
      created_at: new Date(Date.now() - randInt(1, 365) * 86400000).toISOString(),
    };
    if (i > 0 && Math.random() < 0.3) {
      const referrer = users.length > 1 ? users[randInt(0, users.length - 1)] : null;
      if (referrer) user.referred_by = referrer.referral_code;
    }
    const { data, error } = await supabase.from('users').insert(user).select();
    if (error) { console.error(`  User ${email}:`, error.message); continue; }
    if (data) users.push(data[0]);
  }
  console.log(`  Created ${users.length} users.\n`);

  // ── 5. Addresses ─────────────────────────────────────────────
  console.log('Creating addresses...');
  let addressCount = 0;
  for (const user of users) {
    const addrCount = user.role === 'admin' ? 0 : randInt(1, 2);
    for (let a = 0; a < addrCount; a++) {
      const loc = pick(INDIAN_CITIES);
      const addr = {
        user_id: user.id,
        full_name: user.name,
        mobile: `${pick(PHONE_PREFIXES)}${randInt(10000, 99999)}`,
        address_line1: pick(INDIAN_STREETS),
        address_line2: Math.random() < 0.5 ? `Apartment ${randInt(1, 100)}` : null,
        city: loc.city,
        state: loc.state,
        pincode: String(loc.pincode),
        country: 'India',
        is_default: a === 0,
      };
      const { error } = await supabase.from('addresses').insert(addr);
      if (!error) addressCount++;
    }
  }
  console.log(`  Created ${addressCount} addresses.\n`);

  // ── 6. Cart Items ────────────────────────────────────────────
  console.log('Creating cart items...');
  let cartCount = 0;
  for (const user of users) {
    if (user.role === 'admin' || Math.random() > 0.4) continue;
    const itemCount = randInt(1, 4);
    const usedProducts = new Set();
    for (let c = 0; c < itemCount; c++) {
      const product = pick(insertedProducts);
      if (usedProducts.has(product.id)) continue;
      usedProducts.add(product.id);
      const { error } = await supabase.from('cart').insert({
        user_id: user.id,
        product_id: product.id,
        quantity: randInt(1, 3),
      });
      if (!error) cartCount++;
    }
  }
  console.log(`  Created ${cartCount} cart items.\n`);

  // ── 7. Wishlist ──────────────────────────────────────────────
  console.log('Creating wishlist items...');
  let wishlistCount = 0;
  for (const user of users) {
    if (user.role === 'admin' || Math.random() > 0.5) continue;
    const itemCount = randInt(1, 6);
    const usedProducts = new Set();
    for (let w = 0; w < itemCount; w++) {
      const product = pick(insertedProducts);
      if (usedProducts.has(product.id)) continue;
      usedProducts.add(product.id);
      const { error } = await supabase.from('wishlist').insert({
        user_id: user.id,
        product_id: product.id,
      });
      if (!error) wishlistCount++;
    }
  }
  console.log(`  Created ${wishlistCount} wishlist items.\n`);

  // ── 8. Orders ────────────────────────────────────────────────
  console.log('Creating orders with items and history...');
  const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
  const PAYMENT_METHODS = ['cod', 'razorpay'];
  const TRACKING_PREFIXES = ['GYM', 'DEL', 'FED', 'BLU', 'EKO'];
  let orderCount = 0;
  let itemCount = 0;
  let historyCount = 0;

  for (let i = 0; i < Math.min(users.length, 80); i++) {
    const user = users[i];
    if (user.role === 'admin') continue;
    const numOrders = randInt(1, 5);

    for (let o = 0; o < numOrders; o++) {
      const status = pick(ORDER_STATUSES);
      const paymentMethod = pick(PAYMENT_METHODS);
      const paymentStatus = status === 'cancelled' ? 'pending' : (paymentMethod === 'cod' ? 'pending' : 'paid');
      const daysAgo = randInt(1, 90);
      const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString();
      const orderItems = [];
      const numItems = randInt(1, 4);
      let subtotal = 0;
      const usedProds = new Set();

      for (let oi = 0; oi < numItems; oi++) {
        const product = pick(insertedProducts);
        if (usedProds.has(product.id)) continue;
        usedProds.add(product.id);
        const qty = randInt(1, 3);
        const price = product.sale_price || product.price;
        subtotal += price * qty;
        orderItems.push({ product_id: product.id, quantity: qty, price });
      }

      const shipping = subtotal > 4999 ? 0 : 499;
      const hasCoupon = Math.random() < 0.25;
      const couponCode = hasCoupon ? pick(coupons).code : null;
      const discountAmount = hasCoupon ? Math.round(subtotal * randFloat(0.05, 0.2)) : 0;
      const total = Math.max(0, subtotal + shipping - discountAmount + Math.round(subtotal * 0.18));

      const order = {
        user_id: user.id,
        total_amount: total,
        status,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        coupon_code: couponCode,
        discount_amount: discountAmount,
        created_at: createdAt,
      };

      const { data: createdOrder, error: orderErr } = await supabase.from('orders').insert(order).select();
      if (orderErr) { console.error('  Order insert:', orderErr.message); continue; }
      if (!createdOrder || !createdOrder[0]) { console.error('  Order insert: no data returned'); continue; }
      orderCount++;

      const insertItems = orderItems.map(oi => ({ ...oi, order_id: createdOrder[0].id }));
      const { error: itemsErr } = await supabase.from('order_items').insert(insertItems);
      if (!itemsErr) itemCount += insertItems.length;

      // Create order history entries based on status
      const statusOrder = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered'];
      const statusIdx = statusOrder.indexOf(status);
      if (statusIdx >= 0) {
        for (let s = 0; s <= statusIdx; s++) {
          const histTime = new Date(new Date(createdAt).getTime() + s * randInt(1, 48) * 3600000).toISOString();
          const { error: histErr } = await supabase.from('order_history').insert({
            order_id: createdOrder[0].id,
            status: statusOrder[s],
            notes: s === statusIdx ? `Current status: ${statusOrder[s].replace(/_/g, ' ')}` : `Status changed to ${statusOrder[s].replace(/_/g, ' ')}`,
            updated_by: user.id,
            created_at: histTime,
          });
          if (!histErr) historyCount++;
        }
      }

      await safeInsert('notifications', {
        user_id: user.id,
        title: 'Order Update',
        message: `Your order #GS-${String(createdOrder[0].id).padStart(6, '0')} is ${status.replace(/_/g, ' ')}.`,
        created_at: createdAt,
      });

      if (Math.random() < 0.3) {
        await safeInsert('login_history', {
          user_id: user.id,
          ip_address: `192.168.${randInt(0, 255)}.${randInt(1, 254)}`,
          device_info: pick(['Mobile', 'Desktop', 'Mobile', 'Desktop']),
          browser_info: pick(['Chrome', 'Firefox', 'Safari', 'Edge']),
          created_at: createdAt,
        });
      }
    }
  }
  console.log(`  Created ${orderCount} orders, ${itemCount} items, ${historyCount} history entries.\n`);

  // ── 9. Reviews ───────────────────────────────────────────────
  console.log('Creating 500+ reviews...');
  let reviewCount = 0;
  for (let i = 0; i < 520; i++) {
    const product = pick(insertedProducts);
    const user = pick(users);
    if (user.role === 'admin') continue;
    const { error: reviewErr } = await supabase.from('reviews').insert({
      user_id: user.id,
      product_id: product.id,
      rating: randInt(1, 5),
      comment: pick(REVIEW_TEXTS),
      created_at: new Date(Date.now() - randInt(1, 180) * 86400000).toISOString(),
    });
    if (reviewErr) { if (i === 0) console.error('  Review error:', reviewErr.message); continue; }
    reviewCount++;
  }
  console.log(`  Created ${reviewCount} reviews.\n`);

  // ── 10. Referrals ─────────────────────────────────────────────
  console.log('Creating referral data...');
  let referralCount = 0;
  for (let i = 1; i < Math.min(users.length, 50); i++) {
    const referredUser = users[i];
    if (referredUser.referred_by) {
      const referrer = users.find(u => u.referral_code === referredUser.referred_by);
      if (referrer) {
        const { error } = await supabase.from('referrals').insert({
          referrer_id: referrer.id,
          referred_user_id: referredUser.id,
          referral_code: referrer.referral_code,
          reward_coins: 25,
          reward_given: Math.random() < 0.7,
          created_at: new Date(Date.now() - randInt(1, 200) * 86400000).toISOString(),
        });
        if (!error) {
          referralCount++;
          await safeInsert('wallet_transactions', {
            user_id: referrer.id,
            coins: 25,
            transaction_type: 'credit',
            description: `Referral reward for referring ${referredUser.name}`,
            created_at: new Date(Date.now() - randInt(1, 180) * 86400000).toISOString(),
          });
          await safeInsert('notifications', {
            user_id: referrer.id,
            title: 'Referral Reward!',
            message: `You earned 25 GymSword coins for referring ${referredUser.name}!`,
          });
        }
      }
    }
  }
  console.log(`  Created ${referralCount} referrals.\n`);

  // ── 11. Wallet Transactions ──────────────────────────────────
  console.log('Creating wallet transactions...');
  let walletTxCount = 0;
  for (const user of users) {
    if (user.role === 'admin' || user.wallet_coins <= 0) continue;
    const numCredits = randInt(1, 5);
    for (let w = 0; w < numCredits; w++) {
      const { error } = await supabase.from('wallet_transactions').insert({
        user_id: user.id,
        coins: randInt(10, 200),
        transaction_type: 'credit',
        description: pick(['Welcome bonus', 'Purchase reward', 'Referral bonus', 'Daily login reward', 'Fitness challenge reward', 'Birthday reward']),
        created_at: new Date(Date.now() - randInt(1, 180) * 86400000).toISOString(),
      });
      if (!error) walletTxCount++;
    }
    if (Math.random() < 0.3) {
      const { error } = await supabase.from('wallet_transactions').insert({
        user_id: user.id,
        coins: randInt(50, 500),
        transaction_type: 'debit',
        description: 'Used coins for order discount',
        created_at: new Date(Date.now() - randInt(1, 60) * 86400000).toISOString(),
      });
      if (!error) walletTxCount++;
    }
  }
  console.log(`  Created ${walletTxCount} wallet transactions.\n`);

  // ── 12. Notifications ────────────────────────────────────────
  console.log('Creating notifications...');
  let notifCount = 0;
  for (const user of users) {
    if (user.role === 'admin') continue;
    const numNotifs = randInt(0, 8);
    const templates = [
      { title: 'Welcome to GymSword!', message: 'Thank you for joining the GymSword community.' },
      { title: 'New Arrivals', message: 'Check out our latest collection of premium gym wear.' },
      { title: 'Flash Sale!', message: 'Up to 50% off on selected items. Limited time offer!' },
      { title: 'Referral Bonus', message: 'Share GymSword with friends and earn rewards.' },
      { title: 'Order Shipped', message: 'Your package is on its way! Track your order now.' },
      { title: 'Review Request', message: 'How was your recent purchase? Share your feedback.' },
      { title: 'Reward Points', message: 'You earned 50 GymSword coins. Keep going!' },
      { title: 'Price Drop Alert', message: 'An item in your wishlist is now on sale!' },
    ];
    for (let n = 0; n < numNotifs; n++) {
      const tpl = pick(templates);
      const { error } = await supabase.from('notifications').insert({
        user_id: user.id,
        title: tpl.title,
        message: tpl.message,
        is_read: Math.random() < 0.4,
        created_at: new Date(Date.now() - randInt(0, 90) * 86400000).toISOString(),
      });
      if (!error) notifCount++;
    }
  }
  console.log(`  Created ${notifCount} notifications.\n`);

  // ── 13. Email Logs ──────────────────────────────────────────
  console.log('Creating email logs...');
  const emailTypes = ['email_verification', 'welcome', 'forgot_password', 'login_notification', 'order_confirmation',
    'shipping_confirmed', 'shipping_processing', 'shipping_shipped', 'shipping_out_for_delivery', 'shipping_delivered',
    'coupon_notification', 'promotional_campaign'];
  let emailLogCount = 0;
  const emailBatch = [];
  for (const user of users) {
    if (user.role === 'admin') continue;
    const numEmails = randInt(2, 6);
    for (let e = 0; e < numEmails; e++) {
      emailBatch.push({
        user_id: user.id,
        email_type: pick(emailTypes),
        recipient: user.email,
        subject: pick(['Welcome to GymSword', 'GymSword Login OTP', 'Order Confirmed', 'Shipping Update', 'Your GymSword Password Reset OTP', 'New Login Detected', 'FLASH SALE: Up to 50% Off', 'Refer & Earn Rewards']),
        status: Math.random() < 0.9 ? 'sent' : 'failed',
        error_message: Math.random() < 0.9 ? null : 'SMTP connection timeout',
        created_at: new Date(Date.now() - randInt(0, 180) * 86400000).toISOString(),
      });
    }
  }
  for (let i = 0; i < emailBatch.length; i += 50) {
    const { error } = await supabase.from('email_logs').insert(emailBatch.slice(i, i + 50));
    if (!error) emailLogCount += Math.min(50, emailBatch.length - i);
  }
  console.log(`  Created ${emailLogCount} email logs.\n`);

  // ── 14. Contact Messages ─────────────────────────────────────
  console.log('Creating contact messages...');
  const contactMessages = [
    { name: 'Rahul Sharma', email: 'rahul.sharma@gmail.com', subject: 'Order not delivered yet', message: 'My order #GS-000123 was supposed to be delivered 3 days ago but it still shows in transit. Please help.', status: 'new' },
    { name: 'Priya Patel', email: 'priya.patel@gmail.com', subject: 'Size exchange request', message: 'I ordered an oversized tee in size M but it is too large. Can I exchange for size S?', status: 'read' },
    { name: 'Amit Kumar', email: 'amit.kumar@gmail.com', subject: 'Coupon not working', message: 'The coupon code WELCOME10 is not working on my cart. My cart total is Rs. 2,500.', status: 'replied' },
    { name: 'Sneha Reddy', email: 'sneha.reddy@gmail.com', subject: 'Product quality issue', message: 'I received my order and the stitching on the sleeve is coming apart. Request a replacement.', status: 'new' },
    { name: 'Vikram Joshi', email: 'vikram.joshi@gmail.com', subject: 'Refund status', message: 'My cancelled order refund has not been processed yet. It has been 7 days.', status: 'closed' },
    { name: 'Neha Gupta', email: 'neha.gupta@gmail.com', subject: 'Shipping charges query', message: 'Why was I charged shipping when my order was over Rs. 5,000?', status: 'new' },
    { name: 'Rohan Verma', email: 'rohan.verma@gmail.com', subject: 'Wrong item received', message: 'I ordered black joggers but received grey ones. Please arrange a replacement.', status: 'read' },
    { name: 'Ananya Singh', email: 'ananya.singh@gmail.com', subject: 'Account deletion request', message: 'Please delete my account and all associated data. My email is ananya.singh@gmail.com.', status: 'replied' },
    { name: 'Karan Malhotra', email: 'karan.malhotra@gmail.com', subject: 'Bulk order enquiry', message: 'I want to place a bulk order for 50 GymSword t-shirts for my gym. Do you offer corporate discounts?', status: 'new' },
    { name: 'Diya Mehta', email: 'diya.mehta@gmail.com', subject: 'Payment failed but amount deducted', message: 'My Razorpay payment failed but the amount was deducted from my account. Order ID: GS-000456.', status: 'closed' },
  ];
  for (const msg of contactMessages) {
    await safeInsert('contact_messages', msg);
  }
  console.log(`  Created ${contactMessages.length} contact messages.\n`);

  // ── 15. Visitor Leads ────────────────────────────────────────
  console.log('Creating visitor leads...');
  const leadNames = ['Test Lead', 'Walk-in Customer', 'Website Visitor'];
  for (let i = 0; i < 25; i++) {
    await safeInsert('visitor_leads', {
      name: pick(leadNames),
      email: `lead${i}@example.com`,
      phone: `${pick(PHONE_PREFIXES)}${randInt(10000, 99999)}`,
      created_at: new Date(Date.now() - randInt(0, 60) * 86400000).toISOString(),
    });
  }
  console.log(`  Created 25 visitor leads.\n`);

  // ── 16. Update product ratings from reviews ──────────────────
  console.log('Updating product ratings...');
  for (const product of insertedProducts) {
    const { data: reviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('product_id', product.id);
    if (reviews && reviews.length > 0) {
      const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
      try { await supabase.from('products').update({ rating: parseFloat(avg.toFixed(1)), review_count: reviews.length }).eq('id', product.id); } catch {}
    }
  }
  console.log('  Updated product ratings.\n');

  // ── Summary ──────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('=== SEED COMPLETE ===');
  console.log(`  Time: ${elapsed}s`);
  console.log(`  Users: ${users.length}`);
  console.log(`  Products: ${insertedProducts.length}`);
  console.log(`  Categories: ${createdCategories.length}`);
  console.log(`  Coupons: ${createdCoupons?.length || 0}`);
  console.log(`  Orders: ${orderCount}`);
  console.log(`  Order Items: ${itemCount}`);
  console.log(`  Order History: ${historyCount}`);
  console.log(`  Reviews: ${reviewCount}`);
  console.log(`  Referrals: ${referralCount}`);
  console.log(`  Cart Items: ${cartCount}`);
  console.log(`  Wishlist Items: ${wishlistCount}`);
  console.log(`  Wallet Transactions: ${walletTxCount}`);
  console.log(`  Notifications: ${notifCount}`);
  console.log(`  Email Logs: ${emailLogCount}`);
  console.log(`  Addresses: ${addressCount}`);
  console.log(`  Contact Messages: ${contactMessages.length}`);
  console.log('\nAdmin login: admin@gymsword.com / Test@123');
  console.log('User login: Any test user email / Test@123');
}

seed().catch(err => {
  console.error('\nSeed failed:', err);
  process.exit(1);
});