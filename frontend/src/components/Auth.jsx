import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Mail, Lock, User as UserIcon, LogIn, UserPlus, AlertCircle } from 'lucide-react';

const Auth = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { login, register, error, setError } = useAuth();
  const [formValidation, setFormValidation] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormValidation('');
    setError('');

    // Basic Input Validation
    if (!email || !password) {
      setFormValidation('All fields are required.');
      return;
    }

    if (isRegister && !username) {
      setFormValidation('Username is required.');
      return;
    }

    if (password.length < 6) {
      setFormValidation('Password must be at least 6 characters.');
      return;
    }

    if (isRegister) {
      // Auto assign a premium DiceBear avatar based on username seed
      const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`;
      await register(username, email, password, avatarUrl);
    } else {
      await login(email, password);
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setUsername('');
    setEmail('');
    setPassword('');
    setFormValidation('');
    setError('');
  };
  const handleGoogleLogin = () => {
    const backendUrl = import.meta.env.VITE_API_URL 
      ? import.meta.env.VITE_API_URL.replace(/\/api$/, '') 
      : 'https://echo-connect-production.up.railway.app';
    window.location.href = `${backendUrl}/api/auth/google`;
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">antigravity.chat</div>
          <p className="auth-subtitle">
            {isRegister ? 'Create an account to start chatting' : 'Sign in to access your conversations'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {(formValidation || error) && (
            <div className="auth-error-msg">
              <AlertCircle size={18} />
              <span>{formValidation || error}</span>
            </div>
          )}

          {isRegister && (
            <div className="auth-form-group">
              <label className="auth-label">Username</label>
              <div className="auth-input-wrapper">
                <UserIcon size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="auth-input"
                  style={{ paddingLeft: '46px' }}
                />
              </div>
            </div>
          )}

          <div className="auth-form-group">
            <label className="auth-label">Email Address</label>
            <div className="auth-input-wrapper">
              <Mail size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-muted)' }} />
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
                style={{ paddingLeft: '46px' }}
              />
            </div>
          </div>

          <div className="auth-form-group">
            <label className="auth-label">Password</label>
            <div className="auth-input-wrapper">
              <Lock size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-muted)' }} />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
                style={{ paddingLeft: '46px' }}
              />
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px' }}>
            {isRegister ? (
              <>
                <UserPlus size={18} />
                <span>Register Account</span>
              </>
            ) : (
              <>
                <LogIn size={18} />
                <span>Sign In</span>
              </>
            )}
          </button>
          <div style={{ marginTop: "16px" }}>
            <button
              type="button"
              onClick={handleGoogleLogin}
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                cursor: "pointer",
                fontWeight: "600"
              }}
            >
              <img
                src="https://developers.google.com/identity/images/g-logo.png"
                alt="Google"
                width="20"
                height="20"
              />
              Continue with Google
            </button>
          </div>
        </form>

        <div className="auth-footer">
          {isRegister ? 'Already have an account?' : "Don't have an account yet?"}
          <span onClick={toggleMode} className="auth-link">
            {isRegister ? 'Sign In' : 'Register'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Auth;
