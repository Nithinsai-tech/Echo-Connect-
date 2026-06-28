import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ChatProvider } from './context/ChatContext';
import { ToastProvider } from './context/ToastContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Chat from './pages/Chat';
import AuthCallback from './pages/AuthCallback';
import ProtectedRoute from './components/ProtectedRoute';

// Import our visual style system
// legacy chat.css is replaced by modern index.css variables

function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <ToastProvider>
            <ChatProvider>
              <Routes>
                {/* Redirect root to /chat */}
                <Route path="/" element={<Navigate to="/chat" replace />} />

                {/* Private Chat Route */}
                <Route 
                  path="/chat" 
                  element={
                    <ProtectedRoute>
                      <Chat />
                    </ProtectedRoute>
                  } 
                />
                
                {/* Public Auth Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                
                {/* Redirect any other path to /chat */}
                <Route path="*" element={<Navigate to="/chat" replace />} />
              </Routes>
            </ChatProvider>
          </ToastProvider>
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
