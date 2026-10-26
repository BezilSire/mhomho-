import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, LifeBuoy, Plus, Send, X } from 'lucide-react';
import { Tag } from './Tag.tsx';
import {
  createSupportTicket,
  fetchSupportTicket,
  fetchSupportTickets,
  replySupportTicket,
  type SupportMessage,
  type SupportTicketCategory,
  type SupportTicketSummary,
} from '../lib/api.ts';
import { relativeTime } from '../lib/relativeTime.ts';

const CATEGORIES: Array<{ value: SupportTicketCategory; label: string }> = [
  { value: 'payments', label: 'Payments & payouts' },
  { value: 'campaigns', label: 'Campaigns' },
  { value: 'clips', label: 'Clips & verification' },
  { value: 'account', label: 'Account & login' },
  { value: 'technical', label: 'Technical issue' },
  { value: 'other', label: 'Something else' },
];

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

function statusVariant(status: string): 'ok' | 'warn' | 'err' {
  if (status === 'resolved') return 'ok';
  if (status === 'closed') return 'err';
  return 'warn';
}

export interface SupportCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Creator-facing support centre: open a ticket, read the thread, reply.
 * Works for applicants too, so help is never locked behind approval.
 */
export const SupportCenter: React.FC<SupportCenterProps> = ({ isOpen, onClose }) => {
  const [view, setView] = useState<'list' | 'new' | 'detail'>('list');
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
  const [selected, setSelected] = useState<SupportTicketSummary | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [category, setCategory] = useState<SupportTicketCategory>('account');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    const result = await fetchSupportTickets();
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setError('');
    setTickets(result.data?.tickets ?? []);
  }, []);

  const openTicket = useCallback(async (ticket: SupportTicketSummary) => {
    setSelected(ticket);
    setView('detail');
    setLoading(true);
    const result = await fetchSupportTicket(ticket.id);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setError('');
    if (result.data) {
      setSelected(result.data.ticket);
      setMessages(result.data.messages);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setView('list');
    setSelected(null);
    setMessages([]);
    setError('');
    setSubject('');
    setMessage('');
    setReply('');
    void loadList();
  }, [isOpen, loadList]);

  if (!isOpen) return null;

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const result = await createSupportTicket({ category, subject, message });
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSubject('');
    setMessage('');
    await loadList();
    if (result.data?.ticket) await openTicket(result.data.ticket);
  };

  const handleReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || busy || !reply.trim()) return;
    setBusy(true);
    setError('');
    const result = await replySupportTicket(selected.id, reply.trim());
    if (!result.success) {
      setBusy(false);
      setError(result.error);
      return;
    }
    setReply('');
    const detail = await fetchSupportTicket(selected.id);
    setBusy(false);
    if (detail.success && detail.data) {
      setSelected(detail.data.ticket);
      setMessages(detail.data.messages);
    }
    void loadList();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Support"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-soft)] sm:rounded-[22px]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {view !== 'list' && (
              <button
                type="button"
                onClick={() => {
                  setView('list');
                  setSelected(null);
                  setError('');
                  void loadList();
                }}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] cursor-pointer"
                aria-label="Back to tickets"
              >
                <ArrowLeft size={15} />
              </button>
            )}
            <div className="min-w-0">
              <p className="font-display truncate text-[15px] font-bold leading-tight">
                {view === 'new'
                  ? 'New support ticket'
                  : view === 'detail' && selected
                    ? selected.number
                    : 'Support'}
              </p>
              <p className="truncate text-[11px] text-[var(--muted)]">
                {view === 'detail' && selected
                  ? selected.subject
                  : 'We usually reply inside one working day'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] cursor-pointer"
            aria-label="Close support"
          >
            <X size={15} />
          </button>
        </div>

        {error && (
          <p className="border-b border-[var(--line)] bg-[var(--err)]/8 px-4 py-2 text-[11.5px] font-semibold text-[var(--err)]">
            {error}
          </p>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {view === 'list' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setView('new');
                  setError('');
                }}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-full bg-gradient-mhomho px-4 text-[12.5px] font-bold text-[var(--ink)] cursor-pointer"
              >
                <Plus size={14} />
                Open a new ticket
              </button>

              <div className="mt-4">
                {loading && tickets.length === 0 ? (
                  <p className="py-8 text-center text-[12px] text-[var(--muted)]">Loading tickets…</p>
                ) : tickets.length === 0 ? (
                  <div className="py-8 text-center">
                    <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] text-[var(--faint)]">
                      <LifeBuoy size={18} />
                    </span>
                    <p className="mt-3 text-[13px] font-semibold text-[var(--text)]">
                      No tickets yet
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
                      Payments, clips, campaigns or account issues — open a ticket and the team
                      will pick it up.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-[var(--line)]">
                    {tickets.map((ticket) => (
                      <li key={ticket.id}>
                        <button
                          type="button"
                          onClick={() => void openTicket(ticket)}
                          className="flex w-full items-start justify-between gap-3 py-3 text-left cursor-pointer"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="font-mono text-[10.5px] font-semibold text-[var(--faint)]">
                                {ticket.number}
                              </span>
                              <Tag variant={statusVariant(ticket.status)}>
                                {STATUS_LABELS[ticket.status] ?? ticket.status}
                              </Tag>
                            </span>
                            <span className="mt-1 block truncate text-[13px] font-semibold text-[var(--text)]">
                              {ticket.subject}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-[var(--muted)]">
                              {relativeTime(ticket.lastMessageAt)}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {view === 'new' && (
            <form onSubmit={handleCreate} className="space-y-3.5">
              <div>
                <label className="mb-1.5 block text-[11.5px] font-semibold text-[var(--muted)]">
                  What is this about?
                </label>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as SupportTicketCategory)}
                  className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-[13px] font-semibold text-[var(--text)]"
                >
                  {CATEGORIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[11.5px] font-semibold text-[var(--muted)]">
                  Subject
                </label>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  maxLength={140}
                  required
                  minLength={3}
                  placeholder="Short summary of the issue"
                  className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-[13px] font-semibold text-[var(--text)]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11.5px] font-semibold text-[var(--muted)]">
                  Describe the issue
                </label>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={5000}
                  required
                  minLength={3}
                  rows={5}
                  placeholder="What happened, what you expected, and anything you already tried."
                  className="w-full resize-y rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-[13px] text-[var(--text)]"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-gradient-mhomho px-4 text-[13px] font-bold text-[var(--ink)] disabled:opacity-60 cursor-pointer"
              >
                {busy ? 'Sending…' : 'Submit ticket'}
              </button>
            </form>
          )}

          {view === 'detail' && selected && (
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Tag variant={statusVariant(selected.status)}>
                  {STATUS_LABELS[selected.status] ?? selected.status}
                </Tag>
                <span className="text-[11px] text-[var(--faint)]">
                  Opened {relativeTime(selected.createdAt)}
                </span>
              </div>

              <div className="space-y-2.5">
                {messages.map((entry) => (
                  <div
                    key={entry.id}
                    className={`rounded-2xl border px-3.5 py-2.5 ${
                      entry.authorRole === 'admin'
                        ? 'border-[var(--a1)]/25 bg-[var(--a1)]/8'
                        : 'border-[var(--line)] bg-[var(--bg)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--faint)]">
                        {entry.authorRole === 'admin' ? 'Mhommo Support' : 'You'}
                      </span>
                      <span className="text-[10px] text-[var(--faint)]">
                        {relativeTime(entry.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-[var(--text)]">
                      {entry.body}
                    </p>
                  </div>
                ))}
              </div>

              {selected.status === 'closed' ? (
                <p className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-3 text-[11.5px] text-[var(--muted)]">
                  This ticket is closed. Open a new ticket if you still need help.
                </p>
              ) : (
                <form onSubmit={handleReply} className="mt-4 space-y-2">
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    maxLength={5000}
                    rows={3}
                    required
                    placeholder="Add a reply…"
                    className="w-full resize-y rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-[13px] text-[var(--text)]"
                  />
                  <button
                    type="submit"
                    disabled={busy || !reply.trim()}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-gradient-mhomho px-4 text-[12.5px] font-bold text-[var(--ink)] disabled:opacity-60 cursor-pointer"
                  >
                    <Send size={13} />
                    {busy ? 'Sending…' : 'Send reply'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
