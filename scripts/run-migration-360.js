require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rfcmpcuybspsbeynhksa.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function run() {
  const sql = `
    ALTER TABLE public.products 
    ADD COLUMN IF NOT EXISTS enable_360_view BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS enable_try_now BOOLEAN DEFAULT false;
  `;
  console.log('Running migration...');
  // Use rpc to call pg_query if it exists
  const { data, error } = await supabase.rpc('pg_query', { query_text: sql }).maybeSingle();
  if (error) {
    console.log('rpc method failed:', error.message);
    // Try direct management API
    const https = require('https');
    const projectRef = 'rfcmpcuybspsbeynhksa';
    const body = JSON.stringify({ query: sql });
    const options = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${projectRef}/database/query`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', data);
        if (res.statusCode === 201 || res.statusCode === 200) {
          console.log('Migration completed!');
        } else {
          console.log('\nPlease run the SQL manually at:');
          console.log('https://supabase.com/dashboard/project/rfcmpcuybspsbeynhksa/sql/new');
          console.log('\nSQL:');
          console.log(sql);
        }
      });
    });
    req.on('error', (e) => {
      console.error('Request failed:', e.message);
      console.log('\nPlease run SQL manually at Supabase Dashboard.');
      console.log('SQL:', sql);
    });
    req.write(body);
    req.end();
  } else {
    console.log('Migration completed!', data);
  }
}

run();
