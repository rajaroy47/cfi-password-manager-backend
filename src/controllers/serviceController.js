const Service = require('../models/Service');
const ApiError = require('../utils/apiError');

async function listServices(req, res) {
  const services = await Service.find().sort({ name: 1 });
  res.json({ services });
}

async function createService(req, res) {
  const { name, description } = req.body;
  if (!name) throw ApiError.badRequest('Service name is required');

  const existing = await Service.findOne({ name: new RegExp(`^${name.trim()}$`, 'i') });
  if (existing) return res.status(200).json({ service: existing }); // idempotent create

  const service = await Service.create({ name: name.trim(), description, createdBy: req.user._id });
  res.status(201).json({ service });
}

module.exports = { listServices, createService };
