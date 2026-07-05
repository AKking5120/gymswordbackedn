require('dotenv').config();

const app = require('./app');
const { getEnv } = require('./config/env');
const { createSettingsTable } = require('./config/dbInit');

async function start() {
  await createSettingsTable();

  process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason?.message || reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err?.message || err);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });

  const PORT = getEnv('PORT', 5000);

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${getEnv('NODE_ENV', 'development')}`);
  });
}

start();
