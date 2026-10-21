import React from 'react';
import { Card } from '../../components/Card.tsx';
import { ProgressBar } from '../../components/ProgressBar.tsx';
import { ListRow } from '../../components/ListRow.tsx';
import { Button } from '../../components/Button.tsx';
import { DatabaseState, joinCampaign } from '../../lib/firebase.ts';
import { formatPercent } from '../../lib/money.ts';

export interface CampaignDetailProps {
  campaignId: string;
  db: DatabaseState;
  currentUid: string;
  onBack: () => void;
  onSubmitClip: (campaignId: string) => void;
}

export const CampaignDetail: React.FC<CampaignDetailProps> = ({
  campaignId,
  db,
  currentUid,
  onBack,
  onSubmitClip,
}) => {
  const campaign = db.campaigns[campaignId] || Object.values(db.campaigns)[0];
  const stats = campaign ? db.campaignStats[campaign.id] : null;
  const isMember = !!db.campaignMembers[`${campaign?.id}_${currentUid}`];
  const isFull = campaign?.status === 'full' || (stats && !stats.joiningOpen);

  const poolPercent = stats
    ? formatPercent(stats.poolUsedCents, stats.poolTotalCents)
    : 64;

  if (!campaign) {
    return (
      <div className="flex-1 p-6 text-center text-[var(--muted)]">
        Campaign not found.
        <div className="mt-4">
          <Button onClick={onBack}>Back to Campaigns</Button>
        </div>
      </div>
    );
  }

  const handleJoin = () => {
    joinCampaign(campaign.id, currentUid);
  };

  return (
    <div className="flex-1 overflow-y-auto px-[18px] pt-[22px] pb-[14px]">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="text-[13px] text-[var(--muted)] mb-2 inline-flex items-center gap-1 hover:text-[var(--text)] cursor-pointer"
      >
        ← Campaigns
      </button>

      <h2 className="text-[22px] font-extrabold leading-[1.2] mb-[14px]">
        {campaign.title}
      </h2>

      {/* Pool status card */}
      <Card>
        <div className="flex justify-between items-center gap-2">
          <span className="text-[13px] text-[var(--muted)]">Pool filled</span>
          <b>{poolPercent}%</b>
        </div>
        <ProgressBar percentage={poolPercent} />
        <div className="text-[13px] text-[var(--muted)]">
          {stats?.joinedCount || 0} creators joined · {campaign.daysLeft} days left
        </div>
      </Card>

      {/* The Brief card */}
      <Card>
        <b>The brief</b>
        <p className="text-[13px] text-[var(--muted)] mt-[6px] mb-0 leading-[1.5]">
          {campaign.brief}
        </p>
      </Card>

      {/* Hook Ideas card */}
      <Card>
        <b className="block mb-1">Hook ideas</b>
        {campaign.hookIdeas.map((hook, idx) => (
          <ListRow
            key={idx}
            isLast={idx === campaign.hookIdeas.length - 1}
            left={<span className="text-[13px] text-[var(--text)]">{hook}</span>}
          />
        ))}
      </Card>

      {/* Do Not card */}
      <Card>
        <b>Do not</b>
        <p className="text-[13px] text-[var(--muted)] mt-[6px] mb-0 leading-[1.5]">
          {campaign.doNots.join(' ')}
        </p>
      </Card>

      {/* Action CTA */}
      <div className="mt-2 mb-4">
        {isMember ? (
          <Button onClick={() => onSubmitClip(campaign.id)}>
            Submit a clip
          </Button>
        ) : isFull ? (
          <Button disabled={true}>
            Campaign is full
          </Button>
        ) : (
          <Button onClick={handleJoin}>
            Join campaign to submit clips
          </Button>
        )}
      </div>
    </div>
  );
};
