const express = require('express');
const router = express.Router({ mergeParams: true }); // Captures roomId parameter from parent router
const { getRoomMessages, markMessagesAsRead } = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

// Protect all message routes
router.use(protect);

router.get('/', getRoomMessages);
router.post('/read', markMessagesAsRead);

module.exports = router;
