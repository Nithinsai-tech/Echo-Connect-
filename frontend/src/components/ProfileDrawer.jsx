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

const CURATED_WALLPAPERS = {
  dark: [
    { id: 'dark-abstract', name: 'Dark Abstract', value: 'linear-gradient(135deg, #1e1b4b 0%, #311042 50%, #0f172a 100%)', type: 'gradient' },
    { id: 'midnight-blue', name: 'Midnight Blue', value: 'linear-gradient(135deg, #090e1a 0%, #1e293b 100%)', type: 'gradient' },
    { id: 'glass-dark', name: 'Glass Dark', value: 'linear-gradient(135deg, #090d16 0%, #1a1528 50%, #090d16 100%)', type: 'gradient' },
    { id: 'carbon-fiber', name: 'Carbon Fiber', value: 'linear-gradient(45deg, #121212 25%, #181818 25%, #181818 50%, #121212 50%, #121212 75%, #181818 75%, #181818 100%)', type: 'gradient' },
    { id: 'purple-gradient', name: 'Gradient Purple', value: 'linear-gradient(135deg, #2e0854 0%, #1a0233 100%)', type: 'gradient' },
    { id: 'aurora', name: 'Aurora', value: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=800&q=60', type: 'image' },
    { id: 'galaxy', name: 'Galaxy', value: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?auto=format&fit=crop&w=800&q=60', type: 'image' },
    { id: 'modern-geometry', name: 'Modern Geometry', value: 'linear-gradient(135deg, #27272a 0%, #09090b 100%)', type: 'gradient' }
  ],
  light: [
    { id: 'minimal-gray', name: 'Minimal Gray', value: '#e5e7eb', type: 'color' },
    { id: 'soft-white', name: 'Soft White', value: '#f9fafb', type: 'color' },
    { id: 'beige-paper', name: 'Beige Paper', value: '#f5f5dc', type: 'color' },
    { id: 'linen', name: 'Linen', value: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)', type: 'gradient' },
    { id: 'sky-gradient', name: 'Sky Gradient', value: 'linear-gradient(135deg, #a5f3fc 0%, #38bdf8 100%)', type: 'gradient' },
    { id: 'sand', name: 'Sand', value: '#eab308', type: 'color' },
    { id: 'light-abstract', name: 'Light Abstract', value: 'linear-gradient(135deg, #fef08a 0%, #f472b6 100%)', type: 'gradient' }
  ],
  nature: [
    { id: 'forest', name: 'Forest', value: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=60', type: 'image' },
    { id: 'mountains', name: 'Mountains', value: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=60', type: 'image' },
    { id: 'ocean', name: 'Ocean', value: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=800&q=60', type: 'image' },
    { id: 'leaves', name: 'Leaves', value: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=800&q=60', type: 'image' },
    { id: 'sunset', name: 'Sunset', value: 'https://images.unsplash.com/photo-1514241516423-6c0a5e031aa2?auto=format&fit=crop&w=800&q=60', type: 'image' }
  ],
  solid: [
    { id: 'black', name: 'Black', value: '#000000', type: 'color' },
    { id: 'navy', name: 'Navy', value: '#0b132b', type: 'color' },
    { id: 'olive', name: 'Olive', value: '#3f4e2f', type: 'color' },
    { id: 'emerald', name: 'Emerald', value: '#064e3b', type: 'color' },
    { id: 'purple', name: 'Purple', value: '#4c1d95', type: 'color' }
  ],
  glass: [
    { id: 'frosted-glass', name: 'Frosted Glass', value: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)', type: 'gradient' },
    { id: 'mesh-gradient', name: 'Mesh Gradient', value: 'linear-gradient(135deg, #4338ca 0%, #6366f1 50%, #a855f7 100%)', type: 'gradient' },
    { id: 'soft-blur', name: 'Soft Blur', value: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', type: 'gradient' },
    { id: 'glass-morphism', name: 'Glass Morphism', value: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', type: 'gradient' }
  ]
};

const getInitialsBg = (name) => {
  const colors = ['#FF6A00', '#2563EB', '#10B981', '#8B5CF6', '#EC4899'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

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
    deleteAccountPermanently,
    rooms
  } = useChat();

  const [currentScreen, setCurrentScreen] = useState('main'); // 'main' | 'chats' | 'wallpaper' | 'preview'
  const [tempSelectedWp, setTempSelectedWp] = useState(null);
  const [tempBlur, setTempBlur] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(false);

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

  const getRoomTitle = (room) => {
    if (room.isGroup) return room.name;
    const partner = room.participants?.find(p => p._id !== user?._id);
    return partner?.name || 'Private Chat';
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#11131C] text-white transition-all duration-300 animate-in slide-in-from-left">

      {/* 1. SCREEN: MAIN SETTINGS */}
      {currentScreen === 'main' && (
        <>
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

          <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-8">
            {/* Photo Container */}
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
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                >
                  <Camera className="h-5 w-5 mb-1" />
                  <span className="text-[8px] font-bold text-center uppercase tracking-wider px-1">Upload Photo</span>
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
                {errorMsg && <div className="rounded-xl bg-red-500/10 p-3 text-xs font-bold text-red-400 border border-red-500/20">{errorMsg}</div>}
                {successMsg && <div className="rounded-xl bg-green-500/10 p-3 text-xs font-bold text-green-400 border border-green-500/20">{successMsg}</div>}
              </div>
            )}

            {/* Account Profile Details */}
            <div className="bg-[#1A1C28]/60 border border-[#2C3045] rounded-2xl p-4 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 border-b border-[#2C3045] pb-2 mb-2">
                <User className="h-4 w-4 text-orange-500" />
                <h4 className="text-xs font-bold text-[#B5B8C9] uppercase tracking-wider">Account Profile</h4>
              </div>
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

            {/* Chats Submenu Route Button */}
            <button
              onClick={() => setCurrentScreen('chats')}
              className="w-full flex items-center justify-between p-4 bg-[#1A1C28]/60 border border-[#2C3045] rounded-2xl hover:bg-[#1A1C28]/80 transition shadow-sm text-left group"
            >
              <div className="flex items-center gap-3">
                <Palette className="h-5 w-5 text-orange-500 group-hover:scale-110 transition" />
                <div>
                  <span className="text-sm font-bold text-gray-100 block">Chats</span>
                  <span className="text-[10px] text-[#7A8199] block mt-0.5">Themes, wallpapers, bubble styling, size scale</span>
                </div>
              </div>
              <ArrowLeft className="h-4 w-4 rotate-180 text-gray-400 group-hover:translate-x-1 transition" />
            </button>

            {/* Theme Toggle in main */}
            <div className="bg-[#1A1C28]/60 border border-[#2C3045] rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-200">Theme Mode</span>
                <span className="text-[9px] text-[#7A8199]">Toggle dark or light interface style</span>
              </div>
              <ThemeToggle />
            </div>

            {/* Privacy Settings */}
            <div className="bg-[#1A1C28]/60 border border-[#2C3045] rounded-2xl p-4 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 border-b border-[#2C3045] pb-2 mb-2">
                <Shield className="h-4 w-4 text-orange-500" />
                <h4 className="text-xs font-bold text-[#B5B8C9] uppercase tracking-wider">Privacy Settings</h4>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-250">Read Receipts (Seen indicators)</span>
                  <span className="text-[9px] text-[#7A8199]">Let others see when you read messages</span>
                </div>
                <button
                  onClick={toggleReadReceipts}
                  type="button"
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${readReceipts ? 'bg-orange-500' : 'bg-gray-700'}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${readReceipts ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-250">Typing Indicators</span>
                  <span className="text-[9px] text-[#7A8199]">Show others when you are typing</span>
                </div>
                <button
                  onClick={toggleTypingIndicators}
                  type="button"
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${typingIndicators ? 'bg-orange-500' : 'bg-gray-700'}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${typingIndicators ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
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

            {/* Alerts & Notifications */}
            <div className="bg-[#1A1C28]/60 border border-[#2C3045] rounded-2xl p-4 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 border-b border-[#2C3045] pb-2 mb-2">
                <Bell className="h-4 w-4 text-orange-500" />
                <h4 className="text-xs font-bold text-[#B5B8C9] uppercase tracking-wider">Alerts & Notifications</h4>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-250">Notification Sounds</span>
                  <span className="text-[9px] text-[#7A8199]">Play sound when new message arrives</span>
                </div>
                <button
                  onClick={toggleSound}
                  type="button"
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${soundEnabled ? 'bg-orange-500' : 'bg-gray-700'}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${soundEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-250">Desktop Notifications</span>
                  <span className="text-[9px] text-[#7A8199]">Show system alerts when app is unfocused</span>
                </div>
                <button
                  onClick={requestDesktopNotifications}
                  disabled={desktopEnabled}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${desktopEnabled ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}
                >
                  {desktopEnabled ? 'Active' : 'Enable'}
                </button>
              </div>
            </div>

            {/* Security Status Info */}
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

            {/* Logout & Delete Buttons */}
            <button
              onClick={logout}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 py-2.5 text-xs font-bold text-red-400 transition shadow"
            >
              <LogOut className="h-4 w-4" />
              Log Out of Echo Connect
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-650 bg-red-650/10 hover:bg-red-650/30 py-2.5 text-xs font-bold text-red-500 transition shadow mt-2"
            >
              <ShieldAlert className="h-4 w-4" />
              Permanently Delete Account
            </button>
          </div>
        </>
      )}

      {/* 2. SCREEN: CHATS MENU */}
      {currentScreen === 'chats' && (
        <>
          <header className="flex h-20 shrink-0 items-center bg-[#1A1C28] border-b border-[#2C3045] px-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentScreen('main')}
                className="rounded-full p-2 hover:bg-white/5 text-orange-500 transition"
                aria-label="Back to main settings"
              >
                <ArrowLeft className="h-6 w-6" strokeWidth={2.5} />
              </button>
              <h2 className="text-lg font-extrabold text-white">Chats</h2>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-8">
            {/* Wallpaper menu button -> sets screen to wallpaper */}
            <button
              onClick={() => setCurrentScreen('wallpaper')}
              className="w-full flex items-center justify-between p-4 bg-[#1A1C28]/60 border border-[#2C3045] rounded-2xl hover:bg-[#1A1C28]/80 transition shadow-sm text-left group"
            >
              <div className="flex items-center gap-3">
                <Image className="h-5 w-5 text-orange-500 group-hover:scale-110 transition" />
                <div>
                  <span className="text-sm font-bold text-gray-100 block">Chat Wallpaper</span>
                  <span className="text-[10px] text-[#7A8199] block mt-0.5">Select and customize chat backgrounds</span>
                </div>
              </div>
              <ArrowLeft className="h-4 w-4 rotate-180 text-gray-400 group-hover:translate-x-1 transition" />
            </button>

            {/* Visual themes picker */}
            <div className="bg-[#1A1C28]/60 border border-[#2C3045] rounded-2xl p-4 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 border-b border-[#2C3045] pb-2 mb-2">
                <Palette className="h-4 w-4 text-orange-500" />
                <h4 className="text-xs font-bold text-[#B5B8C9] uppercase tracking-wider">Themes & Styling</h4>
              </div>

              {/* Accent color */}
              <div className="space-y-1">
                <span className="text-xs font-bold text-gray-200 block">Accent Color</span>
                <span className="text-[9px] text-[#7A8199] block">Choose color for buttons and Highlights</span>
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

              {/* Chat bubble color */}
              <div className="space-y-1 pt-2">
                <span className="text-xs font-bold text-gray-250 block">Sent Message Bubble Color</span>
                <span className="text-[9px] text-[#7A8199] block">Choose background for your sent bubbles</span>
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

              {/* Chat incoming bubble color */}
              <div className="space-y-1 pt-2">
                <span className="text-xs font-bold text-gray-205 block">Received Message Color</span>
                <span className="text-[9px] text-[#7A8199] block">Choose theme styling for received bubbles</span>
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
            </div>

            {/* Font scale and accessibility */}
            <div className="bg-[#1A1C28]/60 border border-[#2C3045] rounded-2xl p-4 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 border-b border-[#2C3045] pb-2 mb-2">
                <Type className="h-4 w-4 text-orange-500" />
                <h4 className="text-xs font-bold text-[#B5B8C9] uppercase tracking-wider">Font scale & accessibility</h4>
              </div>
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
              <div className="flex items-center justify-between pt-2">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-255">High Contrast Mode</span>
                  <span className="text-[9px] text-[#7A8199]">Increase layout visual contrast</span>
                </div>
                <button
                  onClick={toggleHighContrast}
                  type="button"
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${highContrast ? 'bg-orange-500' : 'bg-gray-700'}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${highContrast ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 3. SCREEN: WALLPAPER CATALOG */}
      {currentScreen === 'wallpaper' && (
        <>
          <header className="flex h-20 shrink-0 items-center bg-[#1A1C28] border-b border-[#2C3045] px-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentScreen('chats')}
                className="rounded-full p-2 hover:bg-white/5 text-orange-500 transition"
                aria-label="Back to chat customizations"
              >
                <ArrowLeft className="h-6 w-6" strokeWidth={2.5} />
              </button>
              <h2 className="text-lg font-extrabold text-white">Select Wallpaper</h2>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-8">
            {/* Custom wallpaper file uploader */}
            <div className="bg-[#1A1C28]/60 border border-[#2C3045] rounded-2xl p-4 space-y-3 shadow-sm">
              <h4 className="text-xs font-bold text-[#B5B8C9] uppercase tracking-wider">Custom Background</h4>
              <button
                onClick={() => document.getElementById('drawer-wallpaper-file-input')?.click()}
                disabled={uploadProgress}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-gray-600 hover:border-orange-500 bg-[#23263A]/40 hover:bg-orange-500/5 text-xs text-gray-300 font-bold transition disabled:opacity-50"
              >
                {uploadProgress ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                    Uploading Image...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 text-orange-400" />
                    Upload Custom Photo
                  </>
                )}
              </button>
              <input
                id="drawer-wallpaper-file-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadProgress(true);
                  try {
                    const res = await uploadAttachmentFile(file);
                    if (res && res.mediaUrl) {
                      setTempSelectedWp({
                        id: `custom-${Date.now()}`,
                        name: file.name.substring(0, 15) || 'Custom Photo',
                        value: res.mediaUrl,
                        type: 'image'
                      });
                      setTempBlur(0);
                      setCurrentScreen('preview');
                    }
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setUploadProgress(false);
                  }
                }}
              />
            </div>

            {/* Categorized curated library */}
            {Object.entries(CURATED_WALLPAPERS).map(([category, items]) => (
              <div key={category} className="bg-[#1A1C28]/60 border border-[#2C3045] rounded-2xl p-4 space-y-3 shadow-sm">
                <h4 className="text-xs font-bold text-[#B5B8C9] uppercase tracking-wider capitalize">
                  {category === 'glass' ? 'Glass & Gradients' : `${category} Library`}
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {items.map(wp => (
                    <button
                      key={wp.id}
                      onClick={() => {
                        setTempSelectedWp(wp);
                        setTempBlur(0);
                        setCurrentScreen('preview');
                      }}
                      className="relative aspect-[3/4] rounded-lg overflow-hidden border border-white/5 hover:border-orange-500 hover:scale-[1.02] transition duration-200 group"
                    >
                      <div
                        className="absolute inset-0 w-full h-full"
                        style={{
                          background: wp.type === 'image' ? `url(${wp.value})` : wp.value,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-[9px] text-center font-bold truncate text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        {wp.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 4. SCREEN: LIVE PREVIEW & ADJUSTMENTS */}
      {currentScreen === 'preview' && (
        <>
          <header className="flex h-20 shrink-0 items-center bg-[#1A1C28] border-b border-[#2C3045] px-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentScreen('wallpaper')}
                className="rounded-full p-2 hover:bg-white/5 text-orange-500 transition"
                aria-label="Back to wallpapers selection"
              >
                <ArrowLeft className="h-6 w-6" strokeWidth={2.5} />
              </button>
              <h2 className="text-lg font-extrabold text-white">Preview & Style</h2>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-8 flex flex-col">
            <div className="text-center shrink-0">
              <p className="text-xs text-gray-400 font-medium">Live wallpaper preview in conversation view</p>
            </div>

            {/* Simulated Live Chat Container */}
            <div className="relative h-60 rounded-2xl overflow-hidden border border-[#2C3045] flex flex-col shadow-2xl shrink-0">
              {/* Live Wallpaper backdrop */}
              <div
                className="absolute inset-0 z-0 transition-all duration-300"
                style={{
                  background: tempSelectedWp?.type === 'image' ? `url(${tempSelectedWp.value})` : (tempSelectedWp?.value || 'var(--chat-bg-gradient)'),
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: tempBlur > 0 ? `blur(${tempBlur / 3}px)` : 'none',
                  transform: tempBlur > 0 ? 'scale(1.08)' : 'none'
                }}
              />
              <div className="absolute inset-0 bg-black/15 z-1" />

              {/* Chat Header Overlay */}
              <div className="relative z-2 bg-[#1A1C28]/85 backdrop-blur-md px-3 py-2 flex items-center gap-2 border-b border-white/5 shrink-0">
                <div className="h-7 w-7 rounded-full bg-orange-500/20 text-orange-500 text-[10px] font-bold flex items-center justify-center uppercase">
                  EC
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-white leading-tight">Echo Connect Admin</p>
                  <p className="text-[8px] text-green-400 font-medium">Online</p>
                </div>
              </div>

              {/* Chat Messages Mock Area */}
              <div className="relative z-2 flex-1 p-3 space-y-2.5 overflow-y-auto flex flex-col justify-end">
                <div className="flex items-end gap-1.5 max-w-[85%] self-start">
                  <div className="w-6 h-6 rounded-full bg-orange-500/10 text-orange-500 text-[8px] font-bold flex items-center justify-center uppercase shrink-0">
                    EA
                  </div>
                  <div className="bg-[#20253A]/90 text-white rounded-2xl rounded-tl-none px-2.5 py-1.5 text-[10px] leading-relaxed shadow-sm">
                    <p>Hey there! Here is how your chat wallpaper will look.</p>
                  </div>
                </div>
                <div className="flex items-end gap-1.5 max-w-[85%] self-end">
                  <div className="bg-[#16A34A] text-white rounded-2xl rounded-tr-none px-2.5 py-1.5 text-[10px] leading-relaxed shadow-sm text-left">
                    <p>Wow, it looks beautiful! The live blur slider works perfectly.</p>
                  </div>
                </div>
              </div>

              {/* Chat Input Mock */}
              <div className="relative z-2 bg-[#1A1C28]/85 backdrop-blur-md px-3 py-2 flex items-center gap-2 border-t border-white/5 shrink-0">
                <div className="flex-1 bg-[#23263A] rounded-full px-3 py-1 text-[9px] text-gray-400">
                  Type a message...
                </div>
                <div className="h-5 w-5 rounded-full bg-orange-500 flex items-center justify-center text-white shrink-0">
                  <span className="text-[9px]">✈</span>
                </div>
              </div>
            </div>

            {/* Wallpaper options controller card */}
            <div className="bg-[#1A1C28]/60 border border-[#2C3045] rounded-2xl p-4 space-y-4 shadow-sm flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                {/* Blur Intensity Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-250">Blur Intensity</span>
                    <span className="text-xs font-bold text-orange-500">{tempBlur}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={tempBlur}
                    onChange={(e) => setTempBlur(Number(e.target.value))}
                    className="w-full h-1 bg-gray-750 rounded-lg appearance-none cursor-pointer accent-[#FF6A00]"
                  />
                </div>

                {/* Scope selector */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-[#7A8199] uppercase tracking-wider">
                    Apply Wallpaper to Scope
                  </label>
                  <select
                    id="wallpaper-apply-scope-select"
                    className="w-full bg-[#23263A] border border-[#2C3045] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500 text-white"
                  >
                    <option value="global">All Chats (Global Default)</option>
                    {rooms.map(room => (
                      <option key={room._id} value={room._id}>
                        Chat: {getRoomTitle(room)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 pt-4">
                <button
                  onClick={async () => {
                    const selectEl = document.getElementById('wallpaper-apply-scope-select');
                    const selectedValue = selectEl?.value || 'global';
                    const isGlobal = selectedValue === 'global';

                    const newWpConfig = {
                      id: tempSelectedWp.id,
                      name: tempSelectedWp.name,
                      value: tempSelectedWp.value,
                      type: tempSelectedWp.type,
                      blur: tempBlur
                    };

                    let updatedWallpaperString = '';
                    try {
                      const current = user?.wallpaper ? JSON.parse(user.wallpaper) : { global: null, rooms: {} };
                      if (isGlobal) {
                        current.global = newWpConfig;
                      } else {
                        if (!current.rooms) current.rooms = {};
                        current.rooms[selectedValue] = newWpConfig;
                      }
                      updatedWallpaperString = JSON.stringify(current);
                    } catch (e) {
                      updatedWallpaperString = JSON.stringify({
                        global: newWpConfig,
                        rooms: isGlobal ? {} : { [selectedValue]: newWpConfig }
                      });
                    }

                    setLoading(true);
                    try {
                      const res = await updateUserProfile({ wallpaper: updatedWallpaperString });
                      if (res.success && res.data) {
                        updateUser(res.data);
                        setCurrentScreen('chats');
                      }
                    } catch (err) {
                      console.error(err);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-xs font-bold text-white transition flex items-center justify-center gap-1.5 shadow-lg"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply Style'}
                </button>

                <button
                  onClick={() => setCurrentScreen('wallpaper')}
                  className="w-full py-2.5 rounded-xl bg-[#23263A] hover:bg-[#2F344F] text-xs font-bold text-gray-300 transition"
                >
                  Cancel Preview
                </button>

                <button
                  onClick={async () => {
                    if (window.confirm('Reset all custom wallpapers to default?')) {
                      setLoading(true);
                      try {
                        const res = await updateUserProfile({ wallpaper: '' });
                        if (res.success && res.data) {
                          updateUser(res.data);
                          setCurrentScreen('chats');
                        }
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setLoading(false);
                      }
                    }
                  }}
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-xs font-bold text-red-400 border border-red-550/20 transition"
                >
                  Reset to Default Wallpaper
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal Overlay */}
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
                <label className="block text-[10px] font-bold text-[#7A8199] uppercase tracking-wider">Enter Password to Confirm</label>
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

            {deleteError && <p className="text-xs text-red-400 font-semibold text-left">{deleteError}</p>}

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
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProfileDrawer;
