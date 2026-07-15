import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { useToast } from './ToastContext';
import { useChat } from '../hooks/useChat';
import { getInitials } from '../utils/getInitials';
import {
  Mic,
  MicOff,
  PhoneOff,
  Phone,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react';

const CallContext = createContext(null);

export const CallProvider = ({ children }) => {
  const { user } = useAuth();
  const socket = useSocket();
  const { addToast } = useToast();
  const { fetchCalls } = useChat();

  const [activeCall, setActiveCall] = useState(null); // { type: 'voice' | 'video', status: 'ringing' | 'connected', isCaller: boolean, targetId: string, targetName: string, targetAvatar: string }
  const [incomingCall, setIncomingCall] = useState(null); // { roomId, callerId, callerName, callerAvatar, type, offer }
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // New Video Layout & Device States
  const [isSwapped, setIsSwapped] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isRemoteVideoOff, setIsRemoteVideoOff] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // WebRTC Calling Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null); // Dedicated audio element for voice calls
  const callOverlayRef = useRef(null); // Target for HTML5 Fullscreen

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const [localStreamState, setLocalStreamState] = useState(null);
  const [remoteStreamState, setRemoteStreamState] = useState(null);
  const iceCandidatesQueueRef = useRef([]);

  // Controls Visibility Timer
  const controlsTimeoutRef = useRef(null);

  // Web Audio Synthesizer for Ringtone & calling tones
  const audioContextRef = useRef(null);
  const ringtoneIntervalRef = useRef(null);

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (activeCall?.status === 'connected') {
        setShowControls(false);
      }
    }, 4000);
  };

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

  const handleIceRestart = async (targetUserId) => {
    try {
      const pc = peerConnectionRef.current;
      if (pc && socket) {
        console.log('Initiating WebRTC ICE restart...');
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        socket.emit('call:ice-restart', { targetUserId, offer });
      }
    } catch (e) {
      console.warn('ICE restart initiation failed:', e);
    }
  };

  const createPeerConnection = (targetUserId, roomId) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

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

    pc.oniceconnectionstatechange = () => {
      console.log('ICE Connection State changed:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        handleIceRestart(targetUserId);
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      const stream = event.streams[0] || new MediaStream([event.track]);
      setRemoteStreamState(stream);
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  const getUserMediaStream = async (videoRequired) => {
    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: videoRequired ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } : false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStreamState(stream);
      return stream;
    } catch (err) {
      console.warn('getUserMedia error, fallback to audio-only constraints:', err);
      if (videoRequired) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            },
            video: false
          });
          localStreamRef.current = stream;
          setLocalStreamState(stream);
          return stream;
        } catch (innerErr) {
          console.warn('Fallback audio-only failed:', innerErr);
        }
      }
      return null;
    }
  };

  const startVoiceCall = async (partnerId, roomId, partnerName, partnerAvatar) => {
    if (!partnerId || !socket) return;
    setActiveCall({ type: 'voice', status: 'ringing', isCaller: true, targetId: partnerId, targetName: partnerName, targetAvatar: partnerAvatar });
    startRingtone();

    try {
      const pc = createPeerConnection(partnerId, roomId);
      const stream = await getUserMediaStream(false);
      if (stream) {
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('call:initiate', {
        roomId,
        targetUserId: partnerId,
        type: 'voice',
        offer
      });
    } catch (e) {
      console.error('Failed to initiate voice call:', e);
      handleEndCall();
    }
  };

  const startVideoCall = async (partnerId, roomId, partnerName, partnerAvatar) => {
    if (!partnerId || !socket) return;
    setActiveCall({ type: 'video', status: 'ringing', isCaller: true, targetId: partnerId, targetName: partnerName, targetAvatar: partnerAvatar });
    startRingtone();

    try {
      const pc = createPeerConnection(partnerId, roomId);
      const stream = await getUserMediaStream(true);
      if (stream) {
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('call:initiate', {
        roomId,
        targetUserId: partnerId,
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

    const { callerId, callerName, callerAvatar, type, offer, roomId } = incomingCall;
    setActiveCall({ type, status: 'connected', isCaller: false, targetId: callerId, targetName: callerName, targetAvatar: callerAvatar });
    setIncomingCall(null);

    try {
      const pc = createPeerConnection(callerId, roomId);
      const stream = await getUserMediaStream(type === 'video');
      if (stream) {
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

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

  const handleEndCall = () => {
    stopRingtone();
    playDisconnectTone();

    const targetId = activeCall?.targetId || incomingCall?.callerId;
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

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.warn(err));
    }

    setLocalStreamState(null);
    setRemoteStreamState(null);
    iceCandidatesQueueRef.current = [];

    setActiveCall(null);
    setIncomingCall(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsSwapped(false);
    setIsRemoteVideoOff(false);
    setIsSpeakerOn(true);
    setIsFullscreen(false);
    setShowControls(true);
  };

  const handleToggleMute = () => {
    const stream = localStreamRef.current;
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      const nextMuteState = !isMuted;
      audioTracks.forEach(track => {
        track.enabled = !nextMuteState;
      });
      setIsMuted(nextMuteState);
    }
  };

  const handleToggleVideo = () => {
    const stream = localStreamRef.current;
    if (stream) {
      const videoTracks = stream.getVideoTracks();
      const nextVideoOff = !isVideoOff;
      videoTracks.forEach(track => {
        track.enabled = !nextVideoOff;
      });
      setIsVideoOff(nextVideoOff);
      if (socket && activeCall) {
        socket.emit('call:toggle-video', {
          targetUserId: activeCall.targetId,
          isVideoOff: nextVideoOff
        });
      }
    }
  };

  const toggleSpeaker = async () => {
    try {
      const newState = !isSpeakerOn;
      setIsSpeakerOn(newState);

      // Route audio to speaker or default
      const targetSinkId = newState ? 'default' : '';
      if (remoteVideoRef.current && remoteVideoRef.current.setSinkId) {
        await remoteVideoRef.current.setSinkId(targetSinkId);
      }
      if (remoteAudioRef.current && remoteAudioRef.current.setSinkId) {
        await remoteAudioRef.current.setSinkId(targetSinkId);
      }
    } catch (e) {
      console.warn('setSinkId failed:', e);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (callOverlayRef.current?.requestFullscreen) {
          await callOverlayRef.current.requestFullscreen();
          setIsFullscreen(true);
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          setIsFullscreen(false);
        }
      }
    } catch (e) {
      console.warn('Fullscreen request failed:', e);
    }
  };

  const formatCallTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Sync fullscreen state if user exits via escape key
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Call duration timer
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

  // Bind video and audio element streams when they render
  useEffect(() => {
    if (localVideoRef.current && localStreamState) {
      localVideoRef.current.srcObject = localStreamState;
    }
  }, [localStreamState, activeCall?.status, isVideoOff, isSwapped]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStreamState) {
      remoteVideoRef.current.srcObject = remoteStreamState;
    }
  }, [remoteStreamState, activeCall?.status, isSwapped]);

  // Bind audio for voice calls
  useEffect(() => {
    if (remoteAudioRef.current && remoteStreamState && activeCall?.type === 'voice') {
      remoteAudioRef.current.srcObject = remoteStreamState;
    }
  }, [remoteStreamState, activeCall?.status, activeCall?.type]);

  // Global socket calling listeners
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

    const handleCallRejected = (data) => {
      stopRingtone();
      playDisconnectTone();
      setActiveCall(null);
      if (data && data.reason === 'offline') {
        addToast('Contact is offline.', 'error');
      } else {
        addToast('Call rejected or busy.', 'info');
      }
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
      setIsMuted(false);
      setIsVideoOff(false);
      setIsSwapped(false);
      setIsRemoteVideoOff(false);
      setIsSpeakerOn(true);
      setIsFullscreen(false);
      setShowControls(true);
    };

    const handleVideoStateChanged = (data) => {
      const { senderId, isVideoOff: remoteVideoState } = data;
      if (activeCall && activeCall.targetId === senderId) {
        setIsRemoteVideoOff(remoteVideoState);
      }
    };

    const handleIceRestartReceived = async (data) => {
      const { senderId, offer } = data;
      console.log('Handling incoming ICE restart offer from:', senderId);
      try {
        const pc = peerConnectionRef.current;
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('call:answer', { callerId: senderId, answer });
        }
      } catch (e) {
        console.warn('Failed to answer ICE restart:', e);
      }
    };

    socket.on('call:incoming', handleIncomingCall);
    socket.on('call:answered', handleCallAnswered);
    socket.on('call:rejected', handleCallRejected);
    socket.on('call:candidate', handleCallCandidate);
    socket.on('call:ended', handleCallEnded);
    socket.on('call:video-state', handleVideoStateChanged);
    socket.on('call:ice-restart', handleIceRestartReceived);

    return () => {
      socket.off('call:incoming', handleIncomingCall);
      socket.off('call:answered', handleCallAnswered);
      socket.off('call:rejected', handleCallRejected);
      socket.off('call:candidate', handleCallCandidate);
      socket.off('call:ended', handleCallEnded);
      socket.off('call:video-state', handleVideoStateChanged);
      socket.off('call:ice-restart', handleIceRestartReceived);
    };
  }, [socket, activeCall, incomingCall]);

  // Escape key end call handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleEndCall();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCall, incomingCall]);

  // Clean up resources on provider unmount
  useEffect(() => {
    return () => {
      stopRingtone();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const partnerName = activeCall ? activeCall.targetName : '';
  const partnerAvatar = activeCall ? activeCall.targetAvatar : '';
  const initials = partnerName ? getInitials(partnerName) : '';

  const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const hasSinkSupport = typeof HTMLMediaElement !== 'undefined' && !!HTMLMediaElement.prototype.setSinkId;

  // Video Swapping CSS Classes
  const remoteVideoClass = !isSwapped
    ? "absolute inset-0 w-full h-full object-cover z-10 transition-all duration-300"
    : "absolute bottom-24 right-4 w-28 md:w-44 aspect-[3/4] md:aspect-video rounded-2xl border border-white/20 shadow-2xl overflow-hidden cursor-pointer z-30 transition-all duration-300 hover:scale-105 bg-gray-900";

  const localVideoClass = isSwapped
    ? "absolute inset-0 w-full h-full object-cover z-10 transition-all duration-300"
    : "absolute bottom-24 right-4 w-28 md:w-44 aspect-[3/4] md:aspect-video rounded-2xl border border-white/20 shadow-2xl overflow-hidden cursor-pointer z-30 transition-all duration-300 hover:scale-105 bg-gray-900";

  return (
    <CallContext.Provider
      value={{
        activeCall,
        incomingCall,
        isMuted,
        isVideoOff,
        callDuration,
        localStreamState,
        remoteStreamState,
        startVoiceCall,
        startVideoCall,
        handleAcceptCall,
        handleDeclineCall,
        handleEndCall,
        handleToggleMute,
        handleToggleVideo
      }}
    >
      {children}

      {/* Hidden audio element for voice calls */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* GLOBAL CALLING INTERFACE OVERLAY */}
      {activeCall && (
        <div
          ref={callOverlayRef}
          onMouseMove={resetControlsTimeout}
          onClick={resetControlsTimeout}
          className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-b from-gray-950 via-gray-900 to-gray-955 text-white p-6 font-sans overflow-hidden select-none"
        >
          {/* Header overlay */}
          <div className={`w-full flex items-center justify-between opacity-80 mt-4 px-4 z-40 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <span className="text-xs font-semibold tracking-wider uppercase flex items-center gap-1.5 text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              End-to-End Encrypted
            </span>
            <span className="text-xs font-medium bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
              {activeCall.type === 'video' ? 'Video Call' : 'Voice Call'}
            </span>
          </div>

          {/* Call Body Layout */}
          {activeCall.type === 'video' && activeCall.status === 'connected' ? (
            <div className="absolute inset-0 w-full h-full flex-1">
              {/* Remote Video Container */}
              <div
                onClick={() => isSwapped && setIsSwapped(false)}
                className={remoteVideoClass}
              >
                {!isRemoteVideoOff && remoteStreamState ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 space-y-2 text-center p-4">
                    <div className={`${!isSwapped ? 'h-24 w-24 text-3xl' : 'h-10 w-10 text-xs'} rounded-full bg-emerald-800 flex items-center justify-center font-bold uppercase transition-all duration-300`}>
                      {initials}
                    </div>
                    <span className={`${!isSwapped ? 'text-lg font-bold' : 'text-[10px]'} truncate w-full`}>{partnerName}</span>
                    <span className="text-[10px] text-white/50 flex items-center gap-1">
                      <VideoOff size={10} /> Camera Off
                    </span>
                  </div>
                )}
              </div>

              {/* Local Video Container */}
              <div
                onClick={() => !isSwapped && setIsSwapped(true)}
                className={localVideoClass}
              >
                {!isVideoOff && localStreamState ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-850 space-y-2 text-center p-4">
                    <div className={`${isSwapped ? 'h-24 w-24 text-3xl' : 'h-10 w-10 text-xs'} rounded-full bg-emerald-700 flex items-center justify-center font-bold uppercase transition-all duration-300`}>
                      {getInitials(user?.name || '')}
                    </div>
                    <span className={`${isSwapped ? 'text-lg font-bold' : 'text-[10px]'} truncate w-full`}>You</span>
                    <span className="text-[10px] text-white/50 flex items-center gap-1">
                      <VideoOff size={10} /> Camera Off
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Voice Call layout or ringing status */
            <div className="flex flex-col items-center justify-center flex-1 space-y-6 w-full md:max-w-sm h-full z-20">
              <div className="relative flex items-center justify-center h-44 w-44">
                {activeCall.status === 'ringing' ? (
                  <>
                    <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping-slow scale-150" />
                    <div className="absolute inset-2 rounded-full bg-emerald-500/15 animate-ping-slow scale-125" />
                    <div className="absolute inset-4 rounded-full bg-emerald-500/20 animate-ping-slow" />
                  </>
                ) : (
                  <div className="absolute inset-0 rounded-full bg-emerald-500/5 animate-pulse scale-110" />
                )}
                <div className="relative z-10 h-28 w-28 rounded-full border-4 border-emerald-500/30 overflow-hidden shadow-2xl bg-gray-800">
                  {partnerAvatar ? (
                    <img src={partnerAvatar} alt={partnerName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-emerald-700 text-3xl font-bold uppercase text-emerald-100">
                      {initials}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-center">
                <h2 className="text-xl font-bold tracking-wide text-white">{partnerName}</h2>
                <p className="text-sm font-medium text-emerald-400 mt-1">
                  {activeCall.status === 'ringing'
                    ? 'Ringing...'
                    : `Connected • ${formatCallTimer(callDuration)}`
                  }
                </p>
              </div>
            </div>
          )}

          {/* Call Controls Bar */}
          <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 md:gap-6 bg-black/40 px-6 py-4 rounded-3xl backdrop-blur-md border border-white/10 shadow-2xl transition-all duration-300 z-40 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
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

            {(!isMobile || hasSinkSupport) && (
              <button
                onClick={toggleSpeaker}
                className={`p-3.5 rounded-full transition-all duration-200 ${
                  !isSpeakerOn
                    ? 'bg-red-500/20 text-red-500 border border-red-500/40 hover:bg-red-500/30'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title={isSpeakerOn ? 'Turn Speaker Off' : 'Turn Speaker On'}
                aria-label={isSpeakerOn ? 'Turn speaker off' : 'Turn speaker on'}
              >
                {isSpeakerOn ? <Volume2 className="h-5.5 w-5.5" /> : <VolumeX className="h-5.5 w-5.5" />}
              </button>
            )}

            <button
              onClick={handleEndCall}
              className="p-4 rounded-full bg-red-600 text-white hover:bg-red-550 active:scale-95 shadow-lg shadow-red-600/30 transition duration-200"
              title="End Call"
              aria-label="End call"
            >
              <PhoneOff className="h-6 w-6" />
            </button>

            {activeCall.type === 'video' && (
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
            )}

            <button
              onClick={toggleFullscreen}
              className="p-3.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="h-5.5 w-5.5" /> : <Maximize2 className="h-5.5 w-5.5" />}
            </button>
          </div>
        </div>
      )}

      {/* GLOBAL INCOMING CALL NOTIFICATION OVERLAY */}
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

      <style>{`
        @keyframes ping-slow {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .animate-ping-slow {
          animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        .bg-gray-955 {
          background-color: #0b0c15;
        }
      `}</style>
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
