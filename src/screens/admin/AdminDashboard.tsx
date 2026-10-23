import React, { useState } from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Inbox,
  MessageCircle,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Card } from '../../components/Card.tsx';
import { Tag } from '../../components/Tag.tsx';
import { FunnelBar, FunnelStage } from '../../components/FunnelBar.tsx';
import {
  CAMPAIGN_ZERO_MIN_CLIPS,
  CAMPAIGN_ZERO_MIN_VIEWS,
  DatabaseState,
  approveCreator,
  calculateTotalOwedCents,
  evaluateCampaignZero,
  isAllowedSocialUrl,
} from '../../lib/firebase.ts';
import { formatCents } from '../../lib/money.ts';

export interface AdminDashboardProps {
  db: DatabaseState;
  onNavigateTab?: (tab: 'queue' | 'campaigns' | 'payouts' | 'enquiries') => void;
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function whatsappLink(number?: string, handle?: string): string {
  const digits = (number || '').replace(/\D/g, '');
  const text = encodeURIComponent(
    `Hi${handle ? ` ${handle}` : ''}, this is Mhomho operations. We’re reviewing your Campaign Zero submission.`
  );
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/263786205197?text=${text}`;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  db,
  onNavigateTab: _onNavigateTab,
}) => {
  const totalOwed = calculateTotalOwedCents();
  const pendingCreators = Object.values(db.creatorsPublic).filter(
    (creator) => creator.status === 'applied'
  );

  const [expandedUid, setExpandedUid] = useState<string | null>(
    pendingCreators.length === 1 ? pendingCreators[0].uid : null
  );
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [approvalError, setApprovalError] = useState<{ uid: string; message: string } | null>(
    null
  );

  const allCreators = Object.values(db.creatorsPublic);
  const signedUp = allCreators.length;
  const postedClips = allCreators.filter(
    (creator) => (creator.campaignZero?.clips.length ?? 0) > 0
  ).length;
  const submittedProof = allCreators.filter(
    (creator) => evaluateCampaignZero(creator.campaignZero).submitted
  ).length;
  const accepted = allCreators.filter((creator) => creator.status === 'approved').length;
  const nicheRows = Object.entries(
    allCreators.reduce<Record<string, { total: number; approved: number }>>((groups, creator) => {
      const group = groups[creator.niche] ?? { total: 0, approved: 0 };
      groups[creator.niche] = {
        total: group.total + 1,
        approved: group.approved + (creator.status === 'approved' ? 1 : 0),
      };
      return groups;
    }, {})
  )
    .sort((left, right) => right[1].total - left[1].total)
    .slice(0, 3);
  const funnelBase = Math.max(signedUp, 1);
  const stages: FunnelStage[] = [
    { label: 'Signed up', count: signedUp, widthPercent: 100 },
    {
      label: 'Posted clips',
      count: postedClips,
      widthPercent:
        postedClips === 0 ? 0 : Math.max(6, Math.round((postedClips / funnelBase) * 100)),
    },
    {
      label: 'Submitted proof',
      count: submittedProof,
      widthPercent:
        submittedProof === 0
          ? 0
          : Math.max(6, Math.round((submittedProof / funnelBase) * 100)),
    },
    {
      label: 'Accepted',
      count: accepted,
      widthPercent:
        accepted === 0 ? 0 : Math.max(6, Math.round((accepted / funnelBase) * 100)),
    },
  ];

  const handleApprove = (uid: string) => {
    setApprovalError(null);
    const result = approveCreator(uid, 'admin');
    if (!result.success) {
      setApprovalError({ uid, message: result.error || 'Could not approve this applicant.' });
    }
  };

  return (
    <div className="pb-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
            Campaign Zero
          </span>
          <h2 className="font-display mt-1 text-[24px] font-bold leading-tight text-[var(--text)]">
            Applicant funnel
          </h2>
        </div>
        {pendingCreators.length > 0 && (
          <Tag variant="warn">
            {pendingCreators.length} applicant{pendingCreators.length === 1 ? '' : 's'} pending
          </Tag>
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Funnel */}
        <Card style={{ marginBottom: 0 }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[14px] font-bold text-[var(--text)]">Roster pipeline</h3>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--muted)]">
                Creators must follow a Mhomho page, post {CAMPAIGN_ZERO_MIN_CLIPS} clips and reach{' '}
                {CAMPAIGN_ZERO_MIN_VIEWS.toLocaleString()} views on one before approval.
              </p>
            </div>
            <span className="shrink-0 text-[11px] font-medium text-[var(--faint)]">All time</span>
          </div>
          <FunnelBar stages={stages} />
        </Card>

        {/* Pending applicants */}
        <Card style={{ marginBottom: 0 }}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-[14px] font-bold text-[var(--text)]">Awaiting approval</h3>
            {pendingCreators.length > 0 && (
              <span className="rounded-full bg-[var(--warn)]/12 px-2 py-0.5 text-[10px] font-bold text-[var(--warn)]">
                {pendingCreators.length}
              </span>
            )}
          </div>

          {pendingCreators.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-9 text-center">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-[var(--faint)]">
                <Inbox size={17} />
              </span>
              <p className="mt-3 text-[13px] font-medium text-[var(--text)]">No applications waiting</p>
              <p className="mt-1 max-w-[26ch] text-[12px] leading-relaxed text-[var(--muted)]">
                New creator applications will show up here with their Campaign Zero proof.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {pendingCreators.map((creator) => {
                const evaluation = evaluateCampaignZero(creator.campaignZero);
                const clips = creator.campaignZero?.clips ?? [];
                const submitted = Boolean(creator.campaignZero?.submittedAt);
                const canApprove = evaluation.complete && evaluation.submitted;
                const isExpanded = expandedUid === creator.uid;
                const checked = Boolean(verified[creator.uid]);
                const privateDoc = db.creatorsPrivate[creator.uid];

                return (
                  <div key={creator.uid} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setExpandedUid(isExpanded ? null : creator.uid)}
                        className="min-w-0 flex-1 text-left cursor-pointer"
                        aria-expanded={isExpanded}
                      >
                        <p className="truncate text-[13.5px] font-semibold text-[var(--text)]">
                          {creator.handle}
                        </p>
                        <p className="mt-0.5 truncate text-[11.5px] text-[var(--muted)]">
                          {creator.platform} · {creator.followers.toLocaleString()} followers ·{' '}
                          {creator.niche}
                        </p>
                      </button>
                      <div className="flex shrink-0 items-center gap-2">
                        {submitted ? (
                          <Tag variant="warn">In review</Tag>
                        ) : (
                          <Tag variant="warn">Proof needed</Tag>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedUid(isExpanded ? null : creator.uid)}
                          className="grid h-7 w-7 place-items-center rounded-full border border-[var(--line)] text-[var(--muted)] transition-colors hover:text-[var(--text)] cursor-pointer"
                          aria-label={isExpanded ? 'Hide Campaign Zero proof' : 'Review Campaign Zero proof'}
                        >
                          <ChevronDown
                            size={14}
                            className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-semibold ${
                          evaluation.followed
                            ? 'bg-[var(--ok)]/10 text-[var(--ok)]'
                            : 'bg-[var(--surface-2)] text-[var(--faint)]'
                        }`}
                      >
                        {evaluation.followed ? <Check size={9} /> : <X size={9} />}
                        Follow
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[9.5px] font-semibold text-[var(--muted)]">
                        {evaluation.clipCount}/{CAMPAIGN_ZERO_MIN_CLIPS} clips
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-semibold ${
                          evaluation.hasQualifyingClip
                            ? 'bg-[var(--ok)]/10 text-[var(--ok)]'
                            : 'bg-[var(--surface-2)] text-[var(--faint)]'
                        }`}
                      >
                        {evaluation.hasQualifyingClip ? <Check size={9} /> : <X size={9} />}
                        1K views
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 p-3.5">
                        {!submitted ? (
                          <div className="flex items-start gap-2.5">
                            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--warn)]/12 text-[var(--warn)]">
                              <ShieldCheck size={12} />
                            </span>
                            <div>
                              <p className="text-[12px] font-semibold text-[var(--text)]">
                                Campaign Zero is still in progress
                              </p>
                              <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--muted)]">
                                The creator has not submitted proof yet. You can only approve after
                                all three requirements are submitted.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
                                Campaign Zero proof
                              </p>
                              <span className="text-[10.5px] text-[var(--faint)]">
                                Submitted {formatDate(creator.campaignZero?.submittedAt)}
                              </span>
                            </div>

                            <div className="mt-2 space-y-1.5">
                              {clips.map((clip, index) => (
                                <a
                                  key={`${clip.url}-${index}`}
                                  href={isAllowedSocialUrl(clip.url) ? clip.url : undefined}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[11.5px] no-underline transition-colors hover:border-[var(--line-strong)]"
                                >
                                  <span className="min-w-0 truncate font-medium text-[var(--text)]">
                                    Clip {index + 1} · {clip.url.replace(/^https?:\/\//, '')}
                                  </span>
                                  <span className="flex shrink-0 items-center gap-1.5">
                                    <span
                                      className={`font-bold tabular-nums ${
                                        clip.claimedViews >= CAMPAIGN_ZERO_MIN_VIEWS
                                          ? 'text-[var(--ok)]'
                                          : 'text-[var(--muted)]'
                                      }`}
                                    >
                                      {clip.claimedViews.toLocaleString()}
                                    </span>
                                    <ArrowUpRight size={11} className="text-[var(--faint)]" />
                                  </span>
                                </a>
                              ))}
                            </div>

                            <a
                              href={whatsappLink(privateDoc?.whatsappNumber, creator.handle)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2.5 inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-[var(--muted)] no-underline hover:text-[var(--text)]"
                            >
                              <MessageCircle size={11} />
                              Message {privateDoc?.name || creator.handle} on WhatsApp
                            </a>

                            <label className="mt-3 flex cursor-pointer items-start gap-2 border-t border-[var(--line)] pt-3 text-[10.5px] leading-relaxed text-[var(--muted)]">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) =>
                                  setVerified((current) => ({
                                    ...current,
                                    [creator.uid]: event.target.checked,
                                  }))
                                }
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--a1)]"
                              />
                              I checked the live public views. One clip has at least{' '}
                              {CAMPAIGN_ZERO_MIN_VIEWS.toLocaleString()} views.
                            </label>

                            {approvalError?.uid === creator.uid && (
                              <p className="mt-2 rounded-lg border border-[var(--err)]/30 bg-[var(--err)]/10 px-2.5 py-2 text-[10.5px] leading-relaxed text-[var(--err)]">
                                {approvalError.message}
                              </p>
                            )}

                            <button
                              type="button"
                              onClick={() => handleApprove(creator.uid)}
                              disabled={!canApprove || !checked}
                              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-gradient-mhomho text-[11.5px] font-bold text-[var(--ink)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 cursor-pointer"
                            >
                              <Check size={12} />
                              Verify & approve
                            </button>
                            {!canApprove && (
                              <p className="mt-1.5 text-center text-[10px] text-[var(--faint)]">
                                Approval is blocked until Campaign Zero is complete.
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Niche readiness */}
        <Card style={{ marginBottom: 0 }}>
          <h3 className="mb-2 text-[14px] font-bold text-[var(--text)]">Niche readiness</h3>
          <div className="divide-y divide-[var(--line)]">
            {nicheRows.length === 0 ? (
              <p className="py-3 text-[12px] text-[var(--muted)]">No creators on the roster yet.</p>
            ) : (
              nicheRows.map(([niche, group]) => (
                <div key={niche} className="flex items-center justify-between gap-3 py-3 last:pb-0">
                  <span className="text-[13.5px] font-medium text-[var(--text)]">{niche}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[12px] tabular-nums text-[var(--muted)]">
                      {group.total}
                    </span>
                    <Tag variant={group.approved > 0 ? 'ok' : 'warn'}>
                      {group.approved > 0 ? 'Ready' : 'Building'}
                    </Tag>
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Owed */}
        <Card style={{ marginBottom: 0 }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[14px] font-bold text-[var(--text)]">Owed to creators</h3>
              <p className="mt-1 max-w-[30ch] text-[12px] leading-relaxed text-[var(--muted)]">
                Verified balances waiting for the next EcoCash payout run.
              </p>
            </div>
            <Tag variant="warn">Pending</Tag>
          </div>
          <p className="font-display mt-4 text-[34px] font-bold leading-none tracking-[-0.03em] text-gradient">
            {formatCents(totalOwed)}
          </p>
        </Card>
      </div>
    </div>
  );
};
