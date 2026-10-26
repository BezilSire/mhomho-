import React from 'react';
import { Card } from '../../components/Card.tsx';
import { Tag } from '../../components/Tag.tsx';
import { Button } from '../../components/Button.tsx';
import { DatabaseState, isAllowedSocialUrl } from '../../lib/firebase.ts';
import { formatCents, formatViews } from '../../lib/money.ts';

export interface MyClipsProps {
  db: DatabaseState;
  currentUid: string;
  onSubmitNew: () => void;
}

export const MyClips: React.FC<MyClipsProps> = ({
  db,
  currentUid,
  onSubmitNew,
}) => {
  const clips = Object.values(db.clips)
    .filter((c) => c.creatorUid === currentUid)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex-1 overflow-y-auto px-[18px] pt-[22px] pb-[14px]">
      <div className="flex justify-between items-center mb-[14px]">
        <h2 className="text-[22px] font-extrabold leading-[1.2] m-0">
          My Clips
        </h2>
        <Button size="sm" fullWidth={false} onClick={onSubmitNew}>
          + Submit clip
        </Button>
      </div>

      {clips.length === 0 ? (
        <Card className="text-center py-8 text-[var(--muted)] text-[14px]">
          You haven’t submitted any clips yet.
          <div className="mt-4">
            <Button size="sm" onClick={onSubmitNew}>
              Submit your first clip
            </Button>
          </div>
        </Card>
      ) : (
        clips.map((clip) => {
          const campaign = db.campaigns[clip.campaignId];
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
            <Card key={clip.id}>
              <div className="flex justify-between items-center gap-2 mb-1">
                <b className="truncate text-[15px]">
                  {campaign?.title || 'Campaign'} · {clip.platform}
                </b>
                <Tag variant={tagVariant}>{tagText}</Tag>
              </div>

              <div className="text-[13px] text-[var(--muted)]">
                {clip.status === 'verified' || clip.status === 'approved'
                  ? `${formatViews(clip.verifiedViews || clip.publicViews)} verified views`
                  : `Claimed ${formatViews(clip.claimedViews)} views · submitted ${clip.createdAt}`}
              </div>

              {(clip.status === 'verified' || clip.status === 'approved') && clip.earningsCents > 0 && (
                <div className="mt-2 text-[14px] font-bold text-[var(--ok)]">
                  Earned: {formatCents(clip.earningsCents)}
                </div>
              )}

              {clip.status === 'rejected' && (
                <div className="mt-2 text-[12px] text-[var(--err)] font-medium">
                  {clip.reviewNote ||
                    clip.spikeReason ||
                    'Views under qualifying threshold (1,000) or check failed.'}
                </div>
              )}

              {clip.status === 'withdrawn' && (
                <div className="mt-2 text-[12px] text-[var(--muted)] font-medium">
                  This submission was withdrawn and is no longer eligible for earnings.
                </div>
              )}

              <div className="mt-3 flex justify-between items-center text-[12px]">
                {isAllowedSocialUrl(clip.link) ? (
                  <a
                    href={clip.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--a1)] hover:underline"
                  >
                  View post ↗
                  </a>
                ) : (
                  <span className="text-[var(--muted)]">Link unavailable</span>
                )}
                <span className="text-[var(--muted)]">{clip.createdAt}</span>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
};
