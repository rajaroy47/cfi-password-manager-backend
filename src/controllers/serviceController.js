const Service = require('../models/Service');
const Credential = require('../models/Credential');
const ApiError = require('../utils/apiError');
const { recordAudit } = require('../utils/audit');

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

async function deleteService(req, res) {
  const service = await Service.findById(req.params.id);
  if (!service) throw ApiError.notFound('Service not found');

  const activeCredentials = await Credential.countDocuments({ service: service._id, isActive: true });
  if (activeCredentials > 0) {
    throw ApiError.conflict(
      `Cannot delete a service used by ${activeCredentials} active credential(s). Reassign or remove them first.`
    );
  }

  await service.deleteOne();
  await recordAudit({ req, action: 'SERVICE_DELETED', meta: { serviceId: service._id, name: service.name } });

  res.json({ message: 'Service deleted' });
}


module.exports = { listServices, createService, deleteService };