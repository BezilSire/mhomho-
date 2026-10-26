import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../../components/Card.tsx';
import { Tag } from '../../components/Tag.tsx';
import { ProgressBar } from '../../components/ProgressBar.tsx';
import { Button } from '../../components/Button.tsx';
import { DatabaseState, campaignStatusLabel } from '../../lib/firebase.ts';
import {
  createCampaign,
  topUpCampaign,
  uploadCampaignPoster,
} from '../../lib/api.ts';
import {
  calculateCreatorPool,
  calculatePerPostCap,
  calculateGuaranteedViews,
  formatCents,
  formatViews,
  formatPercent,
} from '../../lib/money.ts';
import { AdminCampaignDrawer } from './AdminCampaignDrawer.tsx';

export interface AdminCampaignsProps {
  db: DatabaseState;
}

const NICHES = [
  'Health & beauty',
  'Tech & gadgets',
  'Fitness',
  'Food & travel',
  'Fashion & style',
  'Finance',
  'Entertainment',
  'Education',
  'Other',
];

const DAY = 86_400_000;

function dateInputValue(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseDateInput(value: string): number | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function linesToArray(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export const AdminCampaigns: React.FC<AdminCampaignsProps> = ({ db }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('100');
  const [errorMsg, setErrorMsg] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // Campaign form
  const [title, setTitle] = useState('');
  const [brandName, setBrandName] = useState('');
  const [niche, setNiche] = useState('Tech & gadgets');
  const [budgetDollars, setBudgetDollars] = useState('250');
  const [brief, setBrief] = useState('');
  const [requiredContent, setRequiredContent] = useState('');
  const [eligibility, setEligibility] = useState('');
  const [hookInput, setHookInput] = useState('');
  const [doNotInput, setDoNotInput] = useState('No bought views. Must stay live 30 days.');
  const [perPostCapDollars, setPerPostCapDollars] = useState('');
  const [startDate, setStartDate] = useState(() => dateInputValue(Date.now()));
  const [endDate, setEndDate] = useState(() => dateInputValue(Date.now() + 14 * DAY));
  const [publishMode, setPublishMode] = useState<'draft' | 'scheduled' | 'live'>('live');
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string>('');

  const posterUrlRef = useRef<string>('');

  const budgetCents = useMemo(() => {
    const value = Number(budgetDollars);
    return Number.isFinite(value) ? Math.round(value * 100) : 0;
  }, [budgetDollars]);

  const poolCalculated = calculateCreatorPool(budgetCents);
  const capCalculated = calculatePerPostCap(poolCalculated);
  const guaranteedCalculated = calculateGuaranteedViews(budgetCents);

  const setPoster = (file: File | null) => {
    if (posterUrlRef.current) URL.revokeObjectURL(posterUrlRef.current);
    posterUrlRef.current = file ? URL.createObjectURL(file) : '';
    setPosterPreview(posterUrlRef.current);
    setPosterFile(file);
  };

  useEffect(
    () => () => {
      if (posterUrlRef.current) URL.revokeObjectURL(posterUrlRef.current);
    },
    []
  );

  const resetForm = () => {
    setTitle('');
    setBrandName('');
    setBrief('');
    setRequiredContent('');
    setEligibility('');
    setHookInput('');
    setDoNotInput('No bought views. Must stay live 30 days.');
    setPerPostCapDollars('');
    setBudgetDollars('250');
    setPublishMode('live');
    setStartDate(dateInputValue(Date.now()));
    setEndDate(dateInputValue(Date.now() + 14 * DAY));
    setPoster(null);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    setErrorMsg('');
    setNotice('');

    if (!title.trim() || !brandName.trim() || !brief.trim()) {
      setErrorMsg('Title, brand name and brief are required.');
      return;
    }
    if (budgetCents < 5000) {
      setErrorMsg('The budget must be at least $50.00.');
      return;
    }

    const startsAt = parseDateInput(startDate);
    const endsAt = parseDateInput(endDate);
    if (publishMode !== 'live' && (!startsAt || !endsAt)) {
      setErrorMsg('Choose both a start and an end date.');
      return;
    }
    if (startsAt && endsAt && endsAt <= startsAt) {
      setErrorMsg('The campaign must end after it starts.');
      return;
    }
    if (publishMode !== 'draft' && endsAt && endsAt <= Date.now()) {
      setErrorMsg('The end date must be in the future.');
      return;
    }
    if (publishMode === 'scheduled' && startsAt && startsAt <= Date.now()) {
      setErrorMsg('A scheduled campaign needs a start date in the future.');
      return;
    }

    const capValue = perPostCapDollars.trim() ? Number(perPostCapDollars) : null;
    if (capValue !== null && (!Number.isFinite(capValue) || capValue <= 0)) {
      setErrorMsg('The per-post cap must be a positive amount, or left blank.');
      return;
    }

    setBusy(true);
    const result = await createCampaign({
      title: title.trim(),
      brandName: brandName.trim(),
      niche,
      brief: brief.trim(),
      requiredContent: requiredContent.trim() || null,
      eligibility: eligibility.trim() || null,
      budgetCents,
      hookIdeas: linesToArray(hookInput),
      doNots: linesToArray(doNotInput),
      perPostCapCents: capValue === null ? null : Math.round(capValue * 100),
      startsAt,
      endsAt,
      publishMode,
    });
    if (!result.success) {
      setBusy(false);
      setErrorMsg(result.error || 'The campaign could not be created.');
      return;
    }

    const campaignId = result.data?.campaignId;
    if (posterFile && campaignId) {
      const upload = await uploadCampaignPoster(campaignId, posterFile);
      if (!upload.success) {
        setNotice(`Campaign saved, but the image failed to upload: ${upload.error}`);
      }
    }

    setBusy(false);
    setShowCreateModal(false);
    resetForm();
  };

  const handleTopUpConfirm = async (campaignId: string) => {
    const additionalCents = Math.round(Number(topUpAmount) * 100);
    if (!Number.isFinite(additionalCents) || additionalCents < 1000) {
      setErrorMsg('Top-ups must be at least $10.00.');
      return;
    }

    setBusy(true);
    setErrorMsg('');
    const result = await topUpCampaign(campaignId, additionalCents);
    setBusy(false);
    if (!result.success) {
      setErrorMsg(result.error || 'The top-up could not be applied.');
      return;
    }
    setShowTopUpModal(null);
  };

  const campaigns = Object.values(db.campaigns);

  return (
    <div className="flex-1 overflow-y-auto px-[18px] pt-[22px] pb-[14px]">
      <div className="flex justify-between items-center mb-[14px]">
        <div>
          <h2 className="text-[22px] font-extrabold leading-[1.2] m-0">Campaigns</h2>
          <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">
            {campaigns.length} campaign{campaigns.length === 1 ? '' : 's'} · published campaigns
            appear in every creator feed immediately
          </p>
        </div>
        <Button size="sm" fullWidth={false} onClick={() => setShowCreateModal(true)}>
          + New Campaign
        </Button>
      </div>

      {errorMsg && (
        <div className="p-3 mb-3 rounded-[10px] bg-[var(--err)]/10 text-[var(--err)] text-[13px] font-semibold border border-[var(--err)]/30">
          {errorMsg}
        </div>
      )}
      {notice && (
        <div className="p-3 mb-3 rounded-[10px] bg-[var(--warn)]/10 text-[var(--warn)] text-[13px] font-semibold border border-[var(--warn)]/30">
          {notice}
        </div>
      )}

      <div className="space-y-3">
        {campaigns.map((camp) => {
          const stats = db.campaignStats[camp.id];
          const finance = db.campaignFinance[camp.id];
          const poolPercent = stats
            ? formatPercent(stats.poolUsedCents, stats.poolTotalCents)
            : 0;

          return (
            <Card
              key={camp.id}
              onClick={() => setSelectedCampaignId(camp.id)}
              className="cursor-pointer transition-colors hover:border-[var(--line-strong)]"
            >
              {camp.posterUrl && (
                <img
                  src={camp.posterUrl}
                  alt=""
                  className="mb-3 h-32 w-full rounded-xl object-cover"
                  loading="lazy"
                />
              )}

              <div className="flex justify-between items-center gap-2 mb-1">
                <b className="truncate text-[15px]">{camp.title}</b>
                <Tag
                  variant={
                    camp.status === 'live' || camp.status === 'completed'
                      ? 'ok'
                      : camp.status === 'cancelled'
                        ? 'err'
                        : 'warn'
                  }
                >
                  {campaignStatusLabel(camp)}
                </Tag>
              </div>

              <div className="text-[13px] text-[var(--muted)]">
                {camp.brandName} · {camp.niche}
              </div>

              <div className="mt-2 text-[12px] text-[var(--muted)] flex justify-between">
                <span>Budget: {formatCents(finance?.budgetCents || 0, false)}</span>
                <span>Creator Pool: {formatCents(stats?.poolTotalCents || 0)}</span>
              </div>

              <ProgressBar percentage={poolPercent} />

              <div className="flex justify-between items-center text-[12px] text-[var(--muted)] mb-3">
                <span>
                  Pool: {formatCents(stats?.poolUsedCents || 0)} used ({poolPercent}%)
                </span>
                <span>
                  {stats?.joinedCount || 0} joined · {stats?.verifiedViews.toLocaleString() || 0}{' '}
                  views
                </span>
              </div>

              {(stats?.shortfallCents ?? 0) > 0 && (
                <div className="mb-3 rounded-[10px] border border-[var(--warn)]/30 bg-[var(--warn)]/10 px-3 py-2 text-[11.5px] leading-relaxed text-[var(--warn)]">
                  Budget shortfall: {formatCents(stats?.shortfallCents ?? 0)} of verified earnings
                  could not be committed. Top up this campaign to pay creators in full.
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedCampaignId(camp.id);
                  }}
                >
                  View creators
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowTopUpModal(camp.id);
                  }}
                >
                  Top Up Budget
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Top up modal */}
      {showTopUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-[14px] bg-[var(--surface)] border border-[var(--line)] p-5">
            <h3 className="text-[18px] font-extrabold mb-2">Top Up Campaign Budget</h3>
            <p className="text-[13px] text-[var(--muted)] mb-4">
              Adds budget, recalculates creator pool, and re-opens creator joining if it was closed.
            </p>

            <div className="mb-4">
              <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
                Additional Budget (USD)
              </label>
              <input
                type="number"
                min="10"
                step="10"
                value={topUpAmount}
                onChange={(event) => setTopUpAmount(event.target.value)}
                className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold"
              />
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowTopUpModal(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => handleTopUpConfirm(showTopUpModal)} disabled={busy}>
                {busy ? 'Applying…' : 'Confirm Top Up'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-[14px] bg-[var(--surface)] border border-[var(--line)] p-5 max-h-[92vh] overflow-y-auto">
            <h3 className="text-[18px] font-extrabold mb-1">Create New Campaign</h3>
            <p className="mb-3 text-[11.5px] text-[var(--muted)]">
              Published campaigns show in every creator feed and on the landing page.
            </p>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Zuva Data Launch"
                  className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] text-[13px]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">
                    Brand Name
                  </label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(event) => setBrandName(event.target.value)}
                    placeholder="e.g. Zuva Telecom"
                    className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] text-[13px]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">
                    Niche
                  </label>
                  <select
                    value={niche}
                    onChange={(event) => setNiche(event.target.value)}
                    className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] text-[13px]"
                  >
                    {NICHES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">
                  Campaign image
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => setPoster(event.target.files?.[0] ?? null)}
                  className="w-full text-[12px] text-[var(--muted)] file:mr-3 file:rounded-full file:border-0 file:bg-[var(--surface-2)] file:px-3 file:py-1.5 file:text-[11px] file:font-semibold file:text-[var(--text)]"
                />
                <p className="mt-1 text-[10.5px] text-[var(--faint)]">
                  PNG, JPEG or WebP, up to 5 MB. Recommended 16:9. You can replace it later.
                </p>
                {posterPreview && (
                  <img
                    src={posterPreview}
                    alt="Campaign preview"
                    className="mt-2 h-28 w-full rounded-xl object-cover"
                  />
                )}
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">
                  Budget ($USD)
                </label>
                <input
                  type="number"
                  min="50"
                  step="50"
                  value={budgetDollars}
                  onChange={(event) => setBudgetDollars(event.target.value)}
                  className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] text-[13px]"
                  required
                />
                <div className="text-[11px] text-[var(--muted)] mt-1">
                  Pool: {formatCents(poolCalculated)} · Cap: {formatCents(capCalculated)} ·{' '}
                  {formatViews(guaranteedCalculated)} guaranteed views
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">
                  Per-post cap override ($USD, optional)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={perPostCapDollars}
                  onChange={(event) => setPerPostCapDollars(event.target.value)}
                  placeholder={`Default ${formatCents(capCalculated)}`}
                  className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] text-[13px]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">
                  Brief
                </label>
                <textarea
                  value={brief}
                  onChange={(event) => setBrief(event.target.value)}
                  placeholder="What should creators highlight?"
                  className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] text-[13px] h-20 resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">
                  Required content
                </label>
                <textarea
                  value={requiredContent}
                  onChange={(event) => setRequiredContent(event.target.value)}
                  placeholder="e.g. One 30–60s vertical video showing the product in use."
                  className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] text-[13px] h-16 resize-none"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">
                  Eligibility
                </label>
                <textarea
                  value={eligibility}
                  onChange={(event) => setEligibility(event.target.value)}
                  placeholder="e.g. Zimbabwe-based creators with an approved Mhomho profile."
                  className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] text-[13px] h-16 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">
                    Hook ideas (one per line)
                  </label>
                  <textarea
                    value={hookInput}
                    onChange={(event) => setHookInput(event.target.value)}
                    placeholder={'“What happened when I tried this for 7 days”'}
                    className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] text-[13px] h-20 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">
                    Do nots (one per line)
                  </label>
                  <textarea
                    value={doNotInput}
                    onChange={(event) => setDoNotInput(event.target.value)}
                    className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] text-[13px] h-20 resize-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] text-[13px]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">
                    End date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] text-[13px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">
                  Publishing
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: 'live', label: 'Publish now' },
                      { value: 'scheduled', label: 'Schedule' },
                      { value: 'draft', label: 'Save draft' },
                    ] as const
                  ).map((option) => {
                    const active = publishMode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPublishMode(option.value)}
                        className={`h-9 rounded-[10px] border px-2 text-[11.5px] font-semibold transition-colors cursor-pointer ${
                          active
                            ? 'border-[var(--a1)] bg-[var(--a1)]/10 text-[var(--text)]'
                            : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-[10.5px] text-[var(--faint)]">
                  Joining closes automatically at 80% of the run. Submissions close two days
                  before the end date.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={busy}>
                  {busy
                    ? 'Publishing…'
                    : publishMode === 'draft'
                      ? 'Save Draft'
                      : publishMode === 'scheduled'
                        ? 'Schedule Campaign'
                        : 'Publish Campaign'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AdminCampaignDrawer
        campaignId={selectedCampaignId}
        db={db}
        onClose={() => setSelectedCampaignId(null)}
      />
    </div>
  );
};
