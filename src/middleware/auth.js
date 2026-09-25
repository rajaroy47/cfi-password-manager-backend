const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/apiError');
const User = require('../models/User');

/**
 * Verifies the access token from the Authorization: Bearer header,
 * loads the current user, and attaches it to req.user. Rejects
 * deactivated accounts immediately, even if their token is still valid.
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Missing or malformed Authorization header');
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired access token');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Account is inactive or no longer exists');
  }

  req.user = user;
  next();
}

/**
 * Restricts a route to specific roles, e.g. requireRole('ADMIN').
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw ApiError.forbidden('You do not have permission to perform this action');
    }
    next();
  };
}

/**
 * Restricts a route to users holding a specific granular permission.
 * ADMIN always passes (see User.hasPermission). Enforced server-side —
 * the frontend/extension only use permissions for UI hints.
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user || !req.user.hasPermission(permission)) {
      throw ApiError.forbidden(`Missing required permission: ${permission}`);
    }
    next();
  };
}

module.exports = { authenticate, requireRole, requirePermission };