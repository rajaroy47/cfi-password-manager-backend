/**
 * AES-256-GCM encryption/decryption for website credential passwords.
 *
 * The master key lives ONLY in the server's environment (ENCRYPTION_KEY,
 * a 64-char hex string = 32 bytes). It is never stored in MongoDB and
 * never sent to the Chrome extension or admin dashboard.
 *
 * Each encrypted value stores its own random IV and GCM auth tag, so the
 * ciphertext is authenticated (tamper-evident) as well as confidential.
 */
const crypto = require('crypto');
const env = require('../config/env');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const KEY = Buffer.from(env.encryptionKey, 'hex'); // 32 bytes

/**
 * Encrypts plaintext and returns a self-contained payload:
 * { ciphertext, iv, authTag } all base64-encoded.
 */
function encrypt(plaintext) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('encrypt() requires a non-empty string');
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

/**
 * Decrypts a payload produced by encrypt(). Throws if the auth tag does
 * not verify (i.e. the ciphertext was tampered with or the key is wrong).
 */
function decrypt(payload) {
  if (!payload || !payload.ciphertext || !payload.iv || !payload.authTag) {
    throw new Error('decrypt() requires { ciphertext, iv, authTag }');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
