import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Card } from '../../components/Card.tsx';
import { ProgressBar } from '../../components/ProgressBar.tsx';
import { ListRow } from '../../components/ListRow.tsx';
import { Button } from '../../components/Button.tsx';
import {
  DatabaseState,
  campaignStatusLabel,
  isCampaignOpenToJoins,
} from '../../lib/firebase.ts';
import { joinCampaign } from '../../lib/api.ts';
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
  const isOpen = campaign ? isCampaignOpenToJoins(campaign, stats ?? undefined) : false;
  const [errorMsg, setErrorMsg] = useState('');
  const [joining, setJoining] = useState(false);

  const poolPercent = stats
    ? formatPercent(stats.poolUsedCents, stats.poolTotalCents)
    : 0;

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

  const handleJoin = async () => {
    setJoining(true);
    setErrorMsg('');
    const result = await joinCampaign(campaign.id);
    setJoining(false);
    if (!result.success) setErrorMsg(result.error || 'Could not join this campaign.');
  };

  return (
    <div className="app-scroll flex-1 overflow-y-auto px-4 pb-0 pt-4 sm:px-[18px] sm:pt-[22px]">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="press mb-2 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--line)] px-3 text-[12px] font-semibold text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
      >
        <ArrowLeft size={13} />
        Campaigns
      </button>

      <h2 className="mb-3 text-[25px] font-extrabold leading-[1.15] tracking-[-0.03em]">
        {campaign.title}
      </h2>

      {campaign.posterUrl && (
        <img
          src={campaign.posterUrl}
          alt=""
          className="mb-3 aspect-[16/9] w-full rounded-2xl object-cover"
          loading="lazy"
        />
      )}

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
      {campaign.doNots.length > 0 && (
        <Card>
          <b>Do not</b>
          <p className="text-[13px] text-[var(--muted)] mt-[6px] mb-0 leading-[1.5]">
            {campaign.doNots.join(' ')}
          </p>
        </Card>
      )}

      {/* Action CTA — pinned above the tab bar like a native primary action. */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-2 border-t border-[var(--line)] bg-[var(--page)]/95 px-4 pb-3 pt-3 backdrop-blur-xl">
        {errorMsg && (
          <div className="mb-2 rounded-[10px] border border-[var(--err)]/30 bg-[var(--err)]/10 p-3 text-[13px] font-semibold text-[var(--err)]">
            {errorMsg}
          </div>
        )}
        {isMember ? (
          <Button onClick={() => onSubmitClip(campaign.id)}>
            Submit a clip
          </Button>
        ) : !isOpen ? (
          <Button disabled={true}>{`Closed · ${campaignStatusLabel(campaign)}`}</Button>
        ) : (
          <Button onClick={handleJoin} disabled={joining}>
            {joining ? 'Joining...' : 'Join campaign to submit clips'}
          </Button>
        )}
      </div>
    </div>
  );
};
