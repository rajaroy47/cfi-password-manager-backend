const rateLimit = require('express-rate-limit');
const env = require('../config/env');

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests, please try again later.' } },
});

// Stricter limit for auth endpoints to slow down credential-stuffing/brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many authentication attempts, please try again later.' } },
});

// Stricter limit for password reveal (sensitive action)
const revealLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many reveal requests, please slow down.' } },
});

module.exports = { apiLimiter, authLimiter, revealLimiter };
