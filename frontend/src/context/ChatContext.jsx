import React, { createContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './ToastContext';
import { useTheme } from './ThemeContext';
import {
  getRooms,
  getAllUsers,
  getRoomMessages,
  markMessagesAsRead,
  deleteMessage as apiDeleteMessage,
  createPrivateRoom as apiCreatePrivateRoom,
  createGroupRoom as apiCreateGroupRoom,
  uploadAttachment as apiUploadAttachment,
  leaveGroup as apiLeaveGroup,
  addGroupMember as apiAddMember,
  removeGroupMember as apiRemoveMember,
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  getCalls
} from '../api';

// Helper to resolve reactions, replies, pins and deletes in a single linear pass
const processMessageTimeline = (rawMessages) => {
  const normalMessages = [];
  const reactionsMap = {};      // targetMessageId -> Array of { emoji, userId, userName }
  const pinsMap = {};           // targetMessageId -> boolean
  const deletedEveryone = new Set(); // targetMessageId

  rawMessages.forEach(msg => {
    if (!msg) return;
    if (msg.content && msg.content.startsWith('{"_echoType"')) {
      try {
        const parsed = JSON.parse(msg.content);
        const senderId = msg.senderId?._id || msg.senderId;
        const senderName = msg.senderId?.name || 'User';

        if (parsed._echoType === 'reaction') {
          const targetId = parsed.targetMessageId;
          if (!reactionsMap[targetId]) reactionsMap[targetId] = [];
          
          const idx = reactionsMap[targetId].findIndex(r => r.emoji === parsed.emoji && r.userId === senderId);
          if (parsed.action === 'add') {
            if (idx === -1) {
              reactionsMap[targetId].push({ emoji: parsed.emoji, userId: senderId, userName: senderName });
            }
          } else if (parsed.action === 'remove') {
            if (idx !== -1) {
              reactionsMap[targetId].splice(idx, 1);
            }
          }
        } else if (parsed._echoType === 'pin') {
          pinsMap[parsed.targetMessageId] = (parsed.action === 'pin');
        } else if (parsed._echoType === 'delete_everyone') {
          deletedEveryone.add(parsed.targetMessageId);
        } else {
          normalMessages.push(msg);
        }
      } catch (e) {
        normalMessages.push(msg);
      }
    } else {
      normalMessages.push(msg);
    }
  });

  return normalMessages.map(msg => {
    if (!msg) return msg;
    const msgId = msg._id;
    return {
      ...msg,
      reactions: reactionsMap[msgId] || [],
      isPinned: !!pinsMap[msgId],
      isDeletedEveryone: deletedEveryone.has(msgId)
    };
  });
};

// Deduplicate by message ID and sort chronologically (oldest to newest)
const deduplicateAndSortMessages = (msgs) => {
  const map = new Map();
  msgs.forEach(m => {
    if (m && m._id) {
      map.set(m._id.toString(), m);
    }
  });
  return Array.from(map.values()).sort((a, b) => {
    const timeDiff = new Date(a.createdAt) - new Date(b.createdAt);
    if (timeDiff !== 0) return timeDiff;
    return a._id.toString().localeCompare(b._id.toString());
  });
};

const incomingBubbleColorPresets = {
  'light-gray': {
    lightBg: '#EFEFEF',
    lightText: '#0D0D18',
    darkBg: '#20253A',
    darkText: '#FFFFFF'
  },
  'light-blue': {
    lightBg: '#DBEAFE',
    lightText: '#1E3A8A',
    darkBg: '#1E3A8A',
    darkText: '#FFFFFF'
  },
  'light-green': {
    lightBg: '#D1FAE5',
    lightText: '#065F46',
    darkBg: '#065F46',
    darkText: '#FFFFFF'
  },
  'soft-purple': {
    lightBg: '#F3E8FF',
    lightText: '#5B21B6',
    darkBg: '#5B21B6',
    darkText: '#FFFFFF'
  },
  'beige': {
    lightBg: '#FDF6E2',
    lightText: '#78350F',
    darkBg: '#78350F',
    darkText: '#FFFFFF'
  },
  'soft-orange': {
    lightBg: '#FFEDD5',
    lightText: '#9A3412',
    darkBg: '#9A3412',
    darkText: '#FFFFFF'
  }
};

export const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const socket = useSocket();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { isDark } = useTheme();

  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [rawMessages, setRawMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [friendRequests, setFriendRequests] = useState({ incoming: [], outgoing: [] });
  const [typingUsers, setTypingUsers] = useState({}); // { [userId]: username }
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [calls, setCalls] = useState([]);

  // Client-side deduplication helper to ensure no duplicate private rooms are rendered
  const deduplicateRooms = useCallback((roomsList) => {
    const seen = new Set();
    return roomsList.filter(room => {
      if (room.type === 'private') {
        const key = room.participants
          .map(p => (typeof p === 'object' && p !== null ? p._id || p : p).toString())
          .sort()
          .join('-');
        if (seen.has(key)) return false;
        seen.add(key);
      } else {
        if (seen.has(room._id)) return false;
        seen.add(room._id);
      }
      return true;
    });
  }, []);

  // Local storage for starred messages
  const [starredMessages, setStarredMessages] = useState(() => {
    try {
      const stored = localStorage.getItem(`starred_messages_${user?._id}`);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(`starred_messages_${user._id}`, JSON.stringify(starredMessages));
    }
  }, [starredMessages, user]);

  // Phase 4 Personalization States
  const [readReceipts, setReadReceipts] = useState(() => {
    return localStorage.getItem('pref_read_receipts') !== 'false';
  });

  const [typingIndicators, setTypingIndicators] = useState(() => {
    return localStorage.getItem('pref_typing_indicators') !== 'false';
  });

  const [blockedUsers, setBlockedUsers] = useState(() => {
    try {
      const stored = localStorage.getItem(`pref_blocked_users_${user?._id}`);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  const [accentColor, setAccentColor] = useState(() => {
    return localStorage.getItem(`pref_accent_color_${user?._id}`) || '#FF6A00';
  });

  const [chatBubbleColor, setChatBubbleColor] = useState(() => {
    return localStorage.getItem(`pref_bubble_color_${user?._id}`) || '#16A34A';
  });

  const [chatIncomingBubbleColor, setChatIncomingBubbleColor] = useState(() => {
    return localStorage.getItem(`pref_incoming_bubble_color_${user?._id}`) || 'light-gray';
  });

  const [chatWallpaper, setChatWallpaper] = useState(() => {
    return localStorage.getItem(`pref_chat_wallpaper_${user?._id}`) || 'default';
  });

  const [chatTextSize, setChatTextSize] = useState(() => {
    return localStorage.getItem(`pref_chat_text_size_${user?._id}`) || 'medium';
  });

  const [highContrast, setHighContrast] = useState(() => {
    return localStorage.getItem(`pref_high_contrast_${user?._id}`) === 'true';
  });

  // Sync state when switching accounts or user changes
  useEffect(() => {
    if (user) {
      // Stars
      try {
        const storedStars = localStorage.getItem(`starred_messages_${user._id}`);
        setStarredMessages(storedStars ? JSON.parse(storedStars) : []);
      } catch (e) {
        setStarredMessages([]);
      }
      // Blocked
      try {
        const storedBlocked = localStorage.getItem(`pref_blocked_users_${user._id}`);
        setBlockedUsers(storedBlocked ? JSON.parse(storedBlocked) : []);
      } catch (e) {
        setBlockedUsers([]);
      }
      // Preferences
      setAccentColor(localStorage.getItem(`pref_accent_color_${user._id}`) || '#FF6A00');
      setChatBubbleColor(localStorage.getItem(`pref_bubble_color_${user._id}`) || '#16A34A');
      setChatIncomingBubbleColor(localStorage.getItem(`pref_incoming_bubble_color_${user._id}`) || 'light-gray');
      setChatWallpaper(localStorage.getItem(`pref_chat_wallpaper_${user._id}`) || 'default');
      setChatTextSize(localStorage.getItem(`pref_chat_text_size_${user._id}`) || 'medium');
      setHighContrast(localStorage.getItem(`pref_high_contrast_${user._id}`) === 'true');
    } else {
      setStarredMessages([]);
      setBlockedUsers([]);
      setAccentColor('#FF6A00');
      setChatBubbleColor('#16A34A');
      setChatIncomingBubbleColor('light-gray');
      setChatWallpaper('default');
      setChatTextSize('medium');
      setHighContrast(false);
    }
  }, [user]);

  const getHoverColor = (hex) => {
    const mapping = {
      '#FF6A00': '#FF8A00', // Orange
      '#2563EB': '#3B82F6', // Blue
      '#10B981': '#34D399', // Green
      '#8B5CF6': '#A78BFA', // Purple
      '#EC4899': '#F472B6', // Pink
    };
    return mapping[hex] || hex;
  };

  // Apply personalization styles dynamically
  useEffect(() => {
    if (!user) return;
    const root = document.documentElement;

    // Accent Color
    root.style.setProperty('--orange', accentColor);
    root.style.setProperty('--orange-light', getHoverColor(accentColor));

    // Chat Bubble Color
    root.style.setProperty('--bubble-mine', chatBubbleColor);

    // Chat Incoming Bubble Color
    const incomingPreset = incomingBubbleColorPresets[chatIncomingBubbleColor] || incomingBubbleColorPresets['light-gray'];
    if (isDark) {
      root.style.setProperty('--bubble-theirs', incomingPreset.darkBg);
      root.style.setProperty('--bubble-theirs-text', incomingPreset.darkText);
    } else {
      root.style.setProperty('--bubble-theirs', incomingPreset.lightBg);
      root.style.setProperty('--bubble-theirs-text', incomingPreset.lightText);
    }

    // Chat Wallpaper
    if (chatWallpaper === 'default') {
      root.style.removeProperty('--chat-wallpaper');
    } else {
      root.style.setProperty('--chat-wallpaper', chatWallpaper);
    }

    // Text Size
    let pxSize = '14px';
    if (chatTextSize === 'small') pxSize = '12px';
    else if (chatTextSize === 'large') pxSize = '16px';
    else if (chatTextSize === 'xlarge') pxSize = '18px';
    root.style.setProperty('--chat-text-size', pxSize);

    // High Contrast Mode
    if (highContrast) {
      root.classList.add('high-contrast');
      root.style.setProperty('--text-primary', '#FFFFFF');
      root.style.setProperty('--text-secondary', '#FFFFFF');
      root.style.setProperty('--border', '#FFFFFF');
    } else {
      root.classList.remove('high-contrast');
      root.style.removeProperty('--text-primary');
      root.style.removeProperty('--text-secondary');
      root.style.removeProperty('--border');
    }
  }, [user, accentColor, chatBubbleColor, chatIncomingBubbleColor, chatWallpaper, chatTextSize, highContrast, isDark]);

  const messages = useMemo(() => {
    return processMessageTimeline(rawMessages);
  }, [rawMessages]);


  // Real-time Presence, Reconnection & Toast states
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [offlineBanner, setOfflineBanner] = useState(false);
  const [toast, setToast] = useState(null); // { avatar, name, messageText, roomId }
  const [apiError, setApiError] = useState(null); // Global red alert error text

  // Refs to access current state in asynchronous socket event handlers
  const activeRoomRef = useRef(null);
  const roomsRef = useRef([]);
  const toastTimeoutRef = useRef(null);
  const offlineTimeoutRef = useRef(null);
  const apiErrorTimeoutRef = useRef(null);
  const onlineUsersRef = useRef(onlineUsers);
  const clientTypingTimeoutsRef = useRef({});
  const activeAbortControllerRef = useRef(null);

  useEffect(() => {
    onlineUsersRef.current = onlineUsers;
  }, [onlineUsers]);

  useEffect(() => {
    setRooms(prev => prev.map(room => {
      const updatedParticipants = room.participants.map(p => {
        const isOnline = onlineUsers.has(p._id.toString());
        if (p.isOnline !== isOnline) {
          return { ...p, isOnline };
        }
        return p;
      });
      const changed = updatedParticipants.some((p, i) => p.isOnline !== room.participants[i].isOnline);
      return changed ? { ...room, participants: updatedParticipants } : room;
    }));

    setUsers(prev => prev.map(u => {
      const isOnline = onlineUsers.has(u._id.toString());
      if (u.isOnline !== isOnline) {
        return { ...u, isOnline };
      }
      return u;
    }));
  }, [onlineUsers]);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    Object.values(clientTypingTimeoutsRef.current).forEach(clearTimeout);
    clientTypingTimeoutsRef.current = {};
  }, [activeRoom]);

  // Synchronize activeRoom with updated data from rooms list (presence, last message, status ticks)
  useEffect(() => {
    if (activeRoom) {
      const updatedRoom = rooms.find(r => r._id === activeRoom._id);
      if (updatedRoom) {
        const participantsChanged = updatedRoom.participants.some((p, idx) => {
          const prevP = activeRoom.participants[idx];
          return !prevP || p.isOnline !== prevP.isOnline || p.lastSeen !== prevP.lastSeen;
        });
        const lastMsgChanged = updatedRoom.lastMessage?._id !== activeRoom.lastMessage?._id ||
                             updatedRoom.lastMessage?.status !== activeRoom.lastMessage?.status;
        const nameChanged = updatedRoom.groupName !== activeRoom.groupName || updatedRoom.groupAvatar !== activeRoom.groupAvatar;
        const unreadChanged = updatedRoom.unreadCount !== activeRoom.unreadCount;

        if (participantsChanged || lastMsgChanged || nameChanged || unreadChanged) {
          setActiveRoom(updatedRoom);
        }
      }
    }
  }, [rooms, activeRoom]);

  // Automatic Background state synchronization
  const synchronizeState = useCallback(async () => {
    if (!user) return;
    console.log('Running automatic background state synchronization...');
    try {
      await Promise.all([
        getRooms().then(response => {
          if (response.success) {
            const updatedRooms = response.data.map(room => ({
              ...room,
              participants: room.participants.map(p => ({
                ...p,
                isOnline: onlineUsersRef.current.has(p._id.toString())
              }))
            }));
            setRooms(deduplicateRooms(updatedRooms));
          }
        }),
        getAllUsers().then(response => {
          if (response.success) {
            const updatedUsers = response.data.map(u => ({
              ...u,
              isOnline: onlineUsersRef.current.has(u._id.toString())
            }));
            setUsers(updatedUsers);
          }
        }),
        getFriendRequests().then(response => {
          if (response.success) {
            setFriendRequests({
              incoming: response.incoming || [],
              outgoing: response.outgoing || []
            });
          }
        }),
        getCalls().then(response => {
          if (response.success) {
            setCalls(response.data);
          }
        })
      ]);

      const currentActiveRoom = activeRoomRef.current;
      if (currentActiveRoom) {
        await fetchMessages(currentActiveRoom._id, null, true);

        if (socket && socket.connected) {
          socket.emit('room:join', { roomId: currentActiveRoom._id }, (ack) => {
            if (!ack || !ack.success) console.warn('room:join ack failed on sync');
          });
          const readReceiptsOn = localStorage.getItem('pref_read_receipts') !== 'false';
          if (readReceiptsOn) {
            socket.emit('message:read', { roomId: currentActiveRoom._id }, (ack) => {
              if (!ack || !ack.success) console.warn('message:read ack failed on sync');
            });
          }
        }
      }
    } catch (err) {
      console.error('Background synchronization failed:', err);
    }
  }, [user, socket, deduplicateRooms]);

  useEffect(() => {
    if (!user) return;

    const handleWindowFocus = () => {
      synchronizeState();
    };

    const handleWindowOnline = () => {
      if (socket && !socket.connected) {
        socket.connect();
      }
      synchronizeState();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        synchronizeState();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleWindowOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleWindowOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, socket, synchronizeState]);

  // Request browser push notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Update browser tab title based on total unread message count
  useEffect(() => {
    const totalUnread = rooms.reduce((sum, r) => sum + (r.unreadCount || 0), 0);
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) Echo Connect`;
    } else {
      document.title = 'Echo Connect';
    }
  }, [rooms]);

  // Handle 10-second offline banner timer
  useEffect(() => {
    if (isReconnecting) {
      offlineTimeoutRef.current = setTimeout(() => {
        setOfflineBanner(true);
      }, 10000);
    } else {
      if (offlineTimeoutRef.current) clearTimeout(offlineTimeoutRef.current);
      setOfflineBanner(false);
    }
    return () => {
      if (offlineTimeoutRef.current) clearTimeout(offlineTimeoutRef.current);
    };
  }, [isReconnecting]);

  // Utility to fire a standard API error toast
  const triggerApiError = (msg = 'Something went wrong. Try again.') => {
    addToast(msg, 'error');
  };

  // 1. Fetch Room List
  const fetchRooms = useCallback(async () => {
    if (!user) return;
    setLoadingRooms(true);
    try {
      const response = await getRooms();
      if (response.success) {
        const updatedRooms = response.data.map(room => {
          const updatedParticipants = room.participants.map(p => ({
            ...p,
            isOnline: onlineUsersRef.current.has(p._id.toString())
          }));
          return { ...room, participants: updatedParticipants };
        });
        setRooms(deduplicateRooms(updatedRooms));

        // Proactively emit delivered status for unread messages sent by others
        if (socket && socket.connected) {
          updatedRooms.forEach(room => {
            if (room.lastMessage) {
              const lastMsg = room.lastMessage;
              const senderIdStr = lastMsg.senderId?._id || lastMsg.senderId;
              if (senderIdStr !== user._id && lastMsg.status === 'sent') {
                socket.emit('message:delivered', { messageId: lastMsg._id, roomId: room._id });
              }
            }
          });
        }
      }
    } catch (err) {
      console.error('Error fetching rooms:', err.message);
      triggerApiError();
    } finally {
      setLoadingRooms(false);
    }
  }, [user, socket, deduplicateRooms]);

  // 2. Fetch User Directory
  const fetchUsers = useCallback(async () => {
    if (!user) return;
    try {
      const response = await getAllUsers();
      if (response.success) {
        const updatedUsers = response.data.map(u => ({
          ...u,
          isOnline: onlineUsersRef.current.has(u._id.toString())
        }));
        setUsers(updatedUsers);
      }
    } catch (err) {
      console.error('Error fetching user directory:', err.message);
      triggerApiError();
    }
  }, [user]);

  // 2.5. Fetch Friend Requests
  const fetchFriendRequests = useCallback(async () => {
    if (!user) return;
    try {
      const response = await getFriendRequests();
      if (response.success) {
        setFriendRequests({
          incoming: response.incoming || [],
          outgoing: response.outgoing || []
        });
      }
    } catch (err) {
      console.error('Error fetching friend requests:', err.message);
    }
  }, [user]);

  const sendRequest = async (receiverId) => {
    try {
      const response = await sendFriendRequest(receiverId);
      if (response.success) {
        setFriendRequests(prev => ({
          ...prev,
          outgoing: [response.data, ...prev.outgoing.filter(r => r._id !== response.data._id)]
        }));
        addToast('Friend request sent!', 'success');
        return response;
      }
    } catch (err) {
      console.error('Error sending friend request:', err.message);
      addToast(err.response?.data?.message || 'Failed to send friend request', 'error');
      throw err;
    }
  };

  const acceptRequest = async (requestId) => {
    try {
      const response = await acceptFriendRequest(requestId);
      if (response.success) {
        setFriendRequests(prev => ({
          incoming: prev.incoming.filter(r => r._id !== requestId),
          outgoing: prev.outgoing.filter(r => r._id !== requestId)
        }));
        fetchUsers();
        fetchRooms();
        addToast('Friend request accepted!', 'success');
        return response;
      }
    } catch (err) {
      console.error('Error accepting friend request:', err.message);
      addToast(err.response?.data?.message || 'Failed to accept request', 'error');
      throw err;
    }
  };

  const declineRequest = async (requestId) => {
    try {
      const response = await declineFriendRequest(requestId);
      if (response.success) {
        setFriendRequests(prev => ({
          incoming: prev.incoming.filter(r => r._id !== requestId),
          outgoing: prev.outgoing.filter(r => r._id !== requestId)
        }));
        addToast('Friend request declined', 'info');
        return response;
      }
    } catch (err) {
      console.error('Error declining friend request:', err.message);
      addToast(err.response?.data?.message || 'Failed to decline request', 'error');
      throw err;
    }
  };

  const fetchCalls = useCallback(async () => {
    if (!user) return;
    try {
      const response = await getCalls();
      if (response.success) {
        setCalls(response.data);
      }
    } catch (err) {
      console.error('Error fetching calls:', err.message);
    }
  }, [user]);

  // Load directories when user state changes
  useEffect(() => {
    if (user) {
      fetchRooms();
      fetchUsers();
      fetchFriendRequests();
      fetchCalls();
    } else {
      setRooms([]);
      setCalls([]);
      setActiveRoom(null);
      setRawMessages([]);
      setUsers([]);
      setFriendRequests({ incoming: [], outgoing: [] });
      setTypingUsers({});
      setHasMoreMessages(false);
      setNextCursor(null);
      setOnlineUsers(new Set());
      setIsReconnecting(false);
      setOfflineBanner(false);
      setToast(null);
      setApiError(null);
    }
  }, [user, fetchRooms, fetchUsers, fetchFriendRequests, fetchCalls]);

  // 3. Fetch messages for active room
  const fetchMessages = async (roomId, cursor = null, isBackground = false) => {
    // Abort previous request when switching rooms (loading initial room messages)
    if (!cursor) {
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }
      activeAbortControllerRef.current = new AbortController();
    }

    const currentSignal = !cursor ? activeAbortControllerRef.current.signal : null;

    if (cursor) {
      try {
        const response = await getRoomMessages(roomId, { cursor, limit: 20 });
        // Guard against race conditions
        if (activeRoomRef.current?._id !== roomId) return;
        if (response.success && response.data) {
          const { messages: fetchedMessages, pagination } = response.data;
          setRawMessages(prev => deduplicateAndSortMessages([...fetchedMessages, ...prev]));
          setHasMoreMessages(pagination.hasMore);
          setNextCursor(pagination.nextCursor);

          // Proactively mark loaded messages as delivered
          if (socket && socket.connected) {
            fetchedMessages.forEach(msg => {
              const senderIdStr = msg.senderId?._id || msg.senderId;
              if (senderIdStr !== user?._id && msg.status === 'sent') {
                socket.emit('message:delivered', { messageId: msg._id, roomId });
              }
            });
          }
        }
      } catch (err) {
        if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
          return;
        }
        console.error('Error fetching older messages:', err.message);
        triggerApiError();
      }
    } else {
      if (!isBackground) {
        setLoadingMessages(true);
      }
      try {
        const response = await getRoomMessages(roomId, { limit: 20 }, currentSignal);
        // Guard against race conditions
        if (activeRoomRef.current?._id !== roomId) return;
        if (response.success && response.data) {
          const { messages: fetchedMessages, pagination } = response.data;
          setRawMessages(deduplicateAndSortMessages(fetchedMessages));
          setHasMoreMessages(pagination.hasMore);
          setNextCursor(pagination.nextCursor);

          // Proactively mark loaded messages as delivered
          if (socket && socket.connected) {
            fetchedMessages.forEach(msg => {
              const senderIdStr = msg.senderId?._id || msg.senderId;
              if (senderIdStr !== user?._id && msg.status === 'sent') {
                socket.emit('message:delivered', { messageId: msg._id, roomId });
              }
            });
          }

          // Mark messages as read on the backend
          const readReceiptsOn = localStorage.getItem('pref_read_receipts') !== 'false';
          if (readReceiptsOn) {
            await markMessagesAsRead(roomId);
          }

          // Emit socket read receipt
          if (socket && socket.connected && readReceiptsOn) {
            socket.emit('message:read', { roomId }, (ack) => {
              if (!ack || !ack.success) console.warn('message:read ack failed');
            });
          }
        }
      } catch (err) {
        if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
          return;
        }
        console.error('Error fetching messages:', err.message);
        if (!isBackground) triggerApiError();
      } finally {
        if (activeRoomRef.current?._id === roomId) {
          setLoadingMessages(false);
        }
      }
    }
  };

  // 4. Paginate/load more messages
  const loadMoreMessages = () => {
    if (!activeRoom || !hasMoreMessages || !nextCursor || loadingMessages) return;
    fetchMessages(activeRoom._id, nextCursor);
  };

  // 5. Select Active Chat Room
  const selectRoom = (room) => {
    // Leave previous socket room and notify stopped typing
    if (socket && activeRoom) {
      socket.emit('room:leave', { roomId: activeRoom._id }, (ack) => {
        if (!ack || !ack.success) console.warn('room:leave ack failed');
      });
      socket.emit('typing:stop', { roomId: activeRoom._id }, (ack) => {
        if (!ack || !ack.success) console.warn('typing:stop ack failed');
      });
    }

    setActiveRoom(room);
    setRawMessages([]); // Clear messages immediately to avoid flashing previous room history
    setTypingUsers({});
    setHasMoreMessages(false);
    setNextCursor(null);

    if (room) {
      // Reset unread count in room list state immediately
      setRooms(prev => prev.map(r => r._id === room._id ? { ...r, unreadCount: 0 } : r));
      
      fetchMessages(room._id);
      
      const readReceiptsOn = localStorage.getItem('pref_read_receipts') !== 'false';
      if (socket && socket.connected) {
        socket.emit('room:join', { roomId: room._id }, (ack) => {
          if (!ack || !ack.success) console.warn('room:join ack failed');
        });
        if (readReceiptsOn) {
          socket.emit('message:read', { roomId: room._id }, (ack) => {
            if (!ack || !ack.success) console.warn('message:read ack failed');
          });
        }
      }
    }
  };

  // 6. Create Direct Message Room
  const createDM = async (targetUserId) => {
    try {
      const response = await apiCreatePrivateRoom(targetUserId);

      if (response.success) {
        const room = response.data;
        await fetchRooms();
        selectRoom(room);
        return room;
      }
    } catch (err) {
      console.error('Error creating private DM room:', err.message);
      triggerApiError();
    }
  };

  // 7. Create Group Room
  const createGroup = async (name, participantIds, avatar = '') => {
    try {
      const response = await apiCreateGroupRoom({
        name,
        participantIds,
        avatar
      });

      if (response.success) {
        const room = response.data;
        await fetchRooms();
        selectRoom(room);
        return room;
      }
    } catch (err) {
      console.error('Error creating group room:', err.message);
      triggerApiError();
    }
  };

  // 8. Leave Group Room
  const leaveGroupRoom = async (roomId) => {
    try {
      const response = await apiLeaveGroup(roomId);
      if (response.success) {
        if (activeRoom && activeRoom._id === roomId) {
          selectRoom(null);
        }
        await fetchRooms();
      }
    } catch (err) {
      console.error('Error leaving group:', err.message);
      triggerApiError();
    }
  };

  // 9. Add Member to Group
  const addMemberToGroup = async (roomId, userId) => {
    try {
      const response = await apiAddMember(roomId, userId);
      if (response.success) {
        if (activeRoom && activeRoom._id === roomId) {
          setActiveRoom(response.data);
        }
        setRooms(prev => prev.map(r => r._id === roomId ? response.data : r));
      }
    } catch (err) {
      console.error('Error adding member to group:', err.message);
      triggerApiError();
    }
  };

  // 10. Remove Member from Group
  const removeMemberFromGroup = async (roomId, userId) => {
    try {
      const response = await apiRemoveMember(roomId, userId);
      if (response.success) {
        if (activeRoom && activeRoom._id === roomId) {
          setActiveRoom(response.data);
        }
        setRooms(prev => prev.map(r => r._id === roomId ? response.data : r));
      }
    } catch (err) {
      console.error('Error removing member from group:', err.message);
      triggerApiError();
    }
  };

  // 11. Send Message
  const sendMessage = (content, mediaUrl = '', type = 'text') => {
    return new Promise((resolve, reject) => {
      const activeRoomId = activeRoomRef.current?._id;
      if (!activeRoomId) return reject(new Error('No active room selected'));

      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const optimisticMessage = {
        _id: tempId,
        roomId: activeRoomId,
        senderId: {
          _id: user._id,
          name: user.name,
          avatar: user.avatar,
          email: user.email
        },
        content,
        type,
        mediaUrl,
        status: 'sending',
        createdAt: new Date().toISOString(),
        seenBy: [user._id]
      };

      // Immediately append optimistic message
      setRawMessages(prev => deduplicateAndSortMessages([...prev, optimisticMessage]));

      // Immediately update sidebar room preview
      setRooms(prev => {
        const roomIdx = prev.findIndex(r => r._id === activeRoomId);
        if (roomIdx === -1) return prev;
        const updatedRooms = [...prev];
        updatedRooms[roomIdx] = {
          ...updatedRooms[roomIdx],
          lastMessage: optimisticMessage,
          updatedAt: optimisticMessage.createdAt
        };
        return updatedRooms.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      });

      const attempt = () => {
        if (!socket || !socket.connected) {
          console.warn(`Socket offline. Message queued in-memory for auto-retry when connection returns...`);
          const checkAndSend = () => {
            if (socket && socket.connected) {
              sendPayload();
            } else {
              setTimeout(checkAndSend, 1000);
            }
          };
          checkAndSend();
          return;
        }

        sendPayload();
      };

      const sendPayload = () => {
        const messagePayload = {
          roomId: activeRoomId,
          content,
          type,
          mediaUrl
        };

        socket.emit('message:send', messagePayload, (response) => {
          if (response && response.success) {
            const newMessage = response.message;
            setRawMessages(prev => prev.map(m => m._id === tempId ? newMessage : m));

            setRooms(prev => {
              const roomIdx = prev.findIndex(r => r._id === activeRoomId);
              if (roomIdx === -1) return prev;
              const updatedRooms = [...prev];
              updatedRooms[roomIdx] = {
                ...updatedRooms[roomIdx],
                lastMessage: newMessage,
                updatedAt: newMessage.createdAt
              };
              return updatedRooms.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            });
            resolve(newMessage);
          } else {
            // Structural validation or database schema error: Fail immediately
            setRawMessages(prev => prev.map(m => m._id === tempId ? { ...m, status: 'failed' } : m));
            triggerApiError('Failed to send message.');
            reject(new Error('Failed to send message'));
          }
        });
      };

      attempt();
    });
  };

  // 12. Upload File Attachment
  const uploadAttachmentFile = async (file) => {
    try {
      const response = await apiUploadAttachment(file);
      if (response.success) {
        return response.data;
      }
    } catch (err) {
      console.error('Error uploading file:', err.message);
      triggerApiError('File upload failed.');
      throw err;
    }
  };

  // 13. Delete Message (For me)
  const deleteMessageForMe = async (messageId) => {
    try {
      const response = await apiDeleteMessage(messageId);
      if (response.success) {
        setRawMessages(prev => prev.filter(msg => msg._id !== messageId));
        setRooms(prev => prev.map(room => {
          if (room.lastMessage?._id === messageId) {
            return {
              ...room,
              lastMessage: {
                ...room.lastMessage,
                content: 'This message was deleted'
              }
            };
          }
          return room;
        }));
      }
    } catch (err) {
      console.error('Error deleting message:', err.message);
      triggerApiError();
    }
  };

  // 13.2. Delete Message for Everyone (Control Message Sync)
  const sendDeleteForEveryone = async (messageId) => {
    const payload = {
      _echoType: 'delete_everyone',
      targetMessageId: messageId
    };
    return sendMessage(JSON.stringify(payload));
  };

  // 13.3. Star / Unstar Message
  const toggleStarMessage = (msgOrId) => {
    const msg = typeof msgOrId === 'string' 
      ? rawMessages.find(m => m._id === msgOrId) 
      : msgOrId;
    if (!msg) return;

    setStarredMessages(prev => {
      const exists = prev.some(m => m._id === msg._id);
      if (exists) {
        return prev.filter(m => m._id !== msg._id);
      } else {
        return [...prev, msg];
      }
    });
  };

  // 13.4. Send Pin / Unpin
  const sendPinMessage = async (messageId, action = 'pin') => {
    const payload = {
      _echoType: 'pin',
      targetMessageId: messageId,
      action
    };
    return sendMessage(JSON.stringify(payload));
  };

  // 13.5. Send Reaction
  const sendReaction = async (messageId, emoji, action = 'add') => {
    const payload = {
      _echoType: 'reaction',
      targetMessageId: messageId,
      emoji,
      action
    };
    return sendMessage(JSON.stringify(payload));
  };

  // 13.6. Send Reply
  const sendReplyMessage = async (content, replyToMessage) => {
    let snippet = replyToMessage.content || 'Attachment';
    if (snippet.startsWith('{"_echoType"')) {
      try {
        const parsed = JSON.parse(snippet);
        snippet = parsed.text || 'Attachment';
      } catch (e) {
        snippet = 'Attachment';
      }
    }
    const payload = {
      _echoType: 'reply',
      replyTo: replyToMessage._id,
      replyToName: replyToMessage.senderId?.name || 'User',
      replyToText: snippet,
      text: content
    };
    return sendMessage(JSON.stringify(payload));
  };

  // 13.7. Send Forward
  const sendForwardMessage = async (forwardedMsg, targetRoomId) => {
    let text = forwardedMsg.content;
    if (text && text.startsWith('{"_echoType"')) {
      try {
        const parsed = JSON.parse(text);
        if (parsed.text) text = parsed.text;
      } catch (e) {}
    }
    const payload = {
      _echoType: 'forward',
      text: text || '',
      mediaUrl: forwardedMsg.mediaUrl || '',
      type: forwardedMsg.type || 'text'
    };

    return new Promise((resolve, reject) => {
      if (!socket) return reject(new Error('Socket not connected'));
      const messagePayload = {
        roomId: targetRoomId,
        content: JSON.stringify(payload),
        type: forwardedMsg.type || 'text',
        mediaUrl: forwardedMsg.mediaUrl || ''
      };
      socket.emit('message:send', messagePayload, (response) => {
        if (response && response.success) {
          if (activeRoomRef.current?._id === targetRoomId) {
            setRawMessages(prev => deduplicateAndSortMessages([...prev, response.message]));
          }
          resolve(response.message);
        } else {
          reject(new Error('Failed to forward message'));
        }
      });
    });
  };

  // 14. Typing Indicators
  const sendTypingStart = () => {
    const typingOn = localStorage.getItem('pref_typing_indicators') !== 'false';
    if (!typingOn) return;
    if (socket && socket.connected && activeRoom) {
      socket.emit('typing:start', { roomId: activeRoom._id }, (ack) => {
        if (!ack || !ack.success) console.warn('typing:start ack failed');
      });
    }
  };

  const sendTypingStop = () => {
    const typingOn = localStorage.getItem('pref_typing_indicators') !== 'false';
    if (!typingOn) return;
    if (socket && socket.connected && activeRoom) {
      socket.emit('typing:stop', { roomId: activeRoom._id }, (ack) => {
        if (!ack || !ack.success) console.warn('typing:stop ack failed');
      });
    }
  };

  // Trigger browser push notifications & in-app custom toasts
  const triggerNotificationAndToast = (message) => {
    const currentActiveRoom = activeRoomRef.current;
    if (currentActiveRoom && message.roomId === currentActiveRoom._id) return; // ignore if open

    const senderName = message.senderId?.name || 'New Message';
    let bodyText = message.content || 'Sent an attachment file';
    if (bodyText.startsWith('{"_echoType"')) {
      try {
        const parsed = JSON.parse(bodyText);
        if (parsed._echoType === 'reply') bodyText = parsed.text;
        else if (parsed._echoType === 'forward') bodyText = parsed.text || 'Forwarded attachment';
        else if (parsed._echoType === 'call') {
          const typeLabel = parsed.callType === 'video' ? 'Video' : 'Voice';
          const statusText = parsed.callStatus === 'completed' ? 'Completed' : parsed.callStatus === 'missed' ? 'Missed' : parsed.callStatus === 'rejected' ? 'Rejected' : 'Missed';
          bodyText = `${typeLabel} Call (${statusText})`;
        } else return; // Ignore control messages from toasts
      } catch (e) {}
    }
    const avatar = message.senderId?.avatar || '';

    // A. Show Premium In-App Toast
    addToast(`${senderName}: ${bodyText}`, 'info');

    // B. Show Browser Push Notification (only if tab is hidden/unfocused)
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(senderName, {
        body: bodyText,
        icon: avatar || '/favicon.ico'
      });

      notification.onclick = () => {
        window.focus();
        const targetRoom = roomsRef.current.find(r => r._id === message.roomId);
        if (targetRoom) {
          selectRoom(targetRoom);
        }
      };
    }
  };

  // 15. WebSocket Event Listeners
  useEffect(() => {
    if (!socket || !user) return;

    // Emit presence on load/auth success
    socket.emit('user:online', { userId: user._id }, (ack) => {
      if (!ack || !ack.success) console.warn('user:online ack failed');
    });
    socket.emit('presence:online', { userId: user._id }, (ack) => {
      if (!ack || !ack.success) console.warn('presence:online ack failed');
    });

    // A. Receive message
    const handleReceiveMessage = (message) => {
      const currentActiveRoom = activeRoomRef.current;
      const blockedList = JSON.parse(localStorage.getItem(`pref_blocked_users_${user?._id}`) || '[]');
      if (message.senderId && blockedList.includes(message.senderId._id)) {
        return;
      }

      // Handle control messages
      if (message.content && message.content.startsWith('{"_echoType"')) {
        try {
          const parsed = JSON.parse(message.content);
          if (parsed._echoType === 'reaction' || parsed._echoType === 'pin' || parsed._echoType === 'delete_everyone') {
            if (currentActiveRoom && message.roomId === currentActiveRoom._id) {
              setRawMessages(prev => deduplicateAndSortMessages([...prev, message]));
            }
            return;
          }
        } catch (e) {}
      }

      // Append to active message log if in active room
      if (currentActiveRoom && message.roomId === currentActiveRoom._id) {
        setRawMessages(prev => deduplicateAndSortMessages([...prev, message]));
        
        // Mark as read immediately on active room messages from other users
        const readReceiptsOn = localStorage.getItem('pref_read_receipts') !== 'false';
        if (message.senderId?._id !== user._id && readReceiptsOn) {
          socket.emit('message:read', { roomId: currentActiveRoom._id }, (ack) => {
            if (!ack || !ack.success) console.warn('message:read ack failed');
          });
          markMessagesAsRead(currentActiveRoom._id).catch(err => console.error(err));
        }
      }

      // Update room lastMessage reference & unread counts, move to top
      setRooms(prevRooms => {
        const roomIdx = prevRooms.findIndex(r => r._id === message.roomId);
        if (roomIdx === -1) {
          fetchRooms(); // fetch rooms if new DM started externally
          return prevRooms;
        }

        const updatedRooms = [...prevRooms];
        const isCurrentlyOpen = currentActiveRoom && currentActiveRoom._id === message.roomId;

        updatedRooms[roomIdx] = {
          ...updatedRooms[roomIdx],
          lastMessage: message,
          unreadCount: isCurrentlyOpen 
            ? 0 
            : (updatedRooms[roomIdx].unreadCount || 0) + 1,
          updatedAt: new Date().toISOString()
        };

        return deduplicateRooms(updatedRooms).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      });

      // Send delivered receipt if message is newly received and sent by others
      if (message.senderId?._id !== user._id && message.status === 'sent') {
        socket.emit('message:delivered', { messageId: message._id, roomId: message.roomId }, (ack) => {
          if (!ack || !ack.success) console.warn('message:delivered ack failed');
        });
      }

      // Trigger alerts if message was sent by someone else
      if (message.senderId?._id !== user._id) {
        triggerNotificationAndToast(message);
      }
    };

    // B. Presence online
    const handlePresenceOnline = ({ userId: onlineId }) => {
      setOnlineUsers(prev => {
        const copy = new Set(prev);
        copy.add(onlineId);
        return copy;
      });

      setRooms(prev => prev.map(room => {
        const updatedParticipants = room.participants.map(p => {
          if (p._id === onlineId) {
            return { ...p, isOnline: true };
          }
          return p;
        });
        return { ...room, participants: updatedParticipants };
      }));

      setUsers(prev => prev.map(u => {
        if (u._id === onlineId) {
          return { ...u, isOnline: true };
        }
        return u;
      }));
    };

    // C. Presence offline
    const handlePresenceOffline = ({ userId: offlineId, lastSeen }) => {
      setOnlineUsers(prev => {
        const copy = new Set(prev);
        copy.delete(offlineId);
        return copy;
      });

      setRooms(prev => prev.map(room => {
        const updatedParticipants = room.participants.map(p => {
          if (p._id === offlineId) {
            return { ...p, isOnline: false, lastSeen };
          }
          return p;
        });
        return { ...room, participants: updatedParticipants };
      }));

      setUsers(prev => prev.map(u => {
        if (u._id === offlineId) {
          return { ...u, isOnline: false, lastSeen };
        }
        return u;
      }));
    };

    // D. Message status update (delivered)
    const handleStatusUpdate = ({ messageId, roomId, status }) => {
      const currentActiveRoom = activeRoomRef.current;
      if (currentActiveRoom && roomId === currentActiveRoom._id) {
        setRawMessages(prev => prev.map(msg => {
          if (msg._id === messageId) {
            return { ...msg, status };
          }
          return msg;
        }));
      }

      setRooms(prev => prev.map(room => {
        if (room._id === roomId && room.lastMessage?._id === messageId) {
          return {
            ...room,
            lastMessage: { ...room.lastMessage, status }
          };
        }
        return room;
      }));
    };

    // E. Read receipt status update (seen)
    const handleReadReceipt = ({ roomId, userId: readerId }) => {
      const currentActiveRoom = activeRoomRef.current;
      if (currentActiveRoom && roomId === currentActiveRoom._id) {
        setRawMessages(prev => prev.map(msg => {
          if (msg.senderId?._id !== readerId && !msg.seenBy.includes(readerId)) {
            return {
              ...msg,
              seenBy: [...msg.seenBy, readerId],
              status: 'seen'
            };
          }
          return msg;
        }));
      }

      setRooms(prev => prev.map(room => {
        if (room._id === roomId) {
          const isCurrentUser = readerId === user?._id;
          let updatedLastMessage = room.lastMessage;
          if (room.lastMessage) {
            const isMsgSentByReader = (room.lastMessage.senderId?._id || room.lastMessage.senderId) === readerId;
            if (!isMsgSentByReader) {
              const updatedSeenBy = Array.from(new Set([...(room.lastMessage.seenBy || []), readerId]));
              updatedLastMessage = {
                ...room.lastMessage,
                seenBy: updatedSeenBy,
                status: 'seen'
              };
            }
          }
          return {
            ...room,
            unreadCount: isCurrentUser ? 0 : room.unreadCount,
            lastMessage: updatedLastMessage
          };
        }
        return room;
      }));
    };

    // F. Typing indicator start
    const handleTypingStart = ({ roomId, userId: typerId, name }) => {
      const blockedList = JSON.parse(localStorage.getItem(`pref_blocked_users_${user?._id}`) || '[]');
      if (blockedList.includes(typerId)) return;

      const currentActiveRoom = activeRoomRef.current;
      if (currentActiveRoom && roomId === currentActiveRoom._id && typerId !== user._id) {
        setTypingUsers(prev => ({
          ...prev,
          [typerId]: name
        }));

        if (clientTypingTimeoutsRef.current[typerId]) {
          clearTimeout(clientTypingTimeoutsRef.current[typerId]);
        }

        // Auto-remove typing indicator after 5 seconds of inactivity
        clientTypingTimeoutsRef.current[typerId] = setTimeout(() => {
          setTypingUsers(prev => {
            const updated = { ...prev };
            delete updated[typerId];
            return updated;
          });
          delete clientTypingTimeoutsRef.current[typerId];
        }, 5000);
      }
    };

    // G. Typing indicator stop
    const handleTypingStop = ({ roomId, userId: typerId }) => {
      const currentActiveRoom = activeRoomRef.current;
      if (currentActiveRoom && roomId === currentActiveRoom._id) {
        setTypingUsers(prev => {
          const updated = { ...prev };
          delete updated[typerId];
          return updated;
        });

        if (clientTypingTimeoutsRef.current[typerId]) {
          clearTimeout(clientTypingTimeoutsRef.current[typerId]);
          delete clientTypingTimeoutsRef.current[typerId];
        }
      }
    };

    // Connection handlers for Reconnection States
    const handleConnect = () => {
      setIsReconnecting(false);

      // Re-emit online status
      socket.emit('user:online', { userId: user._id }, (ack) => {
        if (!ack || !ack.success) console.warn('user:online ack failed');
      });
      socket.emit('presence:online', { userId: user._id }, (ack) => {
        if (!ack || !ack.success) console.warn('presence:online ack failed');
      });

      // Synchronize all room previews, lastMessages, and unread counts upon reconnection
      fetchRooms().catch(err => console.error('Error fetching rooms on reconnect:', err));
      fetchCalls().catch(err => console.error('Error fetching calls on reconnect:', err));

      const currentActiveRoom = activeRoomRef.current;
      if (currentActiveRoom) {
        fetchMessages(currentActiveRoom._id);
        socket.emit('room:join', { roomId: currentActiveRoom._id }, (ack) => {
          if (!ack || !ack.success) console.warn('room:join ack failed');
        });
        const readReceiptsOn = localStorage.getItem('pref_read_receipts') !== 'false';
        if (readReceiptsOn) {
          socket.emit('message:read', { roomId: currentActiveRoom._id }, (ack) => {
            if (!ack || !ack.success) console.warn('message:read ack failed');
          });
        }
      }
    };

    const handleDisconnect = (reason) => {
      if (reason === 'io server disconnect' || reason === 'transport close') {
        setIsReconnecting(true);
      }
      setTypingUsers({});
      Object.values(clientTypingTimeoutsRef.current).forEach(clearTimeout);
      clientTypingTimeoutsRef.current = {};
    };

    const handleReconnectAttempt = () => {
      setIsReconnecting(true);
    };

    const handlePresenceInitial = ({ onlineIds }) => {
      setOnlineUsers(new Set(onlineIds));
    };

    const handleFriendRequestReceived = (request) => {
      setFriendRequests(prev => ({
        ...prev,
        incoming: [request, ...prev.incoming.filter(r => r._id !== request._id)]
      }));
      addToast(`New friend request from ${request.sender.name}!`, 'info');
    };

    const handleFriendRequestSent = (request) => {
      setFriendRequests(prev => ({
        ...prev,
        outgoing: [request, ...prev.outgoing.filter(r => r._id !== request._id)]
      }));
    };

    const handleFriendRequestAccepted = (request) => {
      setFriendRequests(prev => ({
        incoming: prev.incoming.filter(r => r._id !== request._id),
        outgoing: prev.outgoing.filter(r => r._id !== request._id)
      }));
      fetchUsers();
      fetchRooms();
      const isSender = request.sender._id === user._id;
      const otherUser = isSender ? request.receiver : request.sender;
      addToast(`You and ${otherUser.name} are now contacts!`, 'success');
    };

    const handleFriendRequestDeclined = (request) => {
      setFriendRequests(prev => ({
        incoming: prev.incoming.filter(r => r._id !== request._id),
        outgoing: prev.outgoing.filter(r => r._id !== request._id)
      }));
    };

    const handleCallLogged = () => {
      fetchCalls();
    };

    // Bind event hooks
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnect_attempt', handleReconnectAttempt);

    socket.on('message:receive', handleReceiveMessage);
    socket.on('message:new', handleReceiveMessage);
    socket.on('presence:initial', handlePresenceInitial);
    socket.on('presence:online', handlePresenceOnline);
    socket.on('presence:offline', handlePresenceOffline);
    socket.on('user:online', handlePresenceOnline);
    socket.on('user:offline', handlePresenceOffline);
    socket.on('message:status_update', handleStatusUpdate);
    socket.on('message:read_receipt', handleReadReceipt);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);

    socket.on('friend_request:received', handleFriendRequestReceived);
    socket.on('friend_request:sent', handleFriendRequestSent);
    socket.on('friend_request:accepted', handleFriendRequestAccepted);
    socket.on('friend_request:declined', handleFriendRequestDeclined);
    socket.on('call:logged', handleCallLogged);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect_attempt', handleReconnectAttempt);

      socket.off('message:receive', handleReceiveMessage);
      socket.off('message:new', handleReceiveMessage);
      socket.off('presence:initial', handlePresenceInitial);
      socket.off('presence:online', handlePresenceOnline);
      socket.off('presence:offline', handlePresenceOffline);
      socket.off('user:online', handlePresenceOnline);
      socket.off('user:offline', handlePresenceOffline);
      socket.off('message:status_update', handleStatusUpdate);
      socket.off('message:read_receipt', handleReadReceipt);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);

      socket.off('friend_request:received', handleFriendRequestReceived);
      socket.off('friend_request:sent', handleFriendRequestSent);
      socket.off('friend_request:accepted', handleFriendRequestAccepted);
      socket.off('friend_request:declined', handleFriendRequestDeclined);
      socket.off('call:logged', handleCallLogged);

      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (apiErrorTimeoutRef.current) clearTimeout(apiErrorTimeoutRef.current);
    };
  }, [socket, user, fetchRooms, fetchCalls]);

  const toggleReadReceipts = () => {
    setReadReceipts(prev => {
      const next = !prev;
      localStorage.setItem('pref_read_receipts', next.toString());
      addToast(`Read receipts ${next ? 'enabled' : 'disabled'}`, 'info');
      return next;
    });
  };

  const toggleTypingIndicators = () => {
    setTypingIndicators(prev => {
      const next = !prev;
      localStorage.setItem('pref_typing_indicators', next.toString());
      addToast(`Typing indicators ${next ? 'enabled' : 'disabled'}`, 'info');
      return next;
    });
  };

  const toggleBlockUser = (targetUserId) => {
    setBlockedUsers(prev => {
      let next;
      if (prev.includes(targetUserId)) {
        next = prev.filter(id => id !== targetUserId);
        addToast('Contact unblocked successfully', 'success');
      } else {
        next = [...prev, targetUserId];
        addToast('Contact blocked successfully', 'warning');
      }
      localStorage.setItem(`pref_blocked_users_${user?._id}`, JSON.stringify(next));
      return next;
    });
  };

  const updateAccentColor = (color) => {
    setAccentColor(color);
    localStorage.setItem(`pref_accent_color_${user?._id}`, color);
    addToast('Accent color updated', 'success');
  };

  const updateChatBubbleColor = (color) => {
    setChatBubbleColor(color);
    localStorage.setItem(`pref_bubble_color_${user?._id}`, color);
    addToast('Chat bubble color updated', 'success');
  };

  const updateChatIncomingBubbleColor = (color) => {
    setChatIncomingBubbleColor(color);
    localStorage.setItem(`pref_incoming_bubble_color_${user?._id}`, color);
    addToast('Incoming message color updated', 'success');
  };

  const updateChatWallpaper = (wallpaper) => {
    setChatWallpaper(wallpaper);
    localStorage.setItem(`pref_chat_wallpaper_${user?._id}`, wallpaper);
    addToast('Chat wallpaper updated', 'success');
  };

  const updateChatTextSize = (size) => {
    setChatTextSize(size);
    localStorage.setItem(`pref_chat_text_size_${user?._id}`, size);
    addToast(`Text size set to ${size}`, 'info');
  };

  const toggleHighContrast = () => {
    setHighContrast(prev => {
      const next = !prev;
      localStorage.setItem(`pref_high_contrast_${user?._id}`, next.toString());
      addToast(`High contrast mode ${next ? 'enabled' : 'disabled'}`, 'info');
      return next;
    });
  };

  return (
    <ChatContext.Provider value={{
      rooms,
      activeRoom,
      messages,
      rawMessages,
      starredMessages,
      users,
      typingUsers,
      loadingRooms,
      loadingMessages,
      hasMoreMessages,
      onlineUsers,
      isReconnecting,
      offlineBanner,
      toast,
      setToast,
      apiError,
      setApiError,
      selectRoom,
      createDM,
      createGroup,
      leaveGroupRoom,
      addMemberToGroup,
      removeMemberFromGroup,
      sendMessage,
      uploadAttachmentFile,
      deleteMessageForMe,
      sendDeleteForEveryone,
      toggleStarMessage,
      sendPinMessage,
      sendReaction,
      sendReplyMessage,
      sendForwardMessage,
      sendTypingStart,
      sendTypingStop,
      loadMoreMessages,
      fetchRooms,
      fetchUsers,
      friendRequests,
      fetchFriendRequests,
      sendRequest,
      acceptRequest,
      declineRequest,
      calls,
      fetchCalls,

      // Phase 4 Settings & Personalization Exports
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
      toggleHighContrast
    }}>
      {children}
    </ChatContext.Provider>
  );
};
