const Credential = require('../models/Credential');
const Client = require('../models/Client');
const Service = require('../models/Service');
const ApiError = require('../utils/apiError');
const { encrypt, decrypt } = require('../utils/crypto');
const { recordAudit } = require('../utils/audit');

/**
 * Public-safe representation of a credential. NEVER includes the
 * decrypted password or the raw encryptedPassword payload.
 */
function toDTO(cred) {
  return {
    id: cred._id,
    client: cred.client,
    service: cred.service,
    websiteName: cred.websiteName,
    websiteUrl: cred.websiteUrl,
    hostname: cred.hostname,
    origin: cred.origin,
    username: cred.username,
    hasPassword: true,
    notes: cred.notes,
    isFavorite: cred.isFavorite,
    isActive: cred.isActive,
    lastUsedAt: cred.lastUsedAt,
    createdBy: cred.createdBy,
    updatedBy: cred.updatedBy,
    createdAt: cred.createdAt,
    updatedAt: cred.updatedAt,
  };
}

function deriveOriginParts(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`);
  } catch (e) {
    throw ApiError.badRequest('websiteUrl is not a valid URL');
  }
  return { hostname: url.hostname.toLowerCase(), origin: url.origin.toLowerCase() };
}

async function listCredentials(req, res) {
  const { client, service, hostname, search, favorite, page = 1, limit = 100 } = req.query;
  const query = { isActive: true };
  if (client) query.client = client;
  if (service) query.service = service;
  if (hostname) query.hostname = hostname.toLowerCase();
  if (favorite === 'true') query.isFavorite = true;
  if (search) {
    // A search term can match either the credential itself (website,
    // username, hostname) OR the client it belongs to (name/code) — an
    // employee searching "Sharma Textiles" should land on every login
    // saved for that client, not just credentials whose website/username
    // happens to contain that text.
    const matchingClients = await Client.find({
      $or: [{ name: { $regex: search, $options: 'i' } }, { clientCode: { $regex: search, $options: 'i' } }],
    })
      .select('_id')
      .limit(500);
    const clientIds = matchingClients.map((c) => c._id);

    query.$or = [
      { websiteName: { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } },
      { hostname: { $regex: search, $options: 'i' } },
      ...(clientIds.length ? [{ client: { $in: clientIds } }] : []),
    ];
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(parseInt(limit, 10) || 100, 300);

  const [creds, total] = await Promise.all([
    Credential.find(query)
      .populate('client', 'name clientCode status')
      .populate('service', 'name')
      .sort({ updatedAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Credential.countDocuments(query),
  ]);

  res.json({ credentials: creds.map(toDTO), total, page: pageNum, limit: limitNum });
}

/**
 * Used by the Chrome extension when visiting a page: returns candidate
 * credentials for the current origin/hostname WITHOUT decrypted passwords.
 * The extension must call /reveal or /fill separately (still no plaintext
 * leaves the server outside an explicit, audited action).
 */
async function matchCredentials(req, res) {
  const { hostname } = req.query;
  if (!hostname) throw ApiError.badRequest('hostname query parameter is required');

  const normalized = hostname.toLowerCase().replace(/^www\./, '');

  const creds = await Credential.find({
    isActive: true,
    $or: [
      { hostname: normalized },
      { hostname: `www.${normalized}` },
    ],
  })
    .populate('client', 'name status')
    .populate('service', 'name')
    .sort({ isFavorite: -1, lastUsedAt: -1 });

  res.json({ credentials: creds.map(toDTO) });
}

async function getCredential(req, res) {
  const cred = await Credential.findById(req.params.id).populate('client', 'name').populate('service', 'name');
  if (!cred) throw ApiError.notFound('Credential not found');
  res.json({ credential: toDTO(cred) });
}

async function createCredential(req, res) {
  const { client, service, websiteName, websiteUrl, username, password, notes } = req.body;

  if (!client || !service || !websiteName || !websiteUrl || !username || !password) {
    throw ApiError.badRequest('client, service, websiteName, websiteUrl, username and password are all required');
  }

  const [clientDoc, serviceDoc] = await Promise.all([Client.findById(client), Service.findById(service)]);
  if (!clientDoc) throw ApiError.badRequest('Referenced client does not exist');
  if (!serviceDoc) throw ApiError.badRequest('Referenced service does not exist');

  const { hostname, origin } = deriveOriginParts(websiteUrl);

  // Warn callers about likely duplicates (same client + hostname) — the
  // frontend/extension should show an "update existing?" prompt using
  // GET /api/credentials?client=..&hostname=.. before calling create.
  const encryptedPassword = encrypt(password);

  const cred = await Credential.create({
    client,
    service,
    websiteName,
    websiteUrl,
    hostname,
    origin,
    username,
    encryptedPassword,
    notes,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  await recordAudit({
    req,
    action: 'CREDENTIAL_CREATED',
    client,
    credential: cred._id,
    meta: { websiteName, hostname, username },
  });

  res.status(201).json({ credential: toDTO(cred) });
}

async function updateCredential(req, res) {
  const cred = await Credential.findById(req.params.id);
  if (!cred) throw ApiError.notFound('Credential not found');

  const { websiteName, websiteUrl, username, password, notes, isFavorite, isActive } = req.body;

  if (websiteUrl) {
    const { hostname, origin } = deriveOriginParts(websiteUrl);
    cred.websiteUrl = websiteUrl;
    cred.hostname = hostname;
    cred.origin = origin;
  }
  if (websiteName !== undefined) cred.websiteName = websiteName;
  if (username !== undefined) cred.username = username;
  if (notes !== undefined) cred.notes = notes;
  if (isFavorite !== undefined) cred.isFavorite = isFavorite;
  if (isActive !== undefined) cred.isActive = isActive;
  if (password) cred.encryptedPassword = encrypt(password);

  cred.updatedBy = req.user._id;
  await cred.save();

  await recordAudit({
    req,
    action: 'CREDENTIAL_UPDATED',
    client: cred.client,
    credential: cred._id,
    meta: { websiteName: cred.websiteName, passwordChanged: !!password },
  });

  res.json({ credential: toDTO(cred) });
}

async function deleteCredential(req, res) {
  const cred = await Credential.findById(req.params.id);
  if (!cred) throw ApiError.notFound('Credential not found');

  // Soft delete (deactivate) to preserve audit-log referential integrity.
  cred.isActive = false;
  cred.updatedBy = req.user._id;
  await cred.save();

  await recordAudit({ req, action: 'CREDENTIAL_DELETED', client: cred.client, credential: cred._id });

  res.json({ message: 'Credential deactivated' });
}

/**
 * Returns the decrypted password. This is the ONLY endpoint that ever
 * emits plaintext, requires canRevealPasswords, and is always audited.
 */
async function revealCredential(req, res) {
  if (!req.user.hasPermission('canRevealPasswords')) {
    await recordAudit({
      req,
      action: 'UNAUTHORIZED_ATTEMPT',
      credential: req.params.id,
      meta: { attempted: 'reveal' },
      success: false,
    });
    throw ApiError.forbidden('You do not have permission to reveal passwords');
  }

  const cred = await Credential.findById(req.params.id).select('+encryptedPassword.ciphertext +encryptedPassword.iv +encryptedPassword.authTag');
  if (!cred) throw ApiError.notFound('Credential not found');

  const password = decrypt(cred.encryptedPassword);

  cred.lastUsedAt = new Date();
  await cred.save();

  await recordAudit({ req, action: 'PASSWORD_REVEALED', client: cred.client, credential: cred._id });

  res.json({ password });
}

/**
 * Same decryption path as reveal, but semantically represents "copy to
 * clipboard" so the audit trail and client UX can differ (clipboard
 * auto-clear countdown, etc). Requires the same permission.
 */
async function copyCredential(req, res) {
  if (!req.user.hasPermission('canRevealPasswords')) {
    throw ApiError.forbidden('You do not have permission to copy passwords');
  }
  const cred = await Credential.findById(req.params.id).select('+encryptedPassword.ciphertext +encryptedPassword.iv +encryptedPassword.authTag');
  if (!cred) throw ApiError.notFound('Credential not found');

  const password = decrypt(cred.encryptedPassword);
  cred.lastUsedAt = new Date();
  await cred.save();

  await recordAudit({ req, action: 'PASSWORD_COPIED', client: cred.client, credential: cred._id });

  res.json({ password, clipboardTimeoutSeconds: require('../config/env').clipboardTimeoutSeconds });
}

/**
 * Used when the extension fills a form. Returns username + password so
 * the content script can populate the fields, and records an audit entry.
 * Requires canRevealPasswords since it also exposes plaintext.
 */
async function fillCredential(req, res) {
  if (!req.user.hasPermission('canRevealPasswords')) {
    throw ApiError.forbidden('You do not have permission to autofill passwords');
  }
  const cred = await Credential.findById(req.params.id).select('+encryptedPassword.ciphertext +encryptedPassword.iv +encryptedPassword.authTag');
  if (!cred) throw ApiError.notFound('Credential not found');

  const password = decrypt(cred.encryptedPassword);
  cred.lastUsedAt = new Date();
  await cred.save();

  await recordAudit({
    req,
    action: 'CREDENTIAL_FILLED',
    client: cred.client,
    credential: cred._id,
    meta: { hostname: cred.hostname },
  });

  res.json({ username: cred.username, password });
}

module.exports = {
  listCredentials,
  matchCredentials,
  getCredential,
  createCredential,
  updateCredential,
  deleteCredential,
  revealCredential,
  copyCredential,
  fillCredential,
  deriveOriginParts,
};
