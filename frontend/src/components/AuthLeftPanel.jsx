import React from 'react';
import { CheckCircle2, Shield, Zap, Users, Sparkles } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

const checklistItems = [
  'Google Authentication',
  'JWT Security',
  'Real-Time Messaging',
  'Socket.IO',
  'Group Chats',
  'File Sharing',
  'Read Receipts',
  'Typing Indicators',
  'Cloud Uploads'
];

const floatingCards = [
  {
    icon: <Zap className="h-5 w-5 text-[#FF6A00]" />,
    title: 'Real-Time Sync',
    desc: 'Experience lightning-fast communication with sub-50ms Socket.IO events.'
  },
  {
    icon: <Shield className="h-5 w-5 text-[#2563EB]" />,
    title: 'Bank-Grade Security',
    desc: 'Encrypted tokens, JWT security, and verified Google Authentication OAuth flows.'
  },
  {
    icon: <Users className="h-5 w-5 text-[#16A34A]" />,
    title: 'Group Spaces',
    desc: 'Create channels, start group discussions, and invite participants instantly.'
  },
  {
    icon: <Sparkles className="h-5 w-5 text-[#60A5FA]" />,
    title: 'Rich Interactions',
    desc: 'Typing indicators, message read receipts, and seamless media file uploads.'
  }
];

export default function AuthLeftPanel() {
  return (
    <div className="auth-left-panel select-none">
      {/* Top Header: Logo + App Name */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FF6A00] shadow-lg shadow-orange-500/20">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" fill="white"/>
          </svg>
        </div>
        <div>
          <h1 className="font-extrabold text-2xl tracking-tight leading-none" style={{ fontFamily: 'Poppins, sans-serif' }}>
            <span style={{ color: '#FF6A00' }}>Echo</span>
            <span style={{ color: '#2563EB' }}>Connect</span>
          </h1>
          <p className="text-[11px] text-[var(--text-muted)] mt-1 font-semibold uppercase tracking-wider">Stay connected, instantly.</p>
        </div>
      </div>

      {/* Middle: Feature Cards grid */}
      <div className="my-auto py-8">
        <h2 className="text-3xl font-extrabold text-[var(--text-primary)] leading-tight tracking-tight mb-2">
          Every Message.<br />Every Moment.
        </h2>

        {/* Theme Toggle (Inline below heading) */}
        <div className="flex items-center gap-3" style={{ marginTop: '28px', marginBottom: '32px' }}>
          <span className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wider">Theme</span>
          <div className="bg-[var(--bg-panel)] p-1 rounded-xl border border-[var(--border)] shadow-sm">
            <ThemeToggle />
          </div>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-8 max-w-md">
          A premium real-time collaboration workspace designed for instant sharing, absolute security, and elegant communications.
        </p>

        <div className="auth-floating-cards-container">
          {floatingCards.map((card, idx) => (
            <div key={idx} className="auth-floating-card">
              <div className="auth-floating-card-title">
                {card.icon}
                <span>{card.title}</span>
              </div>
              <p className="auth-floating-card-desc">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom: Feature checklist grid */}
      <div className="border-t border-[var(--border)] pt-6">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block mb-3.5">
          Workspace Features & Integrations
        </span>
        <div className="auth-checklist">
          {checklistItems.map((item, idx) => (
            <div key={idx} className="auth-checklist-item">
              <CheckCircle2 className="h-4 w-4 auth-check-icon" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
