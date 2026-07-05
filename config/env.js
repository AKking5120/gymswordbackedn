const REQUIRED_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
];

const OPTIONAL_VARS = {
  PORT: '5000',
  JWT_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  NODE_ENV: 'development',
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: '587',
  SMTP_USER: '',
  SMTP_PASS: '',
  SMTP_FROM: 'noreply@gymsword.com',
  SITE_URL: 'http://localhost:3000',
  CLOUDINARY_CLOUD_NAME: '',
  CLOUDINARY_API_KEY: '',
  CLOUDINARY_API_SECRET: '',
  RAZORPAY_KEY_ID: '',
  RAZORPAY_KEY_SECRET: '',
  AI_API_KEY: '',
  AI_API_URL: '',
  CORS_ORIGIN: 'http://localhost:3000',
  RATE_LIMIT_WINDOW_MS: '900000',
  RATE_LIMIT_MAX: '100',
};

function validateEnv() {
  const missing = REQUIRED_VARS.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
  const warnings = REQUIRED_VARS.filter(v => {
    if (v.includes('JWT') && process.env[v] === 'your_super_secret_jwt_key_here') {
      return true;
    }
    return false;
  });
  if (warnings.length > 0 && process.env.NODE_ENV === 'production') {
    console.error(`Change default values for: ${warnings.join(', ')}`);
    process.exit(1);
  }
}

function getEnv(key, defaultValue = null) {
  return process.env[key] || OPTIONAL_VARS[key] || defaultValue;
}

module.exports = { validateEnv, getEnv, REQUIRED_VARS, OPTIONAL_VARS };
