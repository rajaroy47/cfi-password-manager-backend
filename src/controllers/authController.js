const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const ApiError = require('../utils/apiError');
const { recordAudit } = require('../utils/audit');

function signAccessToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtAccessExpiresIn,
  });
}

async function issueRefreshToken(user, req) {
  const rawToken = crypto.randomBytes(48).toString('hex');
  const tokenHash = RefreshToken.hashToken(rawToken);
  const expiresAt = new Date(Date.now() + parseExpiryToMs(env.jwtRefreshExpiresIn));

  await RefreshToken.create({
    user: user._id,
    tokenHash,
    expiresAt,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return rawToken;
}

function parseExpiryToMs(expr) {
  const match = /^(\d+)([smhd])$/.exec(expr);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * multipliers[unit];
}

async function login(req, res) {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');

  const genericError = 'Invalid email or password';

  if (!user) {
    await recordAudit({ req, action: 'LOGIN_FAILED', meta: { email }, success: false });
    throw ApiError.unauthorized(genericError);
  }
  if (!user.isActive) {
    await recordAudit({ req, action: 'LOGIN_FAILED', employee: user._id, success: false, meta: { reason: 'inactive' } });
    throw ApiError.unauthorized('This account has been deactivated. Contact your administrator.');
  }

  const valid = await user.verifyPassword(password);
  if (!valid) {
    await recordAudit({ req, action: 'LOGIN_FAILED', employee: user._id, success: false });
    throw ApiError.unauthorized(genericError);
  }

  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user, req);

  await recordAudit({ req, action: 'LOGIN', employee: user._id });

  res.json({
    accessToken,
    refreshToken,
    user: user.toSafeJSON(),
  });
}

async function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) throw ApiError.badRequest('refreshToken is required');

  const tokenHash = RefreshToken.hashToken(refreshToken);
  const stored = await RefreshToken.findOne({ tokenHash });

  if (!stored || stored.revoked || stored.expiresAt < new Date()) {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findById(stored.user);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Account is inactive or no longer exists');
  }

  // Rotate: revoke old token, issue a new one
  const newRawToken = crypto.randomBytes(48).toString('hex');
  stored.revoked = true;
  stored.replacedByHash = RefreshToken.hashToken(newRawToken);
  await stored.save();

  await RefreshToken.create({
    user: user._id,
    tokenHash: RefreshToken.hashToken(newRawToken),
    expiresAt: new Date(Date.now() + parseExpiryToMs(env.jwtRefreshExpiresIn)),
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  const accessToken = signAccessToken(user);

  await recordAudit({ req, action: 'TOKEN_REFRESHED', employee: user._id });

  res.json({ accessToken, refreshToken: newRawToken });
}

async function logout(req, res) {
  const { refreshToken } = req.body;
  if (refreshToken) {
    const tokenHash = RefreshToken.hashToken(refreshToken);
    await RefreshToken.updateOne({ tokenHash }, { revoked: true });
  }
  await recordAudit({ req, action: 'LOGOUT' });
  res.json({ message: 'Logged out' });
}

async function me(req, res) {
  res.json({ user: req.user.toSafeJSON() });
}

module.exports = { login, refresh, logout, me };
