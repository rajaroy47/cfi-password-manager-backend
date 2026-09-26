const express = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/clientController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { authenticatedApiLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');

const router = express.Router();
router.use(authenticate);
router.use(authenticatedApiLimiter);

router.get('/', ctrl.listClients);
router.get('/:id', ctrl.getClient);

router.post(
  '/',
  requirePermission('canManageClients'),
  [body('name').notEmpty().withMessage('Client name is required')],
  validate,
  ctrl.createClient
);

router.put('/:id', requirePermission('canManageClients'), ctrl.updateClient);
router.delete('/:id', requirePermission('canManageClients'), ctrl.deleteClient);

module.exports = router;
