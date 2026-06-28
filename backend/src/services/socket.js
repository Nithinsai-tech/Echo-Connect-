const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Room = require('../models/Room');
const Message = require('../models/Message');
const { getRedisClients } = require('../config/redis');

// Map of userId -> array of active socketIds (to handle multiple open tabs/connections per user)
const userSockets = new Map();

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Enable Socket.IO Redis Adapter for horizontal scaling if Redis is connected
  const { pubClient, subClient, isRedisConnected } = getRedisClients();
  if (isRedisConnected && pubClient && subClient) {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('Socket.IO attached to Redis Pub/Sub adapter for scaling!');
  } else {
    console.log('Socket.IO using default local In-Memory adapter.');
  }

  // Socket.IO Handshake Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication failed: No token provided'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_123456_change_me_in_production');

      // Fetch User
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return next(new Error('Authentication failed: User not found'));
      }

      // Attach user to socket session
      socket.user = user;
      next();
    } catch (err) {
      console.error('Socket authentication handshake error:', err.message);
      next(new Error('Authentication failed: Invalid credentials'));
    }
  });

  // Connection Handler
  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    console.log(`User connected: ${socket.user.username} (Socket ID: ${socket.id})`);

    // Track active connection
    if (!userSockets.has(userId)) {
      userSockets.set(userId, []);
    }
    userSockets.get(userId).push(socket.id);

    // Join personal user room to enable private target operations
    socket.join(`user_${userId}`);

    // Update user status to Online in database
    try {
      await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });
      // Broadcast online status to everyone
      io.emit('presence:update', {
        userId,
        isOnline: true,
        lastSeen: new Date()
      });
    } catch (err) {
      console.error('Error updating presence on connect:', err.message);
    }

    // Event: Room Join
    socket.on('room:join', (data) => {
      const { roomId } = data;
      if (roomId) {
        socket.join(roomId);
        console.log(`Socket ${socket.id} joined room ${roomId}`);
      }
    });

    // Event: Room Leave
    socket.on('room:leave', (data) => {
      const { roomId } = data;
      if (roomId) {
        socket.leave(roomId);
        console.log(`Socket ${socket.id} left room ${roomId}`);
      }
    });

    // Event: Send Message
    socket.on('message:send', async (data) => {
      const { roomId, content, fileUrl, fileType, fileName } = data;

      try {
        if (!roomId) return;

        // Verify room and participation
        const room = await Room.findById(roomId);
        if (!room || !room.participants.includes(userId)) {
          return socket.emit('error', { message: 'Not authorized to send messages to this room' });
        }

        // Store Message persistently
        const message = await Message.create({
          sender: userId,
          room: roomId,
          content: content || '',
          fileUrl: fileUrl || '',
          fileType: fileType || '',
          fileName: fileName || '',
          readBy: [userId] // Sender automatically reads their own message
        });

        // Update Room's lastMessage pointer
        await Room.findByIdAndUpdate(roomId, { lastMessage: message._id });

        // Populate sender info before relaying
        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'username email avatar isOnline');

        // Relay message to everyone in the room
        io.to(roomId).emit('message:receive', populatedMessage);
      } catch (err) {
        console.error('Error sending message:', err.message);
        socket.emit('error', { message: 'Failed to process and send message' });
      }
    });

    // Event: Message Read (Read Receipt)
    socket.on('message:read', async (data) => {
      const { messageId, roomId } = data;

      try {
        if (!messageId || !roomId) return;

        // Add user to readBy array if not already present
        const updatedMessage = await Message.findOneAndUpdate(
          { _id: messageId, readBy: { $ne: userId } },
          { $addToSet: { readBy: userId } },
          { new: true }
        );

        if (updatedMessage) {
          // Broadcast read receipt to room
          io.to(roomId).emit('message:read_receipt', {
            messageId,
            userId,
            roomId
          });
        }
      } catch (err) {
        console.error('Error updating read receipt:', err.message);
      }
    });

    // Event: Start Typing
    socket.on('typing:start', (data) => {
      const { roomId } = data;
      if (roomId) {
        // Broadcast typing notification to other members in the room
        socket.to(roomId).emit('typing:start', {
          roomId,
          userId,
          username: socket.user.username
        });
      }
    });

    // Event: Stop Typing
    socket.on('typing:stop', (data) => {
      const { roomId } = data;
      if (roomId) {
        // Broadcast typing termination
        socket.to(roomId).emit('typing:stop', {
          roomId,
          userId
        });
      }
    });

    // ==========================================
    // WebRTC Signaling Events
    // ==========================================
    socket.on('call:initiate', (data) => {
      const { roomId, targetUserId, type, offer } = data;
      const targetSockets = userSockets.get(targetUserId);
      if (targetSockets && targetSockets.length > 0) {
        targetSockets.forEach(sid => {
          io.to(sid).emit('call:incoming', {
            roomId,
            callerId: userId,
            callerName: socket.user.username,
            callerAvatar: socket.user.avatar,
            type,
            offer
          });
        });
      }
    });

    socket.on('call:answer', (data) => {
      const { callerId, answer } = data;
      const callerSockets = userSockets.get(callerId);
      if (callerSockets && callerSockets.length > 0) {
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
      const callerSockets = userSockets.get(callerId);
      if (callerSockets && callerSockets.length > 0) {
        callerSockets.forEach(sid => {
          io.to(sid).emit('call:rejected', {
            responderId: userId
          });
        });
      }
    });

    socket.on('call:candidate', (data) => {
      const { targetUserId, candidate } = data;
      const targetSockets = userSockets.get(targetUserId);
      if (targetSockets && targetSockets.length > 0) {
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
      const targetSockets = userSockets.get(targetUserId);
      if (targetSockets && targetSockets.length > 0) {
        targetSockets.forEach(sid => {
          io.to(sid).emit('call:ended', {
            senderId: userId
          });
        });
      }
    });

    // Event: Disconnect
    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id}`);

      // Remove socket ID from tracking list
      if (userSockets.has(userId)) {
        const activeSockets = userSockets.get(userId).filter(sid => sid !== socket.id);
        
        if (activeSockets.length > 0) {
          // User still has other active connections (e.g. multi-tabs)
          userSockets.set(userId, activeSockets);
        } else {
          // Completely offline
          userSockets.delete(userId);

          try {
            const logoutTime = new Date();
            await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: logoutTime });
            
            // Broadcast offline notification
            io.emit('presence:update', {
              userId,
              isOnline: false,
              lastSeen: logoutTime
            });
            console.log(`User completely offline: ${socket.user.username}`);
          } catch (err) {
            console.error('Error updating presence on disconnect:', err.message);
          }
        }
      }
    });
  });

  return io;
};

module.exports = { initSocket };
