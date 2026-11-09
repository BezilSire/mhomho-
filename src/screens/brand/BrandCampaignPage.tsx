import React, { useState } from 'react';
import { Card } from '../../components/Card.tsx';
import { Tag } from '../../components/Tag.tsx';
import { Tile, TilesContainer } from '../../components/Tile.tsx';
import { ProgressBar } from '../../components/ProgressBar.tsx';
import { ProgressRing } from '../../components/ProgressRing.tsx';
import { LineChart } from '../../components/LineChart.tsx';
import { Button } from '../../components/Button.tsx';
import { DatabaseState } from '../../lib/firebase.ts';
import { formatCents, formatViews, formatPercent } from '../../lib/money.ts';
import { absoluteTime } from '../../lib/relativeTime.ts';

export interface BrandCampaignPageProps {
  token: string;
  db: DatabaseState;
  onSelectToken?: (newToken: string) => void;
}

export const BrandCampaignPage: React.FC<BrandCampaignPageProps> = ({
  token,
  db,
  onSelectToken,
}) => {
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('100');
  const [topUpSuccess, setTopUpSuccess] = useState(false);

  // Retrieve the server-projected brand report by token. There is no local
  // fallback: an unknown or expired token renders an error.
  const brandDoc = db.brandViews[token];

  if (!brandDoc) {
    return (
      <div className="flex-1 p-6 text-center text-[var(--muted)]">
        {token
          ? 'Loading report… If this message stays, the link is invalid or has expired.'
          : 'No campaign report token was provided.'}
      </div>
    );
  }

  const percentDelivered = formatPercent(
    brandDoc.verifiedViews,
    brandDoc.guaranteedViews
  );

  const budgetPercent = formatPercent(
    brandDoc.budgetUsedCents,
    brandDoc.budgetCents
  );

  const platformMix = brandDoc.platformMix ?? [];
  const topPlatform = platformMix.find((platform) => platform.verifiedViews > 0);

  const handleEmail = () => {
    const body = `Hi Mhomho, checking in on our campaign "${brandDoc.title}". Delivered: ${formatViews(brandDoc.verifiedViews)} of ${formatViews(brandDoc.guaranteedViews)} guaranteed views.`;
    const subject = encodeURIComponent(`Campaign check-in: ${brandDoc.title}`);
    window.location.href = `mailto:support@mhomho.work?subject=${subject}&body=${encodeURIComponent(body)}`;
  };

  const handleTopUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTopUpSuccess(true);
    setTimeout(() => {
      setTopUpSuccess(false);
      setShowTopUpModal(false);
    }, 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto px-[18px] pt-[22px] pb-[14px]">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
          Campaign report
        </span>
        <Tag variant="ok">Live</Tag>
      </div>

      <h2 className="text-[22px] font-extrabold leading-[1.2] mb-1">
        {brandDoc.title}
      </h2>
      <p className="mb-[14px] text-[11px] text-[var(--faint)]">
        {brandDoc.lastUpdatedAt
          ? `Views updated ${absoluteTime(brandDoc.lastUpdatedAt)}`
          : 'No verified views yet'}
      </p>

      {/* Main Delivery Ring Card */}
      <Card>
        <ProgressRing
          percentage={percentDelivered}
          size={128}
          label={`${percentDelivered}% of guaranteed views delivered`}
        />
        <div className="text-center mt-1">
          <div className="text-[28px] font-extrabold leading-[1.1] text-gradient">
            {formatViews(brandDoc.verifiedViews)}
          </div>
          <div className="text-[13px] text-[var(--muted)] mt-1">
            verified views of {formatViews(brandDoc.guaranteedViews)} guaranteed
          </div>
        </div>
      </Card>

      {/* Tiles: Creators joined & Clips live */}
      <TilesContainer>
        <Tile label="Creators joined" value={brandDoc.creatorsJoined} />
        <Tile label="Clips live" value={brandDoc.clipsLive} />
      </TilesContainer>

      {/* Platform mix */}
      <Card>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <b className="block text-[14px]">Verified views by platform</b>
            <p className="mt-0.5 text-[11px] text-[var(--muted)]">
              Based on where each approved clip was posted.
            </p>
          </div>
          {topPlatform && <Tag variant="ok">{topPlatform.platform}</Tag>}
        </div>

        {brandDoc.verifiedViews === 0 ? (
          <p className="py-2 text-[12px] text-[var(--muted)]">
            No views have been verified yet. This section fills in as clips are reviewed.
          </p>
        ) : (
          <div className="space-y-3">
            {platformMix.map((platform) => (
              <div key={platform.platform}>
                <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                  <span className="font-semibold">{platform.platform}</span>
                  <span className="tabular-nums">
                    <b>{formatViews(platform.verifiedViews)}</b>{' '}
                    <span className="text-[11px] text-[var(--muted)]">
                      {platform.sharePct.toFixed(1)}%
                    </span>
                  </span>
                </div>
                <div className="mt-1 h-[6px] overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div
                    className="h-full rounded-full bg-gradient-mhomho"
                    style={{ width: `${platform.sharePct}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-[var(--faint)]">
                  {platform.clips} approved clip{platform.clips === 1 ? '' : 's'}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-2.5 text-[12px]">
          <span className="text-[var(--muted)]">Total</span>
          <b className="tabular-nums">{formatViews(brandDoc.verifiedViews)}</b>
        </div>
      </Card>

      {/* Budget Used Card */}
      <Card>
        <div className="flex justify-between items-center text-[13px] mb-1">
          <span className="text-[var(--muted)]">Budget used</span>
          <b>
            {formatCents(brandDoc.budgetUsedCents)} of {formatCents(brandDoc.budgetCents, false)}
          </b>
        </div>
        <ProgressBar percentage={budgetPercent} />
      </Card>

      {/* Views Over Time Chart */}
      <Card>
        <b className="block text-[14px] mb-2">Verified views over time</b>
        <LineChart data={brandDoc.viewsSeries} height={80} />
      </Card>

      {/* Action Buttons */}
      <div className="mt-2 space-y-[10px] mb-4">
        <Button onClick={() => setShowTopUpModal(true)}>
          Top up this campaign
        </Button>
        <Button variant="ghost" onClick={handleEmail}>
          Email Mhomho
        </Button>
      </div>

      {/* Top up modal */}
      {showTopUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-sm rounded-[14px] bg-[var(--surface)] border border-[var(--line)] p-5">
            <h3 className="text-[18px] font-extrabold mb-2">Top Up Campaign</h3>
            <p className="text-[13px] text-[var(--muted)] mb-4">
              Every top-up expands the verified creator pool and increases your guaranteed delivery
              target. The team will confirm the updated plan before anything is billed.
            </p>

            {topUpSuccess ? (
              <div className="py-4 text-center text-[var(--ok)] font-bold text-[14px]">
                Top-up request sent! Mhomho team will send an invoice and update the guarantee immediately.
              </div>
            ) : (
              <form onSubmit={handleTopUpSubmit} className="space-y-4">
                <div>
                  <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
                    Amount (USD)
                  </label>
                  <input
                    type="number"
                    min="50"
                    step="25"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold"
                    placeholder="100"
                  />
                  <div className="text-[12px] text-[var(--muted)] mt-1">
                    Adds ~{formatViews(Math.floor((Number(topUpAmount || 0) * 100 / 150) * 1000))} guaranteed views.
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="ghost" type="button" onClick={() => setShowTopUpModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    Request Top Up
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
