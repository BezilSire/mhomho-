import React, { useState } from 'react';
import { Card } from '../../components/Card.tsx';
import { Tag } from '../../components/Tag.tsx';
import { ProgressBar } from '../../components/ProgressBar.tsx';
import { Button } from '../../components/Button.tsx';
import {
  DatabaseState,
  CampaignDoc,
  topUpCampaign,
} from '../../lib/firebase.ts';
import {
  calculateCreatorPool,
  calculatePerPostCap,
  calculateGuaranteedViews,
  formatCents,
  formatViews,
  formatPercent,
} from '../../lib/money.ts';

export interface AdminCampaignsProps {
  db: DatabaseState;
}

export const AdminCampaigns: React.FC<AdminCampaignsProps> = ({ db }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState<string | null>(null);
  const [topUpAmount, setTopUpAmount] = useState('100');

  // Form states for creating campaign
  const [title, setTitle] = useState('');
  const [brandName, setBrandName] = useState('');
  const [niche, setNiche] = useState('Tech & gadgets');
  const [budgetCents, setBudgetCents] = useState(25000); // default $250
  const [brief, setBrief] = useState('');
  const [hookIdea, setHookIdea] = useState('');
  const [doNot, setDoNot] = useState('No bought views. Must stay live 30 days.');

  const poolCalculated = calculateCreatorPool(budgetCents);
  const capCalculated = calculatePerPostCap(poolCalculated);
  const guaranteedCalculated = calculateGuaranteedViews(budgetCents);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !brandName.trim()) return;

    const id = `camp_${Date.now()}`;
    const newCampaign: CampaignDoc = {
      id,
      title: title.trim(),
      brandName: brandName.trim(),
      niche,
      brief: brief.trim() || 'Highlight the core product benefits in an authentic voice.',
      hookIdeas: hookIdea ? [hookIdea] : ['“What happened when I tried this for 7 days”'],
      doNots: [doNot],
      status: 'open',
      endDate: '2026-11-20',
      daysLeft: 14,
    };

    db.campaigns[id] = newCampaign;
    db.campaignFinance[id] = {
      id,
      budgetCents,
      brandPricePerThousandCents: 150,
      creatorRatePerThousandCents: 100,
      perPostCapCents: capCalculated,
    };
    db.campaignStats[id] = {
      id,
      poolTotalCents: poolCalculated,
      poolUsedCents: 0,
      joinedCount: 0,
      clipsLive: 0,
      verifiedViews: 0,
      joiningOpen: true,
    };

    setShowCreateModal(false);
    setTitle('');
    setBrandName('');
  };

  const handleTopUpConfirm = (campaignId: string) => {
    const additionalCents = Math.round(Number(topUpAmount) * 100);
    if (additionalCents > 0) {
      topUpCampaign(campaignId, additionalCents, 'admin');
    }
    setShowTopUpModal(null);
  };

  return (
    <div className="flex-1 overflow-y-auto px-[18px] pt-[22px] pb-[14px]">
      <div className="flex justify-between items-center mb-[14px]">
        <h2 className="text-[22px] font-extrabold leading-[1.2] m-0">
          Campaigns
        </h2>
        <Button size="sm" fullWidth={false} onClick={() => setShowCreateModal(true)}>
          + New Campaign
        </Button>
      </div>

      <div className="space-y-3">
        {Object.values(db.campaigns).map((camp) => {
          const stats = db.campaignStats[camp.id];
          const finance = db.campaignFinance[camp.id];
          const poolPercent = stats
            ? formatPercent(stats.poolUsedCents, stats.poolTotalCents)
            : 0;

          return (
            <Card key={camp.id}>
              <div className="flex justify-between items-center gap-2 mb-1">
                <b className="truncate text-[15px]">{camp.title}</b>
                <Tag variant={camp.status === 'open' ? 'ok' : 'err'}>
                  {camp.status}
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
                <span>Pool: {formatCents(stats?.poolUsedCents || 0)} used ({poolPercent}%)</span>
                <span>{stats?.verifiedViews.toLocaleString() || 0} views</span>
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setShowTopUpModal(camp.id)}>
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
                onChange={(e) => setTopUpAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold"
              />
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowTopUpModal(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => handleTopUpConfirm(showTopUpModal)}>
                Confirm Top Up
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-[14px] bg-[var(--surface)] border border-[var(--line)] p-5 max-h-[90vh] overflow-y-auto">
            <h3 className="text-[18px] font-extrabold mb-3">Create New Campaign</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Zuva Data Launch"
                  className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] text-[13px]"
                  required
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">Brand Name</label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. Zuva Telecom"
                  className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] text-[13px]"
                  required
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">Budget ($USD)</label>
                <input
                  type="number"
                  min="50"
                  step="50"
                  value={budgetCents / 100}
                  onChange={(e) => setBudgetCents(Math.round(Number(e.target.value) * 100))}
                  className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] text-[13px]"
                  required
                />
                <div className="text-[11px] text-[var(--muted)] mt-1">
                  Pool: {formatCents(poolCalculated)} · Cap: {formatCents(capCalculated)} · {formatViews(guaranteedCalculated)} guaranteed views
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">Brief</label>
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="What should creators highlight?"
                  className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] text-[13px] h-18 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="ghost" type="button" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit">
                  Publish Campaign
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
