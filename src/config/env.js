/**
 * Centralized environment configuration + startup validation.
 *
 * The app refuses to start if any critical secret is missing or weak.
 * This file is the ONLY place that should read process.env directly.
 */
require('dotenv').config();

const REQUIRED_VARS = [
  'PORT',
  'MONGODB_URI',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'ENCRYPTION_KEY',
  'CORS_ORIGIN',
];

function assertStrongSecret(name, value, minLength = 32) {
  if (!value || value.trim().length < minLength) {
    throw new Error(
      `[CONFIG ERROR] ${name} must be set and at least ${minLength} characters long. ` +
        `Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    );
  }
}

function validateEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key] || process.env[key].trim() === '');
  if (missing.length > 0) {
    throw new Error(
      `[CONFIG ERROR] Missing required environment variables: ${missing.join(', ')}. ` +
        `Copy .env.example to .env and fill in real values before starting the server.`
    );
  }

  assertStrongSecret('JWT_SECRET', process.env.JWT_SECRET);
  assertStrongSecret('JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET);

  // AES-256-GCM requires a 32-byte (256-bit) key. We accept a 64-char hex string.
  const key = process.env.ENCRYPTION_KEY || '';
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      '[CONFIG ERROR] ENCRYPTION_KEY must be a 64-character hex string (32 bytes) for AES-256-GCM. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    throw new Error('[CONFIG ERROR] JWT_SECRET and JWT_REFRESH_SECRET must be different values.');
  }
}

validateEnv();

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 4000,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  encryptionKey: process.env.ENCRYPTION_KEY, // hex string, 32 bytes
  corsOrigin: (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 300,
  clipboardTimeoutSeconds: parseInt(process.env.CLIPBOARD_TIMEOUT_SECONDS, 10) || 30,
};
