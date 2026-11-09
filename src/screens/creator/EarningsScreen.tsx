import React from 'react';
import { Card } from '../../components/Card.tsx';
import { Button } from '../../components/Button.tsx';
import { Tag } from '../../components/Tag.tsx';
import { ListRow } from '../../components/ListRow.tsx';
import { DatabaseState, calculateCreatorBalances } from '../../lib/firebase.ts';
import { formatCents, DEFAULT_MONEY_CONFIG } from '../../lib/money.ts';

export interface EarningsScreenProps {
  db: DatabaseState;
  currentUid: string;
  onEditEcoCash?: () => void;
}

const STATUS_COPY: Record<string, { label: string; tone: 'ok' | 'warn' | 'err' }> = {
  requested: { label: 'Queued', tone: 'warn' },
  approved: { label: 'Approved', tone: 'warn' },
  processing: { label: 'Sending', tone: 'warn' },
  paid: { label: 'Paid', tone: 'ok' },
  failed: { label: 'Failed', tone: 'err' },
  cancelled: { label: 'Cancelled', tone: 'err' },
};

export const EarningsScreen: React.FC<EarningsScreenProps> = ({
  db,
  currentUid,
  onEditEcoCash,
}) => {
  const balances = calculateCreatorBalances(currentUid);
  const creatorPrivate = db.creatorsPrivate[currentUid];
  const ecoCashNumber = creatorPrivate?.ecoCashNumber || '';

  const openPayout = Object.values(db.payouts).find(
    (payout) =>
      payout.creatorUid === currentUid &&
      (payout.status === 'requested' ||
        payout.status === 'approved' ||
        payout.status === 'processing')
  );

  const ledgerEntries = Object.values(db.ledger)
    .filter((entry) => entry.creatorUid === currentUid)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="app-scroll flex-1 overflow-y-auto px-4 pb-8 pt-5 sm:px-[18px] sm:pt-[22px]">
      <h2 className="mb-1 text-[26px] font-extrabold leading-[1.12] tracking-[-0.03em]">
        Earnings
      </h2>
      <p className="mb-4 text-[12.5px] text-[var(--muted)]">
        Verified views become EcoCash. Payouts are sent manually from $5.
      </p>

      {/* Main balance card */}
      <Card>
        <div className="text-[13px] text-[var(--muted)]">Owed to you</div>
        <div className="text-[28px] font-extrabold leading-[1.1] text-gradient my-1">
          {formatCents(balances.owedCents)}
        </div>
        <div className="text-[13px] text-[var(--muted)] mt-[6px] mb-3 leading-[1.4]">
          Payouts are sent directly by the Mhomho team once you reach{' '}
          {formatCents(DEFAULT_MONEY_CONFIG.minPayoutCents)}. No withdrawal request is needed.
        </div>
        <Button variant="ghost" onClick={onEditEcoCash}>
          {ecoCashNumber ? `EcoCash: ${ecoCashNumber}` : 'Add your EcoCash number'}
        </Button>
      </Card>

      {/* Manual payout note */}
      <div className="text-[13px] text-[var(--muted)] mb-2 mt-4 font-semibold">
        Manual payouts
      </div>
      <Card>
        <div className="flex justify-between items-center gap-2 mb-1">
          <b>Sent directly to EcoCash</b>
          <Tag variant="ok">Manual</Tag>
        </div>
        <div className="text-[13px] text-[var(--muted)] leading-[1.55]">
          We send your payout to your EcoCash number outside the app. Our team reviews verified
          earnings and sends payments within {DEFAULT_MONEY_CONFIG.payoutDelayHours} hours on
          business days. Keep your number up to date in Profile.
        </div>
        {openPayout && (
          <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3">
            <div className="flex justify-between items-center gap-2 mb-1">
              <b className="text-[13px]">Latest payout</b>
              <Tag variant={STATUS_COPY[openPayout.status]?.tone ?? 'warn'}>
                {STATUS_COPY[openPayout.status]?.label ?? openPayout.status}
              </Tag>
            </div>
            <div className="text-[12px] text-[var(--muted)]">
              {formatCents(openPayout.amountCents)} to {openPayout.ecoCashNumber} ·{' '}
              {openPayout.createdAt}
            </div>
          </div>
        )}
      </Card>

      {/* Earnings breakdown */}
      <div className="text-[13px] text-[var(--muted)] mb-2 mt-4 font-semibold">History</div>
      <Card>
        {ledgerEntries.length === 0 ? (
          <div className="text-center py-6 text-[var(--muted)] text-[13px]">
            No verified earnings yet. Once your clips reach 1,000 views and are verified, your
            earnings will appear here.
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
