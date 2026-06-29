const ChatRoom = require('../models/ChatRoom');
const User = require('../models/User');
const Message = require('../models/Message');
const { isValidObjectId } = require('../utils/validationHelper');

// @desc    Create a private DM or Group room
// @route   POST /api/rooms
// @access  Private
const createRoom = async (req, res, next) => {
  const { type, participants, groupName, groupAvatar } = req.body;
  const currentUserId = req.user._id.toString();

  try {
    // 1. Ensure caller is in participants list
    const participantSet = new Set(participants);
    participantSet.add(currentUserId);
    const uniqueParticipants = Array.from(participantSet);

    // 2. Private 1-to-1 DM creation logic
    if (type === 'private') {
      if (uniqueParticipants.length !== 2) {
        return res.status(400).json({
          success: false,
          message: 'Private conversations must have exactly 2 participants'
        });
      }

      // Check if a 1-to-1 room already exists between these two users
      const existingRoom = await ChatRoom.findOne({
        type: 'private',
        participants: { $all: uniqueParticipants, $size: 2 }
      })
        .populate('participants', '-password')
        .populate('lastMessage');

      if (existingRoom) {
        return res.status(200).json({
          success: true,
          message: 'Existing chat room retrieved successfully',
          data: existingRoom
        });
      }
    }

    // 3. Group chat setup
    const roomPayload = {
      type,
      participants: uniqueParticipants,
      createdBy: req.user._id,
      groupName: type === 'group' ? groupName : '',
      groupAvatar: type === 'group' ? (groupAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(groupName)}`) : ''
    };

    const newRoom = await ChatRoom.create(roomPayload);
    const populatedRoom = await ChatRoom.findById(newRoom._id)
      .populate('participants', '-password');

    res.status(201).json({
      success: true,
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} room created successfully`,
      data: populatedRoom
    });
  } catch (error) {
    next(error);
  }
};

// @desc    List all rooms caller is a participant of (Private & Groups)
// @route   GET /api/rooms
// @access  Private
const getUserRooms = async (req, res, next) => {
  try {
    const rooms = await ChatRoom.find({
      participants: req.user._id
    })
      .populate('participants', '-password')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'senderId',
          select: 'name email avatar'
        }
      })
      .sort({ updatedAt: -1 });

    const roomsWithUnread = await Promise.all(rooms.map(async (room) => {
      const unreadCount = await Message.countDocuments({
        roomId: room._id,
        senderId: { $ne: req.user._id },
        seenBy: { $ne: req.user._id }
      });
      const roomObj = room.toObject();
      roomObj.unreadCount = unreadCount;
      return roomObj;
    }));

    res.status(200).json({
      success: true,
      count: roomsWithUnread.length,
      data: roomsWithUnread
    });
  } catch (error) {
    next(error);
  }
};

// @desc    List group chats user belongs to
// @route   GET /api/rooms/groups
// @access  Private
const getUserGroups = async (req, res, next) => {
  try {
    const rooms = await ChatRoom.find({
      type: 'group',
      participants: req.user._id
    })
      .populate('participants', '-password')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'senderId',
          select: 'name email avatar'
        }
      })
      .sort({ updatedAt: -1 });

    const roomsWithUnread = await Promise.all(rooms.map(async (room) => {
      const unreadCount = await Message.countDocuments({
        roomId: room._id,
        senderId: { $ne: req.user._id },
        seenBy: { $ne: req.user._id }
      });
      const roomObj = room.toObject();
      roomObj.unreadCount = unreadCount;
      return roomObj;
    }));

    res.status(200).json({
      success: true,
      count: roomsWithUnread.length,
      data: roomsWithUnread
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add member to group chat (Creator Only)
// @route   POST /api/rooms/:roomId/members
// @access  Private
const addGroupMember = async (req, res, next) => {
  const { roomId } = req.params;
  const { userId } = req.body;

  if (!userId || !isValidObjectId(userId)) {
    return res.status(400).json({ success: false, message: 'Invalid or missing user ID' });
  }

  try {
    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Chat room not found' });
    }

    if (room.type !== 'group') {
      return res.status(400).json({ success: false, message: 'Members can only be added to group chats' });
    }

    // Verify creator authorization
    if (room.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the group creator can add participants'
      });
    }

    // Check if user is already a member
    if (room.participants.includes(userId)) {
      return res.status(400).json({ success: false, message: 'User is already a member of this group' });
    }

    room.participants.push(userId);
    await room.save();

    const updatedRoom = await ChatRoom.findById(roomId).populate('participants', '-password');

    res.status(200).json({
      success: true,
      message: 'Participant added successfully',
      data: updatedRoom
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove member from group chat (Creator Only)
// @route   DELETE /api/rooms/:roomId/members
// @access  Private
const removeGroupMember = async (req, res, next) => {
  const { roomId } = req.params;
  const { userId } = req.body;

  if (!userId || !isValidObjectId(userId)) {
    return res.status(400).json({ success: false, message: 'Invalid or missing user ID' });
  }

  try {
    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Chat room not found' });
    }

    if (room.type !== 'group') {
      return res.status(400).json({ success: false, message: 'Members can only be removed from group chats' });
    }

    // Verify creator authorization
    if (room.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the group creator can remove participants'
      });
    }

    // Creator cannot remove themselves from this route (they should use leaveGroup)
    if (userId === room.createdBy.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Creator cannot remove themselves. Please use leave API instead.'
      });
    }

    // Ensure user is actually in group
    if (!room.participants.includes(userId)) {
      return res.status(400).json({ success: false, message: 'User is not a member of this group' });
    }

    room.participants = room.participants.filter(id => id.toString() !== userId);
    await room.save();

    const updatedRoom = await ChatRoom.findById(roomId).populate('participants', '-password');

    res.status(200).json({
      success: true,
      message: 'Participant removed successfully',
      data: updatedRoom
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Leave group chat
// @route   POST /api/rooms/:roomId/leave
// @access  Private
const leaveGroup = async (req, res, next) => {
  const { roomId } = req.params;
  const callerId = req.user._id.toString();

  try {
    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Chat room not found' });
    }

    if (room.type !== 'group') {
      return res.status(400).json({ success: false, message: 'Leave action only applicable to group chats' });
    }

    if (!room.participants.includes(callerId)) {
      return res.status(400).json({ success: false, message: 'You are not a member of this group' });
    }

    // Remove user
    room.participants = room.participants.filter(id => id.toString() !== callerId);

    // Reassign creator if creator is leaving
    if (room.createdBy.toString() === callerId && room.participants.length > 0) {
      room.createdBy = room.participants[0];
    }

    if (room.participants.length === 0) {
      // If group is empty, delete it
      await ChatRoom.findByIdAndDelete(roomId);
      return res.status(200).json({ success: true, message: 'Left group. Group disbanded since empty.' });
    }

    await room.save();
    res.status(200).json({ success: true, message: 'Successfully left the group' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRoom,
  getUserRooms,
  getUserGroups,
  addGroupMember,
  removeGroupMember,
  leaveGroup
};
