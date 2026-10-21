import React, { useState } from 'react';
import { Button } from '../../components/Button.tsx';
import { UserRole } from '../../lib/firebase.ts';

export interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (credentials: { email: string; role: UserRole; uid: string }) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
}) => {
  const [activeTab, setActiveTab] = useState<'creator' | 'admin'>('creator');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email or handle.');
      return;
    }

    if (activeTab === 'admin') {
      if (email.toLowerCase().includes('admin') || email.toLowerCase().includes('mhomho')) {
        onLogin({ email, role: 'admin', uid: 'admin_uid' });
        onClose();
      } else {
        // Allow login as admin with proper role
        onLogin({ email, role: 'admin', uid: 'admin_uid' });
        onClose();
      }
    } else {
      // Creator login
      const uid = email.toLowerCase().includes('kudzai') ? 'newbie_uid' : 'tendai_uid';
      onLogin({ email, role: 'creator', uid });
      onClose();
    }
  };

  const handleFillDemo = (type: 'creator' | 'admin') => {
    if (type === 'creator') {
      setActiveTab('creator');
      setEmail('tendai@mhomho.co.zw');
      setPassword('••••••••');
    } else {
      setActiveTab('admin');
      setEmail('admin@mhomho.co.zw');
      setPassword('••••••••');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-[14px] bg-[var(--surface)] border border-[var(--line)] p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[16px] tracking-[0.05em] text-[var(--text)]">
              MHOMHO
            </span>
            <span className="text-[12px] text-[var(--muted)] font-semibold">
              · Access
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--text)] text-[20px] font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab switch between Creator and Admin */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--bg)] rounded-[10px] border border-[var(--line)] mb-4 text-[13px] font-semibold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('creator');
              setError('');
            }}
            className={`py-2 rounded-[8px] cursor-pointer transition-colors ${
              activeTab === 'creator'
                ? 'bg-[var(--grad)] text-[var(--ink)] font-extrabold'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            Creator Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setError('');
            }}
            className={`py-2 rounded-[8px] cursor-pointer transition-colors ${
              activeTab === 'admin'
                ? 'bg-[var(--grad)] text-[var(--ink)] font-extrabold'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            Admin Sign In
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-[8px] bg-[var(--err)]/10 text-[var(--err)] text-[12px] font-semibold mb-3 border border-[var(--err)]/30">
            {error}
          </div>
        )}

        {/* Clean Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">
              {activeTab === 'admin' ? 'Admin Email' : 'Email or Creator Handle'}
            </label>
            <input
              type={activeTab === 'admin' ? 'email' : 'text'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={activeTab === 'admin' ? 'admin@mhomho.co.zw' : 'tendai@mhomho.co.zw or @tendai_tech'}
              className="w-full px-3.5 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] text-[14px]"
              required
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] text-[14px]"
              required
            />
          </div>

          <div className="pt-1">
            <Button type="submit">
              {activeTab === 'admin' ? 'Sign In as Admin' : 'Sign In as Creator'}
            </Button>
          </div>
        </form>

        {/* Subtle quick fill helper for review convenience */}
        <div className="mt-4 pt-3 border-t border-[var(--line)] text-center text-[11px] text-[var(--muted)]">
          <span>Quick fill: </span>
          <button
            type="button"
            onClick={() => handleFillDemo('creator')}
            className="text-[var(--a1)] hover:underline font-semibold cursor-pointer mr-2"
          >
            Creator (@tendai_tech)
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={() => handleFillDemo('admin')}
            className="text-[var(--a1)] hover:underline font-semibold cursor-pointer ml-2"
          >
            Admin (Mhomho)
          </button>
        </div>
      </div>
    </div>
  );
};
