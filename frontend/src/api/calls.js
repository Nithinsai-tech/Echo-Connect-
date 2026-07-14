import api from './api';

export const getCalls = async () => {
  const response = await api.get('/calls');
  return response.data;
};
