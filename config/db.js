const { createClient } = require('@supabase/supabase-js');
const { getEnv } = require('./env');

const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  global: {
    headers: {
      'X-Client-Info': 'gymsword-backend',
    },
  },
});

module.exports = supabase;
