import React from 'react';
import { ArrowUpRight, Megaphone, Video, Wallet } from 'lucide-react';
import { Card } from '../../components/Card.tsx';
import { Tile, TilesContainer } from '../../components/Tile.tsx';
import { Tag } from '../../components/Tag.tsx';
import { ProgressBar } from '../../components/ProgressBar.tsx';
import { ListRow } from '../../components/ListRow.tsx';
import { Button } from '../../components/Button.tsx';
import { CampaignBriefCountdown } from './CampaignBriefCountdown.tsx';
import {
  DatabaseState,
  calculateCreatorBalances,
} from '../../lib/firebase.ts';
import { formatCents, formatPercent } from '../../lib/money.ts';

export interface CreatorHomeProps {
  db: DatabaseState;
  currentUid: string;
  onNavigateToCampaign: (campaignId: string) => void;
  onNavigateToTab: (tab: 'campaigns' | 'clips' | 'earnings' | 'profile') => void;
  onSubmitClip?: () => void;
}

export const CreatorHome: React.FC<CreatorHomeProps> = ({
  db,
  currentUid,
  onNavigateToCampaign,
  onNavigateToTab,
  onSubmitClip,
}) => {
  const creatorPublic = db.creatorsPublic[currentUid];
  const creatorPrivate = db.creatorsPrivate[currentUid];

  const firstName = creatorPrivate?.name
    ? creatorPrivate.name.split(' ')[0]
    : creatorPublic?.handle.replace('@', '') || 'Creator';

  const balances = calculateCreatorBalances(currentUid);

  // Active campaign (e.g., Glow Skincare Launch)
  const activeCampaign = db.campaigns['glow_skincare'] || Object.values(db.campaigns)[0];
  const activeStats = activeCampaign ? db.campaignStats[activeCampaign.id] : null;
  const poolFillPercent = activeStats
    ? formatPercent(activeStats.poolUsedCents, activeStats.poolTotalCents)
    : 64;

  // Latest clips submitted by this creator
  const creatorClips = Object.values(db.clips)
    .filter((clip) => clip.creatorUid === currentUid)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);

  return (
    <div className="app-scroll flex-1 overflow-y-auto px-4 pb-8 pt-5 sm:px-[18px] sm:pt-[22px]">
      {/* Top Header */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
          Overview
        </span>
        <Tag variant="ok">Approved</Tag>
      </div>

      <h2 className="text-[26px] font-extrabold leading-[1.12] tracking-[-0.03em]">
        Hey {firstName}
      </h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--muted)]">
        Campaigns, clips and EcoCash — all in one place.
      </p>

      {/* App-style quick actions */}
      <div className="mb-4 mt-5 grid grid-cols-3 gap-2">
        <QuickAction
          icon={<Megaphone size={17} />}
          label="Campaigns"
          onClick={() => onNavigateToTab('campaigns')}
        />
        <QuickAction
          icon={<Video size={17} />}
          label="Submit clip"
          onClick={onSubmitClip ?? (() => onNavigateToTab('clips'))}
        />
        <QuickAction
          icon={<Wallet size={17} />}
          label="Earnings"
          onClick={() => onNavigateToTab('earnings')}
        />
      </div>

      <CampaignBriefCountdown />

      {/* Tiles: Owed to you (gradient) & Paid so far */}
      <TilesContainer>
        <Tile
          label="Owed to you"
          value={formatCents(balances.owedCents)}
          highlightGradient={true}
        />
        <Tile
          label="Paid so far"
          value={formatCents(balances.paidCents)}
        />
      </TilesContainer>

      {/* Active Featured Campaign */}
      {activeCampaign && activeStats && (
        <Card
          onClick={() => onNavigateToCampaign(activeCampaign.id)}
          className="tap-card cursor-pointer hover:border-[var(--muted)]"
        >
          {activeCampaign.posterUrl && (
            <img
              src={activeCampaign.posterUrl}
              alt=""
              className="mb-3 aspect-[16/9] w-full rounded-xl object-cover"
              loading="lazy"
            />
          )}
          <div className="flex items-center justify-between gap-2">
            <b className="min-w-0 truncate">{activeCampaign.title}</b>
            <span className="shrink-0 rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--muted)]">
              {activeCampaign.daysLeft} days left
            </span>
          </div>

          <ProgressBar percentage={poolFillPercent} />

          <div className="flex items-center justify-between gap-2 text-[12.5px] text-[var(--muted)]">
            <span>
              {poolFillPercent}% full · {activeStats.joinedCount} creators joined
            </span>
            <ArrowUpRight size={14} className="shrink-0 text-[var(--faint)]" />
          </div>
        </Card>
      )}

      {/* Latest Clips Section */}
      <div className="mb-1 mt-5 flex items-center justify-between gap-3 text-[13px] text-[var(--muted)]">
        <span>Latest clips</span>
        <button
          type="button"
          onClick={() => onNavigateToTab('clips')}
          className="press inline-flex min-h-8 items-center rounded-full px-2 text-[12px] font-semibold text-[var(--text)] hover:underline cursor-pointer"
        >
          View all
        </button>
      </div>

      <Card>
        {creatorClips.length === 0 ? (
          <div className="py-4 text-center text-[13px] text-[var(--muted)]">
            No clips submitted yet.
            <div className="mt-3">
              <Button size="sm" onClick={() => onNavigateToTab('campaigns')}>
                Explore Campaigns
              </Button>
            </div>
          </div>
        ) : (
          creatorClips.map((clip, idx) => {
            const isLast = idx === creatorClips.length - 1;
            const tagVariant =
              clip.status === 'verified' || clip.status === 'approved'
                ? 'ok'
                : clip.status === 'submitted'
                ? 'warn'
                : 'err';

            const tagText =
              clip.status === 'verified'
                ? 'Verified'
                : clip.status === 'approved'
                ? 'Approved'
                : clip.status === 'submitted'
                ? 'Submitted'
                : clip.status === 'withdrawn'
                ? 'Withdrawn'
                : 'Rejected';

            return (
              <ListRow
                key={clip.id}
                isLast={isLast}
                left={
                  <div className="truncate">
                    <b>Clip {idx + 1} · {clip.platform}</b>
                    {clip.verifiedViews > 0 && (
                      <div className="text-[12px] font-normal text-[var(--muted)]">
                        {clip.verifiedViews.toLocaleString()} views
                      </div>
                    )}
                  </div>
                }
                right={<Tag variant={tagVariant}>{tagText}</Tag>}
              />
            );
          })
        )}
      </Card>
    </div>
  );
};

const QuickAction: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}> = ({ icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="press flex min-h-[78px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-1.5 py-3 text-[11px] font-semibold text-[var(--text)]"
  >
    <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--grad-soft)] text-[var(--a1)]">
      {icon}
    </span>
    <span className="max-w-full truncate">{label}</span>
  </button>
);
