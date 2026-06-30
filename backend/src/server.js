require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./config/db');
const initSocket = require('./socket');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // 1. Establish database connection with MongoDB Atlas / local MongoDB
    await connectDB();

    // 2. Create HTTP Server wrapper
    const server = http.createServer(app);

    // 3. Bind Socket.IO engine to the HTTP Server
    const io = new Server(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || 'https://echo-connect-8q3n.vercel.app',
        methods: ['GET', 'POST'],
        credentials: true
      }
    });
    app.set('io', io);

    // 4. Attach real-time connection listeners
    initSocket(io);

    // 5. Spin up listener
    server.listen(PORT, () => {
      console.log(`==================================================`);
      console.log(`  WhatsApp-Style Chat Server Booted successfully! `);
      console.log(`  - Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  - Port: ${PORT}                                 `);
      console.log(`  - CORS Origin: ${process.env.CORS_ORIGIN || 'https://echo-connect-8q3n.vercel.app'}`);
      console.log(`==================================================`);
    });
  } catch (error) {
    console.error('Fatal initialization error:', error.message);
    process.exit(1);
  }
};

startServer();
