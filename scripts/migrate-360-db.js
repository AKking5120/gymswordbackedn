require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const projectRef = 'rfcmpcuybspsbeynhksa';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configs = [
  // Direct Postgres connection
  { host: `db.${projectRef}.supabase.co`, port: 5432, desc: 'direct' },
  // Transaction mode pooler (generic host)
  { host: `aws-0-ap-south-1.pooler.supabase.com`, port: 5432, user: `postgres.${projectRef}`, desc: 'pooler-tx' },
  // Session mode pooler (generic host)
  { host: `aws-0-ap-south-1.pooler.supabase.com`, port: 6543, user: `postgres.${projectRef}`, desc: 'pooler-session' },
];

async function tryConnect(config) {
  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: 'postgres',
    user: config.user || 'postgres',
    password: serviceRoleKey,
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 10000,
  });
  try {
    const client = await pool.connect();
    console.log(`Connected via ${config.desc} (${config.host}:${config.port})`);
    await client.query(`
      ALTER TABLE public.products 
      ADD COLUMN IF NOT EXISTS enable_360_view BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS enable_try_now BOOLEAN DEFAULT false;
    `);
    console.log('Migration completed!');
    client.release();
    await pool.end();
    return true;
  } catch (err) {
    console.log(`${config.desc}: ${err.code || err.message}`);
    await pool.end().catch(() => {});
    return false;
  }
}

async function run() {
  for (const config of configs) {
    if (await tryConnect(config)) {
      console.log('Success!');
      process.exit(0);
    }
  }
  console.log('\nAll connection attempts failed.');
  console.log('\nPlease run the SQL manually in Supabase Dashboard:');
  console.log('https://supabase.com/dashboard/project/rfcmpcuybspsbeynhksa/sql/new');
  console.log('\nSQL:');
  console.log('ALTER TABLE public.products');
  console.log('  ADD COLUMN IF NOT EXISTS enable_360_view BOOLEAN DEFAULT false,');
  console.log('  ADD COLUMN IF NOT EXISTS enable_try_now BOOLEAN DEFAULT false;');
  process.exit(1);
}

run();
