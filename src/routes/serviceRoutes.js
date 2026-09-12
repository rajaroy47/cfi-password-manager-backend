const express = require('express');
const ctrl = require('../controllers/serviceController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', ctrl.listServices);
router.post('/', ctrl.createService);

module.exports = router;
