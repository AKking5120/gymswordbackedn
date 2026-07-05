const { Client } = require('pg');

const PROJECT_REF = 'rfcmpcuybspsbeynhksa';

const SETTINGS_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  id BIGINT PRIMARY KEY DEFAULT 1,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO settings (id, data, updated_at)
VALUES (1, '{
  "hero_headline": "Forge Your Legacy",
  "hero_subheadline": "Premium gymwear engineered for performance.",
  "announcement_bar": "",
  "coming_soon": false,
  "show_prices": true,
  "enable_purchases": true,
  "free_shipping_threshold": 999,
  "standard_shipping_fee": 49,
  "express_shipping_fee": 149,
  "enable_cod": true,
  "razorpay_key_id": "",
  "razorpay_key_secret": "",
  "default_meta_title": "GymSword - Premium Gymwear",
  "default_meta_description": "Premium gymwear engineered for performance. Shop the latest activewear collections.",
  "default_og_image": "",
  "gst_percentage": 18,
  "instagram_url": "https://instagram.com/gymsword",
  "facebook_url": "https://facebook.com/gymsword",
  "youtube_url": "https://youtube.com/@gymsword",
  "twitter_url": "https://x.com/gymsword",
  "pinterest_url": "https://pinterest.com/gymsword",
  "logo_url": "",
  "primary_color": "#000000",
  "accent_color": "#ffffff"
}'::jsonb, NOW())
ON CONFLICT (id) DO NOTHING;
`;

async function tryConnect(host) {
  const client = new Client({
    host,
    port: 6543,
    database: 'postgres',
    user: `postgres.${PROJECT_REF}`,
    password: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    return client;
  } catch {
    return null;
  }
}

async function createSettingsTable() {
  const regions = [
    'ap-south-1', 'us-east-1', 'us-east-2', 'eu-west-1',
    'eu-west-2', 'eu-central-1', 'ap-southeast-1', 'ap-southeast-2', 'ca-central-1',
  ];

  let client = null;
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    client = await tryConnect(host);
    if (client) break;
  }

  if (!client) {
    const host = `${PROJECT_REF}.pooler.supabase.com`;
    client = await tryConnect(host);
  }

  if (!client) {
    console.warn('Could not connect to database for settings table init. Settings will use env defaults until table is created.');
    console.warn(`Run the SQL from backend/migrations/activity_logs.sql (settings section) in the Supabase SQL Editor.`);
    return;
  }

  try {
    await client.query(SETTINGS_SQL);
    console.log('Settings table initialized successfully');
  } catch (err) {
    console.warn('Settings table init failed:', err.message);
  } finally {
    await client.end();
  }
}

module.exports = { createSettingsTable };
