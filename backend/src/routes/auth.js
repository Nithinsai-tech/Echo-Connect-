const express = require('express');
const router = express.Router();
const passport = require('passport');
const { register, login, refresh, logout } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');

// Auth rate limiting applied globally to these routes
router.use(authLimiter);

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.post('/refresh', refresh);
router.post('/logout', protect, logout);

// Google OAuth routes (exempt from authLimiter or place before/after router.use(authLimiter))
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: 'http://localhost:5173/login?error=google_failed' }),
  (req, res) => {
    const { accessToken, refreshToken } = req.user._tokens;
    res.redirect(`http://localhost:5173/auth/callback?token=${accessToken}&refreshToken=${refreshToken}`);
  }
);

module.exports = router;
