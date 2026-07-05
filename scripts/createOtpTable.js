require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SQL = `
CREATE TABLE IF NOT EXISTS otp_verifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('login', 'register', 'forgot_password')),
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 5,
  locked_until TIMESTAMPTZ,
  request_count INT DEFAULT 0,
  last_request_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_email_type ON otp_verifications(email, type);
CREATE INDEX IF NOT EXISTS idx_otp_user_id ON otp_verifications(user_id);
`;

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', { sql: SQL });
  if (error) {
    console.error('RPC failed, trying raw query...', error.message);
    const { data: d2, error: e2 } = await supabase.from('otp_verifications').select('id').limit(1);
    if (e2 && e2.code === '42P01') {
      console.log('Table does not exist. Please create it manually in Supabase SQL Editor.');
      console.log('SQL:\n' + SQL);
    } else {
      console.log('Table exists or was created successfully.');
    }
  } else {
    console.log('Table created successfully.');
  }
  process.exit();
}

run();
