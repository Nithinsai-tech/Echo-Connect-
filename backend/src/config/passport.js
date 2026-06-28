const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const { generateAccessToken, generateRefreshToken, hashToken } = require('../utils/token');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID);
console.log("GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET);
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'dummy_client_id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy_client_secret',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
      proxy: true
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        if (!profile.emails || profile.emails.length === 0) {
          return done(new Error('Google account has no email associated'), null);
        }

        const email = profile.emails[0].value;

        // Find user by googleId OR email
        let user = await User.findOne({
          $or: [{ googleId: profile.id }, { email: email }]
        });

        if (!user) {
          user = new User({
            name: profile.displayName,
            email: email,
            avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : '',
            googleId: profile.id,
            authProvider: 'google',
            password: undefined
          });
        } else {
          // If user exists (registered locally), link googleId
          if (!user.googleId) {
            user.googleId = profile.id;
            user.authProvider = 'google';
          }
          if (profile.photos && profile.photos[0]) {
            user.avatar = profile.photos[0].value;
          }
        }

        // Generate accessToken and refreshToken
        const localAccessToken = generateAccessToken(user._id);
        const localRefreshToken = generateRefreshToken(user._id);

        user.refreshTokenHash = hashToken(localRefreshToken);
        await user.save();

        // Attach tokens to user so route can read them
        user._tokens = {
          accessToken: localAccessToken,
          refreshToken: localRefreshToken
        };

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);
