const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

import axios from 'axios';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor to inject JWT token in header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('chat_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor to handle global authorization failures
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('Unauthorized! Logging out user.');
      localStorage.removeItem('chat_token');
      localStorage.removeItem('chat_user');
      // Redirect to login if window context exists
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
