const { v4: uuidv4 } = require('uuid');

const sendSuccess = (res, data = {}, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({ success: true, message, ...data });
};

const sendError = (res, message = 'Something went wrong', statusCode = 500) => {
  return res.status(statusCode).json({ success: false, message });
};

const generateReferralCode = () => {
  return uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
};

const formatOrderNumber = (id, stored) => stored || `GS-${String(id).padStart(6, '0')}`;

const generatePublicId = async (supabaseClient) => {
  let attempts = 0;
  while (attempts < 20) {
    const id = Math.floor(10000 + Math.random() * 90000).toString();
    const { data } = await supabaseClient
      .from('users')
      .select('id')
      .eq('public_id', id)
      .maybeSingle();
    if (!data) return id;
    attempts++;
  }
  throw new Error('Could not generate unique public ID');
};

module.exports = { sendSuccess, sendError, generateReferralCode, formatOrderNumber, generatePublicId };
