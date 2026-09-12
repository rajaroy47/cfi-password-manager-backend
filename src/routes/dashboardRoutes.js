const express = require('express');
const ctrl = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/stats', ctrl.getStats);

module.exports = router;
