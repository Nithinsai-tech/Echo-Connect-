const express = require('express');
const router = express.Router();
const { deleteMessageForMe, deleteMessageForEveryone, bulkDeleteMessages } = require('../controllers/messageController');
const { protect } = require('../middleware/auth');

router.post('/bulk-delete', protect, bulkDeleteMessages);
router.delete('/:messageId', protect, deleteMessageForMe);
router.delete('/:messageId/delete-for-me', protect, deleteMessageForMe);
router.post('/:messageId/delete-for-everyone', protect, deleteMessageForEveryone);

module.exports = router;
