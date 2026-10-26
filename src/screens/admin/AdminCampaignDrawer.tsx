import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Search, X } from 'lucide-react';
import { Tag, type TagVariant } from '../../components/Tag.tsx';
import { Button } from '../../components/Button.tsx';
import {
  campaignStatusLabel,
  type CampaignMemberDetail,
  type DatabaseState,
} from '../../lib/firebase.ts';
import { fetchCampaignMembers, setCampaignStatus } from '../../lib/api.ts';
import { formatCents } from '../../lib/money.ts';
import { absoluteTime, initials, relativeTime } from '../../lib/relativeTime.ts';

export interface AdminCampaignDrawerProps {
  campaignId: string | null;
  db: DatabaseState;
  onClose: () => void;
}

const PAGE_SIZE = 50;

const STATUS_ACTIONS: Record<string, Array<{ to: string; label: string; variant?: 'primary' | 'ghost' | 'danger' }>> = {
  draft: [
    { to: 'live', label: 'Publish now' },
    { to: 'scheduled', label: 'Schedule', variant: 'ghost' },
  ],
  scheduled: [
    { to: 'live', label: 'Publish now' },
    { to: 'draft', label: 'Back to draft', variant: 'ghost' },
  ],
  live: [
    { to: 'paused', label: 'Pause', variant: 'ghost' },
    { to: 'closing', label: 'Close joining', variant: 'ghost' },
  ],
  paused: [
    { to: 'live', label: 'Resume' },
    { to: 'closing', label: 'Close joining', variant: 'ghost' },
  ],
  closing: [{ to: 'completed', label: 'Mark completed' }],
  completed: [],
  cancelled: [],
};

function statusVariant(status: string): TagVariant {
  if (status === 'live' || status === 'completed') return 'ok';
  if (status === 'cancelled') return 'err';
  return 'warn';
}

