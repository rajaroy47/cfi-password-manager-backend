const express = require('express');
const ctrl = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');
const { authenticatedApiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
router.use(authenticate);
router.use(authenticatedApiLimiter);

router.get('/stats', ctrl.getStats);

module.exports = router;
