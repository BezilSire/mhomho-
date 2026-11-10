import React, { useMemo, useState } from 'react';
import { Card } from '../../components/Card.tsx';
import { Tag } from '../../components/Tag.tsx';
import { Button } from '../../components/Button.tsx';
import {
  DatabaseState,
  BrandWaitlistDoc,
  BrandWaitlistStatus,
} from '../../lib/firebase.ts';
import { updateBrandWaitlist } from '../../lib/api.ts';

export interface AdminBrandWaitlistProps {
  db: DatabaseState;
}

const STATUSES: { id: BrandWaitlistStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'invited', label: 'Invited' },
  { id: 'closed', label: 'Closed' },
];

const statusVariant = (status: BrandWaitlistStatus) => {
  if (status === 'new') return 'warn';
  if (status === 'closed') return 'err';
  return 'ok';
};

const formatDay = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const WaitlistCard: React.FC<{ entry: BrandWaitlistDoc; onChanged: () => void }> = ({
  entry,
  onChanged,
}) => {
  const [note, setNote] = useState(entry.adminNotes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const update = async (updates: { status?: BrandWaitlistStatus; notes?: string | null }) => {
    setBusy(true);
    setError('');
    const result = await updateBrandWaitlist(entry.id, updates);
    if (!result.success) setError(result.error || 'Could not update this waitlist entry.');
    setBusy(false);
    onChanged();
  };

  const digits = entry.contactPhone.replace(/[^0-9]/g, '');

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <b className="text-[15px]">{entry.brandName}</b>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">
            Added {formatDay(entry.createdAt)}
          </p>
        </div>
        <Tag variant={statusVariant(entry.status)}>{entry.status}</Tag>
      </div>

      <div className="mt-3 grid gap-2 text-[12.5px] text-[var(--muted)] sm:grid-cols-2">
        <div>
          <span className="text-[var(--faint)]">Location:</span>{' '}
          <b className="text-[var(--text)]">{entry.location}</b>
        </div>
        <div>
          <span className="text-[var(--faint)]">Industry:</span>{' '}
          <b className="text-[var(--text)]">{entry.industry}</b>
        </div>
        <div>
          <span className="text-[var(--faint)]">Contact:</span>{' '}
          <b className="text-[var(--text)]">{entry.contactName}</b>
        </div>
        <div className="break-all">
          <span className="text-[var(--faint)]">Email:</span>{' '}
          <a className="font-semibold text-[var(--text)]" href={`mailto:${entry.contactEmail}`}>
            {entry.contactEmail}
          </a>
        </div>
        <div>
          <span className="text-[var(--faint)]">Phone:</span>{' '}
          <a className="font-semibold text-[var(--text)]" href={`tel:${entry.contactPhone}`}>
            {entry.contactPhone}
          </a>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`mailto:${entry.contactEmail}?subject=${encodeURIComponent(
            `MHOMHO brand waitlist — ${entry.brandName}`
          )}`}
          className="inline-flex h-9 items-center rounded-full border border-[var(--line)] px-3 text-[12px] font-semibold text-[var(--text)] no-underline"
        >
          Email brand
        </a>
        <a
          href={`tel:${entry.contactPhone}`}
          className="inline-flex h-9 items-center rounded-full border border-[var(--line)] px-3 text-[12px] font-semibold text-[var(--text)] no-underline"
        >
          Call
        </a>
        <a
          href={`https://wa.me/${digits}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center rounded-full border border-[var(--line)] px-3 text-[12px] font-semibold text-[var(--text)] no-underline"
        >
          WhatsApp
        </a>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
        {entry.status !== 'contacted' && entry.status !== 'invited' && (
          <Button size="sm" fullWidth={false} disabled={busy} onClick={() => void update({ status: 'contacted' })}>
            Mark contacted
          </Button>
        )}
        {entry.status !== 'invited' && (
          <Button size="sm" fullWidth={false} disabled={busy} onClick={() => void update({ status: 'invited' })}>
            Mark invited
          </Button>
        )}
        {entry.status !== 'closed' ? (
          <Button
            size="sm"
            variant="ghost"
            fullWidth={false}
            disabled={busy}
            onClick={() => void update({ status: 'closed' })}
          >
            Close
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            fullWidth={false}
            disabled={busy}
            onClick={() => void update({ status: 'new' })}
          >
            Reopen
          </Button>
        )}
      </div>

      <div className="mt-3">
        <label
          className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--faint)]"
          htmlFor={`waitlist-note-${entry.id}`}
        >
          Private admin note
        </label>
        <textarea
          id={`waitlist-note-${entry.id}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          placeholder="Call notes, follow-up date, anything internal…"
          className="w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--bg)] p-2.5 text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--a1)]"
        />
        <div className="mt-2">
          <Button
            size="sm"
            variant="ghost"
            fullWidth={false}
            disabled={busy || note === (entry.adminNotes ?? '')}
            onClick={() => void update({ notes: note.trim() ? note.trim() : null })}
          >
            Save note
          </Button>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-[12px] font-semibold text-[var(--err)]">{error}</p>
      )}
    </Card>
  );
};

