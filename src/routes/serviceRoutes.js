const express = require('express');
const ctrl = require('../controllers/serviceController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', ctrl.listServices);
router.post('/', ctrl.createService);
// Deleting a service affects every client that uses it, so this is
// restricted to admins only (unlike create/list, which any authenticated
// employee can do).
router.delete('/:id', requireRole('ADMIN'), ctrl.deleteService);

module.exports = router;