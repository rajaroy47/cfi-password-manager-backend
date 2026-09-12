const AuditLog = require('../models/AuditLog');

/**
 * Writes an audit log entry. NEVER pass plaintext passwords or decrypted
 * credential values into `meta` — this function does not filter them out,
 * so callers are responsible for only passing safe, non-sensitive metadata
 * (ids, names, domains, etc).
 */
async function recordAudit({ req, action, employee, client, credential, meta = {}, success = true }) {
  try {
    await AuditLog.create({
      employee: employee || (req && req.user && req.user._id) || undefined,
      action,
      client: client || undefined,
      credential: credential || undefined,
      meta,
      success,
      ipAddress: req ? req.ip : undefined,
      userAgent: req ? req.headers['user-agent'] : undefined,
    });
  } catch (err) {
    // Audit logging must never crash the request. Log to console instead.
    // eslint-disable-next-line no-console
    console.error('[AUDIT] Failed to write audit log:', err.message);
  }
}

module.exports = { recordAudit };
