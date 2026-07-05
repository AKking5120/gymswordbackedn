const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/db');
const { sendSuccess, sendError, generateReferralCode, generatePublicId } = require('../utils/helpers');
const { creditWallet } = require('../services/walletService');
const { createNotification } = require('../services/notificationService');
const { sendVerificationOTP, sendWelcomeEmail, sendForgotPasswordOTP, sendLoginNotification, sendLoginOTP: sendLoginOTPEmail } = require('../services/emailService');
const { createOTP, checkOTP } = require('../services/otpService');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

function getClientInfo(req) {
  const ua = req.headers['user-agent'] || '';
  return {
    ip: req.ip || req.connection?.remoteAddress || 'Unknown',
    userAgent: ua,
    device: /mobile|android|iphone|ipad/i.test(ua) ? 'Mobile' : /windows|mac|linux/i.test(ua) ? 'Desktop' : 'Unknown',
    browser: ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : ua.includes('Edge') ? 'Edge' : 'Unknown',
  };
}

// POST /api/auth/register
const register = async (req, res) => {
  try {
    let { name, email, password, referred_by } = req.body;

    if (!name || !email || !password)
      return sendError(res, 'Name, email and password are required', 400);

    email = email.trim().toLowerCase();

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) return sendError(res, 'Email already registered', 409);

    const hashedPassword = await bcrypt.hash(password, 10);
    const referralCode = generateReferralCode();
    const publicId = await generatePublicId(supabase);

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        name,
        email,
        password: hashedPassword,
        referral_code: referralCode,
        referred_by,
        public_id: publicId,
        email_verified: false,
      })
      .select('id, name, email, role, wallet_coins, referral_code, public_id, email_verified')
      .single();

    if (error) return sendError(res, error.message);

    // Generate and store OTP in otp_verifications table
    const { otp, error: otpError } = await createOTP('register', email, newUser.id);
    if (!otpError) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[OTP] Registration OTP for ${email}: ${otp}`);
      }
      try {
        await sendVerificationOTP(newUser, otp);
      } catch (e) {
        console.error('Verification email failed:', e.message);
      }
    }

    // Handle referral reward
    const cleanReferredBy = referred_by && referred_by !== 'undefined' ? referred_by : null;
    if (cleanReferredBy) {
      const { data: referrer, error: refErr } = await supabase
        .from('users')
        .select('id')
        .eq('referral_code', cleanReferredBy)
        .single();

      if (!refErr && referrer) {
        const rewardCoins = 25;
        await supabase.from('referrals').insert({
          referrer_id: referrer.id,
          referred_user_id: newUser.id,
          referral_code: cleanReferredBy,
          reward_coins: rewardCoins,
          reward_given: true,
        });
        try {
          await creditWallet(referrer.id, rewardCoins, `Referral reward â€” ${newUser.name} signed up with your code`);
          await createNotification(referrer.id, 'Referral Reward!', `You earned ${rewardCoins} coins! ${newUser.name} just signed up using your referral code.`);
        } catch (walletErr) {
          console.error('Referral wallet credit error:', walletErr.message);
        }
      }
    }

    await createNotification(newUser.id, 'Verify Email', 'Please check your email to verify your account.');

    return sendSuccess(res, {
      data: { user: { id: newUser.id, name: newUser.name, email: newUser.email, email_verified: false } },
    }, 'Registration successful. Please verify your email.', 201);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// POST /api/auth/verify-email
const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return sendError(res, 'Email and OTP required', 400);

    const normalizedEmail = email.trim().toLowerCase();

    const { success, error: otpError, userId } = await checkOTP('register', normalizedEmail, otp);
    if (!success) return sendError(res, otpError, 400);

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!user) return sendError(res, 'User not found', 404);
    if (user.email_verified) return sendError(res, 'Email already verified', 400);

    await supabase
      .from('users')
      .update({ email_verified: true })
      .eq('id', user.id);

    sendWelcomeEmail({ ...user, name: user.name }).catch(e => console.error('Welcome email failed:', e.message));

    const token = generateToken(user.id);
    const { password: _, ...safeUser } = user;
    safeUser.email_verified = true;

    return sendSuccess(res, { data: { user: safeUser, token } }, 'Email verified successfully');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// POST /api/auth/resend-otp
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return sendError(res, 'Email required', 400);

    const normalizedEmail = email.trim().toLowerCase();

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    if (!user) return sendError(res, 'User not found', 404);
    if (user.email_verified) return sendError(res, 'Email already verified', 400);

    const { otp, error: otpError } = await createOTP('register', normalizedEmail, user.id);
    if (otpError) return sendError(res, otpError, 429);

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP] Resend OTP for ${normalizedEmail}: ${otp}`);
    }
    try {
      await sendVerificationOTP(user, otp);
    } catch (e) {
      console.error('Resend OTP email failed:', e.message);
    }

    return sendSuccess(res, {}, 'OTP resent to your email');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    let { email, password } = req.body;
    if (!email || !password) return sendError(res, 'Email and password required', 400);

    email = email.trim().toLowerCase();

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) return sendError(res, 'Invalid credentials', 401);

    if (user.is_disabled) return sendError(res, 'Account has been disabled. Contact support.', 403);

    if (!user.email_verified) {
      return sendError(res, 'Please verify your email before logging in', 403);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return sendError(res, 'Invalid credentials', 401);

    const { password: _, ...safeUser } = user;
    const token = generateToken(user.id);

    const info = getClientInfo(req);
    await supabase.from('login_history').insert({
      user_id: user.id,
      ip_address: info.ip,
      user_agent: info.userAgent,
      device_info: info.device,
      browser_info: info.browser,
    });

    sendLoginNotification(user, {
      time: new Date().toLocaleString('en-IN'),
      device: info.device,
      browser: info.browser,
      ip: info.ip,
    }).catch(e => console.error('Login notification failed:', e.message));

    return sendSuccess(res, { data: { user: safeUser, token } }, 'Login successful');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    let { email } = req.body;
    if (!email) return sendError(res, 'Email required', 400);

    email = email.trim().toLowerCase();

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (!user) return sendSuccess(res, {}, 'If an account exists, an OTP has been sent');

    const { otp, error: otpError } = await createOTP('forgot_password', email, user.id);
    if (!otpError) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[OTP] Forgot Password OTP for ${email}: ${otp}`);
      }
      try {
        await sendForgotPasswordOTP(user, otp);
      } catch (e) {
        console.error('Forgot password email failed:', e.message);
      }
    }

    return sendSuccess(res, {}, 'If an account exists, an OTP has been sent');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// POST /api/auth/verify-reset-otp
const verifyResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return sendError(res, 'Email and OTP required', 400);

    const normalizedEmail = email.trim().toLowerCase();

    const { success, error: otpError, userId } = await checkOTP('forgot_password', normalizedEmail, otp);
    if (!success) return sendError(res, otpError, 400);

    const resetToken = jwt.sign({ id: userId, purpose: 'reset' }, process.env.JWT_SECRET, { expiresIn: '5m' });

    return sendSuccess(res, { data: { reset_token: resetToken } }, 'OTP verified');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  try {
    const { reset_token, new_password } = req.body;
    if (!reset_token || !new_password) return sendError(res, 'Reset token and new password required', 400);

    const decoded = jwt.verify(reset_token, process.env.JWT_SECRET);
    if (decoded.purpose !== 'reset') return sendError(res, 'Invalid reset token', 400);

    if (new_password.length < 8) return sendError(res, 'Password must be at least 8 characters', 400);
    if (!/[A-Z]/.test(new_password)) return sendError(res, 'Password must contain at least one uppercase letter', 400);
    if (!/[a-z]/.test(new_password)) return sendError(res, 'Password must contain at least one lowercase letter', 400);
    if (!/[0-9]/.test(new_password)) return sendError(res, 'Password must contain at least one number', 400);

    const hashedPassword = await bcrypt.hash(new_password, 10);

    await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', decoded.id);

    return sendSuccess(res, {}, 'Password updated successfully');
  } catch (err) {
    if (err.name === 'TokenExpiredError') return sendError(res, 'Reset token expired', 400);
    return sendError(res, err.message);
  }
};

// POST /api/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password, confirm_new_password } = req.body;

    if (!current_password || !new_password) return sendError(res, 'Current and new password required', 400);

    if (new_password !== confirm_new_password) return sendError(res, 'New passwords do not match', 400);

    if (new_password.length < 8) return sendError(res, 'Password must be at least 8 characters', 400);
    if (!/[A-Z]/.test(new_password)) return sendError(res, 'Password must contain at least one uppercase letter', 400);
    if (!/[a-z]/.test(new_password)) return sendError(res, 'Password must contain at least one lowercase letter', 400);
    if (!/[0-9]/.test(new_password)) return sendError(res, 'Password must contain at least one number', 400);

    const { data: user } = await supabase
      .from('users')
      .select('password')
      .eq('id', req.user.id)
      .single();

    if (!user) return sendError(res, 'User not found', 404);

    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch) return sendError(res, 'Current password is incorrect', 400);

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await supabase.from('users').update({ password: hashedPassword }).eq('id', req.user.id);

    return sendSuccess(res, {}, 'Password changed successfully');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    return sendSuccess(res, { data: req.user });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// PUT /api/auth/profile
const updateProfile = async (req, res) => {
  try {
    const { name } = req.body;
    const updates = {};

    if (name) updates.name = name;

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select('id, name, email, role, wallet_coins')
      .single();

    if (error) return sendError(res, error.message);
    return sendSuccess(res, { data }, 'Profile updated');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /api/auth/addresses
const getAddresses = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', req.user.id);

    if (error) return sendError(res, error.message);
    return sendSuccess(res, { data });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// POST /api/auth/addresses
const addAddress = async (req, res) => {
  try {
    const { full_name, mobile, address_line1, address_line2, city, state, pincode, country, is_default } = req.body;

    if (is_default) {
      await supabase.from('addresses').update({ is_default: false }).eq('user_id', req.user.id);
    }

    const { data, error } = await supabase
      .from('addresses')
      .insert({ user_id: req.user.id, full_name, mobile, address_line1, address_line2, city, state, pincode, country, is_default })
      .select()
      .single();

    if (error) return sendError(res, error.message);
    return sendSuccess(res, { data }, 'Address added', 201);
  } catch (err) {
    return sendError(res, err.message);
  }
};

// PUT /api/auth/addresses/:id
const updateAddress = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.body.is_default) {
      await supabase.from('addresses').update({ is_default: false }).eq('user_id', req.user.id);
    }

    const { data, error } = await supabase
      .from('addresses')
      .update(req.body)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) return sendError(res, error.message);
    return sendSuccess(res, { data }, 'Address updated');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// DELETE /api/auth/addresses/:id
const deleteAddress = async (req, res) => {
  try {
    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) return sendError(res, error.message);
    return sendSuccess(res, {}, 'Address deleted');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /api/auth/notifications
const getNotifications = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) return sendError(res, error.message);
    return sendSuccess(res, { data });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// PUT /api/auth/notifications/:id/read
const markNotificationRead = async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) return sendError(res, error.message);
    return sendSuccess(res, {}, 'Marked as read');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// GET /api/auth/login-history
const getLoginHistory = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('login_history')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) return sendError(res, error.message);
    return sendSuccess(res, { data });
  } catch (err) {
    return sendError(res, err.message);
  }
};

// â”€â”€â”€ OTP Login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// POST /api/auth/send-login-otp
const sendLoginOTP = async (req, res) => {
  try {
    let { email } = req.body;
    if (!email) return sendError(res, 'Email is required', 400);

    email = email.trim().toLowerCase();

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, email_verified, is_disabled')
      .eq('email', email)
      .single();

    if (error || !user) return sendError(res, 'No account found with this email', 404);
    if (user.is_disabled) return sendError(res, 'Account has been disabled. Contact support.', 403);
    if (!user.email_verified) return sendError(res, 'Please verify your email first', 403);

    const { otp, error: otpError } = await createOTP('login', email, user.id);
    if (otpError) return sendError(res, otpError, 429);

    console.log(`[OTP] Login OTP for ${email}: ${otp}`);

    await sendLoginOTPEmail(user, otp);
    return sendSuccess(res, {}, 'OTP sent to your email');
  } catch (err) {
    return sendError(res, err.message);
  }
};

// POST /api/auth/verify-login-otp
const verifyLoginOTP = async (req, res) => {
  try {
    let { email, otp } = req.body;
    if (!email || !otp) return sendError(res, 'Email and OTP are required', 400);

    email = email.trim().toLowerCase();

    const { success, error: otpError, userId } = await checkOTP('login', email, otp);
    if (!success) return sendError(res, otpError, 400);

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !user) return sendError(res, 'User not found', 404);
    if (user.is_disabled) return sendError(res, 'Account has been disabled', 403);

    const { password: _, ...safeUser } = user;
    const token = generateToken(user.id);

    const info = getClientInfo(req);
    await supabase.from('login_history').insert({
      user_id: user.id,
      ip_address: info.ip,
      user_agent: info.userAgent,
      device_info: info.device,
      browser_info: info.browser,
    });

    sendLoginNotification(user, {
      time: new Date().toLocaleString('en-IN'),
      device: info.device,
      browser: info.browser,
      ip: info.ip,
    }).catch(e => console.error('Login notification failed:', e.message));

    return sendSuccess(res, { data: { user: safeUser, token } }, 'Login successful');
  } catch (err) {
    return sendError(res, err.message);
  }
};

module.exports = {
  register, verifyEmail, resendOTP,
  login, sendLoginOTP, verifyLoginOTP,
  forgotPassword, verifyResetOTP, resetPassword, changePassword,
  getMe, updateProfile,
  getAddresses, addAddress, updateAddress, deleteAddress,
  getNotifications, markNotificationRead,
  getLoginHistory,
};
