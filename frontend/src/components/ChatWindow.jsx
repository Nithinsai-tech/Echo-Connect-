import React, { useState, useEffect, useRef, memo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useChat } from '../hooks/useChat';
import { useSocket } from '../hooks/useSocket';
import { useToast } from '../context/ToastContext';
import { 
  formatMessageTime, 
  formatLastSeen, 
  formatMessageDateSeparator 
} from '../utils/formatTime';
import { getInitials, getInitialsBg } from '../utils/getInitials';
import { 
  Paperclip, 
  Smile, 
  Send, 
  Video, 
  Phone, 
  Search, 
  MoreVertical, 
  ArrowLeft, 
  File, 
  X, 
  Loader2,
  Download,
  PhoneOff,
  Mic,
  MicOff,
  VideoOff,
  Volume2,
  Trash2,
  User,
  LogOut,
  ShieldAlert,
  Share2,
  Copy,
  Pin,
  Star,
  Reply,
  Check,
  ChevronDown,
  CheckSquare,
  Flag
} from 'lucide-react';
import * as ReactWindow from 'react-window';
const { VariableSizeList: List } = ReactWindow;

// Checkmark SVGs for Read Receipts
const SingleCheck = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-gray-400 dark:text-gray-500">
    <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const DoubleCheckGray = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-gray-400 dark:text-gray-500">
    <path d="M4 12l4 4L18 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9 12l4 4L23 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const DoubleCheckBlue = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-sky-500 dark:text-sky-400">
    <path d="M4 12l4 4L18 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9 12l4 4L23 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const renderHighlightText = (text, highlight) => {
  if (!highlight || !highlight.trim()) {
    return text;
  }
  const parts = text.split(new RegExp(`(${escapeRegExp(highlight)})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="search-text-highlight bg-yellow-300 dark:bg-yellow-500 text-black px-0.5 rounded">{part}</mark>
        ) : (
          part
        )
      )}
    </span>
  );
};

// Memoized MessageItem Component for rendering performance
const MessageItem = memo(({ msg, isSelf, isGroup, isUnreadByMe, onContextMenu, onImageClick, onReplySwipe, onReaction, starredMessages, currentUser, searchQuery, isConsecutive, isContextMenuOpen }) => {
  const [touchStart, setTouchStart] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const longPressTimer = useRef(null);
  const isLongPressActive = useRef(false);

  const isSticker = msg.mediaUrl && msg.mediaUrl.includes('/stickers/');
  const isStarred = starredMessages?.some(sm => sm._id === msg._id);

  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
    isLongPressActive.current = false;
    
    // Start long press timer (550ms)
    longPressTimer.current = setTimeout(() => {
      isLongPressActive.current = true;
      onContextMenu(e, msg._id, isSelf);
    }, 550);
  };

  const handleTouchMove = (e) => {
    if (!touchStart) return;
    const diff = e.targetTouches[0].clientX - touchStart;
    
    // Cancel long press if user moves finger significantly
    if (Math.abs(diff) > 8) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
    
    if (diff > 0 && diff < 80) {
      setSwipeOffset(diff);
    }
  };

  const handleTouchEnd = (e) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    
    if (swipeOffset > 45) {
      onReplySwipe(msg);
    }
    
    if (isLongPressActive.current) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    setTouchStart(null);
    setSwipeOffset(0);
  };

  const handleTouchCancel = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setTouchStart(null);
    setSwipeOffset(0);
  };

  // Parse JSON message content (replies, forwards)
  let contentText = msg.content;
  let replyData = null;
  let forwardData = null;
  
  if (msg.content && msg.content.startsWith('{"_echoType"')) {
    try {
      const parsed = JSON.parse(msg.content);
      if (parsed._echoType === 'reply') {
        replyData = parsed;
        contentText = parsed.text;
      } else if (parsed._echoType === 'forward') {
        forwardData = parsed;
        contentText = parsed.text;
      }
    } catch(e) {}
  }

  const isDeleted = msg.isDeletedEveryone;
  const hasTextOrQuote = !!(contentText || replyData || forwardData);
  const isImageOnly = msg.mediaUrl && msg.type === 'image' && !isDeleted && !hasTextOrQuote;

  if (isSticker && !isDeleted && !hasTextOrQuote) {
    return (
      <div
        onContextMenu={(e) => onContextMenu(e, msg._id, isSelf)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        style={{ transform: `translateX(${swipeOffset}px)` }}
        data-message-id={msg._id}
        className={`flex w-full ${isSelf ? 'justify-end' : 'justify-start'} ${
          isConsecutive ? 'mt-0.5 mb-0.5' : 'mt-3 mb-1'
        } relative group transition-all duration-100`}
      >
        {/* Swipe Indicator Background */}
        {swipeOffset > 10 && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center text-orange-500 opacity-60">
            <Reply className="h-4 w-4 animate-pulse" />
          </div>
        )}

        <div className={`relative flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
          <img
            src={msg.mediaUrl}
            alt="Sticker"
            className="h-28 w-28 object-contain hover:scale-105 transition duration-200 select-none cursor-pointer"
            onClick={() => onImageClick(msg.mediaUrl)}
          />
          <div className="flex items-center gap-1 text-[8px] text-gray-500 dark:text-gray-400 mt-0.5 mr-1 bg-white/60 dark:bg-gray-855/60 px-1 py-0.5 rounded backdrop-blur-[1px]">
            {isStarred && <Star className="h-2.5 w-2.5 text-orange-500 fill-orange-500 shrink-0" />}
            {msg.isPinned && <Pin className="h-2.5 w-2.5 text-yellow-500 fill-yellow-500 shrink-0 rotate-45" />}
            <span>{formatMessageTime(msg.createdAt)}</span>
            {isSelf && (
              msg.status === 'seen' ? (
                <DoubleCheckBlue />
              ) : msg.status === 'delivered' ? (
                <DoubleCheckGray />
              ) : (
                <SingleCheck />
              )
            )}
          </div>

          {/* Reactions pills layout */}
          {msg.reactions && msg.reactions.length > 0 && (
            <div className={`flex flex-wrap gap-1 mt-1 ${isSelf ? 'justify-end' : 'justify-start'}`}>
              {Object.entries(
                msg.reactions.reduce((acc, r) => {
                  if (!acc[r.emoji]) acc[r.emoji] = [];
                  acc[r.emoji].push(r.userId);
                  return acc;
                }, {})
              ).map(([emoji, userIds]) => {
                const hasReacted = userIds.includes(currentUser?._id);
                return (
                  <button
                    key={emoji}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReaction(msg._id, emoji, hasReacted ? 'remove' : 'add');
                    }}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold transition ${
                      hasReacted 
                        ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' 
                        : 'bg-black/25 border-white/5 text-gray-300 hover:bg-black/35'
                    }`}
                    title={`${userIds.length} reaction${userIds.length > 1 ? 's' : ''}`}
                  >
                    <span>{emoji}</span>
                    <span>{userIds.length}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Corner radius grouping class logic
  const bubbleCornersClass = isSelf
    ? isConsecutive 
      ? 'rounded-2xl rounded-tr-sm rounded-br-sm'
      : 'rounded-2xl rounded-tr-sm'
    : isConsecutive
      ? 'rounded-2xl rounded-tl-sm rounded-bl-sm'
      : 'rounded-2xl rounded-tl-sm';

  return (
    <div
      onContextMenu={(e) => onContextMenu(e, msg._id, isSelf)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      style={{ transform: `translateX(${swipeOffset}px)` }}
      data-message-id={msg._id}
      className={`flex w-full ${isSelf ? 'justify-end' : 'justify-start'} ${
        isConsecutive ? 'mt-0.5 mb-0.5' : 'mt-3 mb-1'
      } relative group transition-all duration-100 msg-bubble-wrapper ${isSelf ? 'mine' : 'theirs'}`}
    >
      {/* Swipe Indicator Background */}
      {swipeOffset > 10 && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center text-orange-500 opacity-60">
          <Reply className="h-4 w-4 animate-pulse" />
        </div>
      )}

      <div
        className={`msg-bubble max-w-[85%] md:max-w-[70%] px-4 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.08)] relative border border-transparent transition-all duration-200 ${bubbleCornersClass} ${
          isImageOnly ? 'p-1.5' : ''
        } ${
          isSelf 
            ? 'bg-[var(--bubble-mine)] hover:bg-[#15803D] text-white' 
            : 'bg-[var(--bubble-theirs)] border-[#E0E0EA] dark:border-[#2C3045] hover:bg-[#E5E5E5] dark:hover:bg-[#3E4E68] text-[var(--bubble-theirs-text,var(--text-primary))]'
        } ${isUnreadByMe ? 'message-bubble-incoming-unread' : ''}`}
      >
        {/* Downward Chevron action button */}
        {!isDeleted && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onContextMenu(e, msg._id, isSelf);
            }}
            className={`absolute top-1.5 right-1.5 p-1 rounded-full bg-black/10 hover:bg-black/25 text-white/80 hover:text-white transition-opacity duration-150 z-20 ${
              isContextMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
            title="Message Actions"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Group Sender Name */}
        {!isSelf && isGroup && !isConsecutive && (
          <span className="block text-[11px] font-bold text-orange-400 mb-0.5">
            {msg.senderId?.name || 'User'}
          </span>
        )}

        {/* Forwarded label */}
        {forwardData && !isDeleted && (
          <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-1 select-none font-medium italic">
            <Share2 className="h-3 w-3 rotate-180 text-orange-455" />
            Forwarded
          </div>
        )}

        {/* Reply Quote preview */}
        {replyData && !isDeleted && (
          <div 
            onClick={(e) => {
              e.stopPropagation();
              const originalMessageEl = document.querySelector(`[data-message-id="${replyData.replyTo}"]`);
              if (originalMessageEl) {
                originalMessageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                originalMessageEl.classList.add('highlight-flash');
                setTimeout(() => {
                  originalMessageEl.classList.remove('highlight-flash');
                }, 2000);
              }
            }}
            className={`mb-1.5 p-2 rounded border-l-4 border-orange-500 text-left text-xs cursor-pointer transition select-none ${
              isSelf 
                ? 'bg-black/15 dark:bg-black/35 hover:bg-black/25' 
                : 'bg-black/5 dark:bg-black/35 hover:bg-black/10'
            }`}
          >
            <div className="font-bold text-orange-500 dark:text-orange-400 text-[10px]">{replyData.replyToName}</div>
            <div className={`truncate text-[11px] mt-0.5 ${isSelf ? 'text-gray-300' : 'text-[var(--bubble-theirs-text,var(--text-secondary))] opacity-90'}`}>{replyData.replyToText}</div>
          </div>
        )}

        {/* Media Attachment Previews */}
        {msg.mediaUrl && !isDeleted && (
          <div className={`overflow-hidden rounded-xl ${isImageOnly ? '' : 'mb-1'}`}>
            {msg.type === 'image' ? (
              <img
                src={msg.mediaUrl}
                alt="Attachment"
                onClick={() => onImageClick(msg.mediaUrl)}
                className="max-h-64 w-full object-cover cursor-zoom-in rounded-[10px] hover:opacity-95 transition"
              />
            ) : (
              <a
                href={msg.mediaUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 bg-black/10 hover:bg-black/20 p-2 border border-white/5 rounded-xl text-xs text-orange-500"
              >
                <File className="h-5 w-5 shrink-0" />
                <div className="min-w-0 text-left">
                  <p className={`truncate font-semibold ${
                    isSelf 
                      ? 'text-gray-200' 
                      : 'text-[var(--bubble-theirs-text,var(--text-primary))]'
                  }`}>
                    {msg.mediaUrl.split('/').pop().split('?')[0] || 'Attachment'}
                  </p>
                  <p className={`text-[10px] ${isSelf ? 'text-gray-400' : 'text-[var(--bubble-theirs-text,var(--text-secondary))] opacity-75'}`}>Click to open/download</p>
                </div>
              </a>
            )}
          </div>
        )}

        {/* Message Text Content */}
        {isDeleted ? (
          <p className="text-[13px] leading-relaxed break-words pb-3 pr-12 italic text-gray-400 select-none">
            This message was deleted
          </p>
        ) : (
          contentText && <p className="message-content-text text-[14px] leading-[1.5] tracking-[0.01em] whitespace-pre-wrap break-words pb-2 pr-12 text-left">{renderHighlightText(contentText, searchQuery)}</p>
        )}

        {/* Message Footer: Time + Pinned/Starred + Ticks */}
        <div className={`absolute bottom-1.5 right-2.5 flex items-center gap-1 text-[9px] ${
          isImageOnly 
            ? 'bg-black/55 text-white/90 rounded-full px-2 py-0.5 backdrop-blur-[2px] z-10' 
            : isSelf 
              ? 'text-white/60' 
              : 'text-[var(--bubble-theirs-text,var(--text-secondary))] opacity-75'
        }`}>
          {isStarred && <Star className="h-2.5 w-2.5 text-orange-500 fill-orange-500 shrink-0" />}
          {msg.isPinned && <Pin className="h-2.5 w-2.5 text-yellow-500 fill-yellow-500 shrink-0 rotate-45" />}
          <span>{formatMessageTime(msg.createdAt)}</span>
          {isSelf && !isDeleted && (
            msg.status === 'seen' ? (
              <DoubleCheckBlue />
            ) : msg.status === 'delivered' ? (
              <DoubleCheckGray />
            ) : (
              <SingleCheck />
            )
          )}
        </div>

        {/* Reactions pills layout */}
        {!isDeleted && msg.reactions && msg.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5 justify-start">
            {Object.entries(
              msg.reactions.reduce((acc, r) => {
                if (!acc[r.emoji]) acc[r.emoji] = [];
                acc[r.emoji].push(r.userId);
                return acc;
              }, {})
            ).map(([emoji, userIds]) => {
              const hasReacted = userIds.includes(currentUser?._id);
              return (
                <button
                  key={emoji}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReaction(msg._id, emoji, hasReacted ? 'remove' : 'add');
                  }}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold transition ${
                    hasReacted 
                      ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' 
                      : 'bg-black/10 border-white/5 text-gray-300 hover:bg-black/20'
                  }`}
                  title={`${userIds.length} reaction${userIds.length > 1 ? 's' : ''}`}
                >
                  <span>{emoji}</span>
                  <span>{userIds.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

const EMOJI_LIST = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
  '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
  '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
  '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
  '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
  '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯',
  '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
  '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈',
  '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾',
  '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿',
  '😾', '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞',
  '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
  '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
  '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂',
  '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋',
  '🩸', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎',
  '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'
];

const STICKER_LIST = [
  { id: 'shiba_happy', name: 'Happy Shiba', url: '/stickers/shiba_happy.svg' },
  { id: 'cat_boba', name: 'Cat Boba', url: '/stickers/cat_boba.svg' },
  { id: 'panda_cool', name: 'Cool Panda', url: '/stickers/panda_cool.svg' },
  { id: 'ghost_cute', name: 'Cute Ghost', url: '/stickers/ghost_cute.svg' },
  { id: 'star_happy', name: 'Happy Star', url: '/stickers/star_happy.svg' },
  { id: 'coffee_hug', name: 'Coffee Cup', url: '/stickers/coffee_hug.svg' }
];

const ChatWindow = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { 
    activeRoom, 
    messages, 
    typingUsers, 
    sendMessage, 
    uploadAttachmentFile, 
    deleteMessageForMe, 
    selectRoom,
    loadingMessages,
    hasMoreMessages,
    loadMoreMessages,
    sendDeleteForEveryone,
    toggleStarMessage,
    sendPinMessage,
    sendReaction,
    sendReplyMessage,
    sendForwardMessage,
    starredMessages,
    rooms,
    blockedUsers,
    toggleBlockUser,
    leaveGroupRoom
  } = useChat();
  
  const socket = useSocket();

  const isGroup = activeRoom?.type === 'group';
  const partner = isGroup ? null : activeRoom?.participants?.find(p => p._id !== user?._id);
  const roomTitle = isGroup ? activeRoom?.groupName : (partner?.name || 'Chat User');
  const roomAvatar = isGroup ? activeRoom?.groupAvatar : partner?.avatar;
  const initials = roomTitle ? getInitials(roomTitle) : '';

  const [text, setText] = useState('');
  const [uploadProgress, setUploadProgress] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sending, setSending] = useState(false);

  // Lightbox Image Viewer state
  const [activeImage, setActiveImage] = useState(null);

  // Unified settings/details & media panel state
  const [activeRightPanel, setActiveRightPanel] = useState(null); // 'info' | 'media' | null

  // Advanced features state
  const [replyingToMessage, setReplyingToMessage] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [selectedForwardRooms, setSelectedForwardRooms] = useState([]);
  const [forwardSearchQuery, setForwardSearchQuery] = useState('');

  // Conversation Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchIndex, setSearchIndex] = useState(0);



  // Emojis & Stickers Picker state
  const pickerRef = useRef(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [activePickerTab, setActivePickerTab] = useState('emojis');

  // Close picker on clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target) &&
        !e.target.closest('[aria-label="Add emojis"]')
      ) {
        setIsPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Dismiss overlays on escape key press
  useEffect(() => {
    const handleDismiss = () => {
      setIsPickerOpen(false);
      setSearchOpen(false);
      setForwardingMessage(null);
      setActiveImage(null);
      setActiveRightPanel(null);
      setReplyingToMessage(null);
      setContextMenu(prev => ({ ...prev, visible: false }));
    };
    window.addEventListener('dismiss-overlays', handleDismiss);
    return () => window.removeEventListener('dismiss-overlays', handleDismiss);
  }, []);

  const handleEmojiClick = (emoji) => {
    const textarea = document.getElementById('chat-input-textarea');
    if (!textarea) {
      setText(prev => prev + emoji);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const textBefore = text.substring(0, start);
    const textAfter = text.substring(end, text.length);

    setText(textBefore + emoji + textAfter);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);

  // Search timeline keyboard listener & matcher
  useEffect(() => {
    const handleSearchShortcut = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => {
          document.getElementById('timeline-search-input')?.focus();
        }, 100);
      }
    };
    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, []);

  // Update search results list as query or messages change
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchIndex(0);
      return;
    }
    const query = searchQuery.toLowerCase();
    const matches = [];
    messages.forEach((msg, idx) => {
      let textContent = msg.content || '';
      if (textContent.startsWith('{"_echoType"')) {
        try {
          const parsed = JSON.parse(textContent);
          if (parsed.text) textContent = parsed.text;
        } catch (e) {}
      }
      if (textContent.toLowerCase().includes(query)) {
        matches.push({ id: msg._id, index: idx });
      }
    });
    setSearchResults(matches);
    setSearchIndex(0);
    if (matches.length > 0) {
      scrollToSearchMatch(0, matches);
    }
  }, [searchQuery, messages]);

  const scrollToSearchMatch = (idx, matchesList = searchResults) => {
    const match = matchesList[idx];
    if (!match) return;
    
    // Virtualized list scroll
    listRef.current?.scrollToItem(match.index, 'center');
    
    // Highlight flash
    setTimeout(() => {
      const el = document.querySelector(`[data-message-id="${match.id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('highlight-flash');
        setTimeout(() => {
          el.classList.remove('highlight-flash');
        }, 2000);
      }
    }, 120);
  };
  const [activeCall, setActiveCall] = useState(null); // { type: 'voice' | 'video', status: 'ringing' | 'connected', isCaller: boolean, targetId?: string }
  const [incomingCall, setIncomingCall] = useState(null); // { roomId, callerId, callerName, callerAvatar, type, offer }
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    messageId: null
  });

  // Web Audio Synthesizer for Ringtone & calling tones
  const audioContextRef = useRef(null);
  const ringtoneIntervalRef = useRef(null);

  const startRingtone = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const playRingTone = () => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc1.frequency.value = 440;
        osc2.frequency.value = 480;

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);

        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.08, ctx.currentTime + 1.8);
        gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.0);

        osc1.start();
        osc2.start();

        osc1.stop(ctx.currentTime + 2.0);
        osc2.stop(ctx.currentTime + 2.0);
      };

      playRingTone();
      ringtoneIntervalRef.current = setInterval(playRingTone, 3000);
    } catch (e) {
      console.warn('Audio ringtone error:', e);
    }
  };

  const stopRingtone = () => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
  };

  const playConnectionTone = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 600;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch (e) {
      console.warn(e);
    }
  };

  const playDisconnectTone = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 400;
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.warn(e);
    }
  };

  // ==========================================
  // WebRTC Calling Implementation
  // ==========================================

  const createPeerConnection = (targetUserId) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    // Clear candidates queue
    iceCandidatesQueueRef.current = [];

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('call:candidate', {
          targetUserId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      const stream = event.streams[0] || new MediaStream([event.track]);
      setRemoteStreamState(stream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  const getUserMediaStream = async (videoRequired) => {
    try {
      const constraints = {
        audio: true,
        video: videoRequired ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } : false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStreamState(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.warn('getUserMedia error, using audio-only fallback or continuing feedless:', err);
      // Try audio-only fallback if video fails
      if (videoRequired) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          localStreamRef.current = stream;
          setLocalStreamState(stream);
          return stream;
        } catch (innerErr) {
          console.warn('Fallback audio-only also failed:', innerErr);
        }
      }
      return null;
    }
  };

  const handleEndCall = () => {
    stopRingtone();
    playDisconnectTone();

    const targetId = activeCall?.isCaller ? partner?._id : incomingCall?.callerId || activeCall?.targetId;
    if (targetId && socket) {
      socket.emit('call:end', { targetUserId: targetId });
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setLocalStreamState(null);
    setRemoteStreamState(null);
    iceCandidatesQueueRef.current = [];

    setActiveCall(null);
    setIncomingCall(null);
    setIsMuted(false);
    setIsVideoOff(false);
  };

  const startVoiceCall = async () => {
    if (!partner || !socket) return;
    setActiveCall({ type: 'voice', status: 'ringing', isCaller: true, targetId: partner._id });
    startRingtone();

    try {
      const pc = createPeerConnection(partner._id);
      const stream = await getUserMediaStream(false);
      if (stream) {
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('call:initiate', {
        roomId: activeRoom._id,
        targetUserId: partner._id,
        type: 'voice',
        offer
      });
    } catch (e) {
      console.error('Failed to initiate voice call:', e);
      handleEndCall();
    }
  };

  const startVideoCall = async () => {
    if (!partner || !socket) return;
    setActiveCall({ type: 'video', status: 'ringing', isCaller: true, targetId: partner._id });
    startRingtone();

    try {
      const pc = createPeerConnection(partner._id);
      const stream = await getUserMediaStream(true);
      if (stream) {
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('call:initiate', {
        roomId: activeRoom._id,
        targetUserId: partner._id,
        type: 'video',
        offer
      });
    } catch (e) {
      console.error('Failed to initiate video call:', e);
      handleEndCall();
    }
  };

  const handleAcceptCall = async () => {
    if (!incomingCall || !socket) return;
    stopRingtone();
    playConnectionTone();

    const { callerId, type, offer } = incomingCall;
    setActiveCall({ type, status: 'connected', isCaller: false, targetId: callerId });
    setIncomingCall(null);

    try {
      const pc = createPeerConnection(callerId);
      const stream = await getUserMediaStream(type === 'video');
      if (stream) {
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Drain queued candidates
      while (iceCandidatesQueueRef.current.length > 0) {
        const cand = iceCandidatesQueueRef.current.shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (err) {
          console.error('Error adding queued ICE candidate:', err);
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('call:answer', {
        callerId,
        answer
      });
    } catch (e) {
      console.error('Failed to accept call:', e);
      handleEndCall();
    }
  };

  const handleDeclineCall = () => {
    if (!incomingCall || !socket) return;
    stopRingtone();
    playDisconnectTone();
    socket.emit('call:reject', { callerId: incomingCall.callerId });
    setIncomingCall(null);
  };

  const handleToggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
      }
    }
  };

  const handleToggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = isVideoOff;
        setIsVideoOff(!isVideoOff);
      }
    }
  };

  // Listen to incoming call sockets
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data) => {
      const { roomId, callerId, callerName, callerAvatar, type, offer } = data;

      if (activeCall || incomingCall) {
        socket.emit('call:reject', { callerId });
        return;
      }

      startRingtone();
      setIncomingCall({ roomId, callerId, callerName, callerAvatar, type, offer });
    };

    const handleCallAnswered = async (data) => {
      const { answer } = data;
      stopRingtone();
      playConnectionTone();

      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          setActiveCall(prev => prev ? { ...prev, status: 'connected' } : null);

          // Drain queued candidates
          while (iceCandidatesQueueRef.current.length > 0) {
            const cand = iceCandidatesQueueRef.current.shift();
            try {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(cand));
            } catch (err) {
              console.error('Error adding queued ICE candidate:', err);
            }
          }
        } catch (e) {
          console.error('Error setting remote answer:', e);
        }
      }
    };

    const handleCallRejected = () => {
      stopRingtone();
      playDisconnectTone();
      setActiveCall(null);
      alert('Call rejected or busy.');
    };

    const handleCallCandidate = async (data) => {
      const { candidate } = data;
      const pc = peerConnectionRef.current;
      if (pc) {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.error('Error adding ICE candidate:', e);
          }
        } else {
          iceCandidatesQueueRef.current.push(candidate);
        }
      }
    };

    const handleCallEnded = () => {
      stopRingtone();
      playDisconnectTone();

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      setLocalStreamState(null);
      setRemoteStreamState(null);
      iceCandidatesQueueRef.current = [];

      setActiveCall(null);
      setIncomingCall(null);
    };

    socket.on('call:incoming', handleIncomingCall);
    socket.on('call:answered', handleCallAnswered);
    socket.on('call:rejected', handleCallRejected);
    socket.on('call:candidate', handleCallCandidate);
    socket.on('call:ended', handleCallEnded);

    return () => {
      socket.off('call:incoming', handleIncomingCall);
      socket.off('call:answered', handleCallAnswered);
      socket.off('call:rejected', handleCallRejected);
      socket.off('call:candidate', handleCallCandidate);
      socket.off('call:ended', handleCallEnded);
    };
  }, [socket, activeCall, incomingCall, partner]);

  const formatCallTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Call duration counter effect
  useEffect(() => {
    let interval = null;
    if (activeCall?.status === 'connected') {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeCall?.status]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      stopRingtone();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // WebRTC Calling Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const [localStreamState, setLocalStreamState] = useState(null);
  const [remoteStreamState, setRemoteStreamState] = useState(null);
  const iceCandidatesQueueRef = useRef([]);

  useEffect(() => {
    if (localVideoRef.current && localStreamState) {
      localVideoRef.current.srcObject = localStreamState;
    }
  }, [localStreamState, activeCall?.status, isVideoOff]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStreamState) {
      remoteVideoRef.current.srcObject = remoteStreamState;
    }
  }, [remoteStreamState, activeCall?.status]);

  // Virtualization List elements
  const listRef = useRef(null);
  const containerRef = useRef(null);
  const [containerHeight, setContainerHeight] = useState(400);

  // Scroll to bottom anchor when message array size updates (standard mode)
  useEffect(() => {
    if (messages.length <= 100) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      listRef.current?.scrollToItem(messages.length - 1, 'end');
    }
  }, [messages, typingUsers]);

  // Clean state when room transitions
  useEffect(() => {
    setText('');
    setUploadProgress(false);
    setUploadError('');
    setIsTyping(false);
    setSending(false);
    setActiveRightPanel(null);
    setIsOptionsMenuOpen(false);
    stopRingtone();
    setActiveCall(null);
    setIsMuted(false);
    setIsVideoOff(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    closeContextMenu();
  }, [activeRoom]);

  // Escape key handler to close Image Lightbox viewer and calls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveImage(null);
        handleEndCall();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Track the height of the message scroll area for VariableSizeList
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerHeight(entry.contentRect.height);
        // Scroll to bottom when container height changes (e.g. keyboard opens)
        setTimeout(() => {
          if (messages.length <= 100) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          } else {
            listRef.current?.scrollToItem(messages.length - 1, 'end');
          }
        }, 100);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [messages]);

  // IntersectionObserver to emit seen status receipts
  useEffect(() => {
    if (!socket || !activeRoom || !messages.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            socket.emit('message:read', { roomId: activeRoom._id });
            socket.emit('message:seen', { roomId: activeRoom._id });
          }
        });
      },
      { threshold: 0.2 }
    );

    const unreadMessages = document.querySelectorAll('.message-bubble-incoming-unread');
    unreadMessages.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [messages, activeRoom, socket]);

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
  };

  const closeOptionsMenu = () => {
    setIsOptionsMenuOpen(false);
  };

  useEffect(() => {
    const handleGlobalClick = () => {
      closeContextMenu();
      closeOptionsMenu();
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleContextMenu = (e, msgId, isSelf) => {
    e.preventDefault();
    const msg = messages.find(m => m._id === msgId);
    if (!msg) return;

    let x = e.clientX;
    let y = e.clientY;

    // Handle mobile touch coordinates
    if (!x && !y && e.nativeEvent) {
      const touch = e.nativeEvent.touches?.[0] || e.nativeEvent.changedTouches?.[0];
      if (touch) {
        x = touch.clientX;
        y = touch.clientY;
      }
    }

    // Fallback coordinates
    if (!x || !y) {
      x = window.innerWidth / 2 - 100;
      y = window.innerHeight / 2 - 100;
    }

    // Keep menu in viewport bounds
    const menuWidth = 200;
    const menuHeight = 280;
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }
    if (x < 10) x = 10;
    if (y < 10) y = 10;

    setContextMenu({
      visible: true,
      x: x,
      y: y,
      messageId: msgId,
      isSelf: isSelf,
      msg: msg
    });
  };

  const handleInputFocus = () => {
    setTimeout(() => {
      if (messages.length <= 100) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else {
        listRef.current?.scrollToItem(messages.length - 1, 'end');
      }
    }, 300);
  };

  // Textarea typing start/stop trigger emitters
  const handleTextareaChange = (e) => {
    setText(e.target.value);
    
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;

    if (!socket || !activeRoom) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing:start', { roomId: activeRoom._id });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { roomId: activeRoom._id });
      setIsTyping(false);
    }, 2000);
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!text.trim() || sending) return;

    setSending(true);
    const content = text.trim();
    setText('');
    
    const textarea = document.getElementById('chat-input-textarea');
    if (textarea) {
      textarea.style.height = 'auto';
      // Return focus to input area immediately
      textarea.focus();
    }

    try {
      if (replyingToMessage) {
        await sendReplyMessage(content, replyingToMessage);
        setReplyingToMessage(null);
      } else {
        await sendMessage(content);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
      if (socket && activeRoom) {
        socket.emit('typing:stop', { roomId: activeRoom._id });
        setIsTyping(false);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadProgress(true);
    setUploadError('');
    try {
      const uploadResponse = await uploadAttachmentFile(file);
      if (uploadResponse && uploadResponse.mediaUrl) {
        const type = file.type.startsWith('image/') ? 'image' : 'file';
        await sendMessage('', uploadResponse.mediaUrl, type);
      }
    } catch (err) {
      console.error('File upload failed:', err.message);
      setUploadError('File upload failed. Please try again.');
    } finally {
      setUploadProgress(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Heuristic estimator of message cell height for virtualization row sizes
  const getItemSize = (index) => {
    const msg = messages[index];
    if (!msg) return 50;
    
    let size = 55;
    if (msg.content) {
      size += Math.ceil(msg.content.length / 45) * 20;
    }
    const isSticker = msg.mediaUrl && msg.mediaUrl.includes('/stickers/');
    if (isSticker) {
      size += 140;
    } else if (msg.mediaUrl) {
      size += msg.type === 'image' ? 255 : 70;
    }
    
    // Check if date boundary separator is rendered above the message
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const showSeparator = !prevMsg || new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
    if (showSeparator) {
      size += 40;
    }
    
    const isConsecutive = prevMsg && !showSeparator && prevMsg.senderId?._id === msg.senderId?._id;
    if (isConsecutive) {
      size -= 8;
    } else {
      size += 4;
    }
    
    return size;
  };

  if (!activeRoom) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center p-8" style={{ background: 'var(--chat-bg-gradient)' }}>
        <div className="flex flex-col items-center">
          {/* Logo: Orange circle 56px + white speech bubble */}
          <div className="w-14 h-14 rounded-full bg-[#FF6A00] flex items-center justify-center mb-4 shadow-md">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" fill="white"/>
            </svg>
          </div>
          {/* Echo Connect split color text */}
          <h2 className="font-extrabold text-2xl select-none mb-1.5" style={{ fontFamily: 'Poppins, sans-serif' }}>
            <span style={{ color: '#FF6A00' }}>Echo</span>
            <span style={{ color: '#2563EB' }}>Connect</span>
          </h2>
          <p className="text-sm text-[var(--text-secondary)] font-medium">
            Stay connected, instantly.
          </p>
        </div>
      </div>
    );
  }

  const statusSubtitle = isGroup 
    ? `${activeRoom.participants.length} participants`
    : partner?.isOnline 
      ? 'Online' 
      : formatLastSeen(partner?.lastSeen);

  // Row Renderer function for VariableSizeList message virtualization
  const VirtualizedRow = ({ index, style }) => {
    const msg = messages[index];
    if (!msg) return null;

    const isSelf = msg.senderId?._id === user?._id;
    const isUnreadByMe = !isSelf && !msg.seenBy?.includes(user?._id);
    
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const showDateSeparator = !prevMsg || new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
    const isConsecutive = prevMsg && !showDateSeparator && prevMsg.senderId?._id === msg.senderId?._id;

    return (
      <div style={style} className="px-4">
        {showDateSeparator && (
          <div className="flex justify-center my-2 mb-3">
            <span className="rounded border border-transparent dark:border-[#2C3045] bg-white/80 dark:bg-[#20253A] px-3 py-1 text-[10px] font-bold text-gray-500 dark:text-gray-200 shadow-sm uppercase tracking-wide">
              {formatMessageDateSeparator(msg.createdAt)}
            </span>
          </div>
        )}
        <MessageItem
          msg={msg}
          isSelf={isSelf}
          isGroup={isGroup}
          isUnreadByMe={isUnreadByMe}
          onContextMenu={handleContextMenu}
          onImageClick={setActiveImage}
          onReplySwipe={setReplyingToMessage}
          onReaction={sendReaction}
          starredMessages={starredMessages}
          currentUser={user}
          searchQuery={searchQuery}
          isConsecutive={isConsecutive}
          isContextMenuOpen={contextMenu.visible && contextMenu.messageId === msg._id}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-1 flex-col h-full relative overflow-hidden" style={{ backgroundColor: 'var(--bg-base)' }}>
      <style>{`
        @keyframes dotbounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .typer-dot {
          animation: dotbounce 0.8s infinite ease-in-out;
        }
        @keyframes pickerpop {
          from { opacity: 0; transform: scale(0.95) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .picker-popover {
          animation: pickerpop 0.18s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>

      {/* 1. HEADER */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b px-3 md:px-5 z-10" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center min-w-0">
          <button
            onClick={() => selectRoom(null)}
            className="mr-1 md:mr-2 rounded-full p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 md:hidden"
            title="Back to Chats"
            aria-label="Back to conversations list"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Room Header Avatar */}
          <div className="relative mr-2 md:mr-3 h-9 w-9 shrink-0">
            {roomAvatar ? (
              <img
                src={roomAvatar}
                alt={roomTitle}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <div 
                className="flex h-full w-full items-center justify-center rounded-full text-white text-xs font-bold uppercase"
                style={{ backgroundColor: getInitialsBg(roomTitle) }}
              >
                {initials}
              </div>
            )}
            {!isGroup && (
              <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 online-status-dot ${partner?.isOnline ? 'online' : ''}`} style={{ borderColor: 'var(--bg-panel)' }} />
            )}
          </div>

          {/* Status Subtitle text */}
          <div className="flex flex-col min-w-0">
            <span onClick={() => setActiveRightPanel('info')} className="truncate text-[15px] font-bold text-[#0D0D18] dark:text-[#F5F5FF] cursor-pointer hover:underline">{roomTitle}</span>
            <span 
              onClick={() => setActiveRightPanel('info')}
              className={`truncate text-xs cursor-pointer select-none ${
                isGroup 
                  ? 'text-[#FF6A00] hover:underline font-semibold' 
                  : partner?.isOnline 
                    ? 'text-[#22C55E] font-medium' 
                    : 'text-[#9090A8] dark:text-[#55556A]'
              }`}
            >
              {statusSubtitle}
            </span>
          </div>
        </div>

        {/* Calling & Option buttons */}
        <div className="flex items-center gap-1 md:gap-1.5 text-gray-600 dark:text-gray-400 relative">
          <button 
            onClick={startVideoCall}
            className="rounded-full p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition" 
            title="Video Call" 
            aria-label="Video Call"
          >
            <Video className="h-5 w-5" />
          </button>
          <button 
            onClick={startVoiceCall}
            className="rounded-full p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition" 
            title="Voice Call" 
            aria-label="Voice Call"
          >
            <Phone className="h-5 w-5" />
          </button>
          <button 
            onClick={() => {
              setSearchOpen(!searchOpen);
              if (!searchOpen) {
                setTimeout(() => {
                  document.getElementById('timeline-search-input')?.focus();
                }, 100);
              } else {
                setSearchQuery('');
                setSearchResults([]);
              }
            }}
            className={`rounded-full p-2 transition ${
              searchOpen 
                ? 'text-[#FF6A00] bg-gray-200 dark:bg-gray-700' 
                : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            }`} 
            title="Search Chat" 
            aria-label="Search inside chat"
          >
            <Search className="h-5 w-5" />
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsOptionsMenuOpen(!isOptionsMenuOpen);
            }}
            className="rounded-full p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition" 
            title="Options"
            aria-label="Room Settings Options"
          >
            <MoreVertical className="h-5 w-5" />
          </button>

          {/* Options Dropdown Menu */}
          {isOptionsMenuOpen && (
            <div 
              onClick={(e) => e.stopPropagation()} 
              className="absolute right-0 top-11 z-30 w-48 rounded-lg bg-white dark:bg-gray-800 py-1.5 shadow-xl border border-gray-200 dark:border-gray-700 transition duration-100 ease-out transform origin-top-right text-gray-800 dark:text-gray-200"
            >
              {isGroup ? (
                <>
                  <button
                    onClick={() => {
                      setActiveRightPanel('info');
                      setIsOptionsMenuOpen(false);
                    }}
                    className="flex items-center gap-2.5 w-full px-4 py-2 text-left text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <User className="h-4 w-4 text-gray-400" />
                    Group Info
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to clear this chat locally?')) {
                        alert('Chat cleared locally.');
                      }
                      setIsOptionsMenuOpen(false);
                    }}
                    className="flex items-center gap-2.5 w-full px-4 py-2 text-left text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Trash2 className="h-4 w-4 text-gray-400" />
                    Clear Chat
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to leave this group?')) {
                        leaveGroupRoom(activeRoom._id);
                      }
                      setIsOptionsMenuOpen(false);
                    }}
                    className="flex items-center gap-2.5 w-full px-4 py-2 text-left text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Leave Group
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setActiveRightPanel('info');
                      setIsOptionsMenuOpen(false);
                    }}
                    className="flex items-center gap-2.5 w-full px-4 py-2 text-left text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <User className="h-4 w-4 text-gray-400" />
                    Contact Info
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Are you sure you want to clear this chat locally?')) {
                        alert('Chat cleared locally.');
                      }
                      setIsOptionsMenuOpen(false);
                    }}
                    className="flex items-center gap-2.5 w-full px-4 py-2 text-left text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Trash2 className="h-4 w-4 text-gray-400" />
                    Clear Chat
                  </button>
                  <button
                    onClick={() => {
                      if (partner) {
                        toggleBlockUser(partner._id);
                      }
                      setIsOptionsMenuOpen(false);
                    }}
                    className="flex items-center gap-2.5 w-full px-4 py-2 text-left text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    {partner && blockedUsers.includes(partner._id) ? 'Unblock Contact' : 'Block Contact'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* SEARCH BAR OVERLAY */}
      {searchOpen && (
        <div className="flex items-center justify-between border-b px-3 md:px-5 py-2 z-10 gap-2 md:gap-3 bg-[#1A1C28]" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 flex-1 min-w-0 px-3 py-1 rounded-lg border border-transparent transition echo-search-container">
            <Search className="h-4 w-4 text-orange-400" />
            <input
              id="timeline-search-input"
              type="text"
              placeholder="Search in this conversation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 border-none outline-none focus:ring-0 focus:outline-none echo-search-input"
            />
            {searchResults.length > 0 && (
              <span className="text-xs text-gray-400 select-none">
                {searchIndex + 1} of {searchResults.length} matches
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {searchResults.length > 0 && (
              <>
                <button
                  onClick={() => {
                    const nextIdx = (searchIndex - 1 + searchResults.length) % searchResults.length;
                    setSearchIndex(nextIdx);
                    scrollToSearchMatch(nextIdx);
                  }}
                  className="px-2 py-0.5 rounded hover:bg-white/5 text-gray-300 text-xs font-bold"
                >
                  Prev
                </button>
                <button
                  onClick={() => {
                    const nextIdx = (searchIndex + 1) % searchResults.length;
                    setSearchIndex(nextIdx);
                    scrollToSearchMatch(nextIdx);
                  }}
                  className="px-2 py-0.5 rounded hover:bg-white/5 text-gray-300 text-xs font-bold"
                >
                  Next
                </button>
              </>
            )}
            <button
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="p-1 rounded-full hover:bg-white/5 text-gray-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. MESSAGES CONTAINER */}
      <main ref={containerRef} className="flex-1 overflow-y-auto py-3 relative min-h-0" style={{ background: 'var(--chat-wallpaper, var(--chat-bg-gradient))' }}>
        {loadingMessages && messages.length === 0 ? (
          /* SKELETON LOADER FOR MESSAGES LIST */
          <div className="flex flex-col space-y-4 px-4 py-3 h-full justify-end">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={`flex w-full ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <div className={`h-12 w-1/3 rounded-lg skeleton-shimmer ${i % 2 === 0 ? 'rounded-tr-none' : 'rounded-tl-none'}`} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          /* EMPTY STATE inside room: "Say hello!" */
          <div className="flex flex-1 flex-col items-center justify-center p-8 py-24 text-center h-full">
            <span className="text-4xl mb-3 block">👋</span>
            <h3 className="text-base font-bold text-gray-700 dark:text-gray-200">Say hello!</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Send a message to start this conversation.</p>
          </div>
        ) : messages.length > 100 ? (
          /* VIRTUALIZED SCROLL LIST FOR 100+ MESSAGES */
          <List
            ref={listRef}
            height={containerHeight}
            itemCount={messages.length}
            itemSize={getItemSize}
            width="100%"
          >
            {VirtualizedRow}
          </List>
        ) : (
          /* STANDARD SCROLL AREA FOR SMALLER MESSAGES LISTS */
          <div className="px-4">
            {/* Pagination Load Button */}
            {hasMoreMessages && (
              <div className="flex justify-center pb-3">
                <button
                  onClick={loadMoreMessages}
                  disabled={loadingMessages}
                  className="rounded-full bg-white dark:bg-gray-800 px-4 py-1.5 text-xs font-semibold text-[#075E54] dark:text-[#075e54] shadow hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition"
                  aria-label="Load older messages"
                >
                  {loadingMessages ? 'Loading older...' : 'Load older messages'}
                </button>
              </div>
            )}

            {messages.map((msg, index) => {
              const isSelf = msg.senderId?._id === user?._id;
              const isUnreadByMe = !isSelf && !msg.seenBy?.includes(user?._id);
              
              const prevMsg = index > 0 ? messages[index - 1] : null;
              const showDateSeparator = !prevMsg || new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
              const isConsecutive = prevMsg && !showDateSeparator && prevMsg.senderId?._id === msg.senderId?._id;

              return (
                <div key={msg._id}>
                  {showDateSeparator && (
                    <div className="flex justify-center my-3">
                      <span className="rounded border border-transparent dark:border-[#2C3045] bg-white/85 dark:bg-[#20253A] px-3 py-1 text-[10px] font-bold text-gray-500 dark:text-gray-200 shadow-sm uppercase tracking-wide">
                        {formatMessageDateSeparator(msg.createdAt)}
                      </span>
                    </div>
                  )}
                  <MessageItem
                    msg={msg}
                    isSelf={isSelf}
                    isGroup={isGroup}
                    isUnreadByMe={isUnreadByMe}
                    onContextMenu={handleContextMenu}
                    onImageClick={setActiveImage}
                    onReplySwipe={setReplyingToMessage}
                    onReaction={sendReaction}
                    starredMessages={starredMessages}
                    currentUser={user}
                    searchQuery={searchQuery}
                    isConsecutive={isConsecutive}
                    isContextMenuOpen={contextMenu.visible && contextMenu.messageId === msg._id}
                  />
                </div>
              );
            })}
            
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Bouncing Typing indicator */}
        {Object.keys(typingUsers).filter(uid => uid !== user?._id).length > 0 && (
          <div className="absolute bottom-2 left-4 z-10 flex justify-start">
            <div className="rounded-lg rounded-tl-none bg-white dark:bg-gray-700 px-3.5 py-2.5 shadow-md">
              <div className="flex items-center space-x-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500 typer-dot" style={{ animationDelay: '0s' }} />
                <div className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500 typer-dot" style={{ animationDelay: '0.15s' }} />
                <div className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500 typer-dot" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. ATTACHMENT FLOATING LOADER */}
      {uploadProgress && (
        <div className="absolute bottom-20 left-4 z-10 flex items-center gap-2 rounded bg-white dark:bg-gray-800 px-4 py-2 shadow-md border border-gray-100 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300">
          <Loader2 className="h-4 w-4 animate-spin text-[#075E54] dark:text-emerald-500" />
          <span>Uploading media file...</span>
        </div>
      )}

      {/* File upload failure warning */}
      {uploadError && (
        <div className="mx-4 mb-2 rounded bg-red-50 dark:bg-red-950/30 p-2 text-xs font-semibold text-red-800 dark:text-red-300 border-l-4 border-red-500">
          {uploadError}
        </div>
      )}

      {/* Emoji & Sticker Picker Popover */}
      {isPickerOpen && (
        <div
          ref={pickerRef}
          className="picker-popover absolute bottom-16 left-4 z-20 w-80 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-850/95 shadow-xl backdrop-blur-md flex flex-col h-72"
        >
          {/* Header Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 p-2 shrink-0">
            <button
              onClick={() => setActivePickerTab('emojis')}
              className={`flex-1 text-center py-1.5 text-xs font-bold rounded-lg transition-all ${
                activePickerTab === 'emojis'
                  ? 'bg-[#075E54] text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              Emojis
            </button>
            <button
              onClick={() => setActivePickerTab('stickers')}
              className={`flex-1 text-center py-1.5 text-xs font-bold rounded-lg transition-all ${
                activePickerTab === 'stickers'
                  ? 'bg-[#075E54] text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              Stickers
            </button>
          </div>

          {/* Grid Content */}
          <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
            {activePickerTab === 'emojis' ? (
              <div className="grid grid-cols-8 gap-2 justify-items-center">
                {EMOJI_LIST.map((emoji, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleEmojiClick(emoji)}
                    className="text-2xl hover:scale-120 hover:bg-gray-100 dark:hover:bg-gray-800 rounded p-1 transition duration-150"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 justify-items-center">
                {STICKER_LIST.map((sticker) => (
                  <button
                    key={sticker.id}
                    onClick={() => {
                      sendMessage('', sticker.url, 'image');
                      setIsPickerOpen(false);
                    }}
                    className="group flex flex-col items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition duration-200"
                  >
                    <img
                      src={sticker.url}
                      alt={sticker.name}
                      className="h-16 w-16 object-contain group-hover:scale-110 transition duration-200"
                    />
                    <span className="text-[9px] text-gray-500 dark:text-gray-400 mt-1 select-none font-semibold truncate max-w-full">
                      {sticker.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3.5 REPLY PREVIEW COMPOSER BAR */}
      {replyingToMessage && (
        <div className="flex items-center justify-between px-5 py-2 bg-[#1A1C28]/90 border-t border-[#2C3045] backdrop-blur z-10 select-none">
          <div className="flex flex-col min-w-0 border-l-4 border-orange-500 pl-3">
            <span className="text-xs font-bold text-orange-400">
              Replying to {replyingToMessage.senderId?._id === user?._id ? 'yourself' : (replyingToMessage.senderId?.name || 'User')}
            </span>
            <span className="text-[11px] text-gray-300 truncate mt-0.5">
              {replyingToMessage.content && replyingToMessage.content.startsWith('{"_echoType"') 
                ? (() => { try { return JSON.parse(replyingToMessage.content).text; } catch(e) { return replyingToMessage.content; } })()
                : replyingToMessage.content || 'Media/Attachment'}
            </span>
          </div>
          <button
            onClick={() => setReplyingToMessage(null)}
            className="p-1 rounded-full hover:bg-white/5 text-gray-400"
            title="Cancel reply"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 4. INPUT CONTROLS BAR */}
      {partner && blockedUsers.includes(partner._id) ? (
        <footer className="chat-input-footer flex shrink-0 items-center justify-center gap-2 px-4 py-4 z-10 border-t animate-in fade-in" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-panel)' }}>
          <div className="flex items-center gap-2 text-red-500 font-medium text-xs select-none">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>You have blocked this contact. Unblock to resume chatting.</span>
            <button
              onClick={() => toggleBlockUser(partner._id)}
              className="ml-2 px-3 py-1 rounded bg-[#FF6A00] hover:bg-[#FF8A00] text-white text-[10px] font-bold transition shadow"
            >
              Unblock
            </button>
          </div>
        </footer>
      ) : (
        <footer 
          className="chat-input-footer flex shrink-0 items-end gap-2 px-3 py-2.5 z-10"
          style={{ 
            paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' 
          }}
        >
          <div className="flex items-center gap-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300"
              title="Attach file"
              aria-label="Attach file"
            >
              <Paperclip className="h-5.5 w-5.5" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              onClick={() => setIsPickerOpen(!isPickerOpen)}
              className={`rounded-full p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition ${
                isPickerOpen
                  ? 'text-[#FF6A00] bg-gray-200 dark:bg-gray-700'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
              title="Emojis and Stickers"
              aria-label="Add emojis"
            >
              <Smile className="h-5.5 w-5.5" />
            </button>
          </div>

          <div className="flex-1">
            <textarea
              id="chat-input-textarea"
              rows="1"
              placeholder="Type a message"
              value={text}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              onFocus={handleInputFocus}
              disabled={sending}
              className="w-full resize-none rounded-lg px-3 py-2 text-sm disabled:opacity-75 composer-focus-ring message-content-text"
              style={{ maxHeight: '120px' }}
            />
          </div>

          {/* Send Action (Disabled or Loading Indicator Spinner) */}
          <button
            onClick={() => handleSend()}
            disabled={!text.trim() || sending}
            className="rounded-full bg-[#FF6A00] p-2.5 text-white shadow hover:bg-[#FF8C3A] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition btn-active-scale"
            title="Send message"
            aria-label="Send message"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </footer>
      )}

      {/* 5. UNIFIED DETAILS AND MEDIA PANEL */}
      {activeRightPanel && (
        <div 
          className="absolute right-0 top-0 h-full w-80 border-l border-[#2C3045] shadow-2xl z-20 flex flex-col transition-all duration-300"
          style={{ backgroundColor: 'var(--bg-panel)' }}
        >
          {/* Panel Header */}
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#2C3045] px-4 animate-in slide-in-from-right" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setActiveRightPanel('info')}
                className={`text-xs font-bold px-2.5 py-1 rounded transition ${activeRightPanel === 'info' ? 'bg-[#FF6A00] text-white animate-pulse' : 'text-gray-400 hover:text-white'}`}
              >
                Details
              </button>
              <button 
                onClick={() => setActiveRightPanel('media')}
                className={`text-xs font-bold px-2.5 py-1 rounded transition ${activeRightPanel === 'media' ? 'bg-[#FF6A00] text-white animate-pulse' : 'text-gray-400 hover:text-white'}`}
              >
                Media
              </button>
            </div>
            <button 
              onClick={() => setActiveRightPanel(null)} 
              className="p-1.5 rounded-full hover:bg-white/5 text-gray-400"
              aria-label="Close side panel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Panel Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin text-white">
            {activeRightPanel === 'info' ? (
              <>
                {/* Avatar & Basic Info */}
                <div className="flex flex-col items-center text-center pb-4 border-b border-[#2C3045]">
                  <div className="h-20 w-20 mb-3">
                    {roomAvatar ? (
                      <img src={roomAvatar} alt={roomTitle} className="h-full w-full rounded-full object-cover shadow-md border-2 border-orange-500/25" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-full text-2xl font-bold uppercase text-white shadow-md" style={{ backgroundColor: getInitialsBg(roomTitle) }}>
                        {initials}
                      </div>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-gray-100">{roomTitle}</h3>
                  {!isGroup && <p className="text-[11px] text-gray-400 mt-0.5">{partner?.email}</p>}
                  <span className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isGroup ? 'bg-orange-500/10 text-orange-400' : partner?.isOnline ? 'bg-green-500/10 text-green-400' : 'bg-gray-800 text-gray-400'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${isGroup ? 'bg-orange-500' : partner?.isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />
                    {isGroup ? `${activeRoom.participants.length} Members` : partner?.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>

                {/* About / Status */}
                {!isGroup && (
                  <div className="space-y-1 pb-3 border-b border-[#2C3045]">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">About</h4>
                    <p className="text-xs text-gray-200">Hey there! I am using Echo Connect.</p>
                    {!partner?.isOnline && (
                      <p className="text-[10px] text-gray-400">
                        Last seen: {formatLastSeen(partner?.lastSeen)}
                      </p>
                    )}
                  </div>
                )}

                {/* Pinned Messages List */}
                <div className="space-y-2 pb-3 border-b border-[#2C3045]">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Pin className="h-3 w-3 rotate-45 text-orange-405" />
                    Pinned Messages
                  </h4>
                  {messages.filter(m => m.isPinned).length === 0 ? (
                    <p className="text-[11px] text-gray-500 italic">No pinned messages yet</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-none">
                      {messages.filter(m => m.isPinned).map(msg => {
                        let previewText = msg.content;
                        if (previewText && previewText.startsWith('{"_echoType"')) {
                          try {
                            const parsed = JSON.parse(previewText);
                            if (parsed.text) previewText = parsed.text;
                          } catch(e) {}
                        }
                        return (
                          <div 
                            key={msg._id}
                            onClick={() => {
                              const el = document.querySelector(`[data-message-id="${msg._id}"]`);
                              if (el) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                el.classList.add('highlight-flash');
                                setTimeout(() => el.classList.remove('highlight-flash'), 2000);
                              }
                            }}
                            className="p-2 rounded bg-white/5 hover:bg-white/10 text-[11px] cursor-pointer truncate transition"
                          >
                            <span className="font-semibold text-orange-450 block text-[9px] mb-0.5">{msg.senderId?.name || 'User'}</span>
                            {previewText || 'Media/Attachment'}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Group Members List */}
                {isGroup && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Members</h4>
                    <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-none">
                      {activeRoom.participants.map(member => (
                        <div key={member._id} className="flex items-center gap-2.5 p-1.5 hover:bg-white/5 rounded transition">
                          <div className="relative h-7 w-7 shrink-0">
                            {member.avatar ? (
                              <img src={member.avatar} alt={member.name} className="h-full w-full rounded-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center rounded-full bg-orange-500/10 text-white text-[10px] font-bold uppercase">
                                {getInitials(member.name)}
                              </div>
                            )}
                            {member.isOnline && (
                              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full border border-gray-900 bg-green-500" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold text-gray-200 truncate">
                              {member.name} {member._id === user?._id && <span className="text-gray-400 font-normal">(You)</span>}
                            </span>
                            <span className="text-[9px] text-gray-400 truncate">
                              {member.isOnline ? 'Online' : formatLastSeen(member.lastSeen)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Media Tab Shared media files grid */
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Shared Media</h4>
                {messages.filter(m => m.mediaUrl && m.type === 'image').length === 0 ? (
                  <div className="text-center p-8 text-xs text-gray-500 italic">No media shared in this chat</div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {messages.filter(m => m.mediaUrl && m.type === 'image').map((msg) => (
                      <div 
                        key={msg._id} 
                        onClick={() => setActiveImage(msg.mediaUrl)}
                        className="aspect-square rounded overflow-hidden cursor-zoom-in bg-white/5 border border-white/5 hover:border-orange-500/50 transition duration-150 animate-in fade-in zoom-in-95"
                      >
                        <img 
                          src={msg.mediaUrl} 
                          alt="Shared Media" 
                          className="h-full w-full object-cover hover:scale-108 transition duration-200" 
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. FULLSCREEN IMAGE LIGHTBOX VIEWER */}
      {activeImage && (
        <div 
          onClick={() => setActiveImage(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4 transition-opacity duration-300"
        >
          {/* Controls Bar */}
          <div className="absolute right-4 top-4 flex items-center gap-2">
            <a 
              href={activeImage} 
              download
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="rounded bg-white/10 p-2 text-white hover:bg-white/20 transition"
              title="Download Image"
              aria-label="Download image"
            >
              <Download className="h-5 w-5" />
            </a>
            <button 
              onClick={() => setActiveImage(null)}
              className="rounded bg-white/10 p-2 text-white hover:bg-white/20 transition"
              aria-label="Close Lightbox"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <img 
            src={activeImage} 
            alt="Fullscreen Preview" 
            onClick={e => e.stopPropagation()}
            className="max-h-[85vh] max-w-[90vw] object-contain rounded shadow-2xl" 
          />
        </div>
      )}

      {/* 7. CONTEXT MENU */}
      {contextMenu.visible && contextMenu.msg && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 min-w-[200px] rounded-xl bg-[var(--bg-panel)]/95 border border-[var(--border)] py-1.5 shadow-2xl backdrop-blur-md text-[var(--text-primary)] overflow-hidden"
        >
          {/* Reaction Shortcut Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border)] gap-1">
            {['👍', '❤️', '😂', '🔥', '🎉', '😢'].map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  sendReaction(contextMenu.messageId, emoji);
                  closeContextMenu();
                }}
                className="hover:scale-125 transition duration-100 text-lg p-1 hover:bg-[var(--bg-hover)] rounded-md"
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="py-1">
            <button
              onClick={() => {
                setReplyingToMessage(contextMenu.msg);
                closeContextMenu();
              }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left text-xs font-semibold hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-primary)]"
            >
              <Reply className="h-4 w-4 text-[#FF6A00]" />
              Reply
            </button>

            {contextMenu.msg.content && (
              <button
                onClick={() => {
                  let copyText = contextMenu.msg.content;
                  if (copyText.startsWith('{"_echoType"')) {
                    try {
                      const parsed = JSON.parse(copyText);
                      if (parsed.text) copyText = parsed.text;
                    } catch(e) {}
                  }
                  navigator.clipboard.writeText(copyText);
                  addToast('Message copied to clipboard', 'success');
                  closeContextMenu();
                }}
                className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left text-xs font-semibold hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-primary)]"
              >
                <Copy className="h-4 w-4 text-[#FF6A00]" />
                Copy Text
              </button>
            )}

            <button
              onClick={() => {
                toggleStarMessage(contextMenu.messageId);
                closeContextMenu();
              }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left text-xs font-semibold hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-primary)]"
            >
              <Star className={`h-4 w-4 ${starredMessages?.some(sm => sm._id === contextMenu.messageId) ? 'text-orange-500 fill-orange-500' : 'text-[#FF6A00]'}`} />
              {starredMessages?.some(sm => sm._id === contextMenu.messageId) ? 'Unstar Message' : 'Star Message'}
            </button>

            <button
              onClick={() => {
                sendPinMessage(contextMenu.messageId);
                closeContextMenu();
              }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left text-xs font-semibold hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-primary)]"
            >
              <Pin className={`h-4 w-4 ${contextMenu.msg.isPinned ? 'text-yellow-500 fill-yellow-500 rotate-45' : 'text-[#FF6A00]'}`} />
              {contextMenu.msg.isPinned ? 'Unpin Message' : 'Pin Message'}
            </button>

            <button
              onClick={() => {
                setForwardingMessage(contextMenu.msg);
                setSelectedForwardRooms([]);
                setForwardSearchQuery('');
                closeContextMenu();
              }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left text-xs font-semibold hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-primary)]"
            >
              <Share2 className="h-4 w-4 text-[#FF6A00]" />
              Forward Message
            </button>

            <button
              onClick={() => {
                addToast('Message selection enabled', 'info');
                closeContextMenu();
              }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left text-xs font-semibold hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-primary)]"
            >
              <CheckSquare className="h-4 w-4 text-[#FF6A00]" />
              Select Message
            </button>

            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to report this message?')) {
                  addToast('Message reported successfully', 'success');
                }
                closeContextMenu();
              }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left text-xs font-semibold hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-primary)]"
            >
              <Flag className="h-4 w-4 text-red-500" />
              Report Message
            </button>

            <div className="border-t border-[var(--border)] my-1"></div>

            {contextMenu.isSelf && (
              <button
                onClick={() => {
                  sendDeleteForEveryone(contextMenu.messageId);
                  closeContextMenu();
                }}
                className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left text-xs font-semibold text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
                Delete for Everyone
              </button>
            )}

            <button
              onClick={() => {
                deleteMessageForMe(contextMenu.messageId);
                closeContextMenu();
              }}
              className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-left text-xs font-semibold text-red-450 hover:bg-red-450/10 transition-colors"
            >
              <Trash2 className="h-4 w-4 text-red-400" />
              Delete for Me
            </button>
          </div>
        </div>
      )}

      {/* 8. MOCK CALLING INTERFACE OVERLAY */}
      {activeCall && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-gray-900/95 via-gray-950/98 to-gray-900/95 backdrop-blur-md text-white p-6 font-sans">
          {/* Header */}
          <div className="w-full flex items-center justify-between opacity-80 mt-4 px-4">
            <span className="text-xs font-semibold tracking-wider uppercase flex items-center gap-1.5 text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              End-to-End Encrypted
            </span>
            <span className="text-sm font-medium bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
              {activeCall.type === 'video' ? 'Video Call' : 'Voice Call'}
            </span>
          </div>

          {/* Call Body */}
          <div className="flex flex-col items-center justify-center flex-1 space-y-6 w-full md:max-w-sm h-full">
            {activeCall.type === 'video' && activeCall.status === 'connected' ? (
              // Video Feed
              <div className="relative w-full h-full flex-1 md:h-auto md:flex-none md:aspect-video rounded-xl bg-gray-955 border border-white/10 overflow-hidden shadow-2xl flex items-center justify-center group">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
                
                {/* Fallback avatar if remote track not active */}
                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-950 via-teal-900 to-slate-900 animate-gradient-xy flex flex-col items-center justify-center pointer-events-none opacity-0 group-only:opacity-100 transition-opacity">
                  {roomAvatar ? (
                    <img 
                      src={roomAvatar} 
                      alt={roomTitle} 
                      className="h-20 w-20 rounded-full object-cover border-2 border-white/20 shadow-md"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-800 text-white text-2xl font-bold uppercase border-2 border-white/20">
                      {initials}
                    </div>
                  )}
                  <span className="mt-2 text-xs text-white/60">Waiting for remote feed...</span>
                </div>
                
                {/* Local Camera stream overlay picture-in-picture */}
                {!isVideoOff && (
                  <div className="absolute bottom-3 right-3 w-28 aspect-video rounded bg-gray-900 border border-white/25 overflow-hidden shadow-md">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            ) : (
              // Voice Call layout or Video Call Ringing/Video-Off layout
              <div className="relative flex items-center justify-center h-44 w-44">
                {activeCall.status === 'ringing' && (
                  <>
                    <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping-slow scale-150" />
                    <div className="absolute inset-2 rounded-full bg-emerald-500/15 animate-ping-slow scale-125" />
                    <div className="absolute inset-4 rounded-full bg-emerald-500/20 animate-ping-slow" />
                  </>
                )}
                <div className="relative z-10 h-28 w-28 rounded-full border-4 border-emerald-500/30 overflow-hidden shadow-2xl bg-gray-800">
                  {roomAvatar ? (
                    <img src={roomAvatar} alt={roomTitle} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-emerald-700 text-3xl font-bold uppercase text-emerald-100">
                      {initials}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contact Name & Status */}
            <div className="text-center">
              <h2 className="text-xl font-bold tracking-wide text-white">{roomTitle}</h2>
              <p className="text-sm font-medium text-emerald-400 mt-1">
                {activeCall.status === 'ringing' 
                  ? 'Ringing...' 
                  : `Connected • ${formatCallTimer(callDuration)}`
                }
              </p>
            </div>
          </div>

          {/* Call Controls Bar */}
          <div className="flex items-center gap-6 bg-white/10 px-6 py-4 rounded-3xl backdrop-blur-md border border-white/5 mb-8 shadow-lg">
            <button
              onClick={handleToggleMute}
              className={`p-3.5 rounded-full transition-all duration-200 ${
                isMuted 
                  ? 'bg-red-500/20 text-red-500 border border-red-500/40 hover:bg-red-500/30' 
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="h-5.5 w-5.5" /> : <Mic className="h-5.5 w-5.5" />}
            </button>

            <button
              onClick={handleEndCall}
              className="p-4 rounded-full bg-red-600 text-white hover:bg-red-500 active:scale-95 shadow-lg shadow-red-600/30 transition duration-200"
              title="End Call"
              aria-label="End call"
            >
              <PhoneOff className="h-6 w-6" />
            </button>

            {activeCall.type === 'video' ? (
              <button
                onClick={handleToggleVideo}
                className={`p-3.5 rounded-full transition-all duration-200 ${
                  isVideoOff 
                    ? 'bg-red-500/20 text-red-500 border border-red-500/40 hover:bg-red-500/30' 
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
                aria-label={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
              >
                {isVideoOff ? <VideoOff className="h-5.5 w-5.5" /> : <Video className="h-5.5 w-5.5" />}
              </button>
            ) : (
              <button
                className="p-3.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
                title="Speaker"
                aria-label="Speaker"
              >
                <Volume2 className="h-5.5 w-5.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 9. INCOMING CALL NOTIFICATION OVERLAY */}
      {incomingCall && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md text-white p-6 font-sans">
          <div className="bg-gray-900/90 border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center space-y-6 shadow-2xl backdrop-blur-xl">
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-400 flex items-center justify-center gap-1.5 animate-pulse">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Incoming {incomingCall.type === 'video' ? 'Video' : 'Voice'} Call
            </span>
            
            <div className="flex justify-center">
              <div className="relative h-24 w-24">
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping-slow" />
                <div className="h-full w-full rounded-full border-2 border-emerald-500 overflow-hidden shadow-lg bg-gray-800">
                  {incomingCall.callerAvatar ? (
                    <img src={incomingCall.callerAvatar} alt={incomingCall.callerName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-emerald-700 text-2xl font-bold uppercase text-emerald-100">
                      {getInitials(incomingCall.callerName)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">{incomingCall.callerName}</h3>
              <p className="text-xs text-gray-400 mt-1">Calling you...</p>
            </div>

            <div className="flex items-center justify-center gap-6 pt-4">
              <button
                onClick={handleDeclineCall}
                className="flex items-center justify-center h-12 w-12 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 shadow-lg shadow-red-600/30 transition duration-200"
                title="Decline"
                aria-label="Decline Call"
              >
                <PhoneOff className="h-5 w-5" />
              </button>

              <button
                onClick={handleAcceptCall}
                className="flex items-center justify-center h-12 w-12 rounded-full bg-emerald-600 hover:bg-emerald-500 active:scale-95 shadow-lg shadow-emerald-600/30 transition duration-200"
                title="Accept"
                aria-label="Accept Call"
              >
                <Phone className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 9. FORWARD MESSAGE MODAL OVERLAY */}
      {forwardingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 text-white">
          <div className="w-full max-w-md rounded-2xl bg-[#1A1C28] border border-[#2C3045] shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2C3045]">
              <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                <Share2 className="h-4 w-4 text-orange-400" />
                Forward Message
              </h3>
              <button
                onClick={() => setForwardingMessage(null)}
                className="p-1 rounded-full hover:bg-white/5 text-gray-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Room Search Input */}
            <div className="p-3 border-b border-[#2C3045] bg-[#12121A]">
              <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-[#2C3045] echo-search-container">
                <Search className="h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search chats..."
                  value={forwardSearchQuery}
                  onChange={(e) => setForwardSearchQuery(e.target.value)}
                  className="bg-transparent text-xs w-full outline-none focus:outline-none placeholder-gray-500 echo-search-input"
                />
              </div>
            </div>

            {/* Rooms List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-[#2C3045]/30 scrollbar-none">
              {(rooms || [])
                .filter(room => {
                  const title = room.type === 'group' ? room.groupName : (room.participants?.find(p => p._id !== user?._id)?.name || '');
                  return title.toLowerCase().includes(forwardSearchQuery.toLowerCase());
                })
                .map(room => {
                  const title = room.type === 'group' ? room.groupName : (room.participants?.find(p => p._id !== user?._id)?.name || 'Direct Chat');
                  const avatar = room.type === 'group' ? room.groupAvatar : room.participants?.find(p => p._id !== user?._id)?.avatar;
                  const isSelected = selectedForwardRooms.includes(room._id);
                  return (
                    <div
                      key={room._id}
                      onClick={() => {
                        setSelectedForwardRooms(prev => 
                          prev.includes(room._id) ? prev.filter(id => id !== room._id) : [...prev, room._id]
                        );
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition ${isSelected ? 'bg-orange-500/10' : 'hover:bg-white/5'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full overflow-hidden shrink-0 bg-white/10 flex items-center justify-center text-xs font-bold uppercase">
                          {avatar ? <img src={avatar} alt={title} className="h-full w-full object-cover" /> : getInitials(title)}
                        </div>
                        <span className="text-xs font-semibold text-gray-200">{title}</span>
                      </div>
                      <div className={`h-4 w-4 rounded-full border flex items-center justify-center transition ${isSelected ? 'border-orange-500 bg-orange-500' : 'border-gray-500'}`}>
                        {isSelected && <Check className="h-3 w-3 text-white stroke-[3px]" />}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Bottom Actions */}
            <div className="p-4 border-t border-[#2C3045] flex items-center justify-between bg-[#12121A]">
              <span className="text-[11px] text-gray-400">
                {selectedForwardRooms.length} chat{selectedForwardRooms.length !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={async () => {
                  if (selectedForwardRooms.length === 0) return;
                  try {
                    for (const roomId of selectedForwardRooms) {
                      await sendForwardMessage(forwardingMessage, roomId);
                    }
                    addToast('Message forwarded successfully', 'success');
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setForwardingMessage(null);
                  }
                }}
                disabled={selectedForwardRooms.length === 0}
                className="px-4 py-2 rounded-lg bg-[#FF6A00] text-xs font-bold hover:bg-[#FF8C3A] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Forward Message
              </button>
            </div>
          </div>
        </div>
      )}


      
      <style>{`
        @keyframes dotbounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .typer-dot {
          animation: dotbounce 0.8s infinite ease-in-out;
        }
        @keyframes ping-slow {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .animate-ping-slow {
          animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        @keyframes gradient-xy {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-xy {
          background-size: 400% 400%;
          animation: gradient-xy 15s ease infinite;
        }
      `}</style>
    </div>
  );
};

export default ChatWindow;
