require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

const projectRef = 'rfcmpcuybspsbeynhksa';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sql = `ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS enable_360_view BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS enable_try_now BOOLEAN DEFAULT false;`;

async function tryConnect(host) {
  const client = new Client({
    host,
    port: 6543,
    database: 'postgres',
    user: `postgres.${projectRef}`,
    password: serviceRoleKey,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });
  try { await client.connect(); return client; } catch { return null; }
}

async function run() {
  const regions = ['ap-south-1', 'us-east-1', 'eu-west-1', 'eu-central-1', 'ap-southeast-1'];
  let client = null;
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    console.log(`Trying ${host}...`);
    client = await tryConnect(host);
    if (client) { console.log(`Connected via ${region}!`); break; }
  }
  if (!client) {
    console.error('Could not connect to database. Run SQL manually in Supabase Dashboard SQL Editor.');
    console.error('\n--- SQL ---\n' + sql + '\n--- END ---\n');
    process.exit(1);
  }
  try {
    console.log('Running migration...');
    await client.query(sql);
    console.log('Migration completed! Columns enable_360_view and enable_try_now added.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally { await client.end(); }
}

run();
