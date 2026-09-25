const mongoose = require('mongoose');

/**
 * Encrypted password is stored as three base64 fields produced by
 * utils/crypto.js (AES-256-GCM). None of these fields are ever returned
 * by default list/detail queries — see `select: false` and the DTO
 * helpers in controllers/credentialController.js.
 */
const encryptedPasswordSchema = new mongoose.Schema(
  {
    ciphertext: { type: String, required: true, select: false },
    iv: { type: String, required: true, select: false },
    authTag: { type: String, required: true, select: false },
  },
  { _id: false }
);

const credentialSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    websiteName: { type: String, required: true, trim: true, maxlength: 150 },
    websiteUrl: { type: String, required: true, trim: true, maxlength: 500 },
    // Origin/hostname derived from websiteUrl, used for extension matching.
    hostname: { type: String, required: true, trim: true, lowercase: true, index: true },
    origin: { type: String, required: true, trim: true, lowercase: true },
    username: { type: String, required: true, trim: true, maxlength: 200 },
    // NOTE: do NOT also set `select: false` on this parent field. The
    // three nested fields below are already individually `select: false`,
    // which is enough to keep them out of default queries. If the parent
    // is *also* marked `select: false`, then any query that tries to
    // re-include just the nested fields (e.g.
    // `.select('+encryptedPassword.ciphertext +encryptedPassword.iv +encryptedPassword.authTag')`,
    // as reveal/copy/fill do below) gets silently reduced by Mongoose to
    // `{ encryptedPassword: 0 }` — the whole subdocument is still
    // excluded. That made `cred.encryptedPassword` come back `undefined`
    // for every reveal/copy/fill/autofill call (even for admins and staff
    // who DO have canRevealPasswords), so `decrypt(undefined)` threw a
    // plain Error, which is not an ApiError, so the global error handler
    // reported it as a generic 500 Internal Server Error instead of
    // returning the decrypted password. Removing `select: false` here
    // fixes that while still keeping the password hidden by default.
    encryptedPassword: { type: encryptedPasswordSchema, required: true },
    notes: { type: String, trim: true, maxlength: 2000 },
    isFavorite: { type: Boolean, default: false },
    neverSaveForSite: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastUsedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

credentialSchema.index({ client: 1, service: 1, hostname: 1 });
credentialSchema.index({ hostname: 1, isActive: 1 });

module.exports = mongoose.model('Credential', credentialSchema);