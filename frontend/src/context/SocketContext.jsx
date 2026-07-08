import React, { createContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import { getAccessToken, refresh } from '../api';

export const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://echo-connect-production.up.railway.app';

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    // Only connect socket if user is logged in and authenticated
    if (!user?._id) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const token = getAccessToken();
    if (!token) {
      console.warn('Socket connection deferred: access token not available in memory');
      return;
    }
    
    // Initialize Socket.IO connection
    const newSocket = io(SOCKET_URL, {
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 20000
    });

    newSocket.on('connect', () => {
      console.log('Socket.IO successfully connected to backend!');
    });

    // Update token dynamically on reconnection attempts
    newSocket.on('reconnect_attempt', () => {
      const currentToken = getAccessToken();
      if (currentToken) {
        newSocket.auth.token = currentToken;
      }
    });

    newSocket.on('connect_error', async (error) => {
      console.error('Socket.IO connection error:', error.message);
      
      // If auth failed, attempt a refresh
      if (error.message && (error.message.includes('Authentication') || error.message.includes('token'))) {
        console.log('Socket authentication failed. Attempting to refresh token...');
        try {
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            const response = await refresh(refreshToken);
            if (response.success && response.data?.tokens) {
              const newAccessToken = response.data.tokens.accessToken;
              newSocket.auth.token = newAccessToken;
              newSocket.connect();
            }
          }
        } catch (refreshErr) {
          console.error('Socket token refresh failed:', refreshErr);
        }
      }
    });

    setSocket(newSocket);

    // Cleanup hook
    return () => {
      newSocket.disconnect();
    };
  }, [user?._id]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
