import React, { createContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import { getAccessToken } from '../api';

export const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    // Only connect socket if user is logged in and authenticated
    if (!user) {
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
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      console.log('Socket.IO successfully connected to backend!');
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket.IO connection error:', error.message);
    });

    setSocket(newSocket);

    // Cleanup hook
    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
