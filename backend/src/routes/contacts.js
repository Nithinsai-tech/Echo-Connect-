const express = require('express');
const router = express.Router();
const {
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  declineFriendRequest
} = require('../controllers/contactController');
const { protect } = require('../middleware/auth');

// Protect all contact endpoints
router.use(protect);

router.post('/request', sendFriendRequest);
router.get('/requests', getFriendRequests);
router.post('/accept', acceptFriendRequest);
router.post('/decline', declineFriendRequest);

module.exports = router;
