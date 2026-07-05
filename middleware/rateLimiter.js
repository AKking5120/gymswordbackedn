const rateLimit = require('express-rate-limit');

const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests. Please try again later.') => {
  return rateLimit({
    windowMs,
    max,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return req.ip || req.connection?.remoteAddress || 'unknown';
    },
  });
};

const authLimiter = createRateLimiter(15 * 60 * 1000, 20, 'Too many authentication attempts. Please try again later.');
const apiLimiter = createRateLimiter(15 * 60 * 1000, 100, 'Too many requests. Please try again later.');
const otpLimiter = createRateLimiter(60 * 60 * 1000, 5, 'Too many OTP requests. Please try again later.');

module.exports = { createRateLimiter, authLimiter, apiLimiter, otpLimiter, rateLimit };
