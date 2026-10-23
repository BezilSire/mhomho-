import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, X } from 'lucide-react';
import { BrandMark } from '../../components/BrandMark.tsx';

export interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (
    identifier: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  onApply: () => void;
}

const FIELD =
  'h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 text-[14px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--faint)] focus:border-[var(--a1)]';

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  onApply,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError('');

    if (!identifier.trim() || !password) {
      setError('Enter your email/handle and password.');
      return;
    }

    setBusy(true);
    const result = await onLogin(identifier, password);
    setBusy(false);

    if (!result.success) {
      setError(result.error || 'Email/handle or password is incorrect.');
      setPassword('');
      return;
    }
    setIdentifier('');
    setPassword('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="creator-signin-title"
    >
      <div className="w-full max-w-sm rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)]">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark size={32} />
            <div>
              <p id="creator-signin-title" className="font-display text-[15px] font-bold leading-tight">
                Creator sign in
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                Applicants and approved creators
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-3">
          <LockKeyhole size={14} className="mt-0.5 shrink-0 text-[var(--a1)]" />
          <p className="text-[11px] leading-relaxed text-[var(--muted)]">
            Sign in to complete Campaign Zero or, once approved, open your dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label
              className="mb-1.5 block text-[11.5px] font-semibold text-[var(--muted)]"
              htmlFor="login-identifier"
            >
              Email or handle
            </label>
            <input
              id="login-identifier"
              type="text"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="@yourhandle or you@email.com"
              className={FIELD}
              autoComplete="username"
              spellCheck={false}
              required
            />
          </div>

          <div>
            <label
              className="mb-1.5 block text-[11.5px] font-semibold text-[var(--muted)]"
              htmlFor="login-password"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className={`${FIELD} pr-11`}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-1 top-1 grid h-10 w-10 place-items-center rounded-lg text-[var(--faint)] transition-colors hover:text-[var(--text)] cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-[var(--err)]/30 bg-[var(--err)]/10 px-3 py-2 text-[12px] font-medium leading-relaxed text-[var(--err)]"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-mhomho text-[13.5px] font-bold text-[var(--ink)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 cursor-pointer"
          >
            {busy ? 'Signing in…' : 'Sign in'}
            <ArrowRight size={15} />
          </button>
        </form>

        <p className="mt-3 text-center text-[10.5px] leading-relaxed text-[var(--faint)]">
          Only approved creators can enter the dashboard. Applicants can sign in to finish Campaign
          Zero.
        </p>

        <div className="mt-4 border-t border-[var(--line)] pt-3 text-center text-[11px] text-[var(--muted)]">
          New here?{' '}
          <button
            type="button"
            onClick={() => {
              onClose();
              onApply();
            }}
            className="font-semibold text-[var(--a1)] hover:underline cursor-pointer"
          >
            Apply as a creator
          </button>
        </div>
      </div>
    </div>
  );
};
