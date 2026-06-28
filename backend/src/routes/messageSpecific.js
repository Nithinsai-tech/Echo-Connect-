const express = require('express');
const router = express.Router();
const { deleteMessageForMe } = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

router.delete('/:messageId', protect, deleteMessageForMe);
router.delete('/:messageId/delete-for-me', protect, deleteMessageForMe);

module.exports = router;
