import api from './api';

export const getRoomMessages = async (roomId, params = {}) => {
  const response = await api.get(`/rooms/${roomId}/messages`, { params });
  return response.data;
};

export const markMessagesAsRead = async (roomId) => {
  const response = await api.post(`/rooms/${roomId}/messages/read`);
  return response.data;
};

export const deleteMessage = async (messageId) => {
  const response = await api.delete(`/messages/${messageId}/delete-for-me`);
  return response.data;
};

export const uploadAttachment = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/uploads', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};
