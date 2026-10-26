import React, { useState } from 'react';
import { Card } from '../../components/Card.tsx';
import { Chips } from '../../components/Chips.tsx';
import { Tag } from '../../components/Tag.tsx';
import { ProgressBar } from '../../components/ProgressBar.tsx';
import { Button } from '../../components/Button.tsx';
import {
  DatabaseState,
  campaignStatusLabel,
  isCampaignOpenToJoins,
} from '../../lib/firebase.ts';
import { joinCampaign } from '../../lib/api.ts';
import { formatPercent } from '../../lib/money.ts';

export interface CampaignsFeedProps {
  db: DatabaseState;
  currentUid: string;
  onSelectCampaign: (campaignId: string) => void;
}

const NICHE_CHIPS = [
  'All',
  'Health & beauty',
  'Tech & gadgets',
  'Fitness',
  'Food & travel',
  'Fashion & style',
];

export const CampaignsFeed: React.FC<CampaignsFeedProps> = ({
  db,
  currentUid,
  onSelectCampaign,
}) => {
  const [selectedNiche, setSelectedNiche] = useState('All');
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const campaigns = Object.values(db.campaigns).filter((c) => {
    if (selectedNiche === 'All') return true;
    return c.niche.toLowerCase().includes(selectedNiche.toLowerCase());
  });

  const handleJoin = async (e: React.MouseEvent, campaignId: string) => {
    e.stopPropagation();
    setJoiningId(campaignId);
    setErrorMsg('');
    const result = await joinCampaign(campaignId);
    setJoiningId(null);
    if (!result.success) {
      setErrorMsg(result.error || 'Could not join this campaign.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-[18px] pt-[22px] pb-[14px]">
      <h2 className="text-[22px] font-extrabold leading-[1.2] mb-[14px]">
        Campaigns
      </h2>

      {errorMsg && (
        <div className="p-3 mb-3 rounded-[10px] bg-[var(--err)]/10 text-[var(--err)] text-[13px] font-semibold border border-[var(--err)]/30">
          {errorMsg}
        </div>
      )}

      {/* Filter Chips */}
      <Chips
        items={NICHE_CHIPS.map((n) => (n === 'Health & beauty' ? 'Beauty' : n === 'Tech & gadgets' ? 'Tech' : n === 'Food & travel' ? 'Food' : n))}
        selectedId={selectedNiche === 'Health & beauty' ? 'Beauty' : selectedNiche === 'Tech & gadgets' ? 'Tech' : selectedNiche === 'Food & travel' ? 'Food' : selectedNiche}
        onSelect={(chip) => {
          if (chip === 'Beauty') setSelectedNiche('Health & beauty');
          else if (chip === 'Tech') setSelectedNiche('Tech & gadgets');
          else if (chip === 'Food') setSelectedNiche('Food & travel');
          else setSelectedNiche(chip);
        }}
      />

      {/* Campaign Cards List */}
      {campaigns.length === 0 ? (
        <Card className="text-center py-6 text-[var(--muted)] text-[14px]">
          No campaigns found in this niche right now.
        </Card>
      ) : (
        campaigns.map((camp) => {
          const stats = db.campaignStats[camp.id];
          const isMember = !!db.campaignMembers[`${camp.id}_${currentUid}`];
          const isOpen = isCampaignOpenToJoins(camp, stats);
          const isFull = !isOpen && (stats?.poolRemainingCents ?? 1) <= 0;
          const statusText = isOpen ? 'Open' : isFull ? 'Full' : campaignStatusLabel(camp);
          const poolPercent = stats
            ? formatPercent(stats.poolUsedCents, stats.poolTotalCents)
            : 0;

          return (
            <Card
              key={camp.id}
              onClick={() => onSelectCampaign(camp.id)}
              className="cursor-pointer hover:border-[var(--muted)] transition-colors"
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
                <Tag variant={isOpen ? 'ok' : 'err'}>{statusText}</Tag>
              </div>

              <div className="text-[13px] text-[var(--muted)]">{camp.niche}</div>

              <ProgressBar percentage={poolPercent} />

              <div className="text-[13px] text-[var(--muted)] mb-3">
                {isOpen
                  ? `${poolPercent}% full · ${stats?.joinedCount || 0} joined · ${camp.daysLeft} days left`
                  : `${statusText} · ${stats?.joinedCount || 0} joined`}
              </div>

              {isMember ? (
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCampaign(camp.id);
                  }}
                >
                  Joined · View Brief
                </Button>
              ) : !isOpen ? (
                <Button disabled={true}>{isFull ? 'Full' : 'Closed to new creators'}</Button>
              ) : (
                <Button
                  disabled={joiningId === camp.id}
                  onClick={(e) => handleJoin(e, camp.id)}
                >
                  {joiningId === camp.id ? 'Joining...' : 'Join campaign'}
                </Button>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
};
