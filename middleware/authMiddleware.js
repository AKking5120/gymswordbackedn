const jwt = require('jsonwebtoken');
const supabase = require('../config/db');
const { getEnv } = require('../config/env');

const JWT_SECRET = getEnv('JWT_SECRET');
const JWT_REFRESH_SECRET = getEnv('JWT_REFRESH_SECRET', JWT_SECRET + '_refresh');

const generateToken = (id, expiresIn = getEnv('JWT_EXPIRES_IN', '15m')) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn });
};

const generateRefreshToken = (id) => {
  return jwt.sign({ id, type: 'refresh' }, JWT_REFRESH_SECRET, { expiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '7d') });
};

const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    if (decoded.type !== 'refresh') return null;
    return decoded;
  } catch {
    return null;
  }
};

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, wallet_coins, public_id, email_verified, is_disabled')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    if (user.is_disabled) {
      return res.status(403).json({ success: false, message: 'Account has been disabled' });
    }

    req.user = user;
    req.tokenExp = decoded.exp;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      const refreshToken = req.headers['x-refresh-token'];
      if (refreshToken) {
        const decoded = verifyRefreshToken(refreshToken);
        if (decoded) {
          const { data: user } = await supabase
            .from('users')
            .select('id, name, email, role, wallet_coins, public_id, email_verified, is_disabled')
            .eq('id', decoded.id)
            .single();
          if (user && !user.is_disabled) {
            const newToken = generateToken(user.id);
            res.setHeader('x-new-token', newToken);
            req.user = user;
            return next();
          }
        }
      }
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    return res.status(401).json({ success: false, message: 'Token expired or invalid' });
  }
};

const protectOptional = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const { data: user } = await supabase
      .from('users')
      .select('id, name, email, role, wallet_coins, public_id, email_verified, is_disabled')
      .eq('id', decoded.id)
      .single();
    if (user && !user.is_disabled) {
      req.user = user;
    }
  } catch {}
  next();
};

module.exports = { protect, protectOptional, generateToken, generateRefreshToken, verifyRefreshToken };
