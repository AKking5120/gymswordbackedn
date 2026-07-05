require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const projectRef = 'rfcmpcuybspsbeynhksa';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', 'coupons_update.sql'), 'utf8');

// Try connection via Supavisor (connection pooler) with JWT auth
// See: https://supabase.com/docs/guides/database/connecting-to-postgres#connecting-with-jwt
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
  try {
    await client.connect();
    return client;
  } catch {
    return null;
  }
}

async function run() {
  // Try common AWS regions for Supabase pooler
  const regions = [
    'ap-south-1',
    'us-east-1',
    'us-east-2',
    'eu-west-1',
    'eu-west-2',
    'eu-central-1',
    'ap-southeast-1',
    'ap-southeast-2',
    'ca-central-1',
  ];

  let client = null;
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    console.log(`Trying ${host}...`);
    client = await tryConnect(host);
    if (client) {
      console.log(`Connected via ${region}!`);
      break;
    }
  }

  if (!client) {
    // Also try the direct pooler host without region
    const host = `${projectRef}.pooler.supabase.com`;
    console.log(`Trying ${host}...`);
    client = await tryConnect(host);
  }

  if (!client) {
    console.error('\nCould not connect to database automatically.');
    console.error('Please run the SQL manually in the Supabase Dashboard SQL Editor:');
    console.error('\n--- SQL TO RUN ---\n');
    console.error(sql);
    console.error('\n--- END ---\n');
    console.error('Steps:');
    console.error('1. Go to https://supabase.com/dashboard/project/rfcmpcuybspsbeynhksa/sql/new');
    console.error('2. Paste the SQL above');
    console.error('3. Click Run');
    process.exit(1);
  }

  try {
    console.log('Running migration...');
    await client.query(sql);
    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
