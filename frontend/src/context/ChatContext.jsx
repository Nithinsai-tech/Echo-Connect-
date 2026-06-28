import React, { createContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './ToastContext';
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
  removeGroupMember as apiRemoveMember
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

export const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
  const socket = useSocket();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [rawMessages, setRawMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({}); // { [userId]: username }
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);

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

  const [chatWallpaper, setChatWallpaper] = useState(() => {
    return localStorage.getItem(`pref_chat_wallpaper_${user?._id}`) || 'default';
  });

  const [chatTextSize, setChatTextSize] = useState(() => {
    return localStorage.getItem(`pref_chat_text_size_${user?._id}`) || 'medium';
  });

  const [highContrast, setHighContrast] = useState(() => {
    return localStorage.getItem(`pref_high_contrast_${user?._id}`) === 'true';
  });

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
  }, [user, accentColor, chatBubbleColor, chatWallpaper, chatTextSize, highContrast]);

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

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

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
        setRooms(response.data);
      }
    } catch (err) {
      console.error('Error fetching rooms:', err.message);
      triggerApiError();
    } finally {
      setLoadingRooms(false);
    }
  }, [user]);

  // 2. Fetch User Directory
  const fetchUsers = useCallback(async () => {
    if (!user) return;
    try {
      const response = await getAllUsers();
      if (response.success) {
        setUsers(response.data);
      }
    } catch (err) {
      console.error('Error fetching user directory:', err.message);
      triggerApiError();
    }
  }, [user]);

  // Load directories when user state changes
  useEffect(() => {
    if (user) {
      fetchRooms();
      fetchUsers();
    } else {
      setRooms([]);
      setActiveRoom(null);
      setRawMessages([]);
      setUsers([]);
      setTypingUsers({});
      setHasMoreMessages(false);
      setNextCursor(null);
      setOnlineUsers(new Set());
      setIsReconnecting(false);
      setOfflineBanner(false);
      setToast(null);
      setApiError(null);
    }
  }, [user, fetchRooms, fetchUsers]);

  // 3. Fetch messages for active room
  const fetchMessages = async (roomId, cursor = null) => {
    if (cursor) {
      try {
        const response = await getRoomMessages(roomId, { cursor, limit: 20 });
        if (response.success && response.data) {
          const { messages: fetchedMessages, pagination } = response.data;
          setRawMessages(prev => [...fetchedMessages, ...prev]);
          setHasMoreMessages(pagination.hasMore);
          setNextCursor(pagination.nextCursor);
        }
      } catch (err) {
        console.error('Error fetching older messages:', err.message);
        triggerApiError();
      }
    } else {
      setLoadingMessages(true);
      try {
        const response = await getRoomMessages(roomId, { limit: 20 });
        if (response.success && response.data) {
          const { messages: fetchedMessages, pagination } = response.data;
          setRawMessages(fetchedMessages);
          setHasMoreMessages(pagination.hasMore);
          setNextCursor(pagination.nextCursor);

          // Mark messages as read on the backend
          const readReceiptsOn = localStorage.getItem('pref_read_receipts') !== 'false';
          if (readReceiptsOn) {
            await markMessagesAsRead(roomId);
          }

          // Emit socket read receipt
          if (socket && readReceiptsOn) {
            socket.emit('message:read', { roomId });
          }
        }
      } catch (err) {
        console.error('Error fetching messages:', err.message);
        triggerApiError();
      } finally {
        setLoadingMessages(false);
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
      socket.emit('room:leave', { roomId: activeRoom._id });
      socket.emit('typing:stop', { roomId: activeRoom._id });
    }

    setActiveRoom(room);
    setTypingUsers({});
    setHasMoreMessages(false);
    setNextCursor(null);

    if (room) {
      // Reset unread count in room list state immediately
      setRooms(prev => prev.map(r => r._id === room._id ? { ...r, unreadCount: 0 } : r));
      
      fetchMessages(room._id);
      
      const readReceiptsOn = localStorage.getItem('pref_read_receipts') !== 'false';
      if (socket) {
        socket.emit('room:join', { roomId: room._id });
        if (readReceiptsOn) {
          socket.emit('message:read', { roomId: room._id });
        }
      }
    } else {
      setRawMessages([]);
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
      if (!socket || !activeRoom) return reject(new Error('Socket or active room not found'));

      const messagePayload = {
        roomId: activeRoom._id,
        content,
        type,
        mediaUrl
      };

      socket.emit('message:send', messagePayload, (response) => {
        if (response && response.success) {
          const newMessage = response.message;
          setRawMessages(prev => [...prev, newMessage]);

          setRooms(prev => {
            const roomIdx = prev.findIndex(r => r._id === activeRoom._id);
            if (roomIdx === -1) return prev;
            const updatedRooms = [...prev];
            updatedRooms[roomIdx] = {
              ...updatedRooms[roomIdx],
              lastMessage: newMessage,
              updatedAt: new Date().toISOString()
            };
            return updatedRooms.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
          });
          resolve(newMessage);
        } else {
          triggerApiError('Failed to send message.');
          reject(new Error('Failed to send message'));
        }
      });
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
  const toggleStarMessage = (message) => {
    setStarredMessages(prev => {
      const exists = prev.some(m => m._id === message._id);
      if (exists) {
        return prev.filter(m => m._id !== message._id);
      } else {
        return [...prev, message];
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
          if (activeRoom && activeRoom._id === targetRoomId) {
            setRawMessages(prev => [...prev, response.message]);
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
    if (socket && activeRoom) {
      socket.emit('typing:start', { roomId: activeRoom._id });
    }
  };

  const sendTypingStop = () => {
    const typingOn = localStorage.getItem('pref_typing_indicators') !== 'false';
    if (!typingOn) return;
    if (socket && activeRoom) {
      socket.emit('typing:stop', { roomId: activeRoom._id });
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
        else return; // Ignore control messages from toasts
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
    socket.emit('user:online', { userId: user._id });
    socket.emit('presence:online', { userId: user._id });

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
              setRawMessages(prev => [...prev, message]);
            }
            return;
          }
        } catch (e) {}
      }

      // Append to active message log if in active room
      if (currentActiveRoom && message.roomId === currentActiveRoom._id) {
        setRawMessages(prev => [...prev, message]);
        
        // Mark as read immediately on active room messages from other users
        const readReceiptsOn = localStorage.getItem('pref_read_receipts') !== 'false';
        if (message.senderId?._id !== user._id && readReceiptsOn) {
          socket.emit('message:read', { roomId: currentActiveRoom._id });
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

        return updatedRooms.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      });

      // Send delivered receipt if message is newly received and sent by others
      if (message.senderId?._id !== user._id && message.status === 'sent') {
        socket.emit('message:delivered', { messageId: message._id, roomId: message.roomId });
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
        if (room._id === roomId && room.lastMessage && room.lastMessage.senderId?._id !== readerId) {
          const updatedSeenBy = Array.from(new Set([...(room.lastMessage.seenBy || []), readerId]));
          return {
            ...room,
            lastMessage: {
              ...room.lastMessage,
              seenBy: updatedSeenBy,
              status: 'seen'
            }
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
      }
    };

    // Connection handlers for Reconnection States
    const handleConnect = () => {
      setIsReconnecting(false);
      const currentActiveRoom = activeRoomRef.current;
      if (currentActiveRoom) {
        fetchMessages(currentActiveRoom._id);
        socket.emit('room:join', { roomId: currentActiveRoom._id });
        socket.emit('message:read', { roomId: currentActiveRoom._id });
      }
    };

    const handleDisconnect = (reason) => {
      if (reason === 'io server disconnect' || reason === 'transport close') {
        setIsReconnecting(true);
      }
    };

    const handleReconnectAttempt = () => {
      setIsReconnecting(true);
    };

    // Bind event hooks
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnect_attempt', handleReconnectAttempt);

    socket.on('message:receive', handleReceiveMessage);
    socket.on('message:new', handleReceiveMessage);
    socket.on('presence:online', handlePresenceOnline);
    socket.on('presence:offline', handlePresenceOffline);
    socket.on('user:online', handlePresenceOnline);
    socket.on('user:offline', handlePresenceOffline);
    socket.on('message:status_update', handleStatusUpdate);
    socket.on('message:read_receipt', handleReadReceipt);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect_attempt', handleReconnectAttempt);

      socket.off('message:receive', handleReceiveMessage);
      socket.off('message:new', handleReceiveMessage);
      socket.off('presence:online', handlePresenceOnline);
      socket.off('presence:offline', handlePresenceOffline);
      socket.off('user:online', handlePresenceOnline);
      socket.off('user:offline', handlePresenceOffline);
      socket.off('message:status_update', handleStatusUpdate);
      socket.off('message:read_receipt', handleReadReceipt);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);

      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (apiErrorTimeoutRef.current) clearTimeout(apiErrorTimeoutRef.current);
    };
  }, [socket, user, fetchRooms]);

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

      // Phase 4 Settings & Personalization Exports
      readReceipts,
      typingIndicators,
      blockedUsers,
      accentColor,
      chatBubbleColor,
      chatWallpaper,
      chatTextSize,
      highContrast,
      toggleReadReceipts,
      toggleTypingIndicators,
      toggleBlockUser,
      updateAccentColor,
      updateChatBubbleColor,
      updateChatWallpaper,
      updateChatTextSize,
      toggleHighContrast
    }}>
      {children}
    </ChatContext.Provider>
  );
};
