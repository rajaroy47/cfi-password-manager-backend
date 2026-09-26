const express = require('express');
const ctrl = require('../controllers/searchController');
const { authenticate } = require('../middleware/auth');
const { authenticatedApiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.use(authenticate);
router.use(authenticatedApiLimiter);

router.get('/', ctrl.search);

module.exports = router;
