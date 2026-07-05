const supabase = require('../config/db');

const createNotification = async (userId, title, message) => {
  try {
    await supabase.from('notifications').insert({ user_id: userId, title, message });
  } catch (err) {
    console.error('Notification error:', err.message);
  }
};

module.exports = { createNotification };
