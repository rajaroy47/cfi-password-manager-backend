const Client = require('../models/Client');
const Credential = require('../models/Credential');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

async function getStats(req, res) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [totalClients, totalCredentials, activeEmployees, createdToday, updatedToday, recentActivity] =
    await Promise.all([
      Client.countDocuments({ status: 'ACTIVE' }),
      Credential.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: true }),
      Credential.countDocuments({ createdAt: { $gte: startOfDay } }),
      Credential.countDocuments({ updatedAt: { $gte: startOfDay }, createdAt: { $lt: startOfDay } }),
      AuditLog.find().populate('employee', 'name').populate('client', 'name').sort({ createdAt: -1 }).limit(20),
    ]);

  res.json({
    totalClients,
    totalCredentials,
    activeEmployees,
    credentialsAddedToday: createdToday,
    credentialsUpdatedToday: updatedToday,
    recentActivity,
  });
}

module.exports = { getStats };
