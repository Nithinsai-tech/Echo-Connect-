const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');

// Helper to emit real-time socket events
const emitToUser = (req, userId, event, data) => {
  const io = req.app.get('io');
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  }
};

// @desc    Send Friend Request
// @route   POST /api/contacts/request
// @access  Private
const sendFriendRequest = async (req, res, next) => {
  const { receiverId } = req.body;
  const senderId = req.user._id;

  try {
    if (!receiverId) {
      return res.status(400).json({ success: false, message: 'Receiver ID is required' });
    }

    if (senderId.toString() === receiverId.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot send a friend request to yourself' });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if already contacts
    const senderUser = await User.findById(senderId);
    if (senderUser.contacts.includes(receiverId)) {
      return res.status(400).json({ success: false, message: 'User is already in your contacts' });
    }

    // Check existing request in either direction
    let existingRequest = await FriendRequest.findOne({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId }
      ]
    });

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return res.status(400).json({ success: false, message: 'A friend request is already pending between you' });
      }
      if (existingRequest.status === 'accepted') {
        return res.status(400).json({ success: false, message: 'You are already friends' });
      }
      
      // If declined, reset request to pending with new sender/receiver
      existingRequest.sender = senderId;
      existingRequest.receiver = receiverId;
      existingRequest.status = 'pending';
      existingRequest.acceptedAt = null;
      await existingRequest.save();
    } else {
      existingRequest = await FriendRequest.create({
        sender: senderId,
        receiver: receiverId,
        status: 'pending'
      });
    }

    // Populate sender info for real-time notification
    const requestData = await FriendRequest.findById(existingRequest._id)
      .populate('sender', 'name email avatar')
      .populate('receiver', 'name email avatar');

    // Emit real-time notifications
    emitToUser(req, receiverId, 'friend_request:received', requestData);
    emitToUser(req, senderId, 'friend_request:sent', requestData);

    res.status(200).json({
      success: true,
      message: 'Friend request sent successfully',
      data: requestData
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Friend Requests (incoming and outgoing)
// @route   GET /api/contacts/requests
// @access  Private
const getFriendRequests = async (req, res, next) => {
  const userId = req.user._id;

  try {
    const incoming = await FriendRequest.find({ receiver: userId, status: 'pending' })
      .populate('sender', 'name email avatar')
      .sort({ createdAt: -1 });

    const outgoing = await FriendRequest.find({ sender: userId, status: 'pending' })
      .populate('receiver', 'name email avatar')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      incoming,
      outgoing
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Accept Friend Request
// @route   POST /api/contacts/accept
// @access  Private
const acceptFriendRequest = async (req, res, next) => {
  const { requestId } = req.body;
  const receiverId = req.user._id;

  try {
    if (!requestId) {
      return res.status(400).json({ success: false, message: 'Request ID is required' });
    }

    const request = await FriendRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Friend request not found' });
    }

    if (request.receiver.toString() !== receiverId.toString()) {
      return res.status(403).json({ success: false, message: 'You are not authorized to accept this request' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request is already processed' });
    }

    request.status = 'accepted';
    request.acceptedAt = new Date();
    await request.save();

    // Add each other to contacts
    await User.findByIdAndUpdate(request.sender, { $addToSet: { contacts: request.receiver } });
    await User.findByIdAndUpdate(request.receiver, { $addToSet: { contacts: request.sender } });

    // Populate sender and receiver for client updates
    const requestData = await FriendRequest.findById(request._id)
      .populate('sender', 'name email avatar')
      .populate('receiver', 'name email avatar');

    // Emit Socket events
    emitToUser(req, request.sender, 'friend_request:accepted', requestData);
    emitToUser(req, request.receiver, 'friend_request:accepted', requestData);

    res.status(200).json({
      success: true,
      message: 'Friend request accepted successfully',
      data: requestData
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Decline Friend Request
// @route   POST /api/contacts/decline
// @access  Private
const declineFriendRequest = async (req, res, next) => {
  const { requestId } = req.body;
  const receiverId = req.user._id;

  try {
    if (!requestId) {
      return res.status(400).json({ success: false, message: 'Request ID is required' });
    }

    const request = await FriendRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Friend request not found' });
    }

    if (request.receiver.toString() !== receiverId.toString()) {
      return res.status(403).json({ success: false, message: 'You are not authorized to decline this request' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request is already processed' });
    }

    request.status = 'declined';
    await request.save();

    const requestData = await FriendRequest.findById(request._id)
      .populate('sender', 'name email avatar')
      .populate('receiver', 'name email avatar');

    // Emit Socket updates
    emitToUser(req, request.sender, 'friend_request:declined', requestData);
    emitToUser(req, request.receiver, 'friend_request:declined', requestData);

    res.status(200).json({
      success: true,
      message: 'Friend request declined successfully',
      data: requestData
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  declineFriendRequest
};
