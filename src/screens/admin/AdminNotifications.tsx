import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, Send } from 'lucide-react';
import { Card } from '../../components/Card.tsx';
import { Tag } from '../../components/Tag.tsx';
import {
  fetchNotifications,
  sendNotification,
  type NotificationAudience,
  type NotificationItem,
} from '../../lib/api.ts';
import type { DatabaseState } from '../../lib/firebase.ts';
import { relativeTime } from '../../lib/relativeTime.ts';

const AUDIENCE_LABELS: Record<NotificationAudience, string> = {
  creators: 'All creators',
  approved_creators: 'Approved creators',
  applicants: 'Applicants only',
  account: 'One creator',
};

export interface AdminNotificationsProps {
  db: DatabaseState;
}

export const AdminNotifications: React.FC<AdminNotificationsProps> = ({ db }) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<NotificationAudience>('creators');
  const [accountId, setAccountId] = useState('');
  const [history, setHistory] = useState<NotificationItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');

  const creators = useMemo(
    () =>
      Object.values(db.creatorsPublic)
        .filter((creator) => creator.status === 'approved' || creator.status === 'applied')
        .sort((left, right) => left.handle.localeCompare(right.handle)),
    [db.creatorsPublic]
  );

  const audienceCount = useMemo(() => {
    if (audience === 'approved_creators') {
      return creators.filter((creator) => creator.status === 'approved').length;
    }
    if (audience === 'applicants') {
      return creators.filter((creator) => creator.status === 'applied').length;
    }
    if (audience === 'account') return accountId ? 1 : 0;
    return creators.length;
  }, [audience, creators, accountId]);

  const loadHistory = useCallback(async () => {
    const result = await fetchNotifications();
    if (result.success) setHistory(result.data?.items ?? []);
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setSent('');
    const result = await sendNotification({
      title: title.trim(),
      message: message.trim(),
      audience,
      accountId: audience === 'account' ? accountId : undefined,
    });
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setTitle('');
    setMessage('');
    setSent(`Notification sent to ${audienceCount} creator${audienceCount === 1 ? '' : 's'}.`);
    void loadHistory();
  };

  return (
    <div className="pb-10">
      <div className="mb-5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
          Notifications
        </span>
        <h2 className="font-display mt-1 text-[24px] font-bold leading-tight text-[var(--text)]">
          Message creators
        </h2>
        <p className="mt-1 text-[12px] text-[var(--muted)]">
          Delivered to the notification bell in the creator portal and on the Campaign Zero screen.
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_0.9fr]">
        <Card style={{ marginBottom: 0 }}>
          <form onSubmit={handleSend} className="space-y-3.5">
            <div>
              <label className="mb-1.5 block text-[11.5px] font-semibold text-[var(--muted)]">
                Audience
              </label>
              <select
                value={audience}
                onChange={(event) => setAudience(event.target.value as NotificationAudience)}
                className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-[13px] font-semibold text-[var(--text)]"
              >
                {(Object.keys(AUDIENCE_LABELS) as NotificationAudience[]).map((value) => (
                  <option key={value} value={value}>
                    {AUDIENCE_LABELS[value]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-[var(--faint)]">
                {audienceCount} recipient{audienceCount === 1 ? '' : 's'}
              </p>
            </div>

            {audience === 'account' && (
              <div>
                <label className="mb-1.5 block text-[11.5px] font-semibold text-[var(--muted)]">
                  Creator
                </label>
                <select
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                  required
                  className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-[13px] font-semibold text-[var(--text)]"
                >
                  <option value="">Choose a creator…</option>
                  {creators.map((creator) => (
                    <option key={creator.uid} value={creator.uid}>
                      {creator.handle} · {creator.status === 'approved' ? 'Approved' : 'Applicant'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[11.5px] font-semibold text-[var(--muted)]">
                Title
              </label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                required
                placeholder="e.g. Payouts run this Friday"
                className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-[13px] font-semibold text-[var(--text)]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11.5px] font-semibold text-[var(--muted)]">
                Message
              </label>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={2000}
                required
                rows={6}
                placeholder="Keep it short and actionable. Plain text only."
                className="w-full resize-y rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-[13px] text-[var(--text)]"
              />
              <p className="mt-1 text-right text-[10.5px] text-[var(--faint)]">
                {message.length}/2000
              </p>
            </div>

            {error && (
              <p className="rounded-xl border border-[var(--err)]/30 bg-[var(--err)]/8 px-3.5 py-2 text-[11.5px] font-semibold text-[var(--err)]">
                {error}
              </p>
            )}
            {sent && (
              <p className="rounded-xl border border-[var(--ok)]/30 bg-[var(--ok)]/8 px-3.5 py-2 text-[11.5px] font-semibold text-[var(--ok)]">
                {sent}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || audienceCount === 0}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-gradient-mhomho px-4 text-[13px] font-bold text-[var(--ink)] disabled:opacity-60 cursor-pointer sm:w-auto"
            >
              <Send size={14} />
              {busy ? 'Sending…' : 'Send notification'}
            </button>
          </form>
        </Card>

        <Card style={{ marginBottom: 0 }}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[14px] font-bold text-[var(--text)]">Recently sent</h3>
            <Tag variant="ok">In-app</Tag>
          </div>
          {history.length === 0 ? (
            <div className="py-9 text-center">
              <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-[var(--faint)]">
                <BellRing size={17} />
              </span>
              <p className="mt-3 text-[13px] font-medium text-[var(--text)]">Nothing sent yet</p>
              <p className="mt-1 text-[12px] text-[var(--muted)]">
                Your broadcasts and support replies will be listed here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {history.slice(0, 20).map((item) => (
                <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12.5px] font-semibold text-[var(--text)]">{item.title}</p>
                    <span className="shrink-0 text-[10px] text-[var(--faint)]">
                      {relativeTime(item.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-3 whitespace-pre-line text-[11.5px] leading-relaxed text-[var(--muted)]">
                    {item.body}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--faint)]">
                    {AUDIENCE_LABELS[item.audience]}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};
