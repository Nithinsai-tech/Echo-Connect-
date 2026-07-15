import api from './api';

export const getRooms = async () => {
  const response = await api.get('/rooms');
  return response.data;
};

export const getGroups = async () => {
  const response = await api.get('/rooms/groups');
  return response.data;
};

export const createRoom = async ({ type, participants, groupName, groupAvatar }) => {
  const response = await api.post('/rooms', { type, participants, groupName, groupAvatar });
  return response.data;
};

export const createPrivateRoom = async (userId) => {
  const response = await api.post('/rooms/private', { userId });
  return response.data;
};

export const createGroupRoom = async ({ name, participantIds, avatar }) => {
  const response = await api.post('/rooms/group', { name, participantIds, avatar });
  return response.data;
};

export const addGroupMember = async (roomId, userId) => {
  const response = await api.post(`/rooms/${roomId}/members`, { userId });
  return response.data;
};

export const removeGroupMember = async (roomId, userId) => {
  const response = await api.delete(`/rooms/${roomId}/members`, { data: { userId } });
  return response.data;
};

export const leaveGroup = async (roomId) => {
  const response = await api.post(`/rooms/${roomId}/leave`);
  return response.data;
};

export const acceptGroupInvitation = async (roomId) => {
  const response = await api.post(`/rooms/${roomId}/accept`);
  return response.data;
};

export const rejectGroupInvitation = async (roomId) => {
  const response = await api.post(`/rooms/${roomId}/reject`);
  return response.data;
};

export const updateGroupDetails = async (roomId, { groupName, groupAvatar, groupDescription }) => {
  const response = await api.put(`/rooms/${roomId}`, { groupName, groupAvatar, groupDescription });
  return response.data;
};

export const transferGroupAdmin = async (roomId, userId) => {
  const response = await api.post(`/rooms/${roomId}/transfer-admin`, { userId });
  return response.data;
};

export const inviteGroupMembers = async (roomId, userIds) => {
  const response = await api.post(`/rooms/${roomId}/invite`, { userIds });
  return response.data;
};
