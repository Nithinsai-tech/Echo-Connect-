const User = require('../models/User');
const { getOnlineUserIds } = require('../services/presence');

// @desc    Get all registered users (excluding current user)
// @route   GET /api/users
// @access  Private
const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select('name email avatar lastSeen')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search users by name or email
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

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
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
