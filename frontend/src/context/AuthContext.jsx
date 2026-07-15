import React, { useState, useEffect, createContext, useRef } from 'react';
import { login as apiLogin, register as apiRegister, logout as apiLogout, refresh as apiRefresh } from '../api';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const bootstrapStarted = useRef(false);

  // Auto-refresh token on initial load if refresh token exists
  useEffect(() => {
    if (bootstrapStarted.current) return;
    bootstrapStarted.current = true;

    const bootstrapAuth = async () => {
      const storedUser = localStorage.getItem('chat_user');
      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        setLoading(false);
        return;
      }


      try {
        const response = await apiRefresh(refreshToken);

        if (response.success && response.data) {
          const userData = response.data.user || (storedUser ? JSON.parse(storedUser) : null);

          if (userData) {
            localStorage.setItem("chat_user", JSON.stringify(userData));
            setUser(userData);
          }
        }
      } catch (err) {
        console.error('Failed to restore session:', err.message);
        setUser(null);
        localStorage.removeItem('chat_user');
        localStorage.removeItem('refreshToken');
      } finally {
        setLoading(false);
      }
    };

    bootstrapAuth();
  }, []);

  // Listen for global force-logout events (e.g. from Axios interceptors)
  useEffect(() => {
    const handleForceLogout = () => {
      setUser(null);
      setError('Session expired. Please log in again.');
    };

    window.addEventListener('auth:force-logout', handleForceLogout);
    return () => {
      window.removeEventListener('auth:force-logout', handleForceLogout);
    };
  }, []);

  const register = async (name, email, password, avatar) => {
    setLoading(true);
    setError('');
    try {
      const response = await apiRegister({ name, email, password, avatar });
      if (response.success && response.data) {
        const userData = response.data.user;
        localStorage.setItem('chat_user', JSON.stringify(userData));
        setUser(userData);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Registration failed:', err.response?.data?.message || err.message);
      setError(err.response?.data?.message || 'Registration failed. Try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    setLoading(true);
    setError('');
    try {
      const response = await apiLogin(email, password);
      if (response.success && response.data) {
        const userData = response.data.user;
        localStorage.setItem('chat_user', JSON.stringify(userData));
        setUser(userData);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Login failed:', err.response?.data?.message || err.message);
      setError(err.response?.data?.message || 'Invalid email or password.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await apiLogout();
    } catch (err) {
      console.error('Logout failed:', err.message);
    } finally {
      setUser(null);
      setLoading(false);
    }
  };

  const updateUser = (updatedData) => {
    localStorage.setItem('chat_user', JSON.stringify(updatedData));
    setUser(updatedData);
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, register, login, logout, updateUser, setError }}>
      {children}
    </AuthContext.Provider>
  );
};
