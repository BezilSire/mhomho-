import React, { useState } from 'react';
import { Card } from '../../components/Card.tsx';
import { Button } from '../../components/Button.tsx';
import { Tag } from '../../components/Tag.tsx';
import { ListRow } from '../../components/ListRow.tsx';
import { DatabaseState, calculateCreatorBalances } from '../../lib/firebase.ts';
import { formatCents } from '../../lib/money.ts';

export interface EarningsScreenProps {
  db: DatabaseState;
  currentUid: string;
  onEditEcoCash?: () => void;
}

export const EarningsScreen: React.FC<EarningsScreenProps> = ({
  db,
  currentUid,
  onEditEcoCash,
}) => {
  const [copied, setCopied] = useState(false);
  const balances = calculateCreatorBalances(currentUid);
  const creatorPrivate = db.creatorsPrivate[currentUid];
  const ecoCashNumber = creatorPrivate?.ecoCashNumber || '+263 77 000 0000';

  // Get creator clips and ledger entries
  const clips = Object.values(db.clips).filter((c) => c.creatorUid === currentUid);
  const ledgerEntries = Object.values(db.ledger)
    .filter((l) => l.creatorUid === currentUid)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const handleCopyEcoCash = () => {
    if (onEditEcoCash) {
      onEditEcoCash();
    } else {
      navigator.clipboard?.writeText(ecoCashNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-[18px] pt-[22px] pb-[14px]">
      <h2 className="text-[22px] font-extrabold leading-[1.2] mb-[14px]">
        Earnings
      </h2>

      {/* Main balance card */}
      <Card>
        <div className="text-[13px] text-[var(--muted)]">Owed to you</div>
        <div className="text-[28px] font-extrabold leading-[1.1] text-gradient my-1">
          {formatCents(balances.owedCents)}
        </div>
        <div className="text-[13px] text-[var(--muted)] mt-[6px] mb-3 leading-[1.4]">
          Paid out 72 hours after a campaign closes, once you reach $5.
        </div>
        <Button variant="ghost" onClick={handleCopyEcoCash}>
          {copied ? 'Copied to clipboard' : `EcoCash: ${ecoCashNumber}`}
        </Button>
      </Card>

      {/* Earnings breakdown card */}
      <Card>
        {ledgerEntries.length === 0 ? (
          <div className="text-center py-6 text-[var(--muted)] text-[13px]">
            No verified earnings yet. Once your clips reach 1,000 views and are verified, your earnings will appear here.
          </div>
        ) : (
          ledgerEntries.map((item, idx) => {
            const isLast = idx === ledgerEntries.length - 1;
            const isPaid = item.type === 'paid';

            return (
              <ListRow
                key={item.id}
                isLast={isLast}
                left={
                  <div>
                    <b className="text-[14px]">{item.description}</b>
                    <div className="text-[12px] text-[var(--muted)]">
                      {isPaid ? `Paid out · ${item.createdAt}` : `Added on ${item.createdAt}`}
                    </div>
                  </div>
                }
                right={
                  isPaid ? (
                    <Tag variant="ok">Paid</Tag>
                  ) : (
                    <b className="text-[15px]">{formatCents(item.amountCents)}</b>
                  )
                }
              />
            );
          })
        )}
      </Card>
    </div>
  );
};
