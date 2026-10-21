import React, { useState } from 'react';
import { Card } from '../../components/Card.tsx';
import { Tag } from '../../components/Tag.tsx';
import { Button } from '../../components/Button.tsx';
import { ListRow } from '../../components/ListRow.tsx';
import {
  DatabaseState,
  calculateCreatorBalances,
  markPaid,
} from '../../lib/firebase.ts';
import { formatCents, DEFAULT_MONEY_CONFIG } from '../../lib/money.ts';

export interface AdminPayoutsProps {
  db: DatabaseState;
}

export const AdminPayouts: React.FC<AdminPayoutsProps> = ({ db }) => {
  const [selectedCreatorUid, setSelectedCreatorUid] = useState<string | null>(null);
  const [refInput, setRefInput] = useState('');
  const [paidFeedback, setPaidFeedback] = useState<string | null>(null);

  // Compute balances for each creator
  const creatorsWithBalances = Object.values(db.creatorsPublic).map((creator) => {
    const balances = calculateCreatorBalances(creator.uid);
    const privateInfo = db.creatorsPrivate[creator.uid];
    return {
      ...creator,
      name: privateInfo?.name || creator.handle,
      ecoCash: privateInfo?.ecoCashNumber || '+263 77 000 0000',
      owedCents: balances.owedCents,
      paidCents: balances.paidCents,
      eligible: balances.owedCents >= DEFAULT_MONEY_CONFIG.minPayoutCents,
    };
  }).filter((c) => c.owedCents > 0 || c.paidCents > 0);

  const pendingPayouts = creatorsWithBalances.filter((c) => c.owedCents > 0);
  const completedPayouts = Object.values(db.payouts).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const handleOpenMarkPaid = (uid: string, owedCents: number) => {
    setSelectedCreatorUid(uid);
    const randomRef = `EC-${Math.floor(10000 + Math.random() * 90000)}-ZW`;
    setRefInput(randomRef);
  };

  const handleConfirmPaid = () => {
    if (!selectedCreatorUid) return;
    const creator = creatorsWithBalances.find((c) => c.uid === selectedCreatorUid);
    if (!creator) return;

    const res = markPaid(creator.uid, creator.owedCents, refInput || 'EC-CONFIRMED', 'admin');
    if (res.success) {
      setPaidFeedback(`Paid ${formatCents(creator.owedCents)} to ${creator.name} via EcoCash (${refInput}).`);
      setTimeout(() => setPaidFeedback(null), 3500);
      setSelectedCreatorUid(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-[18px] pt-[22px] pb-[14px]">
      <h2 className="text-[22px] font-extrabold leading-[1.2] mb-1">
        EcoCash Payouts
      </h2>
      <p className="text-[13px] text-[var(--muted)] mb-4">
        Creators qualify for payout once they reach the $5.00 threshold, 72 hours post-campaign.
      </p>

      {paidFeedback && (
        <div className="p-3 mb-3 rounded-[10px] bg-[var(--ok)]/10 text-[var(--ok)] text-[13px] font-semibold border border-[var(--ok)]/30">
          ✓ {paidFeedback}
        </div>
      )}

      {/* Pending payouts */}
      <div className="text-[13px] text-[var(--muted)] mb-1 font-semibold">
        Pending Payouts ({pendingPayouts.length})
      </div>

      {pendingPayouts.length === 0 ? (
        <Card className="text-center py-6 text-[var(--muted)] text-[13px]">
          No pending balances right now. All verified creators are settled!
        </Card>
      ) : (
        <div className="space-y-3 mb-6">
          {pendingPayouts.map((creator) => (
            <Card key={creator.uid}>
              <div className="flex justify-between items-center gap-2 mb-1">
                <b className="text-[15px]">{creator.name} ({creator.handle})</b>
                <Tag variant={creator.eligible ? 'ok' : 'warn'}>
                  {creator.eligible ? 'Ready (≥$5)' : 'Under $5 min'}
                </Tag>
              </div>

              <div className="text-[13px] text-[var(--muted)] mb-2">
                EcoCash: <b>{creator.ecoCash}</b>
              </div>

              <div className="flex justify-between items-center pt-1 border-t border-[var(--line)]">
                <div>
                  <span className="text-[12px] text-[var(--muted)] block">Owed balance</span>
                  <b className="text-[18px] text-[var(--text)]">{formatCents(creator.owedCents)}</b>
                </div>

                <Button
                  size="sm"
                  fullWidth={false}
                  disabled={!creator.eligible}
                  onClick={() => handleOpenMarkPaid(creator.uid, creator.owedCents)}
                >
                  Mark as Paid
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Payouts History */}
      <div className="text-[13px] text-[var(--muted)] mb-1 font-semibold">
        Recent Settlements History
      </div>
      <Card>
        {completedPayouts.length === 0 ? (
          <div className="text-center py-4 text-[var(--muted)] text-[13px]">
            No completed payouts recorded yet.
          </div>
        ) : (
          completedPayouts.map((payout, idx) => (
            <ListRow
              key={payout.id}
              isLast={idx === completedPayouts.length - 1}
              left={
                <div>
                  <b>{payout.creatorName}</b>
                  <div className="text-[12px] text-[var(--muted)]">
                    {payout.ecoCashNumber} · Ref: {payout.reference}
                  </div>
                </div>
              }
              right={
                <div className="text-right">
                  <b>{formatCents(payout.amountCents)}</b>
                  <div className="text-[11px] text-[var(--ok)] font-bold">Settled</div>
                </div>
              }
            />
          ))
        )}
      </Card>

      {/* Confirmation modal */}
      {selectedCreatorUid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-[14px] bg-[var(--surface)] border border-[var(--line)] p-5">
            <h3 className="text-[18px] font-extrabold mb-2">Confirm EcoCash Transfer</h3>
            <p className="text-[13px] text-[var(--muted)] mb-3">
              Enter the EcoCash transaction approval reference after sending funds via merchant dial (*151#).
            </p>

            <div className="mb-4">
              <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">
                EcoCash Reference Code
              </label>
              <input
                type="text"
                value={refInput}
                onChange={(e) => setRefInput(e.target.value)}
                placeholder="EC-88392-ZW"
                className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold text-[14px]"
              />
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSelectedCreatorUid(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleConfirmPaid}>
                Record & Settle
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
