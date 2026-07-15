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
  X,
  Circle,
  Square,
  Pause,
  Play,
  Download,
  Trash2
} from 'lucide-react';

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'uuid_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
};

const CallContext = createContext(null);

export const CallProvider = ({ children }) => {
  const { user } = useAuth();
  const socket = useSocket();
  const { addToast } = useToast();
  const { fetchCalls } = useChat();

  const [activeCall, setActiveCall] = useState(null); // { type: 'voice' | 'video', status: 'ringing' | 'connected', isCaller: boolean, targetId: string, targetName: string, targetAvatar: string, roomId }
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

  // Call Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showRecordConfirmation, setShowRecordConfirmation] = useState(false);
  const [showPlaybackDialog, setShowPlaybackDialog] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState('');
  const [recordingBlob, setRecordingBlob] = useState(null);
  const [recordingType, setRecordingType] = useState('voice');
  const [customFilename, setCustomFilename] = useState('');

  // Call Recording Refs
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const audioMixerCtxRef = useRef(null);
  const isRecordingRef = useRef(false);
  const recordingSessionRef = useRef(null);
  const lastCallSessionRef = useRef(null);
  const callDurationRef = useRef(0);
  const recordingDurationRef = useRef(0);

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

  // Recording Timer Effect
  useEffect(() => {
    let interval = null;
    if (isRecording && !isRecordingPaused) {
      interval = setInterval(() => {
        setRecordingDuration(prev => {
          const next = prev + 1;
          recordingDurationRef.current = next;
          return next;
        });
      }, 1000);
    } else {
      setRecordingDuration(0);
      recordingDurationRef.current = 0;
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, isRecordingPaused]);

  // Determine supported recording format
  const getSupportedMimeType = (type) => {
    if (type === 'video') {
      const types = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4'
      ];
      for (const t of types) {
        if (MediaRecorder.isTypeSupported(t)) return t;
      }
    } else {
      const types = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
      ];
      for (const t of types) {
        if (MediaRecorder.isTypeSupported(t)) return t;
      }
    }
    return '';
  };

  // Mixed audio stream builder
  const getMixedAudioStream = () => {
    const localStream = localStreamRef.current;
    const remoteStream = remoteStreamState;

    if (!localStream && !remoteStream) return null;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    try {
      const audioCtx = new AudioContextClass();
      const dest = audioCtx.createMediaStreamDestination();
      let hasTracks = false;

      if (localStream && localStream.getAudioTracks().length > 0) {
        const sourceLocal = audioCtx.createMediaStreamSource(localStream);
        sourceLocal.connect(dest);
        hasTracks = true;
      }

      if (remoteStream && remoteStream.getAudioTracks().length > 0) {
        const sourceRemote = audioCtx.createMediaStreamSource(remoteStream);
        sourceRemote.connect(dest);
        hasTracks = true;
      }

      if (!hasTracks) {
        audioCtx.close();
        return null;
      }
      return { mixedStream: dest.stream, audioCtx };
    } catch (e) {
      console.warn('Audio mixing error:', e);
      return null;
    }
  };

  // Start Call Recording
  const startRecording = () => {
    if (!activeCall || activeCall.status !== 'connected') {
      addToast('Call must be connected to start recording', 'error');
      return;
    }

    // Verify browser compatibility
    const mimeType = getSupportedMimeType(activeCall.type);
    if (!mimeType) {
      addToast('Call recording is not supported on this browser.', 'error');
      return;
    }

    try {
      recordedChunksRef.current = [];
      setRecordingDuration(0);
      setRecordingType(activeCall.type);

      const recordingId = generateUUID();
      recordingSessionRef.current = {
        recordingId,
        callSessionId: activeCall.callSessionId || '',
        roomId: activeCall.roomId || '',
        mediaType: activeCall.type,
        startedAt: Date.now()
      };

      const mixedAudioInfo = getMixedAudioStream();
      let combinedStream = null;

      if (activeCall.type === 'video') {
        // Setup Canvas Compositor
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const canvasCtx = canvas.getContext('2d');

        isRecordingRef.current = true;

        const drawFrame = () => {
          if (!isRecordingRef.current) return;

          // 1. Draw remote video
          const remoteVideo = remoteVideoRef.current;
          if (remoteVideo && remoteVideo.readyState >= 2) {
            canvasCtx.drawImage(remoteVideo, 0, 0, canvas.width, canvas.height);
          } else {
            canvasCtx.fillStyle = '#111827';
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
            canvasCtx.fillStyle = '#ffffff';
            canvasCtx.font = 'bold 36px sans-serif';
            canvasCtx.textAlign = 'center';
            canvasCtx.fillText(activeCall.targetName || 'Video Call', canvas.width / 2, canvas.height / 2);
          }

          // 2. Draw local video as PiP in bottom-right corner
          const localVideo = localVideoRef.current;
          if (localVideo && localVideo.readyState >= 2 && !isVideoOff) {
            const pipW = 320;
            const pipH = 240;
            const pipX = canvas.width - pipW - 30;
            const pipY = canvas.height - pipH - 30;

            canvasCtx.strokeStyle = 'rgba(255,255,255,0.3)';
            canvasCtx.lineWidth = 6;
            canvasCtx.strokeRect(pipX - 3, pipY - 3, pipW + 6, pipH + 6);
            canvasCtx.drawImage(localVideo, pipX, pipY, pipW, pipH);
          }

          requestAnimationFrame(drawFrame);
        };

        // Start animation loop
        drawFrame();

        const canvasStream = canvas.captureStream(30);
        const tracks = [...canvasStream.getVideoTracks()];

        if (mixedAudioInfo) {
          tracks.push(...mixedAudioInfo.mixedStream.getAudioTracks());
          audioMixerCtxRef.current = mixedAudioInfo.audioCtx;
        }

        combinedStream = new MediaStream(tracks);
      } else {
        // Voice Call - Audio only
        if (mixedAudioInfo) {
          combinedStream = mixedAudioInfo.mixedStream;
          audioMixerCtxRef.current = mixedAudioInfo.audioCtx;
        } else {
          // Fallback to local mic
          combinedStream = localStreamRef.current;
        }
      }

      if (!combinedStream) {
        addToast('No media stream available for recording', 'error');
        return;
      }

      const recorder = new MediaRecorder(combinedStream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        isRecordingRef.current = false;
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordingBlob(blob);
        setRecordingUrl(url);

        // Generate default filename: CallType_YYYY-MM-DD_HH-MM
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].substring(0, 5).replace(':', '-');
        const defaultName = `${activeCall.type === 'video' ? 'VideoCall' : 'VoiceCall'}_${dateStr}_${timeStr}`;
        setCustomFilename(defaultName);

        // Finalize recordingSession metadata
        const session = recordingSessionRef.current;
        if (session) {
          session.endedAt = Date.now();
          session.duration = recordingDurationRef.current;
          session.callDuration = callDurationRef.current;

          const recordedList = JSON.parse(localStorage.getItem('echo_recorded_calls') || '[]');
          recordedList.push(session);
          localStorage.setItem('echo_recorded_calls', JSON.stringify(recordedList));
        }

        setShowPlaybackDialog(true);
      };

      recorder.start(1000);
      setIsRecording(true);
      setIsRecordingPaused(false);
      addToast('Call recording started privately', 'success');
    } catch (err) {
      console.error('Failed to start media recorder:', err);
      addToast('Error starting recording', 'error');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsRecordingPaused(true);
      addToast('Recording paused', 'info');
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsRecordingPaused(false);
      addToast('Recording resumed', 'info');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && (mediaRecorderRef.current.state === 'recording' || mediaRecorderRef.current.state === 'paused')) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsRecordingPaused(false);
      isRecordingRef.current = false;

      // Close Web Audio AudioContext if opened
      if (audioMixerCtxRef.current) {
        audioMixerCtxRef.current.close().catch(e => console.warn(e));
        audioMixerCtxRef.current = null;
      }
    }
  };

  const handleDownloadRecording = () => {
    if (!recordingUrl || !recordingBlob) return;
    const a = document.createElement('a');
    a.href = recordingUrl;
    a.download = `${customFilename || 'Recording'}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    addToast('Recording downloaded successfully', 'success');
  };

  const handleDeleteRecording = () => {
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl);
    }
    setRecordingUrl('');
    setRecordingBlob(null);
    setShowPlaybackDialog(false);
    addToast('Recording deleted', 'info');
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
    setActiveCall({ type: 'voice', status: 'ringing', isCaller: true, targetId: partnerId, targetName: partnerName, targetAvatar: partnerAvatar, roomId, callSessionId: generateUUID() });
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
    setActiveCall({ type: 'video', status: 'ringing', isCaller: true, targetId: partnerId, targetName: partnerName, targetAvatar: partnerAvatar, roomId, callSessionId: generateUUID() });
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
    setActiveCall({ type, status: 'connected', isCaller: false, targetId: callerId, targetName: callerName, targetAvatar: callerAvatar, roomId, callSessionId: generateUUID() });
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
    if (isRecordingRef.current) {
      stopRecording();
    }
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

    if (activeCall?.callSessionId) {
      try {
        const recordedList = JSON.parse(localStorage.getItem('echo_recorded_calls') || '[]');
        let modified = false;
        recordedList.forEach(rec => {
          if (rec.callSessionId === activeCall.callSessionId) {
            rec.callDuration = callDurationRef.current;
            modified = true;
          }
        });
        if (modified) {
          localStorage.setItem('echo_recorded_calls', JSON.stringify(recordedList));
        }
      } catch (e) {
        console.warn('Error updating recordings with call duration:', e);
      }
    }
    lastCallSessionRef.current = activeCall ? { ...activeCall, duration: callDurationRef.current } : null;
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
        setCallDuration(prev => {
          const next = prev + 1;
          callDurationRef.current = next;
          return next;
        });
      }, 1000);
    } else {
      setCallDuration(0);
      callDurationRef.current = 0;
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
      if (isRecordingRef.current) {
        stopRecording();
      }
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

      if (activeCall?.callSessionId) {
        try {
          const recordedList = JSON.parse(localStorage.getItem('echo_recorded_calls') || '[]');
          let modified = false;
          recordedList.forEach(rec => {
            if (rec.callSessionId === activeCall.callSessionId) {
              rec.callDuration = callDurationRef.current;
              modified = true;
            }
          });
          if (modified) {
            localStorage.setItem('echo_recorded_calls', JSON.stringify(recordedList));
          }
        } catch (e) {
          console.warn('Error updating recordings with call duration:', e);
        }
      }
      lastCallSessionRef.current = activeCall ? { ...activeCall, duration: callDurationRef.current } : null;
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

    const handleReceiveMessage = (message) => {
      const lastSession = lastCallSessionRef.current;
      if (!lastSession) return;

      if (message.content && message.content.startsWith('{"_echoType"')) {
        try {
          const parsed = JSON.parse(message.content);
          if (
            parsed._echoType === 'call' &&
            parsed.callType === lastSession.type &&
            Math.abs(parsed.duration - lastSession.duration) <= 2
          ) {
            // Associate all recordings under the matched session with the database messageId
            const recordedList = JSON.parse(localStorage.getItem('echo_recorded_calls') || '[]');
            let modified = false;
            recordedList.forEach(rec => {
              if (rec.callSessionId === lastSession.callSessionId) {
                rec.messageId = message._id;
                modified = true;
              }
            });
            if (modified) {
              localStorage.setItem('echo_recorded_calls', JSON.stringify(recordedList));
            }
            lastCallSessionRef.current = null;
          }
        } catch (e) {
          console.warn('Error parsing message content for recording match:', e);
        }
      }
    };

    socket.on('call:incoming', handleIncomingCall);
    socket.on('call:answered', handleCallAnswered);
    socket.on('call:rejected', handleCallRejected);
    socket.on('call:candidate', handleCallCandidate);
    socket.on('call:ended', handleCallEnded);
    socket.on('call:video-state', handleVideoStateChanged);
    socket.on('call:ice-restart', handleIceRestartReceived);
    socket.on('message:receive', handleReceiveMessage);

    return () => {
      socket.off('call:incoming', handleIncomingCall);
      socket.off('call:answered', handleCallAnswered);
      socket.off('call:rejected', handleCallRejected);
      socket.off('call:candidate', handleCallCandidate);
      socket.off('call:ended', handleCallEnded);
      socket.off('call:video-state', handleVideoStateChanged);
      socket.off('call:ice-restart', handleIceRestartReceived);
      socket.off('message:receive', handleReceiveMessage);
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
            <div className="flex items-center gap-2">
              {isRecording && (
                <span className="text-xs font-semibold bg-red-650/30 border border-red-500/40 px-3 py-1 rounded-full text-red-400 flex items-center gap-1.5 animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-red-550" />
                  Recording {formatCallTimer(recordingDuration)}
                </span>
              )}
              <span className="text-xs font-medium bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                {activeCall.type === 'video' ? 'Video Call' : 'Voice Call'}
              </span>
            </div>
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
            {/* 1. Mic Button */}
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

            {/* 2. Camera Button (Video call only) */}
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

            {/* 3. Speaker Button */}
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

            {/* 4. Record Button Controls */}
            {activeCall.status === 'connected' && (
              <>
                {isRecording && (
                  <button
                    onClick={isRecordingPaused ? resumeRecording : pauseRecording}
                    className="p-3.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/40 hover:bg-amber-500/30 transition-all duration-200"
                    title={isRecordingPaused ? 'Resume Recording' : 'Pause Recording'}
                    aria-label={isRecordingPaused ? 'Resume recording' : 'Pause recording'}
                  >
                    {isRecordingPaused ? <Play className="h-5.5 w-5.5" /> : <Pause className="h-5.5 w-5.5" />}
                  </button>
                )}
                <button
                  onClick={isRecording ? stopRecording : () => setShowRecordConfirmation(true)}
                  className={`p-3.5 rounded-full transition-all duration-200 ${
                    isRecording
                      ? 'bg-red-500/20 text-red-500 border border-red-500/40 hover:bg-red-500/30 animate-pulse'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                  title={isRecording ? 'Stop Recording' : 'Start Recording'}
                  aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                >
                  {isRecording ? <Square className="h-5.5 w-5.5 text-red-500 fill-red-500" /> : <Circle className="h-5.5 w-5.5 text-white fill-transparent" />}
                </button>
              </>
            )}

            {/* 5. Fullscreen Button (Desktop only) */}
            {!isMobile && (
              <button
                onClick={toggleFullscreen}
                className="p-3.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all"
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? <Minimize2 className="h-5.5 w-5.5" /> : <Maximize2 className="h-5.5 w-5.5" />}
              </button>
            )}

            {/* 6. End Call Button */}
            <button
              onClick={handleEndCall}
              className="p-4 rounded-full bg-red-600 text-white hover:bg-red-550 active:scale-95 shadow-lg shadow-red-600/30 transition duration-200"
              title="End Call"
              aria-label="End call"
            >
              <PhoneOff className="h-6 w-6" />
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

      {/* RECORDING CONFIRMATION MODAL */}
      {showRecordConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm text-white p-4 font-sans">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Start Recording</h3>
            <p className="text-sm text-gray-300">
              Start recording this call? This recording will only be saved on your own device.
            </p>
            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                onClick={() => setShowRecordConfirmation(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowRecordConfirmation(false);
                  startRecording();
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition"
              >
                Start Recording
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PLAYBACK PREVIEW MODAL */}
      {showPlaybackDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm text-white p-4 font-sans">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white">Call Recording Preview</h3>
              <button
                onClick={handleDeleteRecording}
                className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {recordingType === 'video' ? (
                <div className="relative rounded-lg overflow-hidden border border-white/10 bg-black aspect-video flex items-center justify-center">
                  <video src={recordingUrl} controls className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="p-4 bg-gray-950 rounded-lg border border-white/10 flex flex-col items-center justify-center space-y-3">
                  <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <Mic size={24} />
                  </div>
                  <span className="text-xs text-gray-400">Voice Call Recording</span>
                  <audio src={recordingUrl} controls className="w-full" />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400">Filename</label>
                <input
                  type="text"
                  value={customFilename}
                  onChange={(e) => setCustomFilename(e.target.value)}
                  className="w-full bg-gray-950 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition"
                  placeholder="Enter recording filename"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={handleDeleteRecording}
                className="px-4 py-2 rounded-xl bg-red-650/15 border border-red-500/20 hover:bg-red-650/25 text-red-400 text-sm font-medium transition flex items-center gap-1.5"
              >
                <Trash2 size={16} />
                Delete
              </button>
              <button
                onClick={handleDownloadRecording}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition flex items-center gap-1.5"
              >
                <Download size={16} />
                Download
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
