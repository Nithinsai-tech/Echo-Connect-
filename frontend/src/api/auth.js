import api, { setAccessToken } from './api';

export const login = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  if (response.data?.success && response.data?.data?.tokens) {
    const { accessToken, refreshToken } = response.data.data.tokens;
    setAccessToken(accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }
  return response.data;
};

export const register = async ({ name, email, password, avatar }) => {
  const response = await api.post('/auth/register', { name, email, password, avatar });
  if (response.data?.success && response.data?.data?.tokens) {
    const { accessToken, refreshToken } = response.data.data.tokens;
    setAccessToken(accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }
  return response.data;
};

export const logout = async () => {
  try {
    await api.post('/auth/logout');
  } finally {
    setAccessToken('');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('chat_user');
  }
};

export const refresh = async (refreshToken) => {
  const response = await api.post('/auth/refresh', { refreshToken });
  if (response.data?.success && response.data?.data?.tokens) {
    const { accessToken, refreshToken: newRefreshToken } = response.data.data.tokens;
    setAccessToken(accessToken);
    localStorage.setItem('refreshToken', newRefreshToken);
  }
  return response.data;
};