export const AdminCampaignDrawer: React.FC<AdminCampaignDrawerProps> = ({
  campaignId,
  db,
  onClose,
}) => {
  const campaign = campaignId ? db.campaigns[campaignId] : undefined;
  const stats = campaignId ? db.campaignStats[campaignId] : undefined;

  const [members, setMembers] = useState<CampaignMemberDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyStatus, setBusyStatus] = useState(false);
  const [now, setNow] = useState(Date.now());

  const searchRef = useRef('');
  const offsetRef = useRef(0);

  const load = useCallback(
    async (reset: boolean) => {
      if (!campaignId) return;
      const offset = reset ? 0 : offsetRef.current;
      setLoading(true);
      setError('');
      const result = await fetchCampaignMembers(campaignId, {
        limit: PAGE_SIZE,
        offset,
        q: searchRef.current,
      });
      setLoading(false);
      if (!result.success || !result.data) {
        setError(result.success ? 'Could not load members.' : result.error);
        return;
      }
      const next = result.data.members;
      setTotal(result.data.total);
      offsetRef.current = offset + next.length;
      setMembers((current) => (reset ? next : [...current, ...next]));
    },
    [campaignId]
  );

  // Reload (debounced) whenever the campaign or the search term changes.
  useEffect(() => {
    if (!campaignId) return;
    searchRef.current = query;
    const timer = window.setTimeout(() => {
      offsetRef.current = 0;
      setMembers([]);
      void load(true);
    }, query ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [campaignId, query, load]);

  // Keep the first page fresh while the drawer is open, without clobbering
  // pages the administrator has explicitly loaded.
  useEffect(() => {
    if (!campaignId) return;
    const timer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (offsetRef.current > PAGE_SIZE) return;
      void load(true);
    }, 25_000);
    return () => window.clearInterval(timer);
  }, [campaignId, load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const actions = useMemo(
    () => (campaign ? STATUS_ACTIONS[campaign.status] ?? [] : []),
    [campaign]
  );

  if (!campaignId || !campaign) return null;

  const changeStatus = async (status: string) => {
    if (busyStatus) return;
    setBusyStatus(true);
    setError('');
    const result = await setCampaignStatus(campaignId, status);
    setBusyStatus(false);
    if (!result.success) setError(result.error || 'That status change was rejected.');
  };

  const committed = stats?.poolUsedCents ?? 0;
  const pool = stats?.poolTotalCents ?? 0;

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/70">
      <button
        type="button"
        aria-label="Close campaign details"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <aside className="relative flex h-full w-full max-w-[620px] flex-col overflow-hidden border-l border-[var(--line)] bg-[var(--bg)] shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
              Campaign detail
            </p>
            <h2 className="mt-1 truncate text-[20px] font-extrabold leading-tight">{campaign.title}</h2>
            <p className="mt-0.5 truncate text-[12px] text-[var(--muted)]">
              {campaign.brandName} · {campaign.niche}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Tag variant={statusVariant(campaign.status)}>{campaignStatusLabel(campaign)}</Tag>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full border border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              aria-label="Close"
            >
              <X size={15} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {campaign.posterUrl ? (
            <img
              src={campaign.posterUrl}
              alt=""
              className="mb-4 h-36 w-full rounded-xl object-cover"
              loading="lazy"
            />
          ) : null}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Budget', value: formatCents(campaign.budgetCents, false) },
              { label: 'Pool used', value: `${formatCents(committed, false)} / ${formatCents(pool, false)}` },
              { label: 'Joined', value: String(stats?.joinedCount ?? total) },
              { label: 'Verified views', value: (stats?.verifiedViews ?? 0).toLocaleString() },
            ].map((tile) => (
              <div
                key={tile.label}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
              >
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">
                  {tile.label}
                </p>
                <p className="mt-1 truncate text-[13px] font-bold tabular-nums">{tile.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3 text-[11.5px] leading-relaxed text-[var(--muted)]">
            <div className="flex justify-between gap-3">
              <span>Starts</span>
              <span className="font-semibold text-[var(--text)]">{absoluteTime(campaign.startsAt ?? 0)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Joining closes</span>
              <span className="font-semibold text-[var(--text)]">
                {absoluteTime(campaign.joiningCutoffAt ?? 0)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Submissions close</span>
              <span className="font-semibold text-[var(--text)]">
                {absoluteTime(campaign.submissionCutoffAt ?? 0)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Ends</span>
              <span className="font-semibold text-[var(--text)]">{absoluteTime(campaign.endsAt ?? 0)}</span>
            </div>
          </div>

          {actions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((action) => (
                <Button
                  key={action.to}
                  size="sm"
                  fullWidth={false}
                  variant={action.variant ?? 'primary'}
                  disabled={busyStatus}
                  onClick={() => changeStatus(action.to)}
                >
                  {action.label}
                </Button>
              ))}
              {campaign.status !== 'cancelled' && campaign.status !== 'completed' && (
                <Button
                  size="sm"
                  fullWidth={false}
                  variant="danger"
                  disabled={busyStatus}
                  onClick={() => changeStatus('cancelled')}
                >
                  Cancel campaign
                </Button>
              )}
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-[10px] border border-[var(--err)]/30 bg-[var(--err)]/10 p-3 text-[12px] font-semibold text-[var(--err)]">
              {error}
            </div>
          )}

          <div className="mt-5 flex items-center justify-between gap-3">
            <h3 className="text-[14px] font-bold">
              Joined creators{' '}
              <span className="text-[var(--muted)]">
                ({total}
                {query ? ' matching' : ''})
              </span>
            </h3>
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          <div className="relative mt-2">
            <Search
              size={13}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or handle"
              className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] py-2 pl-8 pr-3 text-[12px] text-[var(--text)] outline-none focus:border-[var(--a1)]"
            />
          </div>

          <div className="mt-2 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
            {members.length === 0 ? (
              <p className="px-3.5 py-6 text-center text-[12.5px] text-[var(--muted)]">
                {loading
                  ? 'Loading creators…'
                  : query
                    ? 'No creator matches that search.'
                    : 'No creators have joined this campaign yet.'}
              </p>
            ) : (
              <div className="divide-y divide-[var(--line)]">
                {members.map((member) => (
                  <div key={member.uid} className="px-3.5 py-3">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[10px] font-bold text-[var(--a1)]">
                        {initials(member.displayName || member.handle)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[12.5px] font-bold text-[var(--text)]">
                            {member.handle || member.displayName}
                          </p>
                          <span className="shrink-0 text-[10.5px] text-[var(--faint)]">
                            {relativeTime(member.joinedAtMs, now)}
                          </span>
                        </div>
                        <p className="truncate text-[11px] text-[var(--muted)]">
                          {member.displayName ? `${member.displayName} · ` : ''}
                          {member.platform} · {member.niche} ·{' '}
                          {member.followers.toLocaleString()} followers
                        </p>
                        <p className="mt-0.5 text-[10.5px] text-[var(--faint)]">
                          Joined {absoluteTime(member.joinedAtMs)} · {member.clipsSubmitted} clip
                          {member.clipsSubmitted === 1 ? '' : 's'} ·{' '}
                          {member.verifiedViews.toLocaleString()} verified ·{' '}
                          {formatCents(member.earnedCents)} earned
                        </p>
                      </div>
                      <Tag
                        variant={
                          member.accountStatus === 'approved'
                            ? 'ok'
                            : member.accountStatus === 'rejected' || member.accountStatus === 'suspended'
                              ? 'err'
                              : 'warn'
                        }
                      >
                        {member.accountStatus}
                      </Tag>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {members.length < total && (
            <div className="mt-3">
              <Button size="sm" variant="ghost" disabled={loading} onClick={() => void load(false)}>
                {loading ? 'Loading…' : `Load ${Math.min(PAGE_SIZE, total - members.length)} more`}
              </Button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
