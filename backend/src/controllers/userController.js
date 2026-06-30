const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const { getOnlineUserIds } = require('../services/presence');

// @desc    Get all contacts (accepted friends) of the current user
// @route   GET /api/users
// @access  Private
const getAllUsers = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user._id).populate({
      path: 'contacts',
      select: 'name email avatar lastSeen',
      options: { sort: { name: 1 } }
    });

    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      count: currentUser.contacts.length,
      data: currentUser.contacts
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search all users by name or email, returning relationship status with current user
// @route   GET /api/users/search
// @access  Private
const searchUsers = async (req, res, next) => {
  const { q } = req.query;

  try {
    if (!q) {
      return res.status(200).json({ success: true, data: [] });
    }

    const searchRegex = new RegExp(q, 'i');
    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        { name: searchRegex },
        { email: searchRegex }
      ]
    })
      .select('name email avatar lastSeen')
      .limit(15);

    const userIds = users.map(u => u._id);

    // Find any requests between current user and these matching users
    const requests = await FriendRequest.find({
      $or: [
        { sender: req.user._id, receiver: { $in: userIds } },
        { sender: { $in: userIds }, receiver: req.user._id }
      ]
    });

    const currentUser = await User.findById(req.user._id).select('contacts');
    const contactsSet = new Set((currentUser.contacts || []).map(c => c.toString()));

    const data = users.map(u => {
      const uJson = u.toJSON();
      const isContact = contactsSet.has(u._id.toString());

      if (isContact) {
        uJson.relationship = 'contact';
      } else {
        const reqBetween = requests.find(r => 
          (r.sender.toString() === req.user._id.toString() && r.receiver.toString() === u._id.toString()) ||
          (r.sender.toString() === u._id.toString() && r.receiver.toString() === req.user._id.toString())
        );

        if (reqBetween) {
          uJson.relationship = reqBetween.status; // 'pending' or 'declined'
          uJson.requestSender = reqBetween.sender.toString();
          uJson.requestId = reqBetween._id;
        } else {
          uJson.relationship = 'none';
        }
      }
      return uJson;
    });

    res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all online users
// @route   GET /api/users/online
// @access  Private
const getOnlineUsers = async (req, res, next) => {
  try {
    const onlineIds = getOnlineUserIds();
    
    // Fetch user details for those online (exclude caller themselves)
    const onlineUsersList = await User.find({
      _id: { 
        $in: onlineIds,
        $ne: req.user._id 
      }
    }).select('name email avatar lastSeen');

    res.status(200).json({
      success: true,
      count: onlineUsersList.length,
      data: onlineUsersList
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile (name, avatar)
// @route   PATCH /api/users/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  const { name, avatar } = req.body;

  try {
    const updateFields = {};
    if (name) updateFields.name = name;
    if (avatar) updateFields.avatar = avatar;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  searchUsers,
  getOnlineUsers,
  updateProfile
};
