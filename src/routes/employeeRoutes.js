const express = require('express');
const { body } = require('express-validator');
const ctrl = require('../controllers/employeeController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { authenticatedApiLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');

const router = express.Router();
router.use(authenticate);
router.use(authenticatedApiLimiter);
router.use(requirePermission('canManageEmployees'));

router.get('/', ctrl.listEmployees);
router.get('/:id', ctrl.getEmployee);

router.post(
  '/',
  [body('name').notEmpty(), body('email').isEmail(), body('password').isLength({ min: 10 })],
  validate,
  ctrl.createEmployee
);

router.put('/:id', ctrl.updateEmployee);
router.post('/:id/reset-password', ctrl.resetEmployeePassword);
router.delete('/:id', ctrl.deleteEmployee);

module.exports = router;
