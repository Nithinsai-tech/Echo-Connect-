import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Info, 
  CloudLightning, 
  Wifi, 
  WifiOff, 
  Upload, 
  Download, 
  Send, 
  Trash2, 
  Chrome, 
  X 
} from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [connState, setConnState] = useState('connected'); // 'connected' | 'connecting' | 'reconnecting' | 'offline' | 'socket_connected' | 'socket_disconnected'
  const [showBanner, setShowBanner] = useState(false);
  const socket = useSocket();

  // Add a new toast
  const addToast = (message, type = 'info', duration = 4000) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type, duration, progress: 100 }]);
  };

  // Toast removal helper
  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Toast progression animation logic
  useEffect(() => {
    if (toasts.length === 0) return;
    const interval = setInterval(() => {
      setToasts(prev => 
        prev.map(t => {
          const nextProgress = t.progress - (100 / (t.duration / 100));
          return { ...t, progress: Math.max(0, nextProgress) };
        })
      );
    }, 100);
    return () => clearInterval(interval);
  }, [toasts]);

  // Remove toast when progress hits 0
  useEffect(() => {
    toasts.forEach(t => {
      if (t.progress <= 0) {
        removeToast(t.id);
      }
    });
  }, [toasts]);

  // Connection State listeners
  useEffect(() => {
    const handleOnline = () => {
      setConnState('connected');
      addToast('Internet connection restored', 'success');
      setTimeout(() => setShowBanner(false), 3000);
    };

    const handleOffline = () => {
      setConnState('offline');
      setShowBanner(true);
      addToast('Internet connection lost', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!navigator.onLine) {
      setConnState('offline');
      setShowBanner(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Socket IO connection listeners
  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      setConnState('socket_connected');
      addToast('Connected to messaging server', 'success');
      setTimeout(() => setShowBanner(false), 3000);
    };

    const onDisconnect = () => {
      setConnState('socket_disconnected');
      setShowBanner(true);
      addToast('Disconnected from messaging server', 'error');
    };

    const onReconnectAttempt = () => {
      setConnState('reconnecting');
      setShowBanner(true);
    };

    const onConnectError = () => {
      setConnState('connecting');
      setShowBanner(true);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('reconnect_attempt', onReconnectAttempt);
    socket.on('connect_error', onConnectError);

    // If socket is already connected
    if (socket.connected) {
      setConnState('socket_connected');
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('reconnect_attempt', onReconnectAttempt);
      socket.off('connect_error', onConnectError);
    };
  }, [socket]);

  // Helper to render Toast Icons
  const getToastIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />;
      case 'error': return <XCircle className="h-5 w-5 text-red-400 shrink-0" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />;
      case 'upload_complete': return <Upload className="h-5 w-5 text-emerald-400 shrink-0" />;
      case 'upload_failed': return <XCircle className="h-5 w-5 text-red-400 shrink-0" />;
      case 'download_complete': return <Download className="h-5 w-5 text-sky-400 shrink-0" />;
      case 'message_sent': return <Send className="h-4 w-4 text-emerald-400 shrink-0" />;
      case 'message_deleted': return <Trash2 className="h-5 w-5 text-amber-400 shrink-0" />;
      case 'google_failed': return <Chrome className="h-5 w-5 text-red-400 shrink-0" />;
      case 'conn_lost': return <WifiOff className="h-5 w-5 text-red-400 shrink-0" />;
      case 'conn_restored': return <Wifi className="h-5 w-5 text-emerald-400 shrink-0" />;
      default: return <Info className="h-5 w-5 text-orange-400 shrink-0" />;
    }
  };

  // Helper for Connection Status Details
  const getBannerDetails = () => {
    switch (connState) {
      case 'offline':
        return { text: 'You are currently offline. Check your internet connection.', bg: 'bg-red-650/90 text-white', icon: <WifiOff className="h-4 w-4 animate-bounce" /> };
      case 'connecting':
        return { text: 'Connecting to server...', bg: 'bg-amber-600/90 text-white', icon: <CloudLightning className="h-4 w-4 animate-pulse" /> };
      case 'reconnecting':
        return { text: 'Reconnecting to messaging room...', bg: 'bg-amber-600/90 text-white', icon: <CloudLightning className="h-4 w-4 animate-spin" /> };
      case 'socket_disconnected':
        return { text: 'Connection lost. Retrying...', bg: 'bg-red-600/90 text-white', icon: <WifiOff className="h-4 w-4 animate-pulse" /> };
      case 'socket_connected':
      case 'connected':
        return { text: 'Connected successfully!', bg: 'bg-emerald-650/90 text-white', icon: <Wifi className="h-4 w-4" /> };
      default:
        return null;
    }
  };

  const banner = getBannerDetails();

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}

      {/* CONNECTION STATUS INDICATOR BANNER */}
      {showBanner && banner && (
        <div className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2.5 px-4 py-2 text-xs font-semibold shadow-lg backdrop-blur-md transition-all duration-300 transform translate-y-0 ${banner.bg}`}>
          {banner.icon}
          <span>{banner.text}</span>
        </div>
      )}

      {/* TOAST SYSTEM CONTAINER */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 md:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto relative flex gap-3.5 p-4 rounded-xl border border-white/10 dark:border-white/5 bg-[#1A1C28]/95 dark:bg-[#1A1C28]/95 backdrop-blur-md shadow-2xl text-white overflow-hidden transition-all duration-300 transform translate-x-0 animate-in slide-in-from-right-10 duration-200"
            role="alert"
          >
            {getToastIcon(t.type)}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-200 leading-normal pr-4 select-none">{t.message}</p>
            </div>
            
            <button
              onClick={() => removeToast(t.id)}
              className="absolute right-3 top-3 text-gray-400 hover:text-white p-0.5 rounded-full hover:bg-white/5 transition"
              aria-label="Close Notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            {/* Progress Indicator Bar */}
            <div 
              className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-100 ease-linear"
              style={{ width: `${t.progress}%` }}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
