import api from './api';

export const getAllUsers = async () => {
  const response = await api.get('/users');
  return response.data;
};

export const searchUsers = async (q) => {
  const response = await api.get('/users/search', { params: { q } });
  return response.data;
};

export const getOnlineUsers = async () => {
  const response = await api.get('/users/online');
  return response.data;
};

export const updateUserProfile = async ({ name, avatar, wallpaper }) => {
  const response = await api.patch('/users/profile', { name, avatar, wallpaper });
  return response.data;
};

export const sendFriendRequest = async (receiverId) => {
  const response = await api.post('/contacts/request', { receiverId });
  return response.data;
};

export const getFriendRequests = async () => {
  const response = await api.get('/contacts/requests');
  return response.data;
};

export const acceptFriendRequest = async (requestId) => {
  const response = await api.post('/contacts/accept', { requestId });
  return response.data;
};

export const declineFriendRequest = async (requestId) => {
  const response = await api.post('/contacts/decline', { requestId });
  return response.data;
};

export const deleteUserAccount = async (password) => {
  const response = await api.post('/users/delete-account', { password });
  return response.data;
};
