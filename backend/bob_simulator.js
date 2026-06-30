const io = require('socket.io-client');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const EMAIL = 'bob@example.com';
const PASSWORD = 'Password123!';
const USERNAME = 'Bob';

async function start() {
  console.log('Bob Simulator starting...');
  let token = '';
  let userId = '';

  // 1. Try to login
  try {
    const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });
    const loginData = await loginRes.json();

    if (loginData.success) {
      token = loginData.data.tokens.accessToken;
      userId = loginData.data.user._id;
      console.log('Bob logged in successfully. User ID:', userId);
    } else {
      console.log('Login failed, attempting registration...');
      // Try to register
      const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: USERNAME,
          email: EMAIL,
          password: PASSWORD,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=Bob`
        })
      });
      const regData = await regRes.json();
      if (regData.success) {
        token = regData.data.tokens.accessToken;
        userId = regData.data.user._id;
        console.log('Bob registered and logged in successfully. User ID:', userId);
      } else {
        throw new Error('Registration failed: ' + JSON.stringify(regData));
      }
    }
  } catch (err) {
    console.error('Authentication error:', err.message);
    process.exit(1);
  }

  // 2. Connect to Socket.IO
  console.log('Connecting to Socket.IO...');
  const socket = io(BACKEND_URL, {
    auth: { token }
  });

  socket.on('connect', () => {
    console.log('Bob Socket connected! ID:', socket.id);
    socket.emit('user:online', { userId });
    socket.emit('presence:online', { userId });
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });

  // Keep track of active room
  let currentRoomId = null;

  // Listen to incoming messages
  socket.on('message:receive', async (msg) => {
    console.log(`[Message from ${msg.senderId?.name || 'Alice'}]:`, msg.content);
    currentRoomId = msg.roomId;

    // Send delivered receipt
    socket.emit('message:delivered', { messageId: msg._id, roomId: msg.roomId });

    // Mark as read after 500ms
    setTimeout(() => {
      socket.emit('message:read', { roomId: msg.roomId });
    }, 500);

    // If message is not a control message and not from Bob himself
    if (msg.senderId?._id !== userId && (!msg.content || !msg.content.startsWith('{"_echoType"'))) {
      // Simulate typing and reply
      setTimeout(() => {
        console.log('Bob starts typing...');
        socket.emit('typing:start', { roomId: msg.roomId });

        setTimeout(() => {
          console.log('Bob stops typing and sends reply...');
          socket.emit('typing:stop', { roomId: msg.roomId });

          // Send message
          socket.emit('message:send', {
            roomId: msg.roomId,
            content: `Hello! I received your message: "${msg.content}"`,
            type: 'text'
          }, (res) => {
            if (res && res.success) {
              console.log('Bob reply sent successfully');
            } else {
              console.error('Failed to send Bob reply');
            }
          });
        }, 2000);
      }, 1000);
    }
  });

  // Listen to WebRTC Call events
  socket.on('call:incoming', (data) => {
    const { roomId, callerId, callerName, type, offer } = data;
    console.log(`[Incoming Call] Type: ${type}, Caller: ${callerName} (ID: ${callerId})`);

    // Auto-accept call after 1.5 seconds
    setTimeout(() => {
      console.log('Accepting call...');
      // Simulate answering the call
      const mockAnswer = {
        type: 'answer',
        sdp: offer.sdp.replace(/a=setup:actpass/g, 'a=setup:passive')
      };

      socket.emit('call:answer', {
        callerId,
        answer: mockAnswer
      });

      // Send some mock ICE candidates after 500ms
      setTimeout(() => {
        console.log('Sending mock ICE candidate...');
        socket.emit('call:candidate', {
          targetUserId: callerId,
          candidate: {
            candidate: 'candidate:842163049 1 udp 16777215 127.0.0.1 58342 typ srflx raddr 127.0.0.1 rport 58342',
            sdpMid: '0',
            sdpMLineIndex: 0
          }
        });
      }, 500);

    }, 1500);
  });

  socket.on('call:ended', (data) => {
    console.log('[Call Ended] Remote peer ended the call');
  });

  socket.on('call:rejected', (data) => {
    console.log('[Call Rejected] Remote peer rejected the call');
  });

  // Handle process termination
  process.on('SIGINT', () => {
    console.log('Disconnecting Bob...');
    socket.disconnect();
    process.exit(0);
  });
}

start();
