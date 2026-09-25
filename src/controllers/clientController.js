const Client = require('../models/Client');
const Credential = require('../models/Credential');
const ApiError = require('../utils/apiError');
const { recordAudit } = require('../utils/audit');

// Escapes regex metacharacters in user-typed search text so a query like
// "R.K." or "(Raja)" is treated as literal text instead of being
// interpreted as a regular expression (and can't throw / behave oddly).
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function listClients(req, res) {
  const { search, status, page = 1, limit = 50 } = req.query;
  const query = {};
  if (status) query.status = status;
  if (search) {
    // Match by name, client code, PAN, GSTIN, phone, OR email — a
    // case-insensitive partial match, so typing part of a client's name
    // ("raja") or their PAN/phone/email finds them just the same. This
    // uses regex rather than the $text index below so it can match
    // *anywhere* in the field (not just whole indexed words) and so
    // phone/email are searchable without needing a text-index migration.
    const regex = new RegExp(escapeRegExp(search), 'i');
    query.$or = [
      { name: regex },
      { clientCode: regex },
      { pan: regex },
      { gstin: regex },
      { phone: regex },
      { email: regex },
    ];
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(parseInt(limit, 10) || 50, 200);

  const [clients, total] = await Promise.all([
    Client.find(query)
      .sort({ name: 1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Client.countDocuments(query),
  ]);

  res.json({ clients, total, page: pageNum, limit: limitNum });
}

async function getClient(req, res) {
  const client = await Client.findById(req.params.id);
  if (!client) throw ApiError.notFound('Client not found');

  // Fetch the client's saved logins in the same call so the "client
  // detail" screen (client info up top, all their website credentials
  // below) only ever needs one round trip.
  const credentials = await Credential.find({ client: client._id, isActive: true })
    .populate('service', 'name')
    .sort({ updatedAt: -1 });

  res.json({
    client,
    credentialCount: credentials.length,
    credentials: credentials.map((cred) => ({
      id: cred._id,
      service: cred.service,
      websiteName: cred.websiteName,
      websiteUrl: cred.websiteUrl,
      hostname: cred.hostname,
      username: cred.username,
      notes: cred.notes,
      isFavorite: cred.isFavorite,
      isActive: cred.isActive,
      lastUsedAt: cred.lastUsedAt,
      updatedAt: cred.updatedAt,
    })),
  });
}

async function createClient(req, res) {
  const { name, clientCode, pan, gstin, phone, email, address, notes } = req.body;
  if (!name) throw ApiError.badRequest('Client name is required');

  const client = await Client.create({
    name,
    clientCode,
    pan,
    gstin,
    phone,
    email,
    address,
    notes,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  await recordAudit({ req, action: 'CLIENT_CREATED', client: client._id, meta: { name: client.name } });

  res.status(201).json({ client });
}

async function updateClient(req, res) {
  const client = await Client.findById(req.params.id);
  if (!client) throw ApiError.notFound('Client not found');

  const fields = ['name', 'clientCode', 'pan', 'gstin', 'phone', 'email', 'address', 'notes', 'status'];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) client[f] = req.body[f];
  });
  client.updatedBy = req.user._id;
  await client.save();

  await recordAudit({ req, action: 'CLIENT_UPDATED', client: client._id, meta: { name: client.name } });

  res.json({ client });
}

async function deleteClient(req, res) {
  const client = await Client.findById(req.params.id);
  if (!client) throw ApiError.notFound('Client not found');

  const activeCredentials = await Credential.countDocuments({ client: client._id, isActive: true });
  if (activeCredentials > 0) {
    throw ApiError.conflict(
      `Cannot delete a client with ${activeCredentials} active credential(s). Deactivate or reassign them first.`
    );
  }

  await client.deleteOne();
  await recordAudit({ req, action: 'CLIENT_DELETED', client: client._id, meta: { name: client.name } });

  res.json({ message: 'Client deleted' });
}

module.exports = { listClients, getClient, createClient, updateClient, deleteClient };