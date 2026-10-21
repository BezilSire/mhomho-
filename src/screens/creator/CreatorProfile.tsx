import React, { useState } from 'react';
import { Card } from '../../components/Card.tsx';
import { Tag } from '../../components/Tag.tsx';
import { Button } from '../../components/Button.tsx';
import { ListRow } from '../../components/ListRow.tsx';
import { DatabaseState, getDatabaseState } from '../../lib/firebase.ts';

export interface CreatorProfileProps {
  db: DatabaseState;
  currentUid: string;
  onLogout?: () => void;
}

export const CreatorProfile: React.FC<CreatorProfileProps> = ({
  db,
  currentUid,
  onLogout,
}) => {
  const creatorPublic = db.creatorsPublic[currentUid];
  const creatorPrivate = db.creatorsPrivate[currentUid];

  const [ecoCashNumber, setEcoCashNumber] = useState(
    creatorPrivate?.ecoCashNumber || '+263 77 000 0000'
  );
  const [whatsAppNumber, setWhatsAppNumber] = useState(
    creatorPrivate?.whatsappNumber || '+263 77 123 4567'
  );
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (db.creatorsPrivate[currentUid]) {
      db.creatorsPrivate[currentUid] = {
        ...db.creatorsPrivate[currentUid],
        ecoCashNumber,
        whatsappNumber: whatsAppNumber,
      };
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-[18px] pt-[22px] pb-[14px]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[22px] font-extrabold leading-[1.2] m-0">
          Profile
        </h2>
        <Tag variant={creatorPublic?.status === 'approved' ? 'ok' : 'warn'}>
          {creatorPublic?.status === 'approved' ? 'Approved' : 'Under Review'}
        </Tag>
      </div>

      <Card>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full bg-[var(--line)] flex items-center justify-center font-extrabold text-[18px] text-[var(--a1)]">
            {creatorPublic?.handle.substring(1, 2).toUpperCase() || 'C'}
          </div>
          <div>
            <b className="text-[16px] block">{creatorPrivate?.name || 'Creator'}</b>
            <span className="text-[13px] text-[var(--muted)]">
              {creatorPublic?.handle || '@creator'}
            </span>
          </div>
        </div>

        <ListRow
          left={<span className="text-[var(--muted)]">Main Platform</span>}
          right={<b>{creatorPublic?.platform || 'TikTok'}</b>}
        />
        <ListRow
          left={<span className="text-[var(--muted)]">Followers</span>}
          right={<b>{creatorPublic?.followers.toLocaleString() || '1,000+'}</b>}
        />
        <ListRow
          left={<span className="text-[var(--muted)]">Niche</span>}
          right={<b>{creatorPublic?.niche || 'General'}</b>}
          isLast={true}
        />
      </Card>

      <div className="text-[13px] text-[var(--muted)] mb-2 mt-4 font-semibold">
        Payout &amp; Contact Details (Private)
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        <Card>
          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            EcoCash Phone Number (For Payouts)
          </label>
          <input
            type="tel"
            value={ecoCashNumber}
            onChange={(e) => setEcoCashNumber(e.target.value)}
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold mb-3 text-[14px]"
            placeholder="+263 77 000 0000"
          />

          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            WhatsApp Contact Number
          </label>
          <input
            type="tel"
            value={whatsAppNumber}
            onChange={(e) => setWhatsAppNumber(e.target.value)}
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold text-[14px]"
            placeholder="+263 78 000 0000"
          />

          {isSaved && (
            <div className="text-[12px] text-[var(--ok)] font-bold mt-2">
              ✓ Payout details updated successfully.
            </div>
          )}
        </Card>

        <Button type="submit">
          Save details
        </Button>
      </form>

      {onLogout && (
        <div className="mt-4 mb-6">
          <Button variant="ghost" onClick={onLogout}>
            Switch account / Sign out
          </Button>
        </div>
      )}
    </div>
  );
};
