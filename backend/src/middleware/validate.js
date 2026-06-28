const { isValidObjectId, isValidEmail } = require('../utils/validationHelper');

const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Name is required and must be a string' });
  }

  if (name.length > 50) {
    return res.status(400).json({ success: false, message: 'Name cannot exceed 50 characters' });
  }

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'A valid email is required' });
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'A valid email is required' });
  }

  if (!password || typeof password !== 'string' || password.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Password is required' });
  }

  next();
};

const validateCreateRoom = (req, res, next) => {
  const { type, participants, groupName, name } = req.body;
  const resolvedGroupName = groupName || name;

  // 1. Validate type
  if (!type || !['private', 'group'].includes(type)) {
    return res.status(400).json({ success: false, message: 'Room type must be private or group' });
  }

  // 2. Validate participants
  if (!participants || !Array.isArray(participants) || participants.length === 0) {
    return res.status(400).json({ success: false, message: 'Participants array is required and cannot be empty' });
  }

  for (const id of participants) {
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: `Invalid participant ID: ${id}` });
    }
  }

  // 3. Group specific validation
  if (type === 'group') {
    if (!resolvedGroupName || typeof resolvedGroupName !== 'string' || resolvedGroupName.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Group name must be at least 3 characters long' });
    }
    if (resolvedGroupName.length > 50) {
      return res.status(400).json({ success: false, message: 'Group name cannot exceed 50 characters' });
    }
    // Set groupName on req.body for downstream controller support
    req.body.groupName = resolvedGroupName;
  }

  next();
};


const validateMessage = (req, res, next) => {
  const { content, type, mediaUrl } = req.body;

  // 1. Validate message type
  if (type && !['text', 'image', 'video', 'file'].includes(type)) {
    return res.status(400).json({ success: false, message: 'Invalid message type' });
  }

  // 2. Reject empty messages (if no media)
  const isMedia = ['image', 'video', 'file'].includes(type) || mediaUrl;
  if (!isMedia) {
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message content cannot be empty' });
    }
  }

  // 3. Limit message length to 5000 characters
  if (content && content.length > 5000) {
    return res.status(400).json({ success: false, message: 'Message content cannot exceed 5000 characters' });
  }

  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateCreateRoom,
  validateMessage
};
