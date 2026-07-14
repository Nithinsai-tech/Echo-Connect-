const { verifyAccessToken } = require('../utils/token');
const User = require('../models/User');
const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const { onlineUsers } = require('../services/presence');
const CallLog = require('../models/CallLog');
const mongoose = require('mongoose');

const activeCallSessions = new Map(); // key: userId, value: call session info

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

    // Send initial list of online users to the newly connected client
    socket.emit('presence:initial', {
      onlineIds: Array.from(onlineUsers.keys())
    });

    // Join rooms user is part of automatically
    ChatRoom.find({ participants: socket.user._id })
      .then((userRooms) => {
        userRooms.forEach((room) => {
          socket.join(room._id.toString());
        });
      })
      .catch((err) => {
        console.log('Socket automatic room join error:', err.message);
      });

    // A. Event: Join Room manually
    socket.on('room:join', ({ roomId }, ack) => {
      if (roomId) {
        socket.join(roomId);
        console.log(`Socket client ${socket.id} joined room ${roomId}`);
        if (typeof ack === 'function') ack({ success: true });
      } else {
        if (typeof ack === 'function') ack({ success: false, error: 'Room ID is required' });
      }
    });

    // B. Event: Leave Room manually
    socket.on('room:leave', ({ roomId }, ack) => {
      if (roomId) {
        socket.leave(roomId);
        console.log(`Socket client ${socket.id} left room ${roomId}`);
        if (typeof ack === 'function') ack({ success: true });
      } else {
        if (typeof ack === 'function') ack({ success: false, error: 'Room ID is required' });
      }
    });

    // C. Event: Send Message
    socket.on('message:send', async (data, ackCallback) => {
      const tStart = Date.now();
      const { roomId, content, type, mediaUrl } = data;
      const mongoose = require('mongoose');

      try {
        if (!roomId) {
          return socket.emit('error_message', { message: 'Room ID is required' });
        }

        // 1. Verify participant authorization
        const tAuthStart = Date.now();
        const room = await ChatRoom.findById(roomId);
        if (!room || !room.participants.map(p => p.toString()).includes(userId)) {
          return socket.emit('error_message', { message: 'Not authorized to post to this room' });
        }
        const tAuth = Date.now() - tAuthStart;

        // Ensure all online participants' sockets are joined to this room
        room.participants.forEach(pId => {
          const userSocketIds = onlineUsers.get(pId.toString());
          if (userSocketIds) {
            userSocketIds.forEach(sid => {
              const recipientSocket = io.sockets.sockets.get(sid);
              if (recipientSocket) {
                recipientSocket.join(roomId);
              }
            });
          }
        });

        // Check if other participants are online to update status to "delivered"
        const otherParticipants = room.participants.filter(p => p.toString() !== userId);
        let hasAnyOnlineRecipient = false;
        otherParticipants.forEach(pId => {
          if (onlineUsers.has(pId.toString())) {
            hasAnyOnlineRecipient = true;
          }
        });

        // 2. Generate Message ID and DB Write in Parallel with error recovery
        const messageId = new mongoose.Types.ObjectId();
        const initialStatus = hasAnyOnlineRecipient ? 'delivered' : 'sent';

        const tDbStart = Date.now();
        
        // Await the critical message creation synchronously to guarantee delivery before ACK
        await Message.create({
          _id: messageId,
          roomId,
          senderId: userId,
          content: content || '',
          type: type || 'text',
          mediaUrl: mediaUrl || '',
          status: initialStatus,
          seenBy: [userId]
        });
        const tDbWriteTotal = Date.now() - tDbStart;

        // Update the Room lastMessage pointer in background with retry logic to ensure eventual consistency
        const updateRoomLastMessage = async (attempts = 3) => {
          try {
            await ChatRoom.findByIdAndUpdate(roomId, { lastMessage: messageId });
          } catch (err) {
            if (attempts > 1) {
              console.warn(`Room update failed. Retrying... (${attempts - 1} attempts left)`);
              await new Promise(res => setTimeout(res, 500));
              await updateRoomLastMessage(attempts - 1);
            } else {
              console.error(`Critical Consistency Error: Failed to update room lastMessage after retries:`, err.message);
            }
          }
        };
        updateRoomLastMessage();

        // 3. Construct populated message in-memory (0ms database time)
        const tPopulateStart = Date.now();
        const populatedMessage = {
          _id: messageId,
          roomId,
          senderId: {
            _id: socket.user._id,
            name: socket.user.name,
            email: socket.user.email,
            avatar: socket.user.avatar || ''
          },
          content: content || '',
          type: type || 'text',
          mediaUrl: mediaUrl || '',
          status: initialStatus,
          seenBy: [userId],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        const tPopulate = Date.now() - tPopulateStart;

        // 4. Emit status update to other recipients if delivered (asynchronously in background)
        const tDeliveredStart = Date.now();
        if (hasAnyOnlineRecipient) {
          io.to(roomId).emit('message:status_update', {
            messageId,
            roomId,
            status: 'delivered'
          });
        }
        const tDelivered = Date.now() - tDeliveredStart;

        const totalServerTime = Date.now() - tStart;
        const diagnostics = {
          authTime: tAuth,
          dbWriteTime: tDbWriteTotal,
          roomUpdateTime: 0, // executed in parallel above
          populateTime: tPopulate, // 0ms (in-memory)
          deliveredStatusTime: tDelivered,
          totalServerTime
        };

        const responsePayload = {
          success: true,
          message: populatedMessage,
          diagnostics
        };

        // Execute acknowledgement callback for sender (single tick ACK)
        if (typeof ackCallback === 'function') {
          ackCallback(responsePayload);
        } else {
          socket.emit('message:ack', responsePayload);
        }

        // Relay message to the room channel (append broadcast start time)
        const relayPayload = { ...populatedMessage };
        relayPayload.broadcastStartTime = Date.now();

        socket.to(roomId).emit('message:receive', relayPayload);

      } catch (err) {
        console.error('Socket message send error:', err.message);
        socket.emit('error_message', { message: 'Failed to process and send message' });
      }
    });

    // D. Event: Message Delivered receipt from client
    socket.on('message:delivered', async ({ messageId, roomId }, ack) => {
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
        if (typeof ack === 'function') ack({ success: true });
      } catch (err) {
        console.error('Socket message:delivered error:', err.message);
        if (typeof ack === 'function') ack({ success: false, error: err.message });
      }
    });

    // E. Event: Message Read / Seen receipt
    socket.on('message:read', async ({ roomId }, ack) => {
      try {
        if (!roomId) {
          if (typeof ack === 'function') ack({ success: false, error: 'Room ID is required' });
          return;
        }

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
        if (typeof ack === 'function') ack({ success: true });
      } catch (err) {
        console.error('Socket message:read receipt error:', err.message);
        if (typeof ack === 'function') ack({ success: false, error: err.message });
      }
    });

    // F. Event: Start Typing indicator
    socket.on('typing:start', ({ roomId }, ack) => {
      if (roomId) {
        socket.to(roomId).emit('typing:start', {
          roomId,
          userId,
          name: username
        });
        if (typeof ack === 'function') ack({ success: true });
      } else {
        if (typeof ack === 'function') ack({ success: false, error: 'Room ID is required' });
      }
    });

    // G. Event: Stop Typing indicator
    socket.on('typing:stop', ({ roomId }, ack) => {
      if (roomId) {
        socket.to(roomId).emit('typing:stop', {
          roomId,
          userId
        });
        if (typeof ack === 'function') ack({ success: true });
      } else {
        if (typeof ack === 'function') ack({ success: false, error: 'Room ID is required' });
      }
    });

    // Explicit user presence signaling
    socket.on('user:online', ({ userId: clientUserId }, ack) => {
      if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, new Set());
      }
      onlineUsers.get(userId).add(socket.id);
      
      socket.broadcast.emit('presence:online', {
        userId,
        name: username
      });
      if (typeof ack === 'function') ack({ success: true });
    });

    socket.on('presence:online', ({ userId: clientUserId }, ack) => {
      if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, new Set());
      }
      onlineUsers.get(userId).add(socket.id);
      
      socket.broadcast.emit('presence:online', {
        userId,
        name: username
      });
      if (typeof ack === 'function') ack({ success: true });
    });

    // ==========================================
    // WebRTC Calling Signaling Events
    // ==========================================
    const saveCallLog = async (session, finalStatus, duration = 0) => {
      try {
        // 1. Create CallLog entry
        await CallLog.create({
          caller: session.callerId,
          receiver: session.receiverId,
          type: session.type,
          status: finalStatus,
          duration,
          roomId: session.roomId
        });

        // 2. Create Message entry in ChatRoom so it shows in preview and chat window
        const systemContent = JSON.stringify({
          _echoType: 'call',
          callStatus: finalStatus,
          callType: session.type,
          duration
        });

        // Create system message
        const messageId = new mongoose.Types.ObjectId();
        await Message.create({
          _id: messageId,
          roomId: session.roomId,
          senderId: session.callerId,
          content: systemContent,
          type: 'text',
          status: 'sent',
          seenBy: [session.callerId]
        });

        await ChatRoom.findByIdAndUpdate(session.roomId, { lastMessage: messageId });

        // Get populated sender info
        const senderInfo = await User.findById(session.callerId).select('name email avatar');

        // Notify room of the new call log message
        io.to(session.roomId.toString()).emit('message:receive', {
          _id: messageId,
          roomId: session.roomId,
          senderId: senderInfo,
          content: systemContent,
          type: 'text',
          status: 'sent',
          seenBy: [session.callerId],
          createdAt: new Date(),
          updatedAt: new Date()
        });

        // Also emit a global socket event to update call history live on both clients
        io.to(`user_${session.callerId}`).emit('call:logged', { success: true });
        io.to(`user_${session.receiverId}`).emit('call:logged', { success: true });

      } catch (err) {
        console.error('Error saving call log:', err);
      }
    };

    socket.on('call:initiate', (data) => {
      const { roomId, targetUserId, type, offer } = data;
      
      const session = {
        callerId: userId,
        receiverId: targetUserId,
        type,
        roomId,
        status: 'ringing',
        startTime: Date.now()
      };
      activeCallSessions.set(userId, session);
      activeCallSessions.set(targetUserId, session);

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
      
      const session = activeCallSessions.get(userId);
      if (session) {
        session.status = 'connected';
        session.startTime = Date.now();
      }

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
      
      const session = activeCallSessions.get(userId);
      if (session) {
        saveCallLog(session, 'rejected', 0);
        activeCallSessions.delete(session.callerId);
        activeCallSessions.delete(session.receiverId);
      }

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
      
      const session = activeCallSessions.get(userId);
      if (session) {
        if (session.status === 'ringing') {
          saveCallLog(session, 'missed', 0);
        } else if (session.status === 'connected') {
          const duration = Math.floor((Date.now() - session.startTime) / 1000);
          saveCallLog(session, 'completed', duration);
        }
        activeCallSessions.delete(session.callerId);
        activeCallSessions.delete(session.receiverId);
      }

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

      // Check if user was in an active call session
      const session = activeCallSessions.get(userId);
      if (session) {
        const targetUserId = session.callerId === userId ? session.receiverId : session.callerId;
        
        if (session.status === 'ringing') {
          saveCallLog(session, 'missed', 0);
        } else if (session.status === 'connected') {
          const duration = Math.floor((Date.now() - session.startTime) / 1000);
          saveCallLog(session, 'completed', duration);
        }
        
        activeCallSessions.delete(session.callerId);
        activeCallSessions.delete(session.receiverId);
        
        // Notify the target user
        const targetSockets = onlineUsers.get(targetUserId);
        if (targetSockets && targetSockets.size > 0) {
          targetSockets.forEach(sid => {
            io.to(sid).emit('call:ended', { senderId: userId });
          });
        }
      }

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
