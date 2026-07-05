const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const supabase = require('../config/db');

const OTP_LENGTH = 6;
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function generateOTP() {
  const buffer = crypto.randomBytes(3);
  const num = parseInt(buffer.toString('hex'), 16) % 1000000;
  return String(num).padStart(OTP_LENGTH, '0');
}

async function hashOTP(otp) {
  return bcrypt.hash(otp, 10);
}

async function verifyOTP(otp, storedHash) {
  return bcrypt.compare(otp, storedHash);
}

/**
 * Create and store a new OTP in the database.
 * Returns { otp, error } — if error is set, OTP was not created.
 */
async function createOTP(type, email, userId) {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();

  // Fetch existing record
  const { data: existing } = await supabase
    .from('otp_verifications')
    .select('*')
    .eq('email', normalizedEmail)
    .eq('type', type)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Check lockout
  if (existing && existing.locked_until && new Date(existing.locked_until) > now) {
    const remaining = Math.ceil((new Date(existing.locked_until) - now) / 60000);
    return { otp: null, error: `Too many failed attempts. Try again in ${remaining} minutes.` };
  }

  // Check rate limit (max requests per hour)
  if (existing && existing.last_request_at) {
    const lastReq = new Date(existing.last_request_at);
    const isNewWindow = (now - lastReq) >= RATE_WINDOW_MS;
    if (!isNewWindow && existing.request_count >= MAX_REQUESTS_PER_HOUR) {
      return { otp: null, error: 'Too many OTP requests. Please try again later.' };
    }
  }

  const otp = generateOTP();
  const hash = await hashOTP(otp);
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);

  const isNewWindow = !existing || !existing.last_request_at || (now - new Date(existing.last_request_at)) >= RATE_WINDOW_MS;

  // Delete old records for this email+type
  await supabase
    .from('otp_verifications')
    .delete()
    .eq('email', normalizedEmail)
    .eq('type', type);

  // Insert new OTP record
  const { error: insertError } = await supabase
    .from('otp_verifications')
    .insert({
      user_id: userId,
      email: normalizedEmail,
      otp_hash: hash,
      type,
      expires_at: expiresAt.toISOString(),
      attempts: 0,
      max_attempts: MAX_ATTEMPTS,
      locked_until: null,
      request_count: isNewWindow ? 1 : ((existing?.request_count || 0) + 1),
      last_request_at: now.toISOString(),
    });

  if (insertError) {
    return { otp: null, error: 'Failed to generate OTP. Please try again.' };
  }

  return { otp, error: null };
}

/**
 * Verify an OTP from the database.
 * Returns { success, error, userId }
 */
async function checkOTP(type, email, otp) {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();

  const { data: record } = await supabase
    .from('otp_verifications')
    .select('*')
    .eq('email', normalizedEmail)
    .eq('type', type)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!record) {
    return { success: false, error: 'No OTP found. Please request a new one.', userId: null };
  }

  // Check lockout
  if (record.locked_until && new Date(record.locked_until) > now) {
    const remaining = Math.ceil((new Date(record.locked_until) - now) / 60000);
    return { success: false, error: `Too many failed attempts. Try again in ${remaining} minutes.`, userId: null };
  }

  // Check expiry
  if (new Date(record.expires_at) < now) {
    await supabase.from('otp_verifications').delete().eq('id', record.id);
    return { success: false, error: 'OTP has expired. Please request a new one.', userId: null };
  }

  // Check attempts
  if (record.attempts >= record.max_attempts) {
    const lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MS);
    await supabase.from('otp_verifications').update({ locked_until: lockedUntil.toISOString() }).eq('id', record.id);
    return { success: false, error: 'Too many failed attempts. Locked for 15 minutes.', userId: null };
  }

  // Verify
  const valid = await verifyOTP(otp, record.otp_hash);

  if (!valid) {
    const newAttempts = record.attempts + 1;
    const update = { attempts: newAttempts };
    if (newAttempts >= record.max_attempts) {
      update.locked_until = new Date(now.getTime() + LOCKOUT_DURATION_MS).toISOString();
    }
    await supabase.from('otp_verifications').update(update).eq('id', record.id);
    const remaining = record.max_attempts - newAttempts;
    return { success: false, error: `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`, userId: null };
  }

  // Success — delete all OTP records for this email+type
  const userId = record.user_id;
  await supabase
    .from('otp_verifications')
    .delete()
    .eq('email', normalizedEmail)
    .eq('type', type);

  return { success: true, error: null, userId };
}

module.exports = { createOTP, checkOTP, OTP_EXPIRY_MS };
