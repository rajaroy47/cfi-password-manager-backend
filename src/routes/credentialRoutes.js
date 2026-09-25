const express = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/credentialController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { revealLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
router.use(authenticate);

router.get('/match', ctrl.matchCredentials); // used by the extension for autofill matching
router.get('/', ctrl.listCredentials);
router.get('/:id', ctrl.getCredential);

router.post(
  '/',
  requirePermission('canCreateCredentials'),
  [
    body('client').notEmpty(),
    body('service').notEmpty(),
    body('websiteName').notEmpty(),
    body('websiteUrl').notEmpty(),
    body('username').notEmpty(),
    body('password').notEmpty(),
  ],
  validate,
  ctrl.createCredential
);

router.put('/:id', requirePermission('canEditCredentials'), ctrl.updateCredential);
router.delete('/:id', requirePermission('canDeleteCredentials'), ctrl.deleteCredential);
router.post('/:id/reactivate', requirePermission('canDeleteCredentials'), ctrl.reactivateCredential);

router.post('/:id/reveal', revealLimiter, ctrl.revealCredential);
router.post('/:id/copy', revealLimiter, ctrl.copyCredential);
router.post('/:id/fill', revealLimiter, ctrl.fillCredential);

module.exports = router;