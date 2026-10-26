import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { BrandLockup } from '../../components/BrandMark.tsx';
import { authenticateAdmin } from '../../lib/auth.ts';

export interface AdminAccessProps {
  onAuthenticated: (email: string) => void;
  onCancel: () => void;
}

const FIELD =
  'h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 text-[14px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--faint)] focus:border-[var(--a1)]';

export const AdminAccess: React.FC<AdminAccessProps> = ({ onAuthenticated, onCancel }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Restricted access · Mhomho';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
    return () => {
      document.title = previousTitle;
      robots.remove();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    const result = await authenticateAdmin(email, password);
    setBusy(false);
    if (!result.success) {
      setError(result.error || 'Access denied.');
      setPassword('');
      return;
    }
    onAuthenticated(email.trim().toLowerCase());
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--page)] px-5 py-12">
      <div className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-[420px]" />
      <div className="grid-lines pointer-events-none absolute inset-0 opacity-70" />

      <div className="relative w-full max-w-sm">
        <div className="mb-7 flex justify-center">
          <BrandLockup size={34} />
        </div>

        <div className="rounded-[22px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] sm:p-8">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-[var(--a1)]">
            <LockKeyhole size={17} />
          </span>
          <h1 className="font-display mt-4 text-[24px] font-bold leading-tight">
            Restricted access
          </h1>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--muted)]">
            Operations credentials are required. Sessions expire after 30 minutes and failed
            attempts are rate-limited.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
            <div>
              <label
                htmlFor="admin-email"
                className="mb-1.5 block text-[11.5px] font-semibold text-[var(--muted)]"
              >
                Work email
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@mhomho.co.zw"
                className={FIELD}
                autoComplete="username"
                spellCheck={false}
                autoFocus
                required
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="mb-1.5 block text-[11.5px] font-semibold text-[var(--muted)]"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••••••"
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
                className="rounded-lg border border-[var(--err)]/30 bg-[var(--err)]/10 px-3 py-2.5 text-[12px] font-medium leading-relaxed text-[var(--err)]"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-mhomho text-[13px] font-bold text-[var(--ink)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 cursor-pointer"
            >
              {busy ? 'Verifying…' : 'Unlock operations'}
              <ArrowRight size={15} />
            </button>
          </form>

          <p className="mt-4 flex items-start gap-2 text-[10.5px] leading-relaxed text-[var(--faint)]">
            <ShieldCheck size={12} className="mt-0.5 shrink-0" />
            Credentials are verified server-side over HTTPS with rate limiting. This page is
            excluded from indexing and is never linked from the public site.
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="mx-auto mt-5 flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)] cursor-pointer"
        >
          <ArrowLeft size={12} />
          Return to public site
        </button>
      </div>
    </div>
  );
};
