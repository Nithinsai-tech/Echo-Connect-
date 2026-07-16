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
      .sort({ createdAt: -1 })
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
  const { name, avatar, wallpaper } = req.body;

  try {
    const updateFields = {};
    if (name) updateFields.name = name;
    if (avatar) updateFields.avatar = avatar;
    if (wallpaper !== undefined) updateFields.wallpaper = wallpaper;

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

// @desc    Delete user account and anonymize details
// @route   POST /api/users/delete-account
// @access  Private
const deleteAccount = async (req, res, next) => {
  const { password } = req.body;
  const currentUserId = req.user._id.toString();

  try {
    const user = await User.findById(currentUserId).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.authProvider === 'local') {
      if (!password) {
        return res.status(400).json({ success: false, message: 'Password is required to confirm account deletion' });
      }
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Incorrect password' });
      }
    }

    // 1. Remove friend relationships
    await User.updateMany(
      { contacts: req.user._id },
      { $pull: { contacts: req.user._id } }
    );

    await FriendRequest.deleteMany({
      $or: [
        { sender: req.user._id },
        { receiver: req.user._id }
      ]
    });

    // 2. Leave all group chats
    const ChatRoom = require('../models/ChatRoom');
    const rooms = await ChatRoom.find({ participants: req.user._id });
    for (const room of rooms) {
      if (room.type === 'group') {
        room.participants = room.participants.filter(p => p.toString() !== currentUserId);
        room.invitedMembers = room.invitedMembers.filter(m => m.user.toString() !== currentUserId);
        
        if (room.participants.length === 0) {
          await ChatRoom.findByIdAndDelete(room._id);
        } else {
          if (room.createdBy.toString() === currentUserId) {
            room.createdBy = room.participants[0];
          }
          if (room.groupAdmin && room.groupAdmin.toString() === currentUserId) {
            room.groupAdmin = room.participants[0];
          }
          await room.save();
        }
      }
    }

    // 3. Anonymize user details to "Deleted User"
    await User.findByIdAndUpdate(currentUserId, {
      $set: {
        name: 'Deleted User',
        email: `deleted_${currentUserId}@deleted.com`,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=DU`,
        contacts: [],
        refreshTokenHash: null
      },
      $unset: {
        password: 1,
        googleId: 1
      }
    });

    // Notify clients of presence change
    const io = req.app.get('io');
    if (io) {
      io.emit('presence:offline', { userId: currentUserId });
      io.emit('user:deleted', { userId: currentUserId });
    }

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  searchUsers,
  getOnlineUsers,
  updateProfile,
  deleteAccount
};
