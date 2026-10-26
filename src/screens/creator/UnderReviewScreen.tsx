import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock,
  LifeBuoy,
  Lock,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import {
  CAMPAIGN_ZERO_MIN_CLIPS,
  CAMPAIGN_ZERO_MIN_VIEWS,
  CampaignZeroClip,
  DatabaseState,
  evaluateCampaignZero,
  isAllowedSocialUrl,
} from '../../lib/firebase.ts';
import { saveCampaignZero, submitCampaignZero } from '../../lib/api.ts';
import { BrandLockup, BrandMark } from '../../components/BrandMark.tsx';
import { Tag } from '../../components/Tag.tsx';
import { NotificationBell } from '../../components/NotificationBell.tsx';
import { MHOMHO_SOCIALS } from '../../lib/brand.ts';

export interface UnderReviewScreenProps {
  db: DatabaseState;
  currentUid: string;
  onLogout: () => void;
  onOpenSupport?: () => void;
}

interface ClipDraft {
  url: string;
  views: string;
}

function formatDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const UnderReviewScreen: React.FC<UnderReviewScreenProps> = ({
  db,
  currentUid,
  onLogout,
  onOpenSupport,
}) => {
  const creator = db.creatorsPublic[currentUid];
  const saved = creator?.campaignZero;

  const [followConfirmed, setFollowConfirmed] = useState(Boolean(saved?.followConfirmed));
  const [clips, setClips] = useState<ClipDraft[]>(() =>
    Array.from({ length: CAMPAIGN_ZERO_MIN_CLIPS }, (_, index) => ({
      url: saved?.clips[index]?.url ?? '',
      views: saved?.clips[index] ? String(saved.clips[index].claimedViews) : '',
    }))
  );
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  if (!creator) return null;

  const submitted = Boolean(saved?.submittedAt);

  const draftClips: CampaignZeroClip[] = clips.map((clip) => ({
    url: clip.url,
    claimedViews: Math.max(0, Math.floor(Number(clip.views) || 0)),
    addedAt: '',
  }));
  const evaluation = evaluateCampaignZero({
    followConfirmed,
    clips: draftClips,
  });
  const progress = Math.min(
    100,
    Math.round((evaluation.maxViews / CAMPAIGN_ZERO_MIN_VIEWS) * 100)
  );

  const updateClip = (index: number, patch: Partial<ClipDraft>) => {
    setClips((current) =>
      current.map((clip, clipIndex) => (clipIndex === index ? { ...clip, ...patch } : clip))
    );
    setError('');
    setNotice('');
  };

  const persist = async (): Promise<boolean> => {
    const result = await saveCampaignZero({
      followConfirmed,
      clips: draftClips.map((clip) => ({
        url: clip.url,
        claimedViews: clip.claimedViews,
      })),
    });
    if (!result.success) {
      setError(result.error || 'Could not save your progress.');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    const savedOk = await persist();
    setBusy(false);
    if (savedOk) setNotice('Progress saved. You can come back and finish later.');
  };

  const handleSubmit = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    const savedOk = await persist();
    if (!savedOk) {
      setBusy(false);
      return;
    }
    const result = await submitCampaignZero();
    setBusy(false);
    if (!result.success) {
      setError(result.error || 'Could not submit Campaign Zero.');
      return;
    }
    setNotice('Campaign Zero submitted. Your dashboard unlocks after review.');
  };

  const steps = [
    { label: 'Account created', meta: 'Done', state: 'done' as const },
    {
      label: 'Campaign Zero',
      meta: submitted ? 'Submitted' : evaluation.complete ? 'Ready to submit' : 'In progress',
      state: submitted ? ('done' as const) : ('active' as const),
    },
    {
      label: 'Admin approval',
      meta: submitted ? 'In review' : 'After submission',
      state: 'locked' as const,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto bg-[var(--page)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="campaign-zero-title"
    >
      <div className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-[420px]" />
      <div className="grid-lines pointer-events-none absolute inset-0 opacity-60" />

      <div className="relative mx-auto flex min-h-full w-full max-w-[1120px] flex-col px-5 py-7 sm:px-8 sm:py-10">
        <header className="flex items-center justify-between gap-4">
          <BrandLockup size={32} />
          <div className="flex items-center gap-2">
            {onOpenSupport && (
              <button
                type="button"
                onClick={onOpenSupport}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--line)] px-3.5 text-[11.5px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)] cursor-pointer"
              >
                <LifeBuoy size={13} />
                <span className="hidden sm:inline">Help</span>
              </button>
            )}
            <NotificationBell />
            <span className="hidden items-center gap-1.5 rounded-full border border-[var(--warn)]/25 bg-[var(--warn)]/10 px-3 py-1.5 text-[10.5px] font-semibold text-[var(--warn)] sm:inline-flex">
              <Lock size={11} />
              Dashboard locked
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--line)] px-3.5 text-[11.5px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)] cursor-pointer"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </header>

        <div className="mt-9 grid flex-1 items-start gap-6 lg:grid-cols-[0.88fr_1.12fr] lg:gap-10">
          {/* Status column */}
          <div className="lg:sticky lg:top-8">
            <div className="flex flex-wrap items-center gap-2">
              <Tag variant="warn">Pending approval</Tag>
              <span className="text-[11px] text-[var(--faint)]">
                Applied {formatDate(creator.createdAt)}
              </span>
            </div>

            <h1
              id="campaign-zero-title"
              className="font-display mt-4 text-[32px] font-bold leading-[1.04] tracking-[-0.035em] sm:text-[42px]"
            >
              Your dashboard
              <br />
              is locked.
            </h1>
            <p className="mt-3 max-w-[46ch] text-[13.5px] leading-[1.7] text-[var(--muted)]">
              Campaign Zero is the final step before approval. Follow a Mhomho page, post{' '}
              {CAMPAIGN_ZERO_MIN_CLIPS} clips featuring Mhomho, and get at least{' '}
              {CAMPAIGN_ZERO_MIN_VIEWS.toLocaleString()} views on one of them. Then our team reviews
              your proof.
            </p>

            <div className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)]/85 backdrop-blur">
              {steps.map((step, index) => (
                <div
                  key={step.label}
                  className={`flex items-center gap-3 px-4 py-3.5 ${
                    index !== steps.length - 1 ? 'border-b border-[var(--line)]' : ''
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                      step.state === 'done'
                        ? 'bg-[var(--ok)]/15 text-[var(--ok)]'
                        : step.state === 'active'
                        ? 'bg-[var(--warn)]/15 text-[var(--warn)]'
                        : 'border border-[var(--line)] text-[var(--faint)]'
                    }`}
                  >
                    {step.state === 'done' ? (
                      <Check size={13} />
                    ) : step.state === 'active' ? (
                      <Clock size={13} />
                    ) : (
                      <Lock size={12} />
                    )}
                  </span>
                  <span className="flex-1 text-[13px] font-medium text-[var(--text)]">
                    {step.label}
                  </span>
                  <span className="text-[11px] text-[var(--faint)]">{step.meta}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)]/85 p-4 backdrop-blur">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
                Your application
              </p>
              <dl className="mt-3 space-y-2 text-[12.5px]">
                {[
                  ['Handle', creator.handle],
                  ['Platform', creator.platform],
                  ['Niche', creator.niche],
                  ['Followers', creator.followers.toLocaleString('en-US')],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4">
                    <dt className="text-[var(--muted)]">{label}</dt>
                    <dd className="m-0 font-medium text-[var(--text)]">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[var(--line)] px-4 py-3 text-[11.5px] leading-relaxed text-[var(--muted)]">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[var(--ok)]" />
              Your dashboard, campaigns and earnings stay hidden until an admin verifies your proof
              and approves the account.
            </div>
          </div>

          {/* Campaign Zero card */}
          <div className="overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
            <div className="border-b border-[var(--line)] px-5 py-5 sm:px-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--a1)]">
                    Campaign Zero
                  </p>
                  <h2 className="font-display mt-1 text-[22px] font-bold leading-tight">
                    {submitted ? 'Proof submitted' : 'Prove the clip, not the follower count.'}
                  </h2>
                  <p className="mt-1.5 max-w-[52ch] text-[12.5px] leading-relaxed text-[var(--muted)]">
                    {submitted
                      ? 'Your proof is locked and waiting for review. We verify the public view counts before approval.'
                      : 'Complete all three requirements below. You can save progress and finish later — nothing is visible in the portal until approval.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface-2)] text-[11px] font-bold text-[var(--muted)]">
                    {Math.min(evaluation.clipCount, CAMPAIGN_ZERO_MIN_CLIPS)}/{CAMPAIGN_ZERO_MIN_CLIPS}
                  </span>
                  <span className="text-[10px] font-medium leading-tight text-[var(--faint)]">
                    clips
                    <br />
                    added
                  </span>
                </div>
              </div>
            </div>

            {submitted ? (
              <div className="px-5 py-6 sm:px-7">
                <div className="rounded-2xl border border-[var(--ok)]/25 bg-[var(--ok)]/8 p-5">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--ok)]">
                    <Check size={15} />
                    Submitted for review
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--muted)]">
                    Submitted {formatDate(saved?.submittedAt)}. This usually takes up to 48 hours.
                    You’ll be able to enter the dashboard the moment an admin approves you.
                  </p>
                </div>

                <div className="mt-5 space-y-2.5">
                  {saved?.clips.map((clip, index) => (
                    <div
                      key={`${clip.url}-${index}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-3.5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-[var(--faint)]">
                          Clip {index + 1}
                        </p>
                        <a
                          href={isAllowedSocialUrl(clip.url) ? clip.url : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 block truncate text-[12px] font-medium text-[var(--text)] no-underline hover:text-[var(--a1)]"
                        >
                          {clip.url}
                        </a>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${
                          clip.claimedViews >= CAMPAIGN_ZERO_MIN_VIEWS
                            ? 'bg-[var(--ok)]/12 text-[var(--ok)]'
                            : 'bg-[var(--surface-2)] text-[var(--muted)]'
                        }`}
                      >
                        {clip.claimedViews.toLocaleString()} views
                      </span>
                    </div>
                  ))}
                </div>

                {saved?.followConfirmed && (
                  <p className="mt-4 flex items-center gap-2 text-[11.5px] text-[var(--muted)]">
                    <Check size={13} className="text-[var(--ok)]" />
                    Mhomho social page followed
                  </p>
                )}

                <button
                  type="button"
                  onClick={onLogout}
                  className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--line-strong)] text-[12.5px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--muted)] cursor-pointer"
                >
                  Sign out and check back later
                </button>
              </div>
            ) : (
              <div className="space-y-6 px-5 py-6 sm:px-7">
                {/* 1. Follow */}
                <section>
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--a1)]/12 text-[10px] font-bold text-[var(--a1)]">
                      1
                    </span>
                    <h3 className="text-[13.5px] font-bold text-[var(--text)]">
                      Follow a Mhomho page
                    </h3>
                    {followConfirmed && (
                      <Check size={14} className="ml-auto text-[var(--ok)]" />
                    )}
                  </div>
                  <p className="mt-1.5 pl-8 text-[12px] leading-relaxed text-[var(--muted)]">
                    Follow any one of our official pages. The admin team may check that your account
                    is following back.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 pl-8">
                    {MHOMHO_SOCIALS.map((social) => (
                      <a
                        key={social.name}
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-[11px] font-semibold text-[var(--muted)] no-underline transition-colors hover:border-[var(--line-strong)] hover:text-[var(--text)]"
                      >
                        {social.name}
                        <ArrowUpRight size={11} />
                      </a>
                    ))}
                  </div>
                  <label className="mt-3 ml-8 flex cursor-pointer items-start gap-2.5 text-[12px] leading-relaxed text-[var(--muted)] select-none">
                    <input
                      type="checkbox"
                      checked={followConfirmed}
                      onChange={(event) => {
                        setFollowConfirmed(event.target.checked);
                        setError('');
                        setNotice('');
                      }}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--a1)]"
                    />
                    I followed a Mhomho page with {creator.handle}.
                  </label>
                </section>

                <div className="h-px bg-[var(--line)]" />

                {/* 2. Clips */}
                <section>
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--a1)]/12 text-[10px] font-bold text-[var(--a1)]">
                      2
                    </span>
                    <h3 className="text-[13.5px] font-bold text-[var(--text)]">
                      Post {CAMPAIGN_ZERO_MIN_CLIPS} clips featuring Mhomho
                    </h3>
                    <span className="ml-auto text-[10.5px] font-semibold text-[var(--faint)]">
                      {evaluation.clipCount}/{CAMPAIGN_ZERO_MIN_CLIPS}
                    </span>
                  </div>
                  <p className="mt-1.5 pl-8 text-[12px] leading-relaxed text-[var(--muted)]">
                    Use public TikTok, Instagram, YouTube or Facebook posts. Paste the link and the
                    view count shown on the post.
                  </p>

                  <div className="mt-3 space-y-2.5 pl-8">
                    {clips.map((clip, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-[var(--line)] bg-[var(--bg)]/60 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">
                            Clip {index + 1}
                          </span>
                          {Number(clip.views) >= CAMPAIGN_ZERO_MIN_VIEWS && (
                            <span className="rounded-full bg-[var(--ok)]/12 px-2 py-0.5 text-[9.5px] font-bold text-[var(--ok)]">
                              Qualifies
                            </span>
                          )}
                        </div>
                        <input
                          type="url"
                          inputMode="url"
                          value={clip.url}
                          onChange={(event) => updateClip(index, { url: event.target.value })}
                          placeholder="https://tiktok.com/@you/video/..."
                          className="mt-2 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--faint)] focus:border-[var(--a1)]"
                          spellCheck={false}
                          autoComplete="off"
                        />
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={clip.views}
                            onChange={(event) => updateClip(index, { views: event.target.value })}
                            placeholder="Views"
                            className="h-9 w-28 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-[12px] tabular-nums text-[var(--text)] outline-none transition-colors placeholder:text-[var(--faint)] focus:border-[var(--a1)]"
                          />
                          <span className="text-[11px] text-[var(--faint)]">views on the post</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="h-px bg-[var(--line)]" />

                {/* 3. Views */}
                <section>
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--a1)]/12 text-[10px] font-bold text-[var(--a1)]">
                      3
                    </span>
                    <h3 className="text-[13.5px] font-bold text-[var(--text)]">
                      Get {CAMPAIGN_ZERO_MIN_VIEWS.toLocaleString()} views on one clip
                    </h3>
                    {evaluation.hasQualifyingClip && (
                      <Check size={14} className="ml-auto text-[var(--ok)]" />
                    )}
                  </div>
                  <p className="mt-1.5 pl-8 text-[12px] leading-relaxed text-[var(--muted)]">
                    One qualifying clip is enough. The admin team verifies the live count before
                    approving you.
                  </p>
                  <div className="mt-3 pl-8">
                    <div className="flex items-center justify-between text-[10.5px] font-medium text-[var(--faint)]">
                      <span>Best clip</span>
                      <span className="tabular-nums text-[var(--muted)]">
                        {evaluation.maxViews.toLocaleString()} /{' '}
                        {CAMPAIGN_ZERO_MIN_VIEWS.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <div
                        className="h-full rounded-full bg-gradient-mhomho transition-[width] duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </section>

                {(error || notice) && (
                  <p
                    className={`rounded-xl border px-3.5 py-3 text-[12px] leading-relaxed ${
                      error
                        ? 'border-[var(--err)]/30 bg-[var(--err)]/10 text-[var(--err)]'
                        : 'border-[var(--ok)]/25 bg-[var(--ok)]/8 text-[var(--ok)]'
                    }`}
                  >
                    {error || notice}
                  </p>
                )}

                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={busy}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-[var(--line-strong)] text-[12.5px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--muted)] disabled:opacity-60 cursor-pointer"
                  >
                    Save progress
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={busy || !evaluation.complete}
                    className="inline-flex h-11 flex-[1.35] items-center justify-center gap-2 rounded-full bg-gradient-mhomho text-[12.5px] font-bold text-[var(--ink)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer"
                  >
                    Submit for review
                    <ArrowRight size={14} />
                  </button>
                </div>
                <p className="text-center text-[10.5px] leading-relaxed text-[var(--faint)]">
                  Proof is locked once submitted. Do not delete clips for 30 days.
                </p>
              </div>
            )}
          </div>
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-4 text-[10.5px] text-[var(--faint)]">
          <span className="inline-flex items-center gap-1.5">
            <BrandMark size={16} />
            Mhomho creator onboarding
          </span>
          <span>Campaign Zero · Account access is restricted until approval</span>
        </footer>
      </div>
    </div>
  );
};
