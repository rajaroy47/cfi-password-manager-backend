const rateLimit = require('express-rate-limit');

// Public/authentication limiter. Keep this strict because login/refresh
// endpoints are the places where brute-force protection matters most.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many authentication attempts, please try again later.' } },
});

// Authenticated application limiter.
// IMPORTANT: this middleware must run AFTER authenticate(), so req.user exists.
// The bucket is per employee instead of per office IP. This prevents 10
// employees sharing one public/LAN IP from consuming one global bucket.
const authenticatedApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user && req.user._id) {
      return `user:${req.user._id.toString()}`;
    }

    return `ip:${req.ip}`;
  },
  message: { error: { message: 'Too many requests, please try again later.' } },
});

// Password reveal/copy/fill are deliberately much stricter because they
// return plaintext secrets and are audited.
const revealLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user && req.user._id) {
      return `reveal:${req.user._id.toString()}`;
    }

    return `reveal:${req.ip}`;
  },
  message: { error: { message: 'Too many reveal requests, please slow down.' } },
});

module.exports = {
  authenticatedApiLimiter,
  authLimiter,
  revealLimiter,
};
