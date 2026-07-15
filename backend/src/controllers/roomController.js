const ChatRoom = require('../models/ChatRoom');
const User = require('../models/User');
const Message = require('../models/Message');
const { isValidObjectId } = require('../utils/validationHelper');

const pendingPrivateRooms = new Set();

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

      const lockKey = uniqueParticipants.sort().join('-');
      if (pendingPrivateRooms.has(lockKey)) {
        // Wait up to 1 second for other creation to complete
        for (let i = 0; i < 10; i++) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (!pendingPrivateRooms.has(lockKey)) {
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
            break;
          }
        }
      }

      pendingPrivateRooms.add(lockKey);
      try {
        // Check if a 1-to-1 room already exists between these two users
        const existingRoom = await ChatRoom.findOne({
          type: 'private',
          participants: { $all: uniqueParticipants, $size: 2 }
        })
          .populate('participants', '-password')
          .populate('lastMessage');

        if (existingRoom) {
          pendingPrivateRooms.delete(lockKey);
          return res.status(200).json({
            success: true,
            message: 'Existing chat room retrieved successfully',
            data: existingRoom
          });
        }
      } catch (err) {
        pendingPrivateRooms.delete(lockKey);
        throw err;
      }
    }

    // 3. Group chat setup
    const roomPayload = {
      type,
      participants: uniqueParticipants,
      createdBy: req.user._id,
      groupName: type === 'group' ? groupName : '',
      groupAvatar: type === 'group' ? (groupAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(groupName)}`) : '',
      status: type === 'group' ? 'pending' : 'active',
      groupAdmin: type === 'group' ? req.user._id : undefined
    };

    if (type === 'group') {
      const invitedUserIds = uniqueParticipants.filter(id => id.toString() !== currentUserId);
      roomPayload.invitedMembers = invitedUserIds.map(id => ({ user: id, status: 'pending' }));
    }

    const newRoom = await ChatRoom.create(roomPayload);
    if (type === 'private') {
      const lockKey = uniqueParticipants.sort().join('-');
      pendingPrivateRooms.delete(lockKey);
    }

    const populatedRoom = await ChatRoom.findById(newRoom._id)
      .populate('participants', '-password')
      .populate('invitedMembers.user', 'name email avatar');

    // Notify other users of group invitation in real-time
    if (type === 'group') {
      const io = req.app.get('io');
      if (io) {
        uniqueParticipants.forEach(pId => {
          if (pId !== currentUserId) {
            io.to(`user_${pId}`).emit('group:invited', { roomId: newRoom._id, room: populatedRoom });
          }
        });
      }
    }

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
      .populate('invitedMembers.user', 'name email avatar')
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

    // Deduplicate private rooms
    const uniqueRooms = [];
    const seenPrivateContacts = new Set();
    for (const room of roomsWithUnread) {
      if (room.type === 'private') {
        const otherParticipant = room.participants.find(p => p._id.toString() !== req.user._id.toString());
        if (otherParticipant) {
          const contactId = otherParticipant._id.toString();
          if (seenPrivateContacts.has(contactId)) {
            continue; // Skip duplicate room for the same contact
          }
          seenPrivateContacts.add(contactId);
        }
      }
      uniqueRooms.push(room);
    }

    res.status(200).json({
      success: true,
      count: uniqueRooms.length,
      data: uniqueRooms
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
      .populate('invitedMembers.user', 'name email avatar')
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

    // Verify creator or admin authorization
    const isAdmin = room.groupAdmin && room.groupAdmin.toString() === req.user._id.toString();
    const isCreator = room.createdBy.toString() === req.user._id.toString();
    if (!isAdmin && !isCreator) {
      return res.status(403).json({
        success: false,
        message: 'Only group admins or creators can remove participants'
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
    room.invitedMembers = room.invitedMembers.filter(m => m.user.toString() !== userId);
    await room.save();

    const updatedRoom = await ChatRoom.findById(roomId)
      .populate('participants', '-password')
      .populate('invitedMembers.user', 'name email avatar');

    // Notify participants and the removed user in real-time
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('group:update', updatedRoom);
      io.to(`user_${userId}`).emit('group:removed', { roomId });
    }

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
    // Reassign admin if admin is leaving
    if (room.groupAdmin && room.groupAdmin.toString() === callerId && room.participants.length > 0) {
      room.groupAdmin = room.participants[0];
    }

    if (room.participants.length === 0) {
      // If group is empty, delete it
      await ChatRoom.findByIdAndDelete(roomId);
      return res.status(200).json({ success: true, message: 'Left group. Group disbanded since empty.' });
    }

    // Also remove from invitedMembers
    room.invitedMembers = room.invitedMembers.filter(m => m.user.toString() !== callerId);

    await room.save();

    const updatedRoom = await ChatRoom.findById(roomId)
      .populate('participants', '-password')
      .populate('invitedMembers.user', 'name email avatar');

    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('group:update', updatedRoom);
    }

    res.status(200).json({ success: true, message: 'Successfully left the group' });
  } catch (error) {
    next(error);
  }
};

// @desc    Accept group invitation
// @route   POST /api/rooms/:roomId/accept
// @access  Private
const acceptGroupInvitation = async (req, res, next) => {
  const { roomId } = req.params;
  const currentUserId = req.user._id.toString();

  try {
    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Chat room not found' });
    }

    const invitee = room.invitedMembers.find(m => m.user.toString() === currentUserId);
    if (!invitee) {
      return res.status(400).json({ success: false, message: 'You are not invited to this group' });
    }

    invitee.status = 'accepted';

    // Check if everyone accepted
    const allAccepted = room.invitedMembers.every(m => m.status === 'accepted');
    if (allAccepted) {
      room.status = 'active';
    }

    await room.save();

    const populatedRoom = await ChatRoom.findById(roomId)
      .populate('participants', '-password')
      .populate('invitedMembers.user', 'name email avatar');

    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('group:update', populatedRoom);
      
      if (allAccepted) {
        io.to(roomId).emit('group:activated', { roomId, room: populatedRoom });
      }
    }

    res.status(200).json({
      success: true,
      message: allAccepted ? 'Group is now active!' : 'Invitation accepted',
      data: populatedRoom
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject group invitation
// @route   POST /api/rooms/:roomId/reject
// @access  Private
const rejectGroupInvitation = async (req, res, next) => {
  const { roomId } = req.params;
  const currentUserId = req.user._id.toString();

  try {
    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Chat room not found' });
    }

    const invitee = room.invitedMembers.find(m => m.user.toString() === currentUserId);
    if (!invitee) {
      return res.status(400).json({ success: false, message: 'You are not invited to this group' });
    }

    const creatorId = room.createdBy.toString();
    const rejectingUserName = req.user.name;

    await ChatRoom.findByIdAndDelete(roomId);

    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('group:cancelled', {
        roomId,
        rejectedBy: currentUserId,
        rejectedByName: rejectingUserName,
        creatorId
      });
      
      room.participants.forEach(pId => {
        io.to(`user_${pId}`).emit('group:removed', { roomId });
      });
    }

    res.status(200).json({
      success: true,
      message: 'Group invitation rejected, group disbanded.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update group details (Admin Only)
// @route   PUT /api/rooms/:roomId
// @access  Private
const updateGroupDetails = async (req, res, next) => {
  const { roomId } = req.params;
  const { groupName, groupAvatar, groupDescription } = req.body;
  const currentUserId = req.user._id.toString();

  try {
    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const isAdmin = room.groupAdmin && room.groupAdmin.toString() === currentUserId;
    const isCreator = room.createdBy.toString() === currentUserId;
    if (!isAdmin && !isCreator) {
      return res.status(403).json({ success: false, message: 'Only group admins can update details' });
    }

    if (groupName !== undefined) room.groupName = groupName;
    if (groupAvatar !== undefined) room.groupAvatar = groupAvatar;
    if (groupDescription !== undefined) room.groupDescription = groupDescription;

    await room.save();

    const populatedRoom = await ChatRoom.findById(roomId)
      .populate('participants', '-password')
      .populate('invitedMembers.user', 'name email avatar');

    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('group:update', populatedRoom);
    }

    res.status(200).json({
      success: true,
      message: 'Group updated successfully',
      data: populatedRoom
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Transfer admin ownership (Admin Only)
// @route   POST /api/rooms/:roomId/transfer-admin
// @access  Private
const transferGroupAdmin = async (req, res, next) => {
  const { roomId } = req.params;
  const { userId } = req.body;
  const currentUserId = req.user._id.toString();

  try {
    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const isAdmin = room.groupAdmin && room.groupAdmin.toString() === currentUserId;
    const isCreator = room.createdBy.toString() === currentUserId;
    if (!isAdmin && !isCreator) {
      return res.status(403).json({ success: false, message: 'Only group admins can transfer ownership' });
    }

    if (!room.participants.includes(userId)) {
      return res.status(400).json({ success: false, message: 'Target user is not a participant' });
    }

    room.groupAdmin = userId;
    await room.save();

    const populatedRoom = await ChatRoom.findById(roomId)
      .populate('participants', '-password')
      .populate('invitedMembers.user', 'name email avatar');

    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('group:update', populatedRoom);
    }

    res.status(200).json({
      success: true,
      message: 'Admin ownership transferred successfully',
      data: populatedRoom
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Invite additional members (Admin/Creator Only)
// @route   POST /api/rooms/:roomId/invite
// @access  Private
const inviteGroupMembers = async (req, res, next) => {
  const { roomId } = req.params;
  const { userIds } = req.body;
  const currentUserId = req.user._id.toString();

  try {
    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const isAdmin = room.groupAdmin && room.groupAdmin.toString() === currentUserId;
    const isCreator = room.createdBy.toString() === currentUserId;
    if (!isAdmin && !isCreator) {
      return res.status(403).json({ success: false, message: 'Only group admins can invite members' });
    }

    userIds.forEach(userId => {
      if (!room.participants.includes(userId)) {
        room.participants.push(userId);
      }
      
      const existsInInvites = room.invitedMembers.some(m => m.user.toString() === userId);
      if (!existsInInvites) {
        room.invitedMembers.push({ user: userId, status: 'pending' });
      }
    });

    await room.save();

    const populatedRoom = await ChatRoom.findById(roomId)
      .populate('participants', '-password')
      .populate('invitedMembers.user', 'name email avatar');

    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('group:update', populatedRoom);
      
      userIds.forEach(uId => {
        io.to(`user_${uId}`).emit('group:invited', { roomId, room: populatedRoom });
      });
    }

    res.status(200).json({
      success: true,
      message: 'Invitations sent successfully',
      data: populatedRoom
    });
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
  leaveGroup,
  acceptGroupInvitation,
  rejectGroupInvitation,
  updateGroupDetails,
  transferGroupAdmin,
  inviteGroupMembers
};
