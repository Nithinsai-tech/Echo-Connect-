const User = require('../models/User');
const { verifyAccessToken } = require('../utils/token');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Extract token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify Access Token (15 min expiry)
      const decoded = verifyAccessToken(token);

      // Fetch user from DB (excluding password)
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ success: false, message: 'User session not found' });
      }

      return next();
    } catch (error) {
      console.error(`JWT Auth Middleware Error: ${error.message}`);
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }
};

module.exports = { protect };
