import React, { useState } from 'react';
import { Card } from '../../components/Card.tsx';
import { Tag } from '../../components/Tag.tsx';
import { Button } from '../../components/Button.tsx';
import { ListRow } from '../../components/ListRow.tsx';
import { DatabaseState, calculateCreatorBalances } from '../../lib/firebase.ts';
import { recordPayout, settlePayout } from '../../lib/api.ts';
import { formatCents, DEFAULT_MONEY_CONFIG } from '../../lib/money.ts';

export interface AdminPayoutsProps {
  db: DatabaseState;
}

const OPEN_STATUSES = ['requested', 'approved', 'processing'];

export const AdminPayouts: React.FC<AdminPayoutsProps> = ({ db }) => {
  const [selectedCreatorUid, setSelectedCreatorUid] = useState<string | null>(null);
  const [refInput, setRefInput] = useState('');
  const [paidFeedback, setPaidFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [settlePayoutId, setSettlePayoutId] = useState<string | null>(null);
  const [settleRef, setSettleRef] = useState('');

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
  const withdrawalRequests = completedPayouts.filter((p) => OPEN_STATUSES.includes(p.status));

  const handleOpenMarkPaid = (uid: string) => {
    setSelectedCreatorUid(uid);
    const randomRef = `EC-${Math.floor(10000 + Math.random() * 90000)}-ZW`;
    setRefInput(randomRef);
  };

  const handleConfirmPaid = async () => {
    if (!selectedCreatorUid || busy) return;
    const creator = creatorsWithBalances.find((c) => c.uid === selectedCreatorUid);
    if (!creator) return;

    setBusy(true);
    setErrorMsg(null);
    const res = await recordPayout({
      creatorId: creator.uid,
      amountCents: creator.owedCents,
      reference: refInput.trim() || 'EC-CONFIRMED',
    });
    setBusy(false);

    if (res.success) {
      setPaidFeedback(`Paid ${formatCents(creator.owedCents)} to ${creator.name} via EcoCash (${refInput}).`);
      setTimeout(() => setPaidFeedback(null), 3500);
      setSelectedCreatorUid(null);
    } else {
      setErrorMsg(res.error || 'The payout could not be recorded.');
    }
  };

  const handleSettleRequest = async () => {
    if (!settlePayoutId || busy) return;
    setBusy(true);
    setErrorMsg(null);
    const res = await settlePayout(settlePayoutId, {
      status: 'paid',
      reference: settleRef.trim(),
    });
    setBusy(false);
    if (res.success) {
      setPaidFeedback('Withdrawal settled and marked as paid.');
      setTimeout(() => setPaidFeedback(null), 3500);
      setSettlePayoutId(null);
      setSettleRef('');
    } else {
      setErrorMsg(res.error || 'The withdrawal could not be settled.');
    }
  };

  const handleCancelRequest = async (payoutId: string) => {
    if (busy) return;
    if (!window.confirm('Cancel this withdrawal and return the funds to the creator balance?')) return;
    setBusy(true);
    setErrorMsg(null);
    const res = await settlePayout(payoutId, {
      status: 'cancelled',
      failureReason: 'Cancelled by administrator',
    });
    setBusy(false);
    if (!res.success) {
      setErrorMsg(res.error || 'The withdrawal could not be cancelled.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-[18px] pt-[22px] pb-[14px]">
      <h2 className="text-[22px] font-extrabold leading-[1.2] mb-1">
        EcoCash Payouts
      </h2>
      <p className="text-[13px] text-[var(--muted)] mb-4">
        Creators request withdrawals from their dashboard. Settle the EcoCash transfer with its
        reference, or cancel to return the funds to their balance.
      </p>

      {paidFeedback && (
        <div className="p-3 mb-3 rounded-[10px] bg-[var(--ok)]/10 text-[var(--ok)] text-[13px] font-semibold border border-[var(--ok)]/30">
          ✓ {paidFeedback}
        </div>
      )}

      {errorMsg && (
        <div className="p-3 mb-3 rounded-[10px] bg-[var(--err)]/10 text-[var(--err)] text-[13px] font-semibold border border-[var(--err)]/30">
          {errorMsg}
        </div>
      )}

      {/* Creator-initiated withdrawals */}
      <div className="text-[13px] text-[var(--muted)] mb-1 font-semibold">
        Withdrawal requests ({withdrawalRequests.length})
      </div>

      {withdrawalRequests.length === 0 ? (
        <Card className="text-center py-5 text-[var(--muted)] text-[13px] mb-6">
          No withdrawal requests waiting.
        </Card>
      ) : (
        <div className="space-y-3 mb-6">
          {withdrawalRequests.map((payout) => (
            <Card key={payout.id}>
              <div className="flex justify-between items-center gap-2 mb-1">
                <b className="text-[15px]">{payout.creatorName}</b>
                <Tag variant="warn">{payout.status}</Tag>
              </div>
              <div className="text-[13px] text-[var(--muted)] mb-1">
                {formatCents(payout.amountCents)} to <b>{payout.ecoCashNumber}</b>
              </div>
              <div className="text-[12px] text-[var(--faint)] mb-3">
                Requested {payout.createdAt} · pay within {DEFAULT_MONEY_CONFIG.payoutDelayHours} hours
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setSettlePayoutId(payout.id);
                    setSettleRef(`EC-${Math.floor(10000 + Math.random() * 90000)}-ZW`);
                  }}
                >
                  Mark as paid
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => handleCancelRequest(payout.id)}
                >
                  Cancel
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pending balances (manual payout) */}
      <div className="text-[13px] text-[var(--muted)] mb-1 font-semibold">
        Balances awaiting a payout ({pendingPayouts.length})
      </div>

      {pendingPayouts.length === 0 ? (
        <Card className="text-center py-6 text-[var(--muted)] text-[13px] mb-6">
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
                  onClick={() => handleOpenMarkPaid(creator.uid)}
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
                    {payout.ecoCashNumber} · {payout.reference ? `Ref: ${payout.reference}` : payout.status}
                  </div>
                </div>
              }
              right={
                <div className="text-right">
                  <b>{formatCents(payout.amountCents)}</b>
                  <div
                    className={`text-[11px] font-bold ${
                      payout.status === 'paid' ? 'text-[var(--ok)]' : 'text-[var(--warn)]'
                    }`}
                  >
                    {payout.status === 'paid' ? 'Settled' : payout.status}
                  </div>
                </div>
              }
            />
          ))
        )}
      </Card>

      {/* Manual payout confirmation modal */}
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
              <Button size="sm" onClick={handleConfirmPaid} disabled={busy}>
                {busy ? 'Recording…' : 'Record & Settle'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal settlement modal */}
      {settlePayoutId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-[14px] bg-[var(--surface)] border border-[var(--line)] p-5">
            <h3 className="text-[18px] font-extrabold mb-2">Settle Withdrawal</h3>
            <p className="text-[13px] text-[var(--muted)] mb-3">
              Send the EcoCash payment, then record its reference here. The creator balance was
              already reserved when the request was made.
            </p>

            <div className="mb-4">
              <label className="block text-[12px] font-semibold text-[var(--muted)] mb-1">
                EcoCash Reference Code
              </label>
              <input
                type="text"
                value={settleRef}
                onChange={(e) => setSettleRef(e.target.value)}
                placeholder="EC-88392-ZW"
                className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold text-[14px]"
              />
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSettlePayoutId(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSettleRequest} disabled={busy}>
                {busy ? 'Saving…' : 'Mark as paid'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