export const AdminBrandWaitlist: React.FC<AdminBrandWaitlistProps> = ({ db }) => {
  const [filter, setFilter] = useState<BrandWaitlistStatus | 'all'>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const entries = useMemo(
    () =>
      Object.values(db.brandWaitlist).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.brandWaitlist, refreshKey]
  );

  const metrics = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const industries = new Map<string, number>();
    const locations = new Map<string, number>();
    for (const entry of entries) {
      industries.set(entry.industry, (industries.get(entry.industry) ?? 0) + 1);
      locations.set(entry.location, (locations.get(entry.location) ?? 0) + 1);
    }
    const top = (map: Map<string, number>) =>
      [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

    return {
      total: entries.length,
      fresh: entries.filter((entry) => entry.status === 'new').length,
      working: entries.filter(
        (entry) => entry.status === 'contacted' || entry.status === 'invited'
      ).length,
      week: entries.filter((entry) => new Date(entry.createdAt).getTime() >= weekAgo).length,
      industries: top(industries),
      locations: top(locations),
    };
  }, [entries]);

  const visible =
    filter === 'all' ? entries : entries.filter((entry) => entry.status === filter);

  const stats = [
    { label: 'Brands on waitlist', value: metrics.total },
    { label: 'New', value: metrics.fresh },
    { label: 'Contacted / invited', value: metrics.working },
    { label: 'Added this week', value: metrics.week },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-[18px] pt-[22px] pb-[14px]">
      <h2 className="mb-1 text-[22px] font-extrabold leading-[1.2]">Brand waitlist</h2>
      <p className="mb-4 text-[13px] text-[var(--muted)]">
        Brands that asked to be contacted when campaigns open — with their contact details and
        follow-up status.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
          >
            <p className="text-[19px] font-extrabold leading-none text-[var(--text)]">
              {stat.value}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--faint)]">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {(metrics.industries.length > 0 || metrics.locations.length > 0) && (
        <div className="mb-4 grid gap-2 rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--faint)]">
              Top industries
            </p>
            <p className="mt-1 text-[12px] text-[var(--muted)]">
              {metrics.industries.map(([name, count]) => `${name} (${count})`).join(' · ') || '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--faint)]">
              Top locations
            </p>
            <p className="mt-1 text-[12px] text-[var(--muted)]">
              {metrics.locations.map(([name, count]) => `${name} (${count})`).join(' · ') || '—'}
            </p>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((status) => {
          const active = filter === status.id;
          const count =
            status.id === 'all'
              ? entries.length
              : entries.filter((entry) => entry.status === status.id).length;
          return (
            <button
              key={status.id}
              type="button"
              onClick={() => setFilter(status.id)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[12px] font-semibold transition-colors ${
                active
                  ? 'border-transparent bg-[var(--text)] text-[var(--page)]'
                  : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {status.label}
              <span className="opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <Card className="py-8 text-center text-[14px] text-[var(--muted)]">
          {entries.length === 0
            ? 'No brands on the waitlist yet.'
            : 'No brands match this filter.'}
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((entry) => (
            <WaitlistCard
              key={entry.id}
              entry={entry}
              onChanged={() => setRefreshKey((value) => value + 1)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
