import React, { useState } from 'react';
import { Card } from '../../components/Card.tsx';
import { Button } from '../../components/Button.tsx';
import { Tag } from '../../components/Tag.tsx';
import { ListRow } from '../../components/ListRow.tsx';
import { DatabaseState, calculateCreatorBalances } from '../../lib/firebase.ts';
import { formatCents, DEFAULT_MONEY_CONFIG } from '../../lib/money.ts';
import { requestPayout } from '../../lib/api.ts';

export interface EarningsScreenProps {
  db: DatabaseState;
  currentUid: string;
  onEditEcoCash?: () => void;
}

const STATUS_COPY: Record<string, { label: string; tone: 'ok' | 'warn' | 'err' }> = {
  requested: { label: 'Requested', tone: 'warn' },
  approved: { label: 'Approved', tone: 'warn' },
  processing: { label: 'Processing', tone: 'warn' },
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

  const [amount, setAmount] = useState(
    balances.owedCents >= DEFAULT_MONEY_CONFIG.minPayoutCents
      ? (balances.owedCents / 100).toFixed(2)
      : ''
  );
  const [destination, setDestination] = useState(ecoCashNumber);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [notice, setNotice] = useState('');

  const openRequest = Object.values(db.payouts).find(
    (payout) =>
      payout.creatorUid === currentUid &&
      (payout.status === 'requested' ||
        payout.status === 'approved' ||
        payout.status === 'processing')
  );

  const belowMinimum = balances.owedCents < DEFAULT_MONEY_CONFIG.minPayoutCents;

  const handleWithdraw = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg('');
    setNotice('');

    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setErrorMsg('Enter the amount you want to withdraw.');
      return;
    }
    if (cents < DEFAULT_MONEY_CONFIG.minPayoutCents) {
      setErrorMsg(
        `The minimum withdrawal is ${formatCents(DEFAULT_MONEY_CONFIG.minPayoutCents)}.`
      );
      return;
    }
    if (cents > balances.owedCents) {
      setErrorMsg(`You can withdraw up to ${formatCents(balances.owedCents)}.`);
      return;
    }
    if (destination.replace(/\D/g, '').length < 7) {
      setErrorMsg('Enter the EcoCash number that should receive the money.');
      return;
    }

    setBusy(true);
    const result = await requestPayout({ amountCents: cents, ecoCashNumber: destination.trim() });
    setBusy(false);

    if (!result.success) {
      setErrorMsg(result.error || 'Your withdrawal request could not be submitted.');
      return;
    }
    setAmount('');
    setNotice(
      `Withdrawal requested. We review requests and pay to EcoCash within ${DEFAULT_MONEY_CONFIG.payoutDelayHours} hours on business days.`
    );
  };

  const ledgerEntries = Object.values(db.ledger)
    .filter((entry) => entry.creatorUid === currentUid)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="flex-1 overflow-y-auto px-[18px] pt-[22px] pb-[14px]">
      <h2 className="text-[22px] font-extrabold leading-[1.2] mb-[14px]">Earnings</h2>

      {/* Main balance card */}
      <Card>
        <div className="text-[13px] text-[var(--muted)]">Owed to you</div>
        <div className="text-[28px] font-extrabold leading-[1.1] text-gradient my-1">
          {formatCents(balances.owedCents)}
        </div>
        <div className="text-[13px] text-[var(--muted)] mt-[6px] mb-3 leading-[1.4]">
          Withdraw once you reach {formatCents(DEFAULT_MONEY_CONFIG.minPayoutCents)}. Requests are
          reviewed by our team and paid to EcoCash within{' '}
          {DEFAULT_MONEY_CONFIG.payoutDelayHours} hours on business days.
        </div>
        <Button variant="ghost" onClick={onEditEcoCash}>
          {ecoCashNumber ? `EcoCash: ${ecoCashNumber}` : 'Add your EcoCash number'}
        </Button>
      </Card>

      {/* Withdrawal */}
      <div className="text-[13px] text-[var(--muted)] mb-2 mt-4 font-semibold">
        Withdraw to EcoCash
      </div>

      {openRequest ? (
        <Card>
          <div className="flex justify-between items-center gap-2 mb-1">
            <b>Withdrawal in progress</b>
            <Tag variant={STATUS_COPY[openRequest.status]?.tone ?? 'warn'}>
              {STATUS_COPY[openRequest.status]?.label ?? openRequest.status}
            </Tag>
          </div>
          <div className="text-[13px] text-[var(--muted)]">
            {formatCents(openRequest.amountCents)} to {openRequest.ecoCashNumber} · requested{' '}
            {openRequest.createdAt}
          </div>
          <div className="text-[12px] text-[var(--faint)] mt-2 leading-[1.5]">
            We review requests and pay to EcoCash within {DEFAULT_MONEY_CONFIG.payoutDelayHours}{' '}
            hours on business days. You can request again once this one is settled.
          </div>
        </Card>
      ) : belowMinimum ? (
        <Card className="text-[13px] text-[var(--muted)] leading-[1.5]">
          You need at least {formatCents(DEFAULT_MONEY_CONFIG.minPayoutCents)} to withdraw. Your
          verified earnings stay in your balance until then.
        </Card>
      ) : (
        <form onSubmit={handleWithdraw}>
          <Card>
            <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
              Amount (USD)
            </label>
            <input
              type="number"
              min={(DEFAULT_MONEY_CONFIG.minPayoutCents / 100).toFixed(2)}
              step="0.01"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setErrorMsg('');
              }}
              placeholder="5.00"
              className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold mb-3 text-[14px]"
            />

            <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
              EcoCash phone number
            </label>
            <input
              type="tel"
              value={destination}
              onChange={(event) => {
                setDestination(event.target.value);
                setErrorMsg('');
              }}
              placeholder="+263 77 000 0000"
              className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold text-[14px]"
            />

            <div className="text-[12px] text-[var(--faint)] mt-3 leading-[1.5]">
              Paid to this EcoCash number within {DEFAULT_MONEY_CONFIG.payoutDelayHours} hours on
              business days. Make sure the number is correct — payments cannot be reversed.
            </div>
          </Card>

          {errorMsg && (
            <div className="p-3 mt-3 rounded-[10px] bg-[var(--err)]/10 text-[var(--err)] text-[13px] font-semibold border border-[var(--err)]/30">
              {errorMsg}
            </div>
          )}
          {notice && (
            <div className="p-3 mt-3 rounded-[10px] bg-[var(--ok)]/10 text-[var(--ok)] text-[13px] font-semibold border border-[var(--ok)]/30">
              ✓ {notice}
            </div>
          )}

          <div className="mt-3">
            <Button type="submit" disabled={busy}>
              {busy ? 'Requesting…' : `Withdraw ${amount ? `$${amount}` : 'funds'}`}
            </Button>
          </div>
        </form>
      )}

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
