const express = require('express');
const ctrl = require('../controllers/auditLogController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('ADMIN'));

router.get('/', ctrl.listAuditLogs);

module.exports = router;
