const Client = require('../models/Client');
const Credential = require('../models/Credential');

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function credentialDTO(cred) {
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
    updatedAt: cred.updatedAt,
  };
}

async function search(req, res) {
  const raw = String(req.query.q || '').trim();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 500);

  if (!raw) {
    return res.json({ clients: [], credentials: [], totalClients: 0, totalCredentials: 0 });
  }

  const regex = new RegExp(escapeRegExp(raw), 'i');

  // One request performs both client and credential searches.
  // No password/encryptedPassword fields are selected or returned.
  const [clients, directCredentials] = await Promise.all([
    Client.find({
      $or: [
        { name: regex },
        { clientCode: regex },
        { pan: regex },
        { gstin: regex },
        { phone: regex },
        { email: regex },
      ],
    })
      .sort({ name: 1 })
      .limit(limit)
      .lean(),

    Credential.find({
      isActive: true,
      $or: [
        { websiteName: regex },
        { username: regex },
        { hostname: regex },
      ],
    })
      .populate('client', 'name clientCode status pan email phone')
      .populate('service', 'name')
      .sort({ isFavorite: -1, updatedAt: -1 })
      .limit(limit)
      .lean(),
  ]);

  let groupedCredentials = [];

  if (clients.length) {
    const clientIds = clients.map((client) => client._id);

    const clientCredentials = await Credential.find({
      client: { $in: clientIds },
      isActive: true,
    })
      .populate('service', 'name')
      .sort({ isFavorite: -1, updatedAt: -1 })
      .lean();

    const byClient = new Map();

    for (const credential of clientCredentials) {
      const key = String(credential.client);
      if (!byClient.has(key)) byClient.set(key, []);
      byClient.get(key).push(credentialDTO(credential));
    }

    groupedCredentials = clients.map((client) => ({
      clientId: client._id,
      credentials: byClient.get(String(client._id)) || [],
    }));
  }

  res.json({
    clients,
    clientCredentials: groupedCredentials,
    credentials: directCredentials.map(credentialDTO),
    totalClients: clients.length,
    totalCredentials: directCredentials.length,
  });
}

module.exports = { search };
