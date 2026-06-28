import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { setAccessToken, api } from '../api';

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { updateUser } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(location.search);
        const token = params.get('token');
        const refreshToken = params.get('refreshToken');

        if (token) {
          // Save tokens
          setAccessToken(token);
          localStorage.setItem('refreshToken', refreshToken);

          // Retrieve user profile information using the token
          const res = await api.get('/users/me');
          if (res.data?.success && res.data?.data) {
            updateUser(res.data.data);
            navigate('/chat');
          } else {
            throw new Error('Failed to retrieve user profile');
          }
        } else {
          navigate('/login?error=auth_failed');
        }
      } catch (err) {
        console.error('Google Auth Callback Error:', err);
        navigate('/login?error=auth_failed');
      }
    };

    handleCallback();
  }, [location, navigate, updateUser]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#F5F5FA] dark:bg-[#0D0D18]">
      <div className="flex flex-col items-center gap-4">
        {/* Orange Spinner */}
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-solid border-[#FF6A00] border-t-transparent" />
        <p className="text-sm font-semibold text-[#FF6A00]">Signing you in...</p>
      </div>
    </div>
  );
}
