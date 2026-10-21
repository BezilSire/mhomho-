import React from 'react';
import { Card } from '../../components/Card.tsx';
import { Tile, TilesContainer } from '../../components/Tile.tsx';
import { Tag } from '../../components/Tag.tsx';
import { ProgressBar } from '../../components/ProgressBar.tsx';
import { ListRow } from '../../components/ListRow.tsx';
import { Button } from '../../components/Button.tsx';
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
}

export const CreatorHome: React.FC<CreatorHomeProps> = ({
  db,
  currentUid,
  onNavigateToCampaign,
  onNavigateToTab,
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
    <div className="flex-1 overflow-y-auto px-[18px] pt-[22px] pb-[14px]">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="font-extrabold tracking-[0.06em] text-[14px]">
          MHOMHO
        </span>
        <Tag variant="ok">Approved</Tag>
      </div>

      <h2 className="text-[22px] font-extrabold leading-[1.2] mb-[14px]">
        Hey {firstName}
      </h2>

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
          className="cursor-pointer hover:border-[var(--muted)] transition-colors"
        >
          <div className="flex justify-between items-center gap-2">
            <b>{activeCampaign.title}</b>
            <span className="text-[13px] text-[var(--muted)]">
              {activeCampaign.daysLeft} days left
            </span>
          </div>

          <ProgressBar percentage={poolFillPercent} />

          <div className="text-[13px] text-[var(--muted)]">
            {poolFillPercent}% full · {activeStats.joinedCount} creators joined
          </div>
        </Card>
      )}

      {/* Latest Clips Section */}
      <div className="flex justify-between items-center text-[13px] text-[var(--muted)] mt-4 mb-1">
        <span>Latest clips</span>
        <button
          type="button"
          onClick={() => onNavigateToTab('clips')}
          className="text-[12px] font-semibold text-[var(--text)] hover:underline cursor-pointer"
        >
          View all
        </button>
      </div>

      <Card>
        {creatorClips.length === 0 ? (
          <div className="text-center py-4 text-[var(--muted)] text-[13px]">
            No clips submitted yet.
            <div className="mt-2">
              <Button size="sm" onClick={() => onNavigateToTab('campaigns')}>
                Explore Campaigns
              </Button>
            </div>
          </div>
        ) : (
          creatorClips.map((clip, idx) => {
            const isLast = idx === creatorClips.length - 1;
            const tagVariant =
              clip.status === 'verified'
                ? 'ok'
                : clip.status === 'submitted'
                ? 'warn'
                : 'err';

            const tagText =
              clip.status === 'verified'
                ? 'Verified'
                : clip.status === 'submitted'
                ? 'Submitted'
                : 'Rejected';

            return (
              <ListRow
                key={clip.id}
                isLast={isLast}
                left={
                  <div className="truncate">
                    <b>Clip {idx + 1} · {clip.platform}</b>
                    {clip.verifiedViews > 0 && (
                      <div className="text-[12px] text-[var(--muted)] font-normal">
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
