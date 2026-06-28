const Message = require('../models/Message');
const ChatRoom = require('../models/ChatRoom');

// @desc    Get messages for a room with cursor-based pagination (oldest to newest)
// @route   GET /api/rooms/:roomId/messages
// @access  Private
const getRoomMessages = async (req, res, next) => {
  const { roomId } = req.params;
  const cursor = req.query.cursor; // ISO date string or timestamp
  const limit = parseInt(req.query.limit, 10) || 20;
  const currentUserId = req.user._id;

  try {
    // 1. Confirm room exists and user is participant
    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Chat room not found' });
    }

    if (!room.participants.includes(currentUserId.toString())) {
      return res.status(403).json({ success: false, message: 'Access denied: not a room participant' });
    }

    // 2. Build cursor query (querying older messages than cursor)
    const query = {
      roomId,
      deletedFor: { $ne: currentUserId } // Hide messages deleted for this user
    };

    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }

    // Fetch limit + 1 messages to determine if there are more items
    const rawMessages = await Message.find(query)
      .populate('senderId', 'name email avatar')
      .sort({ createdAt: -1 })
      .limit(limit + 1);

    // 3. Process pagination cursors
    let hasMore = false;
    let nextCursor = null;

    if (rawMessages.length > limit) {
      hasMore = true;
      // Remove the limit + 1 element
      const extraMessage = rawMessages.pop();
      nextCursor = rawMessages[rawMessages.length - 1].createdAt;
    }

    // 4. Reverse to chronologically order (oldest to newest)
    const messages = rawMessages.reverse();

    res.status(200).json({
      success: true,
      data: {
        messages,
        pagination: {
          limit,
          hasMore,
          nextCursor
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all messages in room as read (seen)
// @route   POST /api/rooms/:roomId/messages/read
// @access  Private
const markMessagesAsRead = async (req, res, next) => {
  const { roomId } = req.params;
  const currentUserId = req.user._id;

  try {
    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Chat room not found' });
    }

    if (!room.participants.includes(currentUserId.toString())) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Update messages in this room sent by others that haven't been seen by current user
    await Message.updateMany(
      {
        roomId,
        senderId: { $ne: currentUserId },
        seenBy: { $ne: currentUserId }
      },
      {
        $addToSet: { seenBy: currentUserId },
        $set: { status: 'seen' }
      }
    );

    res.status(200).json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete message (Delete for me)
// @route   DELETE /api/messages/:messageId
// @access  Private
const deleteMessageForMe = async (req, res, next) => {
  const { messageId } = req.params;
  const currentUserId = req.user._id;

  try {
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Push current user ID into deletedFor array
    await Message.findByIdAndUpdate(messageId, {
      $addToSet: { deletedFor: currentUserId }
    });

    res.status(200).json({ success: true, message: 'Message deleted for you' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRoomMessages,
  markMessagesAsRead,
  deleteMessageForMe
};
