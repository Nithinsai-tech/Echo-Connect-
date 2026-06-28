const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateAccessToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_ACCESS_SECRET || 'super_secret_access_jwt_key_123456_change_me',
    { expiresIn: '15m' } // 15 minutes
  );
};

const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET || 'super_secret_refresh_jwt_key_987654_change_me',
    { expiresIn: '7d' } // 7 days
  );
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'super_secret_access_jwt_key_123456_change_me');
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'super_secret_refresh_jwt_key_987654_change_me');
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyAccessToken,
  verifyRefreshToken
};
