import React, { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Plus, ShieldOff, Users } from 'lucide-react';
import { Card } from '../../components/Card.tsx';
import { Tag } from '../../components/Tag.tsx';
import {
  createInviteCode,
  fetchAdminInvites,
  revokeInviteCode,
  setInviteMode,
  type AdminInvitesData,
  type InviteCodeStatus,
  type InviteMode,
} from '../../lib/api.ts';

const MODES: { id: InviteMode; label: string; hint: string }[] = [
  { id: 'auto', label: 'Auto', hint: 'Open until the threshold, then invite-only' },
  { id: 'on', label: 'Invite only', hint: 'Every new creator needs a code' },
  { id: 'off', label: 'Open', hint: 'No invite code required' },
];

function formatDate(timestamp: number | null): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function statusTag(status: InviteCodeStatus): React.ReactNode {
  if (status === 'active') return <Tag variant="ok">Active</Tag>;
  if (status === 'used') return <Tag variant="warn">Used</Tag>;
  if (status === 'expired') return <Tag variant="err">Expired</Tag>;
  return <Tag variant="err">Revoked</Tag>;
}

interface CreatedInvite {
  id: string;
  code: string;
  hint: string;
  label: string | null;
  expiresAt: number;
}

export const AdminInvites: React.FC = () => {
  const [data, setData] = useState<AdminInvitesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [copied, setCopied] = useState(false);

  const [modeBusy, setModeBusy] = useState<InviteMode | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    const result = await fetchAdminInvites();
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Invite codes could not be loaded.');
      return;
    }
    setData(result.data ?? null);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleMode = async (mode: InviteMode) => {
    if (modeBusy) return;
    setModeBusy(mode);
    setError('');
    setNotice('');
    const result = await setInviteMode(mode);
    setModeBusy(null);
    if (!result.success) {
      setError(result.error || 'The access mode could not be changed.');
      return;
    }
    setNotice(
      mode === 'on'
        ? 'Invite-only mode is on. New creators now need a code.'
        : mode === 'off'
          ? 'Registration is open. Invite codes are not required.'
          : 'Auto mode is on. Registration closes at the creator threshold.'
    );
    await load();
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setError('');
    setNotice('');
    setCopied(false);
    const result = await createInviteCode(label);
    setCreating(false);
    if (!result.success) {
      setError(result.error || 'The invite code could not be created.');
      return;
    }
    if (!result.data) {
      setError('The invite code could not be created.');
      return;
    }
    setCreated(result.data);
    setLabel('');
    setNotice('Invite code created. Copy it now — the full code is not shown again.');
    await load();
  };

  const handleRevoke = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setError('');
    setNotice('');
    const result = await revokeInviteCode(id);
    setBusyId(null);
    if (!result.success) {
      setError(result.error || 'The invite code could not be revoked.');
      return;
    }
    setNotice('Invite code revoked.');
    if (created?.id === id) setCreated(null);
    await load();
  };

  const copyCreated = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed. Select the code and copy it manually.');
    }
  };

  const creatorCount = data?.creatorCount ?? 0;
  const threshold = data?.threshold ?? 3000;
  const progress =
    threshold > 0 ? Math.min(100, Math.round((creatorCount / threshold) * 100)) : 0;
  const activeCodes = data?.codes.filter((code) => code.status === 'active') ?? [];

  return (
    <div className="pb-10">
      <div className="mb-5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
          Creator access
        </span>
        <h2 className="font-display mt-1 text-[24px] font-bold leading-tight text-[var(--text)]">
          Invite codes
        </h2>
        <p className="mt-1 max-w-[60ch] text-[12px] leading-relaxed text-[var(--muted)]">
          Keep the roster close once it reaches {threshold.toLocaleString()} creators. Codes are
          single-use and expire after {data?.inviteCodeTtlDays ?? 30} days.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-[var(--err)]/30 bg-[var(--err)]/10 px-3.5 py-2.5 text-[12px] font-semibold text-[var(--err)]">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-4 rounded-xl border border-[var(--ok)]/30 bg-[var(--ok)]/10 px-3.5 py-2.5 text-[12px] font-semibold text-[var(--ok)]">
          {notice}
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_0.95fr]">
        <div className="space-y-4">
          <Card style={{ marginBottom: 0 }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[14px] font-bold text-[var(--text)]">Registration gate</h3>
                <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--muted)]">
                  {creatorCount.toLocaleString()} of {threshold.toLocaleString()} creator accounts
                  used
                </p>
              </div>
              <Tag variant={data?.inviteRequired ? 'warn' : 'ok'}>
                {data?.inviteRequired ? 'Invite only' : 'Open'}
              </Tag>
            </div>

            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div
                  className="h-full rounded-full bg-gradient-mhomho transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-[var(--faint)]">
                <span>{progress}% of threshold</span>
                <span>{Math.max(0, threshold - creatorCount).toLocaleString()} to go</span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {MODES.map((mode) => {
                const selected = data?.mode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => handleMode(mode.id)}
                    disabled={Boolean(modeBusy) || loading}
                    className={`flex w-full items-start justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      selected
                        ? 'border-[var(--a1)]/45 bg-[var(--a1)]/10'
                        : 'border-[var(--line)] hover:border-[var(--line-strong)]'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-semibold text-[var(--text)]">
                        {mode.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--muted)]">
                        {mode.hint}
                      </span>
                    </span>
                    <span className="mt-0.5 shrink-0">
                      {modeBusy === mode.id ? (
                        <span className="text-[10px] font-semibold text-[var(--faint)]">Saving…</span>
                      ) : selected ? (
                        <Check size={15} className="text-[var(--a1)]" />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card style={{ marginBottom: 0 }}>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface-2)] text-[var(--a1)]">
                <KeyRound size={15} />
              </span>
              <div>
                <h3 className="text-[14px] font-bold text-[var(--text)]">Create an invite code</h3>
                <p className="text-[11px] text-[var(--muted)]">
                  Single use · expires in {data?.inviteCodeTtlDays ?? 30} days
                </p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                maxLength={120}
                placeholder="Label (optional) — e.g. First 50 creators"
                className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 text-[13px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--faint)] focus:border-[var(--a1)]"
              />
              <button
                type="submit"
                disabled={creating}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-mhomho px-5 text-[13px] font-bold text-[var(--ink)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                <Plus size={15} />
                {creating ? 'Generating…' : 'Generate code'}
              </button>
            </form>

            {created && (
              <div className="mt-4 rounded-xl border border-[var(--ok)]/30 bg-[var(--ok)]/10 p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ok)]">
                  Copy this code now
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <code className="min-w-0 flex-1 select-all break-all rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 font-mono text-[14px] font-bold tracking-[0.08em] text-[var(--text)]">
                    {created.code}
                  </code>
                  <button
                    type="button"
                    onClick={copyCreated}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[var(--line-strong)] px-4 text-[12px] font-semibold text-[var(--text)] hover:border-[var(--muted)]"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="mt-2 text-[10.5px] text-[var(--muted)]">
                  {created.label ? `${created.label} · ` : ''}Expires {formatDate(created.expiresAt)}
                </p>
              </div>
            )}
          </Card>
        </div>

        <Card style={{ marginBottom: 0 }}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-[14px] font-bold text-[var(--text)]">Recent codes</h3>
              <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                {activeCodes.length} active · {data?.codes.length ?? 0} shown
              </p>
            </div>
            <Tag variant="ok">Single use</Tag>
          </div>

          {loading ? (
            <p className="py-6 text-center text-[12px] text-[var(--muted)]">Loading codes…</p>
          ) : !data || data.codes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-9 text-center">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-[var(--faint)]">
                <Users size={17} />
              </span>
              <p className="mt-3 text-[13px] font-medium text-[var(--text)]">No codes yet</p>
              <p className="mt-1 max-w-[30ch] text-[12px] leading-relaxed text-[var(--muted)]">
                Generate a code when the gate is on, or when you want to invite someone early.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {data.codes.map((code) => (
                <li key={code.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[12.5px] font-semibold tracking-[0.04em] text-[var(--text)]">
                        MHOM-••••-••••-{code.hint}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">
                        {code.label || 'No label'}
                      </p>
                    </div>
                    <div className="shrink-0">{statusTag(code.status)}</div>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-3">
                    <p className="text-[10.5px] text-[var(--faint)]">
                      {code.status === 'used'
                        ? `Used ${formatDate(code.usedAt)}`
                        : code.status === 'revoked'
                          ? `Revoked ${formatDate(code.revokedAt)}`
                          : `Expires ${formatDate(code.expiresAt)}`}
                    </p>
                    {code.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(code.id)}
                        disabled={busyId === code.id}
                        className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[var(--err)] hover:underline disabled:opacity-60"
                      >
                        <ShieldOff size={11} />
                        {busyId === code.id ? 'Revoking…' : 'Revoke'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};
