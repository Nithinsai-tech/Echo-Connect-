import React, { useState, useEffect, memo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useChat } from '../hooks/useChat';
import { getInitials } from '../utils/getInitials';
import { formatChatTime } from '../utils/formatTime';
import {
  Search,
  X,
  LogOut,
  MessageSquare,
  Bell,
  Settings,
  Plus,
  Users,
  Check
} from 'lucide-react';
import NewChatModal from './NewChatModal';
import ThemeToggle from './ThemeToggle';

const getInitialsBg = (name) => {
  const char = (name || 'E').toUpperCase().charAt(0);
  const code = char.charCodeAt(0);
  const colors = ['#FF6A00', '#2563EB', '#7C3AED', '#059669', '#DC2626'];
  return colors[code % colors.length];
};

const RoomItem = memo(({ room, isActive, user, typingUsers, selectRoom, getRoomMeta }) => {
  const meta = getRoomMeta(room);

  const typers = Object.keys(typingUsers).filter(
    uid => room.participants.some(p => p._id === uid) && uid !== user?._id
  );
  const isSomeoneTyping = typers.length > 0;
  const unreadCount = room.unreadCount || 0;

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectRoom(room);
    }
  };

  return (
    <div
      onClick={() => selectRoom(room)}
      onKeyDown={handleKeyPress}
      tabIndex={0}
      role="button"
      aria-label={`Chat room with ${meta.title}. ${unreadCount > 0 ? `${unreadCount} unread messages.` : ''}`}
      className="flex items-center gap-3 px-4 py-3 cursor-pointer border-l-4 transition-all"
      style={{
        borderLeftColor: isActive ? '#FF6A00' : 'transparent',
        backgroundColor: isActive ? 'var(--orange-bg)' : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <div className="relative shrink-0" style={{ width: '46px', height: '46px' }}>
        {meta.avatar ? (
          <img
            src={meta.avatar}
            alt={meta.title}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center rounded-full text-white font-bold text-sm"
            style={{ backgroundColor: getInitialsBg(meta.title) }}
          >
            {getInitials(meta.title)}
          </div>
        )}
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 online-status-dot ${meta.isOnline ? 'online' : ''}`}
          style={{ borderColor: 'var(--bg-panel)' }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-sm font-semibold truncate text-[var(--text-primary)]">
            {meta.title}
          </span>
          {room.lastMessage && (
            <span className="text-[11px] text-[var(--text-muted)] shrink-0">
              {formatChatTime(room.lastMessage.createdAt)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          {isSomeoneTyping ? (
            <span className="text-xs italic font-medium text-[#FF6A00] shrink-0">
              typing...
            </span>
          ) : (
            <span className="text-xs text-[var(--text-secondary)] truncate flex-1 pr-2">
              {room.lastMessage
                ? room.lastMessage.content || 'Attachment file'
                : 'No messages yet'}
            </span>
          )}

          {unreadCount > 0 && (
            <span className="flex items-center justify-center bg-[#FF6A00] text-white rounded-full text-[10px] font-bold h-5 min-w-[20px] px-1 shrink-0">
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

RoomItem.displayName = 'RoomItem';

const Sidebar = ({ onNewChat, onOpenSettings }) => {
  const { user, logout } = useAuth();
  const {
    rooms,
    activeRoom,
    selectRoom,
    typingUsers,
    loadingRooms,
    users,
    friendRequests,
    acceptRequest,
    declineRequest
  } = useChat();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('All');

  useEffect(() => {
    const handleCycleTabs = () => {
      const tabs = ['All', 'Unread', 'Groups'];
      setActiveTab(prev => {
        const nextIdx = (tabs.indexOf(prev) + 1) % tabs.length;
        return tabs[nextIdx];
      });
    };
    window.addEventListener('cycle-sidebar-tabs', handleCycleTabs);
    return () => {
      window.removeEventListener('cycle-sidebar-tabs', handleCycleTabs);
    };
  }, []);

  const getRoomMeta = (room) => {
    if (!room || !room.participants) {
      return { title: 'Chat User', avatar: '', isOnline: false };
    }
    if (room.type === 'group') {
      const isOnline = room.participants.some(
        p => p && p._id !== user?._id && p.isOnline
      );
      return {
        title: room.groupName || 'Unnamed Group',
        avatar: room.groupAvatar || '',
        isOnline
      };
    } else {
      const partner = room.participants.find(p => p && p._id !== user?._id);
      return {
        title: partner?.name || 'Chat User',
        avatar: partner?.avatar || '',
        isOnline: partner?.isOnline || false
      };
    }
  };

  const filteredRooms = rooms
    .filter(room => {
      const meta = getRoomMeta(room);
      const matchesSearch = meta.title
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      if (activeTab === 'Unread') return (room.unreadCount || 0) > 0;
      if (activeTab === 'Groups') return room.type === 'group';
      return true;
    })
    .sort((a, b) => {
      const timeA = new Date(a.lastMessage?.createdAt || a.updatedAt);
      const timeB = new Date(b.lastMessage?.createdAt || b.updatedAt);
      return timeB - timeA;
    });

  return (
    <aside
      className="w-full md:w-[340px] border-r flex flex-col h-full shrink-0"
      style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border)' }}
    >
      {/* TOP BAR */}
      <div
        className="flex items-center gap-2.5 px-4 py-3.5 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        {/* User avatar */}
        <button
          onClick={onOpenSettings}
          className="shrink-0 relative focus:outline-none rounded-full overflow-hidden hover:opacity-85 transition"
          aria-label="Open Profile Settings"
          style={{ width: '36px', height: '36px' }}
        >
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="h-full w-full object-cover rounded-full"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center rounded-full text-white font-bold text-sm"
              style={{ backgroundColor: '#FF6A00' }}
            >
              {getInitials(user?.name || '')}
            </div>
          )}
        </button>

        {/* Logo + App name */}
        <div className="flex items-center gap-2 flex-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF6A00]">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"
                fill="white"
              />
            </svg>
          </div>
          <h1
            className="font-extrabold text-lg select-none"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            <span style={{ color: '#FF6A00' }}>Echo</span>
            <span style={{ color: '#2563EB' }}>Connect</span>
          </h1>
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 rounded-lg transition"
            style={{ color: '#9090A8' }}
            title="Notifications"
            aria-label="Notifications"
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Bell size={18} />
          </button>

          <ThemeToggle />

          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg transition"
            style={{ color: '#9090A8' }}
            title="Settings"
            aria-label="Settings"
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Settings size={18} />
          </button>

          <button
            onClick={logout}
            className="p-1.5 rounded-lg transition"
            style={{ color: '#EF4444' }}
            title="Log Out"
            aria-label="Log Out"
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div
        className="mx-3.5 my-2.5 flex items-center gap-2 px-4 py-2.5 rounded-full border transition"
        style={{
          backgroundColor: 'var(--bg-input)',
          borderColor: 'var(--border)'
        }}
      >
        <Search size={16} style={{ color: '#9090A8', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Search chats..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-transparent border-none outline-none text-sm w-full"
          style={{ color: 'var(--text-primary)' }}
          aria-label="Search chats"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            aria-label="Clear search"
          >
            <X size={15} style={{ color: '#9090A8' }} />
          </button>
        )}
      </div>

      {/* TABS */}
      <div className="flex gap-1 mx-3.5 mb-2">
        {['All', 'Unread', 'Groups', 'Requests'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition"
            style={{
              backgroundColor: activeTab === tab ? '#FF6A00' : 'transparent',
              color: activeTab === tab ? '#FFFFFF' : 'var(--text-secondary)'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab)
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab)
                e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span>{tab}</span>
            {tab === 'Requests' && friendRequests?.incoming?.length > 0 && (
              <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shrink-0">
                {friendRequests.incoming.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* NEW CHAT BUTTON */}
      <div className="mx-3.5 mb-2">
        <button
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 text-white rounded-xl py-2 px-4 text-sm font-semibold cursor-pointer transition"
          style={{ backgroundColor: '#FF6A00' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FF8C3A'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#FF6A00'}
        >
          <Plus size={16} />
          <span>New Chat</span>
        </button>
      </div>

      {/* ROOM LIST */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        {activeTab === 'Requests' ? (
          <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {/* Incoming Requests */}
            {friendRequests?.incoming?.length > 0 && (
              <div>
                <div 
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider border-b"
                  style={{ color: '#FF6A00', backgroundColor: 'var(--bg-hover)', borderColor: 'var(--border)' }}
                >
                  Incoming Friend Requests ({friendRequests.incoming.length})
                </div>
                {friendRequests.incoming.map(req => (
                  <div key={req._id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-850/20 transition">
                    <div className="flex items-center min-w-0 mr-2">
                      <div className="relative mr-3 h-9 w-9 shrink-0">
                        {req.sender?.avatar ? (
                          <img src={req.sender.avatar} alt={req.sender.name} className="h-full w-full rounded-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center rounded-full text-xs font-bold uppercase text-white" style={{ backgroundColor: getInitialsBg(req.sender?.name || '') }}>
                            {getInitials(req.sender?.name || '')}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{req.sender?.name}</span>
                        <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{req.sender?.email}</span>
                      </div>
                    </div>
                    <div className="flex items-center shrink-0">
                      <button
                        onClick={() => acceptRequest(req._id)}
                        className="px-2.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition mr-1"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => declineRequest(req._id)}
                        className="px-2.5 py-1.5 rounded-lg bg-red-650 hover:bg-red-700 text-white text-xs font-bold transition"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Outgoing Requests */}
            {friendRequests?.outgoing?.length > 0 && (
              <div>
                <div 
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider border-b"
                  style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-hover)', borderColor: 'var(--border)' }}
                >
                  Sent Friend Requests ({friendRequests.outgoing.length})
                </div>
                {friendRequests.outgoing.map(req => (
                  <div key={req._id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-850/20 transition">
                    <div className="flex items-center min-w-0 mr-2">
                      <div className="relative mr-3 h-9 w-9 shrink-0">
                        {req.receiver?.avatar ? (
                          <img src={req.receiver.avatar} alt={req.receiver.name} className="h-full w-full rounded-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center rounded-full text-xs font-bold uppercase text-white" style={{ backgroundColor: getInitialsBg(req.receiver?.name || '') }}>
                            {getInitials(req.receiver?.name || '')}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{req.receiver?.name}</span>
                        <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{req.receiver?.email}</span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <span className="px-3 py-1.5 rounded-lg text-gray-500 dark:text-gray-400 text-xs font-semibold select-none" style={{ backgroundColor: 'var(--bg-hover)' }}>
                        Pending
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Zero State for Requests */}
            {(!friendRequests?.incoming?.length && !friendRequests?.outgoing?.length) && (
              <div className="flex flex-col items-center justify-center p-8 py-16 text-center">
                <div
                  className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
                  style={{ backgroundColor: 'var(--orange-bg)', color: '#FF6A00' }}
                >
                  <Users size={32} />
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  No pending requests
                </p>
                <p className="text-xs mt-1 max-w-[200px]" style={{ color: 'var(--text-muted)' }}>
                  All caught up! Add contacts to start a chat.
                </p>
                <button
                  onClick={onNewChat}
                  className="mt-4 rounded-xl px-4 py-2 text-xs font-bold text-white transition"
                  style={{ backgroundColor: '#FF6A00' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FF8C3A'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#FF6A00'}
                >
                  Find People
                </button>
              </div>
            )}
          </div>
        ) : loadingRooms ? (
          <div className="flex flex-col">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center px-4 py-4 space-x-3">
                <div
                  className="rounded-full h-11 w-11 shrink-0 animate-pulse"
                  style={{ backgroundColor: 'var(--bg-hover)' }}
                />
                <div className="flex-1 space-y-2">
                  <div
                    className="h-4 rounded w-1/3 animate-pulse"
                    style={{ backgroundColor: 'var(--bg-hover)' }}
                  />
                  <div
                    className="h-3 rounded w-2/3 animate-pulse"
                    style={{ backgroundColor: 'var(--bg-hover)' }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : filteredRooms.length === 0 ? (
          rooms.length === 0 ? (
            users.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 py-16 text-center">
                <div
                  className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
                  style={{ backgroundColor: 'var(--orange-bg)', color: '#FF6A00' }}
                >
                  <Users size={32} />
                </div>
                <p
                  className="text-sm font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  No contacts yet
                </p>
                <p
                  className="text-xs mt-1 max-w-[200px]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Connect with friends to start chatting!
                </p>
                <button
                  onClick={onNewChat}
                  className="mt-4 rounded-xl px-4 py-2 text-xs font-bold text-white transition"
                  style={{ backgroundColor: '#FF6A00' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FF8C3A'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#FF6A00'}
                >
                  Add Contact
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 py-16 text-center">
                <div
                  className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
                  style={{ backgroundColor: 'var(--orange-bg)', color: '#FF6A00' }}
                >
                  <MessageSquare size={32} />
                </div>
                <p
                  className="text-sm font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  No conversations yet.
                </p>
                <p
                  className="text-xs mt-1 max-w-[200px]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Start a conversation to show here!
                </p>
                <button
                  onClick={onNewChat}
                  className="mt-4 rounded-xl px-4 py-2 text-xs font-bold text-white transition"
                  style={{ backgroundColor: '#FF6A00' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FF8C3A'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#FF6A00'}
                >
                  Start a new chat
                </button>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <p
                className="text-sm font-medium"
                style={{ color: 'var(--text-muted)' }}
              >
                No results found
              </p>
            </div>
          )
        ) : (
          filteredRooms.map(room => (
            <RoomItem
              key={room._id}
              room={room}
              isActive={activeRoom && activeRoom._id === room._id}
              user={user}
              typingUsers={typingUsers}
              selectRoom={selectRoom}
              getRoomMeta={getRoomMeta}
            />
          ))
        )}
      </div>


    </aside>
  );
};

export default Sidebar;