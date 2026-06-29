const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const passport = require('passport');
const errorHandler = require('./middleware/error');
const { generalLimiter } = require('./middleware/rateLimiter');

// Initialize Passport config
require('./config/passport');

// Route imports
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const messageRoutes = require('./routes/messages');
const messageSpecificRoutes = require('./routes/messageSpecific');
const userRoutes = require('./routes/users');
const uploadRoutes = require('./routes/uploads');

const app = express();

// 1. Core Security Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'https://echo-connect-8q3n.vercel.app',
    credentials: true
  })
);

// 2. Request Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2.5. Session & Passport initialization
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'echoconnect-session-secret-key',
    resave: false,
    saveUninitialized: false
  })
);
app.use(passport.initialize());
app.use(passport.session());

// 3. Global General Rate Limiter (Protects REST API namespace)
app.use('/api', generalLimiter);

// 4. REST API Routing Map
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/rooms/:roomId/messages', messageRoutes); // Nested message histories
app.use('/api/messages', messageSpecificRoutes); // Individual message operations (delete)
app.use('/api/users', userRoutes);
app.use('/api/uploads', uploadRoutes);

// Base Health Check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'WhatsApp-style chat backend is running smoothly' });
});

// 5. Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
