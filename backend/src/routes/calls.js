const express = require('express');
const router = express.Router();
const { getCallLogs } = require('../controllers/callController');
const { protect } = require('../middleware/auth');

// Protect all call history endpoints
router.use(protect);

router.route('/').get(getCallLogs);

module.exports = router;
