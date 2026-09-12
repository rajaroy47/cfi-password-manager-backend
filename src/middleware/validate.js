const { validationResult } = require('express-validator');
const xss = require('xss');
const ApiError = require('../utils/apiError');

/**
 * Runs after express-validator check() chains; throws a 400 with field
 * details if validation failed.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ApiError.badRequest('Validation failed', errors.array().map((e) => ({ field: e.path, message: e.msg })));
  }
  next();
}

/**
 * Recursively strips potentially dangerous HTML/script content from
 * string fields in req.body, to guard against stored XSS in notes,
 * client names, etc. Numbers/booleans/ObjectIds pass through untouched.
 */
function sanitizeBody(req, res, next) {
  const clean = (value) => {
    if (typeof value === 'string') return xss(value.trim());
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v)]));
    }
    return value;
  };
  if (req.body && typeof req.body === 'object') {
    req.body = clean(req.body);
  }
  next();
}

module.exports = { validate, sanitizeBody };
