const { verifyAccessToken } = require('../utils/token');
const User = require('../models/User');
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const { onlineUsers } = require('../services/presence');

const initSocket = (io) => {
  // 1. Socket.IO Handshake Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error('Authentication failed: Token missing'));
      }

      // Verify access token
      const decoded = verifyAccessToken(token);

      // Fetch user
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return next(new Error('Authentication failed: User not found'));
      }

      // Attach user to socket
      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket Authentication Error:', error.message);
      next(new Error('Authentication failed: Invalid token'));
    }
  });

  // 2. Main Connection Event
  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    const username = socket.user.name;

    console.log(`Socket client connected: ${username} (Socket ID: ${socket.id})`);

    // Track active connection
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Join personal room for targeted DMs/notifications
    socket.join(`user_${userId}`);

    // If it's the user's first connection (e.g. first tab), broadcast online status
    if (onlineUsers.get(userId).size === 1) {
      socket.broadcast.emit('presence:online', {
        userId,
        name: username
      });
    }

    // Join rooms user is part of automatically
    try {
      const userRooms = await ChatRoom.find({ participants: socket.user._id });
      userRooms.forEach((room) => {
        socket.join(room._id.toString());
      });
    } catch (err) {
      console.error('Socket automatic room join error:', err.message);
    }

    // A. Event: Join Room manually
    socket.on('room:join', ({ roomId }) => {
      if (roomId) {
        socket.join(roomId);
        console.log(`Socket client ${socket.id} joined room ${roomId}`);
      }
    });

    // B. Event: Leave Room manually
    socket.on('room:leave', ({ roomId }) => {
      if (roomId) {
        socket.leave(roomId);
        console.log(`Socket client ${socket.id} left room ${roomId}`);
      }
    });

    // C. Event: Send Message
    socket.on('message:send', async (data, ackCallback) => {
      const { roomId, content, type, mediaUrl } = data;

      try {
        if (!roomId) {
          return socket.emit('error_message', { message: 'Room ID is required' });
        }

        // Verify participant authorization
        const room = await ChatRoom.findById(roomId);
        if (!room || !room.participants.includes(userId)) {
          return socket.emit('error_message', { message: 'Not authorized to post to this room' });
        }

        // Save message in MongoDB (Default status: sent)
        const message = await Message.create({
          roomId,
          senderId: userId,
          content: content || '',
          type: type || 'text',
          mediaUrl: mediaUrl || '',
          status: 'sent',
          seenBy: [userId]
        });

        // Update lastMessage pointer in Room
        await ChatRoom.findByIdAndUpdate(roomId, { lastMessage: message._id });

        // Populate sender info for the relay
        const populatedMessage = await Message.findById(message._id)
          .populate('senderId', 'name email avatar');

        // Execute acknowledgement callback for sender (single tick ACK)
        if (typeof ackCallback === 'function') {
          ackCallback({ success: true, message: populatedMessage });
        } else {
          socket.emit('message:ack', { success: true, message: populatedMessage });
        }

        // Relay message to the room channel
        socket.to(roomId).emit('message:receive', populatedMessage);

        // Check if other participants are online to update status to "delivered"
        const otherParticipants = room.participants.filter(p => p.toString() !== userId);
        let hasAnyOnlineRecipient = false;
        
        otherParticipants.forEach(pId => {
          if (onlineUsers.has(pId.toString())) {
            hasAnyOnlineRecipient = true;
          }
        });

        // If at least one recipient is online, mark message as delivered
        if (hasAnyOnlineRecipient) {
          message.status = 'delivered';
          await message.save();
          io.to(roomId).emit('message:status_update', {
            messageId: message._id,
            roomId,
            status: 'delivered'
          });
        }
      } catch (err) {
        console.error('Socket message send error:', err.message);
        socket.emit('error_message', { message: 'Failed to process and send message' });
      }
    });

    // D. Event: Message Delivered receipt from client
    socket.on('message:delivered', async ({ messageId, roomId }) => {
      try {
        const message = await Message.findById(messageId);
        if (message && message.status === 'sent') {
          message.status = 'delivered';
          await message.save();

          // Broadcast status update
          io.to(roomId).emit('message:status_update', {
            messageId,
            roomId,
            status: 'delivered'
          });
        }
      } catch (err) {
        console.error('Socket message:delivered error:', err.message);
      }
    });

    // E. Event: Message Read / Seen receipt
    socket.on('message:read', async ({ roomId }) => {
      try {
        if (!roomId) return;

        // Update all unread messages in the room sent by others
        await Message.updateMany(
          {
            roomId,
            senderId: { $ne: userId },
            status: { $ne: 'seen' }
          },
          {
            $addToSet: { seenBy: userId },
            $set: { status: 'seen' }
          }
        );

        // Broadcast read receipt to room
        io.to(roomId).emit('message:read_receipt', {
          roomId,
          userId,
          status: 'seen'
        });
      } catch (err) {
        console.error('Socket message:read receipt error:', err.message);
      }
    });

    // F. Event: Start Typing indicator
    socket.on('typing:start', ({ roomId }) => {
      if (roomId) {
        socket.to(roomId).emit('typing:start', {
          roomId,
          userId,
          name: username
        });
      }
    });

    // G. Event: Stop Typing indicator
    socket.on('typing:stop', ({ roomId }) => {
      if (roomId) {
        socket.to(roomId).emit('typing:stop', {
          roomId,
          userId
        });
      }
    });

    // ==========================================
    // WebRTC Calling Signaling Events
    // ==========================================
    socket.on('call:initiate', (data) => {
      const { roomId, targetUserId, type, offer } = data;
      const targetSockets = onlineUsers.get(targetUserId);
      if (targetSockets && targetSockets.size > 0) {
        targetSockets.forEach(sid => {
          io.to(sid).emit('call:incoming', {
            roomId,
            callerId: userId,
            callerName: socket.user.name,
            callerAvatar: socket.user.avatar,
            type,
            offer
          });
        });
      }
    });

    socket.on('call:answer', (data) => {
      const { callerId, answer } = data;
      const callerSockets = onlineUsers.get(callerId);
      if (callerSockets && callerSockets.size > 0) {
        callerSockets.forEach(sid => {
          io.to(sid).emit('call:answered', {
            answer,
            responderId: userId
          });
        });
      }
    });

    socket.on('call:reject', (data) => {
      const { callerId } = data;
      const callerSockets = onlineUsers.get(callerId);
      if (callerSockets && callerSockets.size > 0) {
        callerSockets.forEach(sid => {
          io.to(sid).emit('call:rejected', {
            responderId: userId
          });
        });
      }
    });

    socket.on('call:candidate', (data) => {
      const { targetUserId, candidate } = data;
      const targetSockets = onlineUsers.get(targetUserId);
      if (targetSockets && targetSockets.size > 0) {
        targetSockets.forEach(sid => {
          io.to(sid).emit('call:candidate', {
            candidate,
            senderId: userId
          });
        });
      }
    });

    socket.on('call:end', (data) => {
      const { targetUserId } = data;
      const targetSockets = onlineUsers.get(targetUserId);
      if (targetSockets && targetSockets.size > 0) {
        targetSockets.forEach(sid => {
          io.to(sid).emit('call:ended', {
            senderId: userId
          });
        });
      }
    });

    // H. Event: Disconnect
    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id}`);

      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);

        // If no more active socket sessions exist, set offline
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);

          const disconnectTime = new Date();
          try {
            await User.findByIdAndUpdate(userId, { lastSeen: disconnectTime });
            
            // Broadcast offline notification
            io.emit('presence:offline', {
              userId,
              lastSeen: disconnectTime
            });
          } catch (err) {
            console.error('Presence status save error on disconnect:', err.message);
          }
        }
      }
    });
  });
};

module.exports = initSocket;
