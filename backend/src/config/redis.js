const { createClient } = require('redis');

let pubClient = null;
let subClient = null;
let isRedisConnected = false;

const initRedis = async () => {
  if (process.env.USE_REDIS !== 'true') {
    console.log('Redis scaling is disabled (USE_REDIS=false). Falling back to in-memory adapter.');
    return { pubClient: null, subClient: null, isRedisConnected: false };
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    pubClient = createClient({ url: redisUrl });
    subClient = pubClient.duplicate();

    pubClient.on('error', (err) => console.error('Redis Pub Client Error:', err));
    subClient.on('error', (err) => console.error('Redis Sub Client Error:', err));

    await Promise.all([
      pubClient.connect(),
      subClient.connect()
    ]);

    console.log('Redis connected successfully for Socket.IO horizontal scaling!');
    isRedisConnected = true;

    return { pubClient, subClient, isRedisConnected: true };
  } catch (error) {
    console.error('Failed to connect to Redis. Falling back to in-memory adapter.', error.message);
    isRedisConnected = false;
    pubClient = null;
    subClient = null;
    return { pubClient: null, subClient: null, isRedisConnected: false };
  }
};

const getRedisClients = () => {
  return { pubClient, subClient, isRedisConnected };
};

module.exports = {
  initRedis,
  getRedisClients
};
