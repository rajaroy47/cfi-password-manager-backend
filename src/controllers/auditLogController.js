const AuditLog = require('../models/AuditLog');

async function listAuditLogs(req, res) {
  const { employee, action, client, credential, from, to, page = 1, limit = 100 } = req.query;

  const query = {};
  if (employee) query.employee = employee;
  if (action) query.action = action;
  if (client) query.client = client;
  if (credential) query.credential = credential;
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to);
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(parseInt(limit, 10) || 100, 500);

  const [logs, total] = await Promise.all([
    AuditLog.find(query)
      .populate('employee', 'name email')
      .populate('client', 'name')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    AuditLog.countDocuments(query),
  ]);

  res.json({ logs, total, page: pageNum, limit: limitNum });
}

module.exports = { listAuditLogs };
