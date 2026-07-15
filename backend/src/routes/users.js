const express = require('express');
const router = express.Router();
const { getAllUsers, searchUsers, getOnlineUsers, updateProfile, deleteAccount } = require('../controllers/userController');
const { protect } = require('../middleware/auth');

// Protect all user endpoints
router.use(protect);

router.get('/me', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar,
      lastSeen: req.user.lastSeen
    }
  });
});

router.get('/', getAllUsers);
router.get('/search', searchUsers);
router.get('/online', getOnlineUsers);
router.patch('/profile', updateProfile);
router.post('/delete-account', deleteAccount);

module.exports = router;
