import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import FloatingActionButton from '../components/FloatingActionButton';
import NewChatModal from '../components/NewChatModal';
import ProfileDrawer from '../components/ProfileDrawer';
import { useChat } from '../hooks/useChat';
import { getInitials } from '../utils/getInitials';
import { Loader2, X, MessageSquare, Phone, Users, Settings as SettingsIcon } from 'lucide-react';

const Chat = () => {
  const { 
    activeRoom, 
    isReconnecting, 
    offlineBanner,
    toast, 
    setToast, 
    apiError,
    selectRoom, 
    rooms 
  } = useChat();

  const [mobileTab, setMobileTab] = useState('chats');
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatModalStep, setNewChatModalStep] = useState('private');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleOpenNewChat = (step = 'private') => {
    setNewChatModalStep(step);
    setIsNewChatModalOpen(true);
  };

  const handleFABAction = (actionType) => {
    if (actionType === 'new_chat') {
      handleOpenNewChat('private');
    } else if (actionType === 'new_group') {
      handleOpenNewChat('group-step1');
    } else if (actionType === 'quick_conv') {
      handleOpenNewChat('private');
    }
  };

  const handleToastClick = () => {
    if (toast) {
      const targetRoom = rooms.find(r => r._id === toast.roomId);
      if (targetRoom) {
        selectRoom(targetRoom);
      }
      setToast(null);
    }
  };

  // Global Keyboard Shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      const isTyping = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.isContentEditable
      );

      // Escape key to dismiss overlays
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsNewChatModalOpen(false);
        setIsProfileOpen(false);
        window.dispatchEvent(new CustomEvent('dismiss-overlays'));
        return;
      }

      // If actively typing, bypass other productivity shortcuts
      if (isTyping) return;

      // Ctrl + N (New Chat DM)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleOpenNewChat('private');
      }

      // Ctrl + G (New Group Step 1)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        handleOpenNewChat('group-step1');
      }

      // Ctrl + Shift + S (Cycle Sidebar Tabs)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('cycle-sidebar-tabs'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  React.useEffect(() => {
    const handleDismiss = () => setIsProfileOpen(false);
    window.addEventListener('dismiss-overlays', handleDismiss);
    return () => window.removeEventListener('dismiss-overlays', handleDismiss);
  }, []);

  const showBanner = isReconnecting || offlineBanner;

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden relative" style={{ backgroundColor: 'var(--bg-base)' }}>
      
      {/* Outer Wrapper for responsive layout */}
      <div className="flex h-full w-full overflow-hidden relative" style={{ backgroundColor: 'var(--bg-base)' }}>
        
        {/* Left Panel: Sidebar */}
        <div
          className={`absolute inset-0 w-full h-full flex flex-col transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:w-[340px] md:shrink-0 md:h-full md:border-r md:z-auto ${
            activeRoom ? '-translate-x-full z-0' : 'translate-x-0 z-10'
          }`}
          style={{ borderColor: 'var(--border)' }}
        >
          <Sidebar onNewChat={() => handleOpenNewChat('private')} onOpenSettings={() => setIsProfileOpen(true)} />
        </div>

        {/* Right Panel: ChatWindow */}
        <div
          className={`absolute inset-0 w-full h-full flex flex-col transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:flex-1 md:z-auto ${
            activeRoom ? 'translate-x-0 z-10' : 'translate-x-full z-0'
          }`}
          style={{ backgroundColor: 'var(--bg-base)' }}
        >
          <ChatWindow />
        </div>

      </div>

      {/* Floating Action Button (FAB) */}
      {!activeRoom && <FloatingActionButton onAction={handleFABAction} />}

      {/* Unified New Chat / Group Creation Modal */}
      <NewChatModal 
        isOpen={isNewChatModalOpen} 
        onClose={() => setIsNewChatModalOpen(false)} 
        initialStep={newChatModalStep} 
      />

      {/* Bottom Nav Bar (mobile only, hidden on desktop) */}
      {!activeRoom && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-[#13131F] border-t border-[#E0E0EA] dark:border-[#2A2A45] flex items-center justify-around z-30 animate-in slide-in-from-bottom duration-300">
          <button 
            onClick={() => setMobileTab('chats')} 
            className="flex flex-col items-center justify-center gap-1 bg-transparent border-none outline-none"
            style={{ color: mobileTab === 'chats' ? '#FF6A00' : '#9090A8' }}
          >
            <MessageSquare className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Chats</span>
          </button>
          <button 
            onClick={() => {
              setMobileTab('calls');
              alert('Voice & Video calls list is coming soon!');
            }}
            className="flex flex-col items-center justify-center gap-1 bg-transparent border-none outline-none"
            style={{ color: mobileTab === 'calls' ? '#FF6A00' : '#9090A8' }}
          >
            <Phone className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Calls</span>
          </button>
          <button 
            onClick={() => {
              setMobileTab('people');
              alert('Search & discover new friends feature is coming soon!');
            }}
            className="flex flex-col items-center justify-center gap-1 bg-transparent border-none outline-none"
            style={{ color: mobileTab === 'people' ? '#FF6A00' : '#9090A8' }}
          >
            <Users className="h-5 w-5" />
            <span className="text-[10px] font-semibold">People</span>
          </button>
          <button 
            onClick={() => {
              setMobileTab('settings');
              alert('Access settings from the top left profile icon!');
            }}
            className="flex flex-col items-center justify-center gap-1 bg-transparent border-none outline-none"
            style={{ color: mobileTab === 'settings' ? '#FF6A00' : '#9090A8' }}
          >
            <SettingsIcon className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Settings</span>
          </button>
        </div>
      )}

      {/* PROFILE DRAWER */}
      <ProfileDrawer 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
      />
    </div>
  );
};

export default Chat;
