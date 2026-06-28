import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { uploadAttachment } from '../api';
import { Eye, EyeOff, Loader2, Camera, X, Mail, Lock, User } from 'lucide-react';
import AuthLeftPanel from '../components/AuthLeftPanel';
import ThemeToggle from '../components/ThemeToggle';

const Register = () => {
  const { register, user, error: authError, setError } = useAuth();
  const navigate = useNavigate();

  // Input states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Avatar upload/preview states
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Validation states
  const [fieldErrors, setFieldErrors] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [submitError, setSubmitError] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    setError('');
    if (user) {
      navigate('/chat', { replace: true });
    }
  }, [user, navigate, setError]);

  // Clean up object URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith('blob:')) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  // Clean input errors on change
  const handleInputChange = (setter, field) => (e) => {
    setter(e.target.value);
    setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    setSubmitError('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setSubmitError('Only image files are allowed for avatar');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setSubmitError('Avatar image must be smaller than 5MB');
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setSubmitError('');
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview('');
  };

  const validate = () => {
    let isValid = true;
    const errors = { name: '', email: '', password: '', confirmPassword: '' };

    if (!name.trim()) {
      errors.name = 'Name is required';
      isValid = false;
    }

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

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    setFieldErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!validate()) return;

    setUploading(true);
    let avatarUrl = '';

    try {
      if (avatarFile) {
        const uploadResponse = await uploadAttachment(avatarFile);
        if (uploadResponse.success && uploadResponse.data) {
          avatarUrl = uploadResponse.data.mediaUrl;
        } else {
          throw new Error('Avatar upload failed');
        }
      }

      const success = await register(name, email, password, avatarUrl);
      if (success) {
        navigate('/chat', { replace: true });
      } else {
        setSubmitError(authError || 'Registration failed. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setSubmitError(err.message || 'An unexpected error occurred.');
    } finally {
      setUploading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setGoogleLoading(true);
    window.location.href = 'http://localhost:5000/api/auth/google';
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

        {/* Register Glassmorphic Card */}
        <div className="auth-card-new auth-card-glass animate-fade-in" style={{ padding: '32px 40px' }}>
          
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

          <div className="w-full text-center mb-4">
            <h2 className="auth-welcome-title">Create Account ✨</h2>
            <p className="auth-welcome-subtitle">Get started with your free secure account</p>
          </div>

          {/* Premium Google Sign In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || uploading}
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
          <div className="auth-divider" style={{ margin: '16px 0' }}>
            <div className="auth-divider-line"></div>
            <span className="auth-divider-text">or fill registration details</span>
            <div className="auth-divider-line"></div>
          </div>

          {/* Form */}
          <form className="w-full" onSubmit={handleSubmit}>
            
            {/* Avatar Upload (optional, circular preview) */}
            <div className="flex flex-col items-center mb-4">
              <span className="auth-form-label mb-2">Profile Photo</span>
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-input)] border border-[var(--border)] shadow-inner transition-all hover:scale-105">
                {avatarPreview ? (
                  <>
                    <img
                      src={avatarPreview}
                      alt="Avatar Preview"
                      className="h-full w-full rounded-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600 focus:outline-none border-none cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-full hover:bg-[var(--bg-hover)] transition">
                    <Camera className="h-5 w-5 text-[var(--text-muted)]" />
                    <span className="mt-0.5 text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-wider">Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={uploading || googleLoading}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Full Name field */}
            <div className="mb-4">
              <label htmlFor="name" className="auth-form-label">Full Name</label>
              <div className="auth-input-wrapper">
                <User className="auth-input-icon h-5 w-5" />
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  className="auth-input-field"
                  placeholder="John Doe"
                  value={name}
                  onChange={handleInputChange(setName, 'name')}
                  disabled={uploading || googleLoading}
                />
              </div>
              {fieldErrors.name && (
                <p className="mt-1 text-xs text-red-500 font-medium">{fieldErrors.name}</p>
              )}
            </div>

            {/* Email Address field */}
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
                  onChange={handleInputChange(setEmail, 'email')}
                  disabled={uploading || googleLoading}
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
                  autoComplete="new-password"
                  className="auth-input-field"
                  placeholder="••••••••"
                  value={password}
                  onChange={handleInputChange(setPassword, 'password')}
                  disabled={uploading || googleLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="password-toggle-btn absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent border-none cursor-pointer"
                  disabled={uploading || googleLoading}
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-500 font-medium">{fieldErrors.password}</p>
              )}
            </div>

            {/* Confirm Password field */}
            <div className="mb-6">
              <label htmlFor="confirmPassword" className="auth-form-label">Confirm Password</label>
              <div className="auth-input-wrapper">
                <Lock className="auth-input-icon h-5 w-5" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="auth-input-field"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={handleInputChange(setConfirmPassword, 'confirmPassword')}
                  disabled={uploading || googleLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="password-toggle-btn absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent border-none cursor-pointer"
                  disabled={uploading || googleLoading}
                >
                  {showConfirmPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
              {fieldErrors.confirmPassword && (
                <p className="mt-1 text-xs text-red-500 font-medium">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={uploading || googleLoading}
              className="auth-btn-primary w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold cursor-pointer shadow-md transition-all duration-200"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span>Create Account</span>
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

          {/* Switch to Login link */}
          <div className="mt-6 text-sm text-[var(--text-secondary)] text-center">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-[#FF6A00] hover:text-[#FF8A00] transition-colors">
              Sign in
            </Link>
          </div>
        </div>

        {/* Small version, terms and privacy links */}
        <div className="mt-6 text-center text-xs text-[var(--text-muted)] space-y-2 max-w-sm">
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

export default Register;
