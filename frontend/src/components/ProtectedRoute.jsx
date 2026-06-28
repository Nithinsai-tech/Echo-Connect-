import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#FF6A00] border-t-transparent"></div>
        <p className="mt-4 text-sm font-medium text-[#FF6A00]">Loading session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
