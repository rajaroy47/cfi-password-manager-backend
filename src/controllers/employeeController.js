const crypto = require('crypto');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const { recordAudit } = require('../utils/audit');

async function listEmployees(req, res) {
  const employees = await User.find().sort({ name: 1 });
  res.json({ employees: employees.map((e) => e.toSafeJSON()) });
}

async function getEmployee(req, res) {
  const employee = await User.findById(req.params.id);
  if (!employee) throw ApiError.notFound('Employee not found');
  res.json({ employee: employee.toSafeJSON() });
}

async function createEmployee(req, res) {
  const { name, email, password, role, permissions } = req.body;
  if (!name || !email || !password) throw ApiError.badRequest('name, email and password are required');

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) throw ApiError.conflict('An employee with this email already exists');

  const employee = new User({
    name,
    email: email.toLowerCase().trim(),
    role: role === 'ADMIN' ? 'ADMIN' : 'STAFF',
    permissions: permissions || undefined,
    mustChangePassword: true,
  });
  await employee.setPassword(password);
  await employee.save();

  await recordAudit({ req, action: 'EMPLOYEE_CREATED', meta: { email: employee.email, role: employee.role } });

  res.status(201).json({ employee: employee.toSafeJSON() });
}

async function updateEmployee(req, res) {
  const employee = await User.findById(req.params.id);
  if (!employee) throw ApiError.notFound('Employee not found');

  const { name, role, permissions, isActive } = req.body;
  if (name !== undefined) employee.name = name;
  if (role !== undefined) employee.role = role;
  if (permissions !== undefined) employee.permissions = permissions;
  if (isActive !== undefined) employee.isActive = isActive;

  await employee.save();

  await recordAudit({
    req,
    action: isActive === false ? 'EMPLOYEE_DEACTIVATED' : 'EMPLOYEE_UPDATED',
    meta: { email: employee.email },
  });

  res.json({ employee: employee.toSafeJSON() });
}

async function resetEmployeePassword(req, res) {
  const employee = await User.findById(req.params.id);
  if (!employee) throw ApiError.notFound('Employee not found');

  const tempPassword = crypto.randomBytes(9).toString('base64url'); // 12 chars, URL-safe
  await employee.setPassword(tempPassword);
  employee.mustChangePassword = true;
  await employee.save();

  await recordAudit({ req, action: 'EMPLOYEE_PASSWORD_RESET', meta: { email: employee.email } });

  // Returned once, over the authenticated admin session, so the admin can
  // relay it to the employee out-of-band. It is never logged or stored.
  res.json({ message: 'Password reset', temporaryPassword: tempPassword });
}

async function deleteEmployee(req, res) {
  const employee = await User.findById(req.params.id);
  if (!employee) throw ApiError.notFound('Employee not found');

  if (employee._id.equals(req.user._id)) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }

  employee.isActive = false;
  await employee.save();

  await recordAudit({ req, action: 'EMPLOYEE_DEACTIVATED', meta: { email: employee.email } });

  res.json({ message: 'Employee deactivated' });
}

module.exports = {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  resetEmployeePassword,
  deleteEmployee,
};
