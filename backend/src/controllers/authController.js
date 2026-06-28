const User = require('../models/User');
const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyRefreshToken
} = require('../utils/token');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  const { name, email, password, avatar } = req.body;

  try {
    // 1. Basic validation handled by request validator, but check email duplication
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({ success: false, message: 'Email address already registered' });
    }

    // 2. Create user (pre-save hook hashes password)
    const user = new User({
      name,
      email,
      password,
      avatar
    });

    // 3. Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // 4. Hash and save refresh token
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    // 5. Respond to client
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          lastSeen: user.lastSeen
        },
        tokens: {
          accessToken,
          refreshToken
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Log in user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    // 1. Fetch user including password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // 2. Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // 3. Generate tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // 4. Hash and store refresh token
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          lastSeen: user.lastSeen
        },
        tokens: {
          accessToken,
          refreshToken
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh access token (incorporating token rotation)
// @route   POST /api/auth/refresh
// @access  Public
const refresh = async (req, res, next) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'Refresh token is required' });
  }

  try {
    // 1. Verify token signature and expiration
    const decoded = verifyRefreshToken(refreshToken);
    
    // 2. Fetch user with current token hash
    const user = await User.findById(decoded.id).select('+refreshTokenHash');
    if (!user || !user.refreshTokenHash) {
      return res.status(401).json({ success: false, message: 'Invalid session or user not found' });
    }

    // 3. Compare hashed tokens
    const incomingHash = hashToken(refreshToken);
    if (incomingHash !== user.refreshTokenHash) {
      // Security breach warning: Reuse of refresh token could mean theft!
      // Clear hash to force re-authentication across all devices
      user.refreshTokenHash = null;
      await user.save();
      return res.status(401).json({
        success: false,
        message: 'Security warning: Refresh token reuse detected. Please sign in again.'
      });
    }

    // 4. Generate new pair (Token Rotation)
    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    // 5. Update hash in DB
    user.refreshTokenHash = hashToken(newRefreshToken);
    await user.save();

    res.status(200).json({
      success: true,
      data: {
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken
        }
      }
    });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

// @desc    Log out user / Clear session
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.refreshTokenHash = null;
      await user.save();
    }

    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout
};
