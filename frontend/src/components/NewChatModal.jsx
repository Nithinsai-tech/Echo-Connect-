import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useChat } from '../hooks/useChat';
import { getInitials } from '../utils/getInitials';
import { searchUsers } from '../api';
import { 
  X, 
  Search, 
  Users, 
  ArrowRight, 
  ArrowLeft, 
  Camera, 
  Check, 
  Loader2 
} from 'lucide-react';

const NewChatModal = ({ isOpen, onClose, initialStep = 'private' }) => {
  const { user } = useAuth();
  const {
    users,
    createDM,
    createGroup,
    uploadAttachmentFile,
    sendRequest,
    acceptRequest,
    declineRequest
  } = useChat();

  // Modal Flow state: 'private' | 'group-step1' | 'group-step2'
  const [step, setStep] = useState(initialStep);
  
  // Search query
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected participants for group
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  
  // Group creation details
  const [groupName, setGroupName] = useState('');
  const [groupAvatarFile, setGroupAvatarFile] = useState(null);
  const [groupAvatarPreview, setGroupAvatarPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Contact discovery states
  const [searchMode, setSearchMode] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Animation states
  const [animate, setAnimate] = useState(false);

  // Debounced search for global contact discovery
  useEffect(() => {
    if (!searchMode || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearching(true);
      setErrorMsg('');
      try {
        const res = await searchUsers(searchQuery);
        if (res.success) {
          setSearchResults(res.data || []);
        }
      } catch (err) {
        console.error('Error searching users:', err);
        setErrorMsg('Failed to fetch search results');
      } finally {
        setSearching(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, searchMode]);

  const handleAddFriend = async (targetUser) => {
    try {
      setErrorMsg('');
      await sendRequest(targetUser._id);
      setSearchResults(prev => prev.map(u => 
        u._id === targetUser._id 
          ? { ...u, relationship: 'pending', requestSender: user._id }
          : u
      ));
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Failed to send friend request');
    }
  };

  const handleAcceptFriendInSearch = async (targetUser) => {
    try {
      setErrorMsg('');
      await acceptRequest(targetUser.requestId);
      setSearchResults(prev => prev.map(u => 
        u._id === targetUser._id 
          ? { ...u, relationship: 'contact' }
          : u
      ));
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Failed to accept friend request');
    }
  };

  const handleDeclineFriendInSearch = async (targetUser) => {
    try {
      setErrorMsg('');
      await declineRequest(targetUser.requestId);
      setSearchResults(prev => prev.map(u => 
        u._id === targetUser._id 
          ? { ...u, relationship: 'none' }
          : u
      ));
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Failed to decline friend request');
    }
  };

  // Trigger smooth enter transition
  useEffect(() => {
    if (isOpen) {
      setAnimate(true);
      setStep(initialStep);
      setSearchQuery('');
      setSelectedParticipants([]);
      setGroupName('');
      setGroupAvatarFile(null);
      setGroupAvatarPreview('');
      setErrorMsg('');
      setSearchMode(false);
      setSearchResults([]);
      setSearching(false);
    } else {
      setAnimate(false);
    }
  }, [isOpen, initialStep]);

  // Clean up avatar preview URL
  useEffect(() => {
    return () => {
      if (groupAvatarPreview && groupAvatarPreview.startsWith('blob:')) {
        URL.revokeObjectURL(groupAvatarPreview);
      }
    };
  }, [groupAvatarPreview]);

  // Escape key overlay dismissal
  useEffect(() => {
    const handleDismiss = () => {
      onClose();
    };
    window.addEventListener('dismiss-overlays', handleDismiss);
    return () => window.removeEventListener('dismiss-overlays', handleDismiss);
  }, [onClose]);

  if (!isOpen) return null;

  // Filter users directory
  const filteredUsers = users.filter(u => 
    u._id !== user?._id && 
    (u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleStartPrivateChat = async (targetUserId) => {
    try {
      await createDM(targetUserId);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to start conversation');
    }
  };

  const handleToggleParticipant = (userId) => {
    setSelectedParticipants(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrorMsg('Only image files are allowed');
        return;
      }
      setGroupAvatarFile(file);
      setGroupAvatarPreview(URL.createObjectURL(file));
      setErrorMsg('');
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setErrorMsg('Group name is required');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    let avatarUrl = '';

    try {
      if (groupAvatarFile) {
        const uploadRes = await uploadAttachmentFile(groupAvatarFile);
        if (uploadRes && uploadRes.mediaUrl) {
          avatarUrl = uploadRes.mediaUrl;
        }
      }

      await createGroup(groupName.trim(), selectedParticipants, avatarUrl);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to create group');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-0 md:p-4 transition-opacity duration-300">
      
      {/* Modal Container */}
      <div 
        className={`flex flex-col bg-white dark:bg-gray-900 w-full h-full md:h-auto md:max-h-[640px] md:max-w-[480px] md:rounded-lg shadow-2xl overflow-hidden transition-all duration-300 transform ${
          animate ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between bg-[#075E54] px-4 text-white">
          <div className="flex items-center gap-2">
            {(step !== 'private' || searchMode) && (
              <button 
                onClick={() => {
                  if (searchMode) {
                    setSearchMode(false);
                    setSearchQuery('');
                    setErrorMsg('');
                  } else {
                    if (step === 'group-step1') setStep('private');
                    if (step === 'group-step2') setStep('group-step1');
                    setErrorMsg('');
                  }
                }}
                className="rounded-full p-1 hover:bg-[#075e54]/80"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <h2 className="text-lg font-bold">
              {searchMode && 'Find People'}
              {!searchMode && step === 'private' && 'New Chat'}
              {step === 'group-step1' && 'Add Group Participants'}
              {step === 'group-step2' && 'New Group'}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-[#075e54]/80"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Dynamic Step Content */}
        {step === 'private' && (
          <div className="flex flex-1 flex-col overflow-hidden min-h-0">
            {errorMsg && (
              <div className="bg-red-50 dark:bg-red-950/25 border-b border-red-100 dark:border-red-900/30 px-4 py-2 text-xs font-semibold text-red-600 dark:text-red-400">
                {errorMsg}
              </div>
            )}

            {/* Search Box */}
            <div className="border-b border-gray-100 dark:border-gray-800 px-4 py-2 bg-gray-50 dark:bg-gray-850">
              <div className="flex items-center rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 px-3 py-1.5">
                <Search className="mr-2 h-4 w-4 text-gray-400 dark:text-gray-550" />
                <input
                  type="text"
                  placeholder={searchMode ? "Search globally by username or email" : "Search contacts"}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none"
                />
              </div>
            </div>

            {!searchMode ? (
              <>
                {/* Create Group Action button */}
                <div
                  onClick={() => {
                    setStep('group-step1');
                    setSearchQuery('');
                  }}
                  className="flex cursor-pointer items-center border-b border-gray-100 dark:border-gray-800 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-850/40 transition"
                >
                  <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#075E54]/10 text-[#075E54] dark:text-emerald-400">
                    <Users className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">New Group Chat</span>
                </div>

                {/* Find People / Add Contact Action button */}
                <div
                  onClick={() => {
                    setSearchMode(true);
                    setSearchQuery('');
                  }}
                  className="flex cursor-pointer items-center border-b border-gray-100 dark:border-gray-800 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-850/40 transition"
                >
                  <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#075E54]/10 text-[#075E54] dark:text-emerald-400">
                    <Search className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Find People / Add Contact</span>
                </div>

                {/* Contact list title */}
                <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#075E54] dark:text-emerald-450 bg-gray-50/50 dark:bg-gray-850/30 border-b border-gray-100 dark:border-gray-800">
                  Contacts
                </div>

                {/* Users list scroll area */}
                <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No contacts available</p>
                      <button
                        onClick={() => setSearchMode(true)}
                        className="text-xs font-semibold text-[#075E54] dark:text-emerald-400 hover:underline"
                      >
                        Add Contacts
                      </button>
                    </div>
                  ) : (
                    filteredUsers.map(u => (
                      <div
                        key={u._id}
                        onClick={() => handleStartPrivateChat(u._id)}
                        className="flex cursor-pointer items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-850/40 transition"
                      >
                        <div className="relative mr-3 h-10 w-10 shrink-0">
                          {u.avatar ? (
                            <img src={u.avatar} alt={u.name} className="h-full w-full rounded-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-sm font-bold uppercase text-emerald-800 dark:text-emerald-300">
                              {getInitials(u.name)}
                            </div>
                          )}
                          {u.isOnline && (
                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-white dark:border-gray-900 bg-green-500" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{u.name}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-550 truncate">{u.email}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              // Contact discovery search mode
              <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
                {searching ? (
                  <div className="flex justify-center items-center p-12">
                    <Loader2 className="h-6 w-6 animate-spin text-[#075E54] dark:text-emerald-450" />
                  </div>
                ) : !searchQuery.trim() ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500 dark:text-gray-400">
                    <Search className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm font-semibold">Search EchoConnect Directory</p>
                    <p className="text-xs mt-1 max-w-[240px]">Type a username or email to discover and add contacts.</p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500 dark:text-gray-400">
                    <p className="text-sm font-semibold">No users found</p>
                    <p className="text-xs mt-1">Make sure spelling is correct.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {searchResults.map(u => (
                      <div
                        key={u._id}
                        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-850/20 transition"
                      >
                        <div className="flex items-center min-w-0 mr-2">
                          <div className="relative mr-3 h-10 w-10 shrink-0">
                            {u.avatar ? (
                              <img src={u.avatar} alt={u.name} className="h-full w-full rounded-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-sm font-bold uppercase text-emerald-800 dark:text-emerald-300">
                                {getInitials(u.name)}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{u.name}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-550 truncate">{u.email}</span>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {u.relationship === 'contact' ? (
                            <button
                              onClick={() => {
                                handleStartPrivateChat(u._id);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold transition"
                            >
                              Chat
                            </button>
                          ) : u.relationship === 'pending' ? (
                            u.requestSender === user?._id ? (
                              <span className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-550 text-xs font-semibold select-none">
                                Pending
                              </span>
                            ) : (
                              <div className="flex items-center">
                                <button
                                  onClick={() => handleAcceptFriendInSearch(u)}
                                  className="px-2.5 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition mr-1"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleDeclineFriendInSearch(u)}
                                  className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition"
                                >
                                  Decline
                                </button>
                              </div>
                            )
                          ) : (
                            <button
                              onClick={() => handleAddFriend(u)}
                              className="px-3 py-1.5 rounded-lg bg-[#075E54] hover:bg-[#075E54]/95 text-white text-xs font-bold transition"
                            >
                              Add Friend
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Group Step 1: Select Participants */}
        {step === 'group-step1' && (
          <div className="flex flex-1 flex-col overflow-hidden min-h-0">
            {/* Search Box */}
            <div className="border-b border-gray-100 dark:border-gray-800 px-4 py-2 bg-gray-50 dark:bg-gray-850">
              <div className="flex items-center rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 px-3 py-1.5">
                <Search className="mr-2 h-4 w-4 text-gray-400 dark:text-gray-550" />
                <input
                  type="text"
                  placeholder="Search contact"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm text-gray-800 dark:text-gray-100 focus:outline-none"
                />
              </div>
            </div>

            {/* Selected Chips container */}
            {selectedParticipants.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-b border-gray-100 dark:border-gray-800 px-4 py-2.5 max-h-24 overflow-y-auto bg-gray-50/50 dark:bg-gray-850/30">
                {selectedParticipants.map(id => {
                  const targetUser = users.find(u => u._id === id);
                  if (!targetUser) return null;
                  return (
                    <div 
                      key={id} 
                      className="flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 pl-2 pr-1 py-0.5 text-xs text-emerald-800 dark:text-emerald-300 font-medium"
                    >
                      <span className="truncate max-w-[80px]">{targetUser.name}</span>
                      <button 
                        type="button" 
                        onClick={() => handleToggleParticipant(id)}
                        className="rounded-full p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-600 dark:text-emerald-400"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Contacts list */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
              {filteredUsers.length === 0 ? (
                <p className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">No contacts available</p>
              ) : (
                filteredUsers.map(u => {
                  const isChecked = selectedParticipants.includes(u._id);
                  return (
                    <div
                      key={u._id}
                      onClick={() => handleToggleParticipant(u._id)}
                      className="flex cursor-pointer items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-850/40 transition"
                    >
                      <div className="flex items-center min-w-0">
                        <div className="relative mr-3 h-10 w-10 shrink-0">
                          {u.avatar ? (
                            <img src={u.avatar} alt={u.name} className="h-full w-full rounded-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-sm font-bold uppercase text-emerald-800 dark:text-emerald-300">
                              {getInitials(u.name)}
                            </div>
                          )}
                          {u.isOnline && (
                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-white dark:border-gray-900 bg-green-500" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{u.name}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-550 truncate">{u.email}</span>
                        </div>
                      </div>
                      
                      {/* Checkbox circle indicator */}
                      <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                        isChecked 
                          ? 'bg-[#075E54] border-[#075E54] text-white' 
                          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                      }`}>
                        {isChecked && <Check className="h-3 w-3" strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Actions footer */}
            <footer className="border-t border-gray-100 dark:border-gray-800 px-4 py-3.5 flex justify-end bg-gray-50 dark:bg-gray-850">
              <button
                disabled={selectedParticipants.length < 2}
                onClick={() => {
                  setStep('group-step2');
                  setSearchQuery('');
                }}
                className="flex items-center gap-1.5 rounded-full bg-[#075E54] px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#075e54]/95 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Next
                <ArrowRight className="h-4.5 w-4.5" />
              </button>
            </footer>
          </div>
        )}

        {/* Group Step 2: Group Details */}
        {step === 'group-step2' && (
          <form onSubmit={handleCreateGroup} className="flex flex-1 flex-col overflow-hidden min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              
              {/* Group Avatar Upload */}
              <div className="flex flex-col items-center space-y-2">
                <span className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-405">
                  Group Avatar
                </span>
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  {groupAvatarPreview ? (
                    <>
                      <img
                        src={groupAvatarPreview}
                        alt="Group Avatar Preview"
                        className="h-full w-full rounded-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setGroupAvatarFile(null);
                          setGroupAvatarPreview('');
                        }}
                        className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600 focus:outline-none"
                      >
                        <X className="h-4.5 w-4.5" />
                      </button>
                    </>
                  ) : (
                    <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                      <Camera className="h-7 w-7 text-gray-400 dark:text-gray-500" />
                      <span className="mt-1 text-[10px] text-gray-500 dark:text-gray-400 font-medium">Add Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                        disabled={submitting}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Group Subject Name */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Group Subject Name
                </label>
                <input
                  type="text"
                  placeholder="Provide a group subject..."
                  value={groupName}
                  onChange={(e) => {
                    setGroupName(e.target.value);
                    setErrorMsg('');
                  }}
                  className="block w-full rounded border border-gray-300 dark:border-gray-650 bg-gray-50 dark:bg-gray-700 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-[#075E54] focus:outline-none focus:ring-1 focus:ring-[#075E54]"
                  required
                  disabled={submitting}
                />
              </div>

              {/* Participants Counter summary */}
              <div className="rounded bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/60 p-3 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                Creating group with {selectedParticipants.length} participants
              </div>
            </div>

            {/* Error notifications */}
            {errorMsg && (
              <div className="mx-6 mb-4 rounded bg-red-50 dark:bg-red-950/20 p-3 border-l-4 border-red-500">
                <p className="text-xs font-semibold text-red-800 dark:text-red-300">{errorMsg}</p>
              </div>
            )}

            {/* Bottom Actions footer */}
            <footer className="border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between bg-gray-50 dark:bg-gray-850">
              <button
                type="button"
                onClick={() => setStep('group-step1')}
                disabled={submitting}
                className="rounded px-4 py-2 text-sm font-semibold text-gray-500 dark:text-gray-450 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting || !groupName.trim()}
                className="flex items-center justify-center gap-1.5 rounded bg-[#075E54] px-6 py-2 text-sm font-bold text-white shadow hover:bg-[#075e54]/95 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create'
                )}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
};

export default NewChatModal;
