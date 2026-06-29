const io = require('socket.io-client');

const baseUrl = 'http://127.0.0.1:5000/api';
const socketUrl = 'http://127.0.0.1:5000';

const userA = { name: 'Alice', email: 'alice@test.com', password: 'Password123' };
const userB = { name: 'Bob', email: 'bob@test.com', password: 'Password123' };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const authenticateUser = async (user) => {
  // Try to register first (ignore if duplicate)
  try {
    await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
  } catch (e) {}

  // Login to get tokens
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password })
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(`Auth failed for ${user.email}: ${data.message}`);
  }
  return data.data;
};

const runSuite = async () => {
  console.log('=== STARTING WHATSAPP BACKEND FULL INTEGRATION TEST ===');

  let aliceData, bobData;
  let deliveryReceiptReceived = false;
  try {
    aliceData = await authenticateUser(userA);
    bobData = await authenticateUser(userB);
    console.log('✓ Authentication successful for Alice and Bob.');
  } catch (err) {
    console.error('✗ Authentication failed:', err.message);
    process.exit(1);
  }

  const tokenA = aliceData.tokens.accessToken;
  const tokenB = bobData.tokens.accessToken;
  const aliceId = aliceData.user._id;
  const bobId = bobData.user._id;

  // 1. REST: Get Rooms
  console.log('\n--- 1. Testing GET Rooms REST API ---');
  try {
    const res = await fetch(`${baseUrl}/rooms`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const roomsData = await res.json();
    if (roomsData.success) {
      console.log(`✓ GET Rooms returned successfully (Count: ${roomsData.count})`);
    } else {
      console.error('✗ GET Rooms failed:', roomsData.message);
    }
  } catch (err) {
    console.error('✗ GET Rooms request error:', err.message);
  }

  // 2. REST: Create Group Room
  console.log('\n--- 2. Testing Group Room Creation REST API ---');
  let room = null;
  try {
    const res = await fetch(`${baseUrl}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        name: 'Project Room',
        type: 'group',
        participants: [bobId]
      })
    });
    const roomRes = await res.json();
    if (roomRes.success) {
      room = roomRes.data;
      console.log(`✓ Group Room created successfully. ID: ${room._id}, Name: "${room.groupName}"`);
    } else {
      console.error('✗ Group Room creation failed:', roomRes.message);
      process.exit(1);
    }
  } catch (err) {
    console.error('✗ Group Room creation error:', err.message);
    process.exit(1);
  }

  // 3. Socket: Connect & Auth
  console.log('\n--- 3. Testing Socket.IO Connect & JWT Auth ---');
  const socketA = io(socketUrl, { auth: { token: tokenA } });
  const socketB = io(socketUrl, { auth: { token: tokenB } });

  await new Promise((resolve) => {
    let connectedCount = 0;
    const checkConnected = () => {
      connectedCount++;
      if (connectedCount === 2) resolve();
    };
    socketA.on('connect', () => {
      console.log('✓ Alice Socket connected.');
      checkConnected();
    });
    socketB.on('connect', () => {
      console.log('✓ Bob Socket connected.');
      checkConnected();
    });
  });

  // Join rooms
  socketA.emit('room:join', { roomId: room._id });
  socketB.emit('room:join', { roomId: room._id });

  socketA.on('message:status_update', (status) => {
    if (status.status === 'delivered') {
      deliveryReceiptReceived = true;
      console.log(`✓ Alice received status_update showing message ${status.messageId} was DELIVERED`);
    }
  });

  await sleep(200);

  // 4. Socket: Typing Indicators
  console.log('\n--- 4. Testing Typing Indicator ---');
  let typingStartReceived = false;
  let typingStopReceived = false;

  socketB.on('typing:start', (data) => {
    if (data.roomId === room._id && data.userId === aliceId) {
      typingStartReceived = true;
      console.log(`✓ Bob received typing:start event from ${data.name}`);
    }
  });

  socketB.on('typing:stop', (data) => {
    if (data.roomId === room._id && data.userId === aliceId) {
      typingStopReceived = true;
      console.log(`✓ Bob received typing:stop event`);
    }
  });

  socketA.emit('typing:start', { roomId: room._id });
  await sleep(300);
  socketA.emit('typing:stop', { roomId: room._id });
  await sleep(300);

  if (typingStartReceived && typingStopReceived) {
    console.log('✓ Typing Indicator events verified successfully.');
  } else {
    console.error('✗ Typing Indicator event validation failed.');
  }

  // 5. Socket: Send Message & ACK
  console.log('\n--- 5. Testing Send Message & ACK ---');
  let aliceAckReceived = false;
  let bobMsgReceived = false;
  let sentMessageId = null;

  socketB.on('message:receive', (msg) => {
    if (msg.roomId === room._id && msg.senderId._id === aliceId) {
      bobMsgReceived = true;
      console.log(`✓ Bob received Alice's message: "${msg.content}"`);
    }
  });

  await new Promise((resolve) => {
    socketA.emit('message:send', {
      roomId: room._id,
      content: 'Hey Bob! Testing WhatsApp receipts.',
      type: 'text'
    }, (ack) => {
      if (ack.success) {
        aliceAckReceived = true;
        sentMessageId = ack.message._id;
        console.log(`✓ Alice received ACK for message ID: ${sentMessageId} (Status: ${ack.message.status})`);
      }
      resolve();
    });
  });

  await sleep(300);

  // 6. Socket: Real-time Delivery Receipts
  console.log('\n--- 6. Testing Real-time Delivery Receipts ---');

  // Bob sends delivered receipt
  socketB.emit('message:delivered', { messageId: sentMessageId, roomId: room._id });
  await sleep(500);

  if (aliceAckReceived && bobMsgReceived && deliveryReceiptReceived) {
    console.log('✓ Real-time messaging and delivery receipts verified.');
  } else {
    console.error('✗ Messaging/delivery receipts verification failed.');
  }

  // 7. Socket: Read Receipts
  console.log('\n--- 7. Testing Read Receipts ---');
  let readReceiptReceived = false;

  socketA.on('message:read_receipt', (receipt) => {
    if (receipt.roomId === room._id && receipt.userId === bobId) {
      readReceiptReceived = true;
      console.log(`✓ Alice received read_receipt showing Bob read messages in room ${receipt.roomId}`);
    }
  });

  // Bob opens chat
  socketB.emit('message:read', { roomId: room._id });
  await sleep(500);

  if (readReceiptReceived) {
    console.log('✓ Read receipts verified.');
  } else {
    console.error('✗ Read receipts verification failed.');
  }

  // 8. REST: Pagination
  console.log('\n--- 8. Testing Cursor-Based Pagination ---');
  try {
    const res = await fetch(`${baseUrl}/rooms/${room._id}/messages?limit=5`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const paginated = await res.json();
    if (paginated.success && paginated.data.messages.length > 0) {
      console.log(`✓ Pagination returned ${paginated.data.messages.length} messages. HasMore: ${paginated.data.pagination.hasMore}`);
    } else {
      console.error('✗ Pagination test failed:', paginated.message);
    }
  } catch (err) {
    console.error('✗ Pagination test error:', err.message);
  }

  // 9. REST: Message Deletion (Delete for me)
  console.log('\n--- 9. Testing Message Deletion (Delete for Me) ---');
  try {
    // Delete for Alice
    const delRes = await fetch(`${baseUrl}/messages/${sentMessageId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const delResult = await delRes.json();
    console.log('✓ Alice deleted message for herself:', delResult.message);

    // Verify Alice cannot see the message
    const aliceMsgsRes = await fetch(`${baseUrl}/rooms/${room._id}/messages`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const aliceMsgs = await aliceMsgsRes.json();
    const aliceFound = aliceMsgs.data.messages.some(m => m._id === sentMessageId);

    // Verify Bob STILL sees the message
    const bobMsgsRes = await fetch(`${baseUrl}/rooms/${room._id}/messages`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    const bobMsgs = await bobMsgsRes.json();
    const bobFound = bobMsgs.data.messages.some(m => m._id === sentMessageId);

    if (!aliceFound && bobFound) {
      console.log('✓ Message deletion verified: Hidden from Alice, but visible to Bob.');
    } else {
      console.error(`✗ Deletion check failed. Alice found: ${aliceFound}, Bob found: ${bobFound}`);
    }
  } catch (err) {
    console.error('✗ Deletion test error:', err.message);
  }

  // Close Sockets
  socketA.disconnect();
  socketB.disconnect();

  console.log('\n=== WHATSAPP BACKEND FULL INTEGRATION TEST COMPLETED ===');
};

runSuite();
