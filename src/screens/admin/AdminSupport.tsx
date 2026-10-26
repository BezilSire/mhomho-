import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Inbox, LifeBuoy, Send } from 'lucide-react';
import { Card } from '../../components/Card.tsx';
import { Tag } from '../../components/Tag.tsx';
import {
  fetchSupportTicket,
  fetchSupportTickets,
  replySupportTicket,
  updateSupportTicket,
  type SupportMessage,
  type SupportTicketSummary,
  type SupportTicketStatus,
} from '../../lib/api.ts';
import { absoluteTime, relativeTime } from '../../lib/relativeTime.ts';

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const CATEGORY_LABELS: Record<string, string> = {
  payments: 'Payments',
  campaigns: 'Campaigns',
  clips: 'Clips',
  account: 'Account',
  technical: 'Technical',
  other: 'Other',
};

const FILTERS: Array<{ id: string; label: string }> = [
  { id: '', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed', label: 'Closed' },
];

function statusVariant(status: string): 'ok' | 'warn' | 'err' {
  if (status === 'resolved') return 'ok';
  if (status === 'closed') return 'err';
  return 'warn';
}

function statusColor(status: string): string {
  if (status === 'open') return 'var(--a1)';
  if (status === 'in_progress') return 'var(--warn)';
  if (status === 'resolved') return 'var(--ok)';
  return 'var(--faint)';
}

export const AdminSupport: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SupportTicketSummary | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadList = useCallback(async (status: string) => {
    const result = await fetchSupportTickets({ status: status || undefined });
    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setError('');
    setTickets(result.data?.tickets ?? []);
    setCounts(result.data?.counts ?? {});
    setLoading(false);
  }, []);

  const openTicket = useCallback(async (ticket: SupportTicketSummary) => {
    setSelected(ticket);
    setReply('');
    const result = await fetchSupportTicket(ticket.id);
    if (!result.success) {
      setError(result.error);
      return;
    }
    if (result.data) {
      setSelected(result.data.ticket);
      setMessages(result.data.messages);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void loadList(filter);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadList(filter);
    }, 25_000);
    return () => window.clearInterval(timer);
  }, [filter, loadList]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tickets;
    return tickets.filter((ticket) =>
      [ticket.number, ticket.subject, ticket.creator.handle, ticket.creator.name]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [tickets, search]);

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
    void loadList(filter);
  };

  const handleUpdate = async (
    input: { status?: SupportTicketStatus; priority?: 'low' | 'normal' | 'high' }
  ) => {
    if (!selected) return;
    setBusy(true);
    setError('');
    const result = await updateSupportTicket(selected.id, input);
    if (!result.success) {
      setBusy(false);
      setError(result.error);
      return;
    }
    const detail = await fetchSupportTicket(selected.id);
    setBusy(false);
    if (detail.success && detail.data) {
      setSelected(detail.data.ticket);
      setMessages(detail.data.messages);
    }
    void loadList(filter);
  };

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <div className="pb-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
            Creator support
          </span>
          <h2 className="font-display mt-1 text-[24px] font-bold leading-tight text-[var(--text)]">
            Support inbox
          </h2>
          <p className="mt-1 text-[12px] text-[var(--muted)]">
            {total} ticket{total === 1 ? '' : 's'} in total. Replies reach the creator&apos;s
            notification bell.
          </p>
        </div>
        <Tag variant={(counts.open ?? 0) > 0 ? 'warn' : 'ok'}>
          {counts.open ?? 0} open
        </Tag>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((option) => {
          const active = filter === option.id;
          const count = option.id ? counts[option.id] ?? 0 : total;
          return (
            <button
              key={option.id || 'all'}
              type="button"
              onClick={() => setFilter(option.id)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[11.5px] font-semibold transition-colors cursor-pointer ${
                active
                  ? 'bg-[var(--text)] text-[var(--page)]'
                  : 'border border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {option.label}
              <span className={`text-[10px] font-bold ${active ? 'opacity-70' : 'text-[var(--faint)]'}`}>
                {count}
              </span>
            </button>
          );
        })}
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search ticket, handle or subject"
          className="h-8 min-w-[200px] flex-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 text-[11.5px] text-[var(--text)] sm:max-w-xs"
        />
      </div>

      {error && (
        <p className="mb-3 rounded-xl border border-[var(--err)]/30 bg-[var(--err)]/8 px-3.5 py-2 text-[11.5px] font-semibold text-[var(--err)]">
          {error}
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Card style={{ marginBottom: 0 }}>
          <h3 className="mb-2 text-[14px] font-bold text-[var(--text)]">
            {filter ? STATUS_LABELS[filter] : 'All tickets'}
          </h3>
          {loading && visible.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-[var(--muted)]">Loading tickets…</p>
          ) : visible.length === 0 ? (
            <div className="py-8 text-center">
              <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-[var(--faint)]">
                <LifeBuoy size={17} />
              </span>
              <p className="mt-3 text-[13px] font-medium text-[var(--text)]">No tickets here</p>
              <p className="mt-1 text-[12px] text-[var(--muted)]">
                New tickets from creators will appear in this inbox.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {visible.map((ticket) => (
                <li key={ticket.id}>
                  <button
                    type="button"
                    onClick={() => void openTicket(ticket)}
                    className={`flex w-full items-start gap-3 py-3 text-left transition-colors cursor-pointer ${
                      selected?.id === ticket.id ? 'opacity-100' : 'opacity-90 hover:opacity-100'
                    }`}
                  >
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: statusColor(ticket.status) }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-[10.5px] font-semibold text-[var(--faint)]">
                          {ticket.number}
                        </span>
                        <span className="shrink-0 text-[10px] text-[var(--faint)]">
                          {relativeTime(ticket.lastMessageAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] font-semibold text-[var(--text)]">
                        {ticket.subject}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-[var(--muted)]">
                        {ticket.creator.handle || ticket.creator.name} ·{' '}
                        {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card style={{ marginBottom: 0 }}>
          {!selected ? (
            <div className="py-14 text-center">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] text-[var(--faint)]">
                <Inbox size={18} />
              </span>
              <p className="mt-3 text-[13px] font-semibold text-[var(--text)]">Select a ticket</p>
              <p className="mt-1 text-[12px] text-[var(--muted)]">
                The full thread and reply box will open here.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] pb-3">
                <div className="min-w-0">
                  <span className="font-mono text-[10.5px] font-semibold text-[var(--faint)]">
                    {selected.number}
                  </span>
                  <h3 className="mt-0.5 text-[15px] font-bold leading-snug text-[var(--text)]">
                    {selected.subject}
                  </h3>
                  <p className="mt-1 text-[11.5px] text-[var(--muted)]">
                    {selected.creator.name || 'Creator'}
                    {selected.creator.handle ? ` · ${selected.creator.handle}` : ''}
                    {selected.creator.platform ? ` · ${selected.creator.platform}` : ''}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--faint)]">
                    {selected.creator.email} · opened {absoluteTime(selected.createdAt)}
                  </p>
                </div>
                <Tag variant={statusVariant(selected.status)}>
                  {STATUS_LABELS[selected.status] ?? selected.status}
                </Tag>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--faint)]">
                  Status
                </label>
                <select
                  value={selected.status}
                  disabled={busy}
                  onChange={(event) =>
                    void handleUpdate({ status: event.target.value as SupportTicketStatus })
                  }
                  className="h-8 rounded-full border border-[var(--line)] bg-[var(--bg)] px-2.5 text-[11.5px] font-semibold text-[var(--text)]"
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <label className="ml-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--faint)]">
                  Priority
                </label>
                <select
                  value={selected.priority}
                  disabled={busy}
                  onChange={(event) =>
                    void handleUpdate({
                      priority: event.target.value as 'low' | 'normal' | 'high',
                    })
                  }
                  className="h-8 rounded-full border border-[var(--line)] bg-[var(--bg)] px-2.5 text-[11.5px] font-semibold text-[var(--text)]"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="mt-4 max-h-[42vh] space-y-2.5 overflow-y-auto pr-1">
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
                        {entry.authorRole === 'admin' ? 'You (Mhommo Support)' : entry.authorName}
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

              <form onSubmit={handleReply} className="mt-3 space-y-2">
                <textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  rows={3}
                  maxLength={5000}
                  required
                  placeholder="Reply to the creator…"
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
            </>
          )}
        </Card>
      </div>
    </div>
  );
};
