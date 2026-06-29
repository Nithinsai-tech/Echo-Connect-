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
  "/google/callback",
  (req, res, next) => {
    passport.authenticate(
      "google",
      { session: false },
      (err, user) => {
        if (err) {
          console.error("GOOGLE AUTH ERROR:", err);
          return res.status(500).json({
            success: false,
            error: err.message,
            stack: err.stack,
          });
        }

        if (!user) {
          return res.status(401).json({
            success: false,
            error: "No user returned from Google",
          });
        }

        req.user = user;
        next();
      }
    )(req, res, next);
  },
  (req, res) => {
    const { accessToken, refreshToken } = req.user._tokens;

    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.CORS_ORIGIN ||
      "https://echo-connect-8q3n.vercel.app";

    res.redirect(
      `${frontendUrl}/auth/callback?token=${accessToken}&refreshToken=${refreshToken}`
    );
  }
);

module.exports = router;
