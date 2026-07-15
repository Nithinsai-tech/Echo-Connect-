import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useChat } from '../hooks/useChat';
import { getInitials } from '../utils/getInitials';
import { 
  ArrowLeft, 
  Camera, 
  Check, 
  Loader2, 
  LogOut, 
  User, 
  Bell, 
  Shield, 
  Moon, 
  Sun, 
  Info,
  Sliders,
  Palette,
  Type,
  Image,
  Eye,
  ShieldAlert
} from 'lucide-react';
import { updateUserProfile } from '../api';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';

const ProfileDrawer = ({ isOpen, onClose }) => {
  const { user, logout, updateUser } = useAuth();
  const { isDark } = useTheme();
  const { 
    uploadAttachmentFile,
    users,
    readReceipts,
    typingIndicators,
    blockedUsers,
    accentColor,
    chatBubbleColor,
    chatIncomingBubbleColor,
    chatWallpaper,
    chatTextSize,
    highContrast,
    toggleReadReceipts,
    toggleTypingIndicators,
    toggleBlockUser,
    updateAccentColor,
    updateChatBubbleColor,
    updateChatIncomingBubbleColor,
    updateChatWallpaper,
    updateChatTextSize,
    toggleHighContrast,
    deleteAccountPermanently
  } = useChat();

  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [bio, setBio] = useState(localStorage.getItem(`bio_${user?._id}`) || 'Stay connected, instantly.');
  const [about, setAbout] = useState(localStorage.getItem(`about_${user?._id}`) || 'Available');
  const [loading, setLoading] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingBio, setSavingBio] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Delete account states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Notification Preferences
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('pref_sound') !== 'false';
  });
  const [desktopEnabled, setDesktopEnabled] = useState(() => {
    return Notification.permission === 'granted';
  });

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAvatar(user.avatar || '');
    }
  }, [user]);

  if (!isOpen) return null;

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload an image file.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const uploadRes = await uploadAttachmentFile(file);
      if (uploadRes && uploadRes.mediaUrl) {
        const profileRes = await updateUserProfile({ avatar: uploadRes.mediaUrl });
        if (profileRes.success) {
          setAvatar(uploadRes.mediaUrl);
          updateUser(profileRes.data);
          setSuccessMsg('Profile picture updated successfully!');
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to update avatar. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleNameSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Name cannot be empty.');
      return;
    }

    setSavingName(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const profileRes = await updateUserProfile({ name: name.trim() });
      if (profileRes.success) {
        updateUser(profileRes.data);
        setSuccessMsg('Name updated successfully!');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to update name. Try again.');
    } finally {
      setSavingName(false);
    }
  };

  const saveBioAndAbout = (e) => {
    e.preventDefault();
    setSavingBio(true);
    setErrorMsg('');
    setSuccessMsg('');
    setTimeout(() => {
      localStorage.setItem(`bio_${user?._id}`, bio);
      localStorage.setItem(`about_${user?._id}`, about);
      setSuccessMsg('Status & Bio updated!');
      setSavingBio(false);
    }, 1000);
  };

  const toggleSound = () => {
    const val = !soundEnabled;
    setSoundEnabled(val);
    localStorage.setItem('pref_sound', val.toString());
  };

  const requestDesktopNotifications = () => {
    if (!('Notification' in window)) return;
    Notification.requestPermission().then(permission => {
      setDesktopEnabled(permission === 'granted');
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#11131C] text-white transition-all duration-300 animate-in slide-in-from-left">
      
      {/* Header */}
      <header className="flex h-20 shrink-0 items-center bg-[#1A1C28] border-b border-[#2C3045] px-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose} 
            className="rounded-full p-2 hover:bg-white/5 text-orange-500 transition"
            aria-label="Go back"
          >
            <ArrowLeft className="h-6 w-6" strokeWidth={2.5} />
          </button>
          <h2 className="text-lg font-extrabold text-white">Settings & Profile</h2>
        </div>
      </header>

      {/* Body Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-8">
        
        {/* Photo Container - Glassmorphic Card */}
        <div className="flex flex-col items-center justify-center py-6 bg-[#1A1C28]/60 backdrop-blur-md rounded-2xl border border-[#2C3045] shadow-lg">
          <div className="relative group h-28 w-28 cursor-pointer mb-3">
            {avatar ? (
              <img 
                src={avatar} 
                alt={user?.name} 
                className="h-full w-full rounded-full object-cover border-2 border-orange-500/30 shadow-md" 
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full bg-orange-500/10 text-3xl font-bold uppercase text-orange-500 border-2 border-orange-500/20 shadow-md">
                {getInitials(user?.name || '')}
              </div>
            )}

            {/* Hover overlay */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            >
              <Camera className="h-5 w-5 mb-1" />
              <span className="text-[8px] font-bold text-center uppercase tracking-wider px-1">
                Upload Photo
              </span>
            </div>

            {loading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </div>

          <h3 className="text-base font-bold text-white">{user?.name}</h3>
          <p className="text-xs text-[#B5B8C9] mt-0.5">{user?.email}</p>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleAvatarChange} 
            className="hidden" 
            accept="image/*"
            disabled={loading}
          />
        </div>

        {/* Success / Error Alerts */}
        {(errorMsg || successMsg) && (
          <div className="animate-in fade-in duration-200">
            {errorMsg && (
              <div className="rounded-xl bg-red-500/10 p-3 text-xs font-bold text-red-400 border border-red-500/20">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="rounded-xl bg-green-500/10 p-3 text-xs font-bold text-green-400 border border-green-500/20">
                {successMsg}
              </div>
            )}
          </div>
        )}

        {/* Section: Profile Form */}
        <div className="bg-[#1A1C28]/60 border border-[#2C3045] rounded-2xl p-4 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#2C3045] pb-2 mb-2">
            <User className="h-4 w-4 text-orange-500" />
            <h4 className="text-xs font-bold text-[#B5B8C9] uppercase tracking-wider">Account Profile</h4>
          </div>

          {/* Name Edit */}
          <form onSubmit={handleNameSave} className="space-y-1">
            <label className="block text-[10px] font-bold text-[#7A8199] uppercase tracking-wider">Display Name</label>
            <div className="flex items-center gap-2 bg-[#23263A] border border-[#2C3045] rounded-xl px-3 py-1.5">
              <input 
                type="text" 
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                disabled={savingName || loading}
                className="flex-1 bg-transparent text-xs text-white focus:outline-none"
                placeholder="Name"
              />
              <button 
                type="submit"
                disabled={savingName || loading || name.trim() === user?.name}
                className="p-1 rounded-full text-orange-500 hover:bg-orange-500/15 disabled:opacity-30"
              >
                {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </button>
            </div>
          </form>

          {/* Bio & Status Edit */}
          <form onSubmit={saveBioAndAbout} className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[#7A8199] uppercase tracking-wider">Status message</label>
              <input 
                type="text" 
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                className="w-full bg-[#23263A] border border-[#2C3045] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500"
                placeholder="About you"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[#7A8199] uppercase tracking-wider">Bio description</label>
              <textarea 
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
                className="w-full bg-[#23263A] border border-[#2C3045] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500 resize-none"
                placeholder="Write a brief bio..."
              />
            </div>
            <button
              type="submit"
              disabled={savingBio}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50"
            >
              {savingBio ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save Profile Details'}
            </button>
          </form>
        </div>

        {/* Section: Customizations & Theme */}
        <div className="bg-[#1A1C28]/60 border border-[#2C3045] rounded-2xl p-4 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#2C3045] pb-2 mb-2">
            <Palette className="h-4 w-4 text-orange-500" />
            <h4 className="text-xs font-bold text-[#B5B8C9] uppercase tracking-wider">Design & Personalization</h4>
          </div>

          {/* Theme selection */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-200">Theme Toggle</span>
              <span className="text-[9px] text-[#7A8199]">Select dark or light interface style</span>
            </div>
            <ThemeToggle />
          </div>

          {/* Accent Color picker */}
          <div className="space-y-1 pt-1">
            <span className="text-xs font-bold text-gray-200 block">Accent Color</span>
            <span className="text-[9px] text-[#7A8199] block">Choose your theme highlights & buttons</span>
            <div className="flex gap-2.5 mt-1.5">
              {[
                { color: '#FF6A00', name: 'Orange' },
                { color: '#2563EB', name: 'Blue' },
                { color: '#10B981', name: 'Green' },
                { color: '#8B5CF6', name: 'Purple' },
                { color: '#EC4899', name: 'Pink' }
              ].map(acc => (
                <button
                  key={acc.color}
                  type="button"
                  onClick={() => updateAccentColor(acc.color)}
                  style={{ backgroundColor: acc.color }}
                  className={`h-6 w-6 rounded-full flex items-center justify-center border-2 transition ${accentColor === acc.color ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                  title={acc.name}
                >
                  {accentColor === acc.color && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Bubble Color picker */}
          <div className="space-y-1 pt-1">
            <span className="text-xs font-bold text-gray-200 block">Chat Bubble Color</span>
            <span className="text-[9px] text-[#7A8199] block">Customize color for your sent bubbles</span>
            <div className="flex gap-2.5 mt-1.5">
              {[
                { color: '#16A34A', name: 'Green' },
                { color: '#FF6A00', name: 'Orange' },
                { color: '#2563EB', name: 'Blue' },
                { color: '#4F46E5', name: 'Indigo' },
                { color: '#374151', name: 'Charcoal' }
              ].map(bub => (
                <button
                  key={bub.color}
                  type="button"
                  onClick={() => updateChatBubbleColor(bub.color)}
                  style={{ backgroundColor: bub.color }}
                  className={`h-6 w-6 rounded-full flex items-center justify-center border-2 transition ${chatBubbleColor === bub.color ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                  title={bub.name}
                >
                  {chatBubbleColor === bub.color && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Incoming Bubble Color picker */}
          <div className="space-y-1 pt-1">
            <span className="text-xs font-bold text-gray-200 block">Incoming Message Color</span>
            <span className="text-[9px] text-[#7A8199] block">Customize color for received bubbles</span>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {[
                { value: 'light-gray', label: 'Light Gray', lightBg: '#EFEFEF', lightText: '#0D0D18', darkBg: '#20253A', darkText: '#FFFFFF' },
                { value: 'light-blue', label: 'Light Blue', lightBg: '#DBEAFE', lightText: '#1E3A8A', darkBg: '#1E3A8A', darkText: '#FFFFFF' },
                { value: 'light-green', label: 'Light Green', lightBg: '#D1FAE5', lightText: '#065F46', darkBg: '#065F46', darkText: '#FFFFFF' },
                { value: 'soft-purple', label: 'Soft Purple', lightBg: '#F3E8FF', lightText: '#5B21B6', darkBg: '#5B21B6', darkText: '#FFFFFF' },
                { value: 'beige', label: 'Beige', lightBg: '#FDF6E2', lightText: '#78350F', darkBg: '#78350F', darkText: '#FFFFFF' },
                { value: 'soft-orange', label: 'Soft Orange', lightBg: '#FFEDD5', lightText: '#9A3412', darkBg: '#9A3412', darkText: '#FFFFFF' }
              ].map(bub => {
                const isSelected = chatIncomingBubbleColor === bub.value;
                const bg = isDark ? bub.darkBg : bub.lightBg;
                const fg = isDark ? bub.darkText : bub.lightText;
                return (
                  <button
                    key={bub.value}
                    type="button"
                    onClick={() => updateChatIncomingBubbleColor(bub.value)}
                    style={{ backgroundColor: bg, color: fg, borderColor: isSelected ? '#FF6A00' : 'rgba(255,255,255,0.08)' }}
                    className={`h-7 px-3 rounded-full flex items-center justify-center border-2 transition gap-1.5 ${isSelected ? 'scale-105 shadow-md font-bold' : 'hover:scale-102 opacity-90'}`}
                    title={bub.label}
                  >
                    <span className="text-[10px] tracking-tight">{bub.label}</span>
                    {isSelected && <Check className="h-3 w-3" strokeWidth={3.5} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chat Wallpaper selection */}
          <div className="space-y-1 pt-1">
            <span className="text-xs font-bold text-gray-200 block">Chat Wallpaper</span>
            <span className="text-[9px] text-[#7A8199] block">Set your chat window background styling</span>
            <div className="grid grid-cols-5 gap-2 mt-1.5">
              {[
                { value: 'default', label: 'Default', preview: '#11131C' },
                { value: '#030712', label: 'Midnight', preview: '#030712' },
                { value: '#0B132B', label: 'Navy', preview: '#0B132B' },
                { value: '#1C1917', label: 'Stone', preview: '#1C1917' },
                { value: 'linear-gradient(135deg, #0f172a, #1e1b4b)', label: 'Cosmic', preview: 'linear-gradient(135deg, #0f172a, #1e1b4b)' }
              ].map(wall => (
                <button
                  key={wall.value}
                  type="button"
                  onClick={() => updateChatWallpaper(wall.value)}
                  style={{ background: wall.preview }}
                  className={`h-8 rounded-lg flex items-center justify-center border transition ${chatWallpaper === wall.value ? 'border-orange-500 scale-105 font-extrabold shadow' : 'border-[#2C3045] hover:scale-102 text-gray-500'}`}
                  title={wall.label}
                >
                  <span className="text-[8px] text-white/70 select-none tracking-tighter">{wall.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section: Accessibility */}
        <div className="bg-[#1A1C28]/60 border border-[#2C3045] rounded-2xl p-4 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#2C3045] pb-2 mb-2">
            <Type className="h-4 w-4 text-orange-500" />
            <h4 className="text-xs font-bold text-[#B5B8C9] uppercase tracking-wider">Accessibility (A11y)</h4>
          </div>

          {/* Chat Text Size Selection */}
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-250 block">Chat Font Scale</span>
            <div className="flex bg-[#23263A] p-0.5 rounded-xl border border-[#2C3045] mt-1.5">
              {[
                { value: 'small', label: 'A-', desc: 'Small' },
                { value: 'medium', label: 'A', desc: 'Normal' },
                { value: 'large', label: 'A+', desc: 'Large' },
                { value: 'xlarge', label: 'A++', desc: 'XL' }
              ].map(sz => (
                <button
                  key={sz.value}
                  type="button"
                  onClick={() => updateChatTextSize(sz.value)}
                  className={`flex-1 text-center py-1.5 text-[10px] font-bold rounded-lg transition-all ${chatTextSize === sz.value ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  {sz.label}
                </button>
              ))}
            </div>
          </div>

          {/* High Contrast toggle */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-250">High Contrast Mode</span>
              <span className="text-[9px] text-[#7A8199]">Increase visibility borders and values</span>
            </div>
            <button
              onClick={toggleHighContrast}
              type="button"
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                highContrast ? 'bg-orange-500' : 'bg-gray-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  highContrast ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Section: Privacy Settings */}
        <div className="bg-[#1A1C28]/60 border border-[#2C3045] rounded-2xl p-4 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#2C3045] pb-2 mb-2">
            <Shield className="h-4 w-4 text-orange-500" />
            <h4 className="text-xs font-bold text-[#B5B8C9] uppercase tracking-wider">Privacy Settings</h4>
          </div>

          {/* Read Receipts toggle */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-250">Read Receipts (Seen indicators)</span>
              <span className="text-[9px] text-[#7A8199]">Let others see when you read their messages</span>
            </div>
            <button
              onClick={toggleReadReceipts}
              type="button"
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                readReceipts ? 'bg-orange-500' : 'bg-gray-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  readReceipts ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Typing Indicators toggle */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-250">Typing Indicators</span>
              <span className="text-[9px] text-[#7A8199]">Show others when you are typing a response</span>
            </div>
            <button
              onClick={toggleTypingIndicators}
              type="button"
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                typingIndicators ? 'bg-orange-500' : 'bg-gray-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  typingIndicators ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Blocked Contacts list */}
          <div className="pt-2 border-t border-[#2C3045]">
            <span className="text-xs font-bold text-gray-200 block mb-1">Blocked Contacts</span>
            {users.filter(u => blockedUsers.includes(u._id)).length === 0 ? (
              <span className="text-[10px] text-[#7A8199]">No blocked contacts</span>
            ) : (
              <div className="space-y-2 mt-1.5 max-h-36 overflow-y-auto pr-1">
                {users.filter(u => blockedUsers.includes(u._id)).map(u => (
                  <div key={u._id} className="flex items-center justify-between bg-[#23263A]/80 p-2 rounded-xl border border-[#2C3045]">
                    <div className="flex items-center gap-2 min-w-0">
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.name} className="h-6 w-6 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-orange-500/10 text-orange-500 text-[10px] font-bold flex items-center justify-center uppercase shrink-0">
                          {getInitials(u.name || '')}
                        </div>
                      )}
                      <span className="text-xs text-white font-medium truncate">{u.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleBlockUser(u._id)}
                      className="px-2.5 py-0.5 rounded bg-red-500/15 hover:bg-red-500/25 text-[10px] text-red-400 font-bold border border-red-500/30 transition shrink-0"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section: Notification Sounds & Desktop preferences */}
        <div className="bg-[#1A1C28]/60 border border-[#2C3045] rounded-2xl p-4 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#2C3045] pb-2 mb-2">
            <Bell className="h-4 w-4 text-orange-500" />
            <h4 className="text-xs font-bold text-[#B5B8C9] uppercase tracking-wider">Alerts & Notifications</h4>
          </div>

          {/* Sound Notification preferences */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-250">Notification Sounds</span>
              <span className="text-[9px] text-[#7A8199]">Play sound when new message arrives</span>
            </div>
            <button
              onClick={toggleSound}
              type="button"
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                soundEnabled ? 'bg-orange-500' : 'bg-gray-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  soundEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Push Notification permissions */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-250">Desktop Notifications</span>
              <span className="text-[9px] text-[#7A8199]">Show system alerts when app is unfocused</span>
            </div>
            <button
              onClick={requestDesktopNotifications}
              disabled={desktopEnabled}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
                desktopEnabled 
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
                  : 'bg-orange-500 hover:bg-orange-600 text-white'
              }`}
            >
              {desktopEnabled ? 'Active' : 'Enable'}
            </button>
          </div>
        </div>

        {/* Section: Account Security & Privacy info */}
        <div className="bg-[#1A1C28]/60 border border-[#2C3045] rounded-2xl p-4 space-y-3 shadow-sm text-xs">
          <div className="flex items-center gap-2 border-b border-[#2C3045] pb-2 mb-1">
            <Shield className="h-4 w-4 text-orange-500" />
            <h4 className="text-[10px] font-bold text-[#B5B8C9] uppercase tracking-wider">Security & Privacy</h4>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-gray-400">Account status</span>
            <span className="text-green-400 font-bold">Verified & Active</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-gray-400">Security protocol</span>
            <span className="text-blue-400 font-bold">End-to-End JWT</span>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 py-2.5 text-xs font-bold text-red-400 transition shadow"
        >
          <LogOut className="h-4 w-4" />
          Log Out of Echo Connect
        </button>

        {/* Delete Account Button */}
        <button
          onClick={() => setShowDeleteModal(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-650 bg-red-650/10 hover:bg-red-650/30 py-2.5 text-xs font-bold text-red-500 transition shadow mt-2"
        >
          <ShieldAlert className="h-4 w-4" />
          Permanently Delete Account
        </button>

      </div>

      {showDeleteModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#161925] border border-red-900/30 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-500">
              <ShieldAlert className="h-8 w-8 shrink-0" />
              <div>
                <h3 className="text-base font-extrabold text-white">Permanently Delete Account?</h3>
                <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Warning: This action is irreversible</p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Are you absolutely sure you want to delete your account? All contacts, active friend requests, and settings will be permanently removed. Your messages will remain but your identity will be anonymized as <span className="font-semibold text-white">"Deleted User"</span>.
            </p>

            {user?.authProvider === 'local' && (
              <div className="space-y-1.5 text-left">
                <label className="block text-[10px] font-bold text-[#7A8199] uppercase tracking-wider">
                  Enter Password to Confirm
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => {
                    setDeletePassword(e.target.value);
                    setDeleteError('');
                  }}
                  placeholder="Your Account Password"
                  className="w-full bg-[#1E2235] border border-[#2D334E] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-red-500 text-white"
                />
              </div>
            )}

            {deleteError && (
              <p className="text-xs text-red-400 font-semibold text-left">{deleteError}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword('');
                  setDeleteError('');
                }}
                disabled={deleting}
                className="flex-1 rounded-2xl bg-[#23273B] hover:bg-[#2F344F] py-2.5 text-xs font-bold text-gray-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setDeleting(true);
                  setDeleteError('');
                  try {
                    const res = await deleteAccountPermanently(deletePassword);
                    if (res && res.success) {
                      setShowDeleteModal(false);
                      logout();
                    } else {
                      setDeleteError(res?.message || 'Failed to delete account.');
                    }
                  } catch (err) {
                    setDeleteError(err.response?.data?.message || 'Verification failed. Please check your credentials.');
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting || (user?.authProvider === 'local' && !deletePassword)}
                className="flex-1 rounded-2xl bg-red-600 hover:bg-red-700 py-2.5 text-xs font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  'Confirm Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProfileDrawer;
