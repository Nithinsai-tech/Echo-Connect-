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

export const updateUserProfile = async ({ name, avatar }) => {
  const response = await api.patch('/users/profile', { name, avatar });
  return response.data;
};
