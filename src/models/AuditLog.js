const mongoose = require('mongoose');

const ACTIONS = [
  'LOGIN',
  'LOGIN_FAILED',
  'LOGOUT',
  'TOKEN_REFRESHED',
  'CLIENT_CREATED',
  'CLIENT_UPDATED',
  'CLIENT_DELETED',
  'SERVICE_DELETED',
  'CREDENTIAL_CREATED',
  'CREDENTIAL_UPDATED',
  'CREDENTIAL_DELETED',
  'PASSWORD_REVEALED',
  'PASSWORD_COPIED',
  'CREDENTIAL_FILLED',
  'WEBSITE_OPENED',
  'EMPLOYEE_CREATED',
  'EMPLOYEE_UPDATED',
  'EMPLOYEE_DEACTIVATED',
  'EMPLOYEE_PASSWORD_RESET',
  'UNAUTHORIZED_ATTEMPT',
];

const auditLogSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, enum: ACTIONS, required: true, index: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    credential: { type: mongoose.Schema.Types.ObjectId, ref: 'Credential' },
    // meta must never contain plaintext passwords or decrypted secrets.
    meta: { type: mongoose.Schema.Types.Mixed },
    success: { type: Boolean, default: true },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
module.exports.ACTIONS = ACTIONS;
