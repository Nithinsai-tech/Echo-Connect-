import React, { useState, useRef, useEffect } from 'react';
import { Plus, MessageSquare, Users, MessageCircle } from 'lucide-react';

const FloatingActionButton = ({ onAction }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleTriggerAction = (actionType) => {
    setIsOpen(false);
    if (onAction) {
      onAction(actionType);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3 font-sans"
    >
      {/* EXPANDABLE ACTIONS MENU */}
      {isOpen && (
        <div className="flex flex-col items-end gap-2.5 mb-2 animate-in slide-in-from-bottom-5 fade-in duration-200">
          
          {/* Action 1: New Chat */}
          <button
            onClick={() => handleTriggerAction('new_chat')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1A1C28]/95 border border-[#2C3045] hover:border-orange-500/30 text-xs font-bold text-white shadow-xl hover:bg-[#23263A] transition duration-150 transform hover:-translate-x-1"
          >
            <span>New Chat</span>
            <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400">
              <MessageSquare className="h-4 w-4" />
            </div>
          </button>

          {/* Action 2: New Group */}
          <button
            onClick={() => handleTriggerAction('new_group')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1A1C28]/95 border border-[#2C3045] hover:border-orange-500/30 text-xs font-bold text-white shadow-xl hover:bg-[#23263A] transition duration-150 transform hover:-translate-x-1"
          >
            <span>New Group</span>
            <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400">
              <Users className="h-4 w-4" />
            </div>
          </button>

          {/* Action 3: Quick Conversation */}
          <button
            onClick={() => handleTriggerAction('quick_conv')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1A1C28]/95 border border-[#2C3045] hover:border-orange-500/30 text-xs font-bold text-white shadow-xl hover:bg-[#23263A] transition duration-150 transform hover:-translate-x-1"
          >
            <span>Quick Conversation</span>
            <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400">
              <MessageCircle className="h-4 w-4" />
            </div>
          </button>

        </div>
      )}

      {/* PRIMARY FAB TRIGGER BUTTON */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="Quick Actions Menu"
        className={`relative flex items-center justify-center h-14 w-14 rounded-full bg-[#FF6A00] text-white shadow-lg shadow-orange-650/30 active:scale-95 transition-all duration-300 hover:bg-[#FF8A00] focus:outline-none cursor-pointer overflow-hidden ${
          isOpen ? 'rotate-135 bg-[#EF4444] hover:bg-[#F87171] shadow-red-500/20' : ''
        }`}
      >
        {/* Ripple effect animation element inside the button */}
        <span className="absolute inset-0 rounded-full border-4 border-white/20 animate-ping opacity-20 pointer-events-none" style={{ animationDuration: '3s' }} />
        
        <Plus className="h-7 w-7 transition-transform duration-300" />
      </button>

      {/* Custom Styles for rotation & ping animation */}
      <style>{`
        .rotate-135 {
          transform: rotate(135deg);
        }
      `}</style>
    </div>
  );
};

export default FloatingActionButton;
