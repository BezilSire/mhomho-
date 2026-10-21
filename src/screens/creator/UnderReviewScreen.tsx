import React, { useState } from 'react';
import { Card } from '../../components/Card.tsx';
import { Tag } from '../../components/Tag.tsx';
import { Button } from '../../components/Button.tsx';
import { DatabaseState, getDatabaseState } from '../../lib/firebase.ts';

export interface UnderReviewScreenProps {
  db: DatabaseState;
  currentUid: string;
  onApproved: () => void;
  onLogout?: () => void;
}

export const UnderReviewScreen: React.FC<UnderReviewScreenProps> = ({
  db,
  currentUid,
  onApproved,
  onLogout,
}) => {
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const creatorPublic = db.creatorsPublic[currentUid];

  const handleCheckStatus = () => {
    setChecking(true);
    setStatusMessage(null);
    setTimeout(() => {
      setChecking(false);
      const latestDb = getDatabaseState();
      const creator = latestDb.creatorsPublic[currentUid];
      if (creator?.status === 'approved') {
        setStatusMessage('Congratulations! Your application has been approved.');
        setTimeout(() => {
          onApproved();
        }, 1000);
      } else {
        setStatusMessage('Your application is still under review by our onboarding team.');
      }
    }, 600);
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `Hi Mhomho team, I submitted an application for ${creatorPublic?.handle || 'creator account'} and would like to follow up on my Campaign Zero status.`
    );
    window.open(`https://wa.me/263786205197?text=${text}`, '_blank');
  };

  return (
    <div className="flex-1 overflow-y-auto px-[18px] pt-[28px] pb-[20px] flex flex-col justify-center">
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-[var(--surface)] border border-[var(--line)] mx-auto flex items-center justify-center text-[26px] mb-3">
          ⏳
        </div>
        <Tag variant="warn">Under review</Tag>
        <h2 className="text-[22px] font-extrabold leading-[1.2] mt-3 mb-1">
          Application Pending
        </h2>
        <p className="text-[13px] text-[var(--muted)] max-w-xs mx-auto">
          We received your application for <b>{creatorPublic?.handle || 'your handle'}</b>.
        </p>
      </div>

      <Card>
        <b>What happens next?</b>
        <p className="text-[13px] text-[var(--muted)] mt-1.5 mb-2 leading-[1.5]">
          1. Our team verifies your public profile on {creatorPublic?.platform || 'your platform'}.
        </p>
        <p className="text-[13px] text-[var(--muted)] mb-2 leading-[1.5]">
          2. We will WhatsApp you the Campaign Zero content kit.
        </p>
        <p className="text-[13px] text-[var(--muted)] mb-0 leading-[1.5]">
          3. Once approved, you gain full access to the Creator Home and paid campaigns.
        </p>
      </Card>

      {statusMessage && (
        <div className="p-3 my-3 rounded-[10px] bg-[var(--surface)] border border-[var(--line)] text-center text-[13px] font-semibold text-[var(--text)]">
          {statusMessage}
        </div>
      )}

      <div className="mt-4 space-y-2.5">
        <Button onClick={handleCheckStatus} disabled={checking}>
          {checking ? 'Checking status...' : 'Check application status'}
        </Button>
        <Button variant="ghost" onClick={handleWhatsApp}>
          WhatsApp Onboarding Support
        </Button>
        {onLogout && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onLogout}
              className="w-full text-center text-[13px] text-[var(--muted)] hover:text-[var(--text)] cursor-pointer py-1"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
