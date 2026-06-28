// In-memory mapping of userId (string) -> Set of active socketIds
const onlineUsers = new Map();

const isUserOnline = (userId) => {
  if (!userId) return false;
  return onlineUsers.has(userId.toString());
};

const getOnlineUserIds = () => {
  return Array.from(onlineUsers.keys());
};

module.exports = {
  onlineUsers,
  isUserOnline,
  getOnlineUserIds
};
