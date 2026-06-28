import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { Eye, EyeOff, Loader2, Mail, Lock, Sparkles } from 'lucide-react';
import AuthLeftPanel from '../components/AuthLeftPanel';
import ThemeToggle from '../components/ThemeToggle';

const Login = () => {
  const { login, user, error: authError, loading, setError } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Input states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Loading states
  const [googleLoading, setGoogleLoading] = useState(false);

  // Validation states
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [submitError, setSubmitError] = useState('');

  // Load remembered email
  useEffect(() => {
    setError('');
    const savedEmail = localStorage.getItem('echo_connect_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, [setError]);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/chat', { replace: true });
    }
  }, [user, navigate]);

  // Handle URL errors (e.g. from Google auth redirect failure)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('error') === 'auth_failed') {
      setSubmitError('Authentication via Google failed. Please try again.');
      addToast('Authentication via Google failed. Please try again.', 'google_failed');
    }
  }, [location, addToast]);

  // Clean error messages on change
  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setFieldErrors((prev) => ({ ...prev, email: '' }));
    setSubmitError('');
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    setFieldErrors((prev) => ({ ...prev, password: '' }));
    setSubmitError('');
  };

  const validate = () => {
    let isValid = true;
    const errors = { email: '', password: '' };

    if (!email.trim()) {
      errors.email = 'Email is required';
      isValid = false;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.email = 'Please enter a valid email address';
        isValid = false;
      }
    }

    if (!password) {
      errors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    setFieldErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!validate()) return;

    const success = await login(email, password);
    if (success) {
      if (rememberMe) {
        localStorage.setItem('echo_connect_remembered_email', email);
      } else {
        localStorage.removeItem('echo_connect_remembered_email');
      }
      navigate('/chat', { replace: true });
    } else {
      setSubmitError('Invalid email or password. Please verify and try again.');
    }
  };

  const handleGoogleSignIn = () => {
    setGoogleLoading(true);
    const backendUrl = import.meta.env.VITE_API_URL 
      ? import.meta.env.VITE_API_URL.replace(/\/api$/, '') 
      : 'http://localhost:5000';
    window.location.href = `${backendUrl}/api/auth/google`;
  };

  return (
    <div className="auth-split-container">
      {/* Left Side Branding & Checklist */}
      <AuthLeftPanel />

      {/* Right Side Form Panel */}
      <div className="auth-right-panel">
        
        {/* Floating Theme Toggle (Top Right) */}
        <div className="absolute top-6 right-6 flex items-center gap-2 z-10">
          <span className="text-xs text-[var(--text-muted)] font-semibold">Theme</span>
          <div className="bg-[var(--bg-panel)] p-1 rounded-xl border border-[var(--border)] shadow-sm">
            <ThemeToggle />
          </div>
        </div>

        {/* Login Glassmorphic Card */}
        <div className="auth-card-new auth-card-glass animate-fade-in">
          
          {/* Logo & Headline */}
          <div className="auth-logo-circle shadow-lg shadow-orange-500/20">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" fill="white"/>
            </svg>
          </div>

          <h1 className="auth-brand-title">
            <span className="auth-brand-echo">Echo</span>
            <span className="auth-brand-connect">Connect</span>
          </h1>
          <p className="auth-tagline">Stay connected, instantly.</p>

          <div className="w-full text-center mb-5">
            <h2 className="auth-welcome-title">Welcome back 👋</h2>
            <p className="auth-welcome-subtitle">Sign in to continue to your account</p>
          </div>

          {/* Premium Google Sign In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="google-btn w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl text-sm font-semibold border-none cursor-pointer transition-all duration-200"
            style={{
              background: '#FFFFFF',
              color: '#1F2937',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(0, 0, 0, 0.08)'
            }}
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-[#2563EB]" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            <span>{googleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
          </button>

          {/* Divider */}
          <div className="auth-divider">
            <div className="auth-divider-line"></div>
            <span className="auth-divider-text">or sign in with email</span>
            <div className="auth-divider-line"></div>
          </div>

          {/* Form */}
          <form className="w-full" onSubmit={handleSubmit}>
            
            {/* Email field */}
            <div className="mb-4">
              <label htmlFor="email" className="auth-form-label">Email Address</label>
              <div className="auth-input-wrapper">
                <Mail className="auth-input-icon h-5 w-5" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className="auth-input-field"
                  placeholder="name@example.com"
                  value={email}
                  onChange={handleEmailChange}
                  disabled={loading || googleLoading}
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-500 font-medium">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password field */}
            <div className="mb-4">
              <label htmlFor="password" className="auth-form-label">Password</label>
              <div className="auth-input-wrapper">
                <Lock className="auth-input-icon h-5 w-5" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="auth-input-field"
                  placeholder="••••••••"
                  value={password}
                  onChange={handlePasswordChange}
                  disabled={loading || googleLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle-btn absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent border-none cursor-pointer"
                  disabled={loading || googleLoading}
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-500 font-medium">{fieldErrors.password}</p>
              )}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between mb-6">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading || googleLoading}
                  className="rounded border-[var(--border)] bg-[var(--bg-input)] text-[#FF6A00] focus:ring-[#FF6A00] h-4 w-4 cursor-pointer"
                />
                <span className="text-xs text-[var(--text-secondary)] font-medium">Remember me</span>
              </label>
              <Link to="#" onClick={(e) => { e.preventDefault(); alert("Password reset is under maintenance. Please use local login or Google Sign In!"); }} className="text-xs font-semibold text-[#2563EB] hover:text-[#3B82F6] transition-colors">
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="auth-btn-primary w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold cursor-pointer shadow-md transition-all duration-200"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <span className="ml-1">→</span>
                </>
              )}
            </button>
          </form>

          {/* Alert error panel */}
          {(submitError || authError) && (
            <div className="mt-4 w-full rounded-xl bg-red-500/10 p-3.5 border border-red-500/20 text-left">
              <p className="text-xs font-medium text-red-500 leading-normal">{submitError || authError}</p>
            </div>
          )}

          {/* Switch to Register link */}
          <div className="mt-6 text-sm text-[var(--text-secondary)] text-center">
            Don't have an account?{' '}
            <Link to="/register" className="font-bold text-[#FF6A00] hover:text-[#FF8A00] transition-colors">
              Sign up
            </Link>
          </div>
        </div>

        {/* Small version, terms and privacy links */}
        <div className="mt-8 text-center text-xs text-[var(--text-muted)] space-y-2 max-w-sm">
          <p className="font-semibold">Version 1.0.0</p>
          <div className="flex justify-center gap-3">
            <a href="#" onClick={(e) => { e.preventDefault(); alert("Privacy Policy: Echo Connect encrypts and secures all chat sessions locally."); }} className="hover:underline hover:text-[var(--text-primary)]">Privacy Policy</a>
            <span>•</span>
            <a href="#" onClick={(e) => { e.preventDefault(); alert("Terms of Service: Play nice, chat friendly, stay connected."); }} className="hover:underline hover:text-[var(--text-primary)]">Terms of Service</a>
          </div>
          <p className="text-[10px] mt-1">© 2026 Echo Connect. All rights reserved.</p>
        </div>

      </div>
    </div>
  );
};

export default Login;
