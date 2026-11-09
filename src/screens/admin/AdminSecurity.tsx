import React, { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Card } from '../../components/Card.tsx';
import { Button } from '../../components/Button.tsx';
import { changePassword } from '../../lib/api.ts';

export interface AdminSecurityProps {
  email?: string;
}

const FIELD =
  'h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[14px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--faint)] focus:border-[var(--a1)]';

/**
 * Operations-only password rotation. The API verifies the current password,
 * bumps the account session version, and revokes every other device.
 */
export const AdminSecurity: React.FC<AdminSecurityProps> = ({ email }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (newPassword.length < 12) {
      setError('Use at least 12 characters for the new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    setBusy(true);
    const result = await changePassword({ currentPassword, newPassword });
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setNotice('Password updated. Every other signed-in device has been signed out.');
  };

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--a1)]">
          <KeyRound size={18} />
        </span>
        <div>
          <h2 className="font-display text-[22px] font-extrabold leading-tight">Security</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--muted)]">
            Rotate the operations password. Use a unique password that is not reused anywhere
            else.
          </p>
        </div>
      </div>

      <Card>
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--muted)]">
            <ShieldCheck size={14} className="text-[var(--a1)]" />
            {email ? `Signed in as ${email}` : 'Operations account'}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--faint)]">
              Current password
            </span>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className={FIELD}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--faint)]">
              New password
            </span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className={FIELD}
              minLength={12}
              maxLength={200}
              required
            />
            <span className="mt-1.5 block text-[11.5px] text-[var(--muted)]">
              At least 12 characters. Other sessions are revoked after the change.
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--faint)]">
              Confirm new password
            </span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={FIELD}
              minLength={12}
              maxLength={200}
              required
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-[var(--err)]/30 bg-[var(--err)]/10 px-3.5 py-3 text-[12px] font-semibold text-[var(--err)]"
            >
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-xl border border-[var(--ok)]/30 bg-[var(--ok)]/10 px-3.5 py-3 text-[12px] font-semibold text-[var(--ok)]">
              {notice}
            </p>
          )}

          <Button type="submit" disabled={busy} className="w-full sm:w-auto">
            {busy ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </Card>
    </div>
  );
};
