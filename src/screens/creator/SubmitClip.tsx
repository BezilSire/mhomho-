import React, { useState } from 'react';
import { Card } from '../../components/Card.tsx';
import { Button } from '../../components/Button.tsx';
import { DatabaseState, submitClip } from '../../lib/firebase.ts';

export interface SubmitClipProps {
  initialCampaignId?: string;
  db: DatabaseState;
  currentUid: string;
  onBack: () => void;
  onSuccess: () => void;
}

export const SubmitClip: React.FC<SubmitClipProps> = ({
  initialCampaignId,
  db,
  currentUid,
  onBack,
  onSuccess,
}) => {
  const [campaignId, setCampaignId] = useState(
    initialCampaignId || Object.keys(db.campaigns)[0] || ''
  );
  const [platform, setPlatform] = useState<'TikTok' | 'Instagram' | 'YouTube' | 'Facebook'>('TikTok');
  const [link, setLink] = useState('');
  const [claimedViews, setClaimedViews] = useState('');
  const [screenshotName, setScreenshotName] = useState<string>('analytics_proof.png');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const creator = db.creatorsPublic[currentUid];
  const joinedCampaigns = Object.values(db.campaigns).filter(
    (c) => !!db.campaignMembers[`${c.id}_${currentUid}`]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!link.trim()) {
      setErrorMsg('Please enter your live clip URL.');
      return;
    }

    const views = parseInt(claimedViews, 10);
    if (isNaN(views) || views < 1) {
      setErrorMsg('Please enter your current claimed view count.');
      return;
    }

    if (views < 1000) {
      setErrorMsg('Posts only qualify once they reach 1,000 views.');
      return;
    }

    setIsSubmitting(true);

    const res = submitClip({
      campaignId,
      creatorUid: currentUid,
      creatorHandle: creator?.handle || '@creator',
      platform,
      link: link.trim(),
      screenshotUrl: `/uploads/${screenshotName}`,
      claimedViews: views,
    });

    setIsSubmitting(false);

    if (res.success) {
      onSuccess();
    } else {
      setErrorMsg(res.error || 'Failed to submit clip.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-[18px] pt-[22px] pb-[14px]">
      <button
        type="button"
        onClick={onBack}
        className="text-[13px] text-[var(--muted)] mb-2 inline-flex items-center gap-1 hover:text-[var(--text)] cursor-pointer"
      >
        ← Back
      </button>

      <h2 className="text-[22px] font-extrabold leading-[1.2] mb-1">
        Submit a clip
      </h2>
      <p className="text-[13px] text-[var(--muted)] mb-4">
        Post on your account, let it reach at least 1,000 views, then paste the link and screenshot here.
      </p>

      {errorMsg && (
        <div className="p-3 mb-3 rounded-[10px] bg-[var(--err)]/10 text-[var(--err)] text-[13px] font-semibold border border-[var(--err)]/30">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            Campaign
          </label>
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold mb-3 text-[14px]"
          >
            {joinedCampaigns.length === 0 ? (
              Object.values(db.campaigns).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))
            ) : (
              joinedCampaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))
            )}
          </select>

          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            Platform
          </label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as any)}
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold mb-3 text-[14px]"
          >
            <option value="TikTok">TikTok</option>
            <option value="Instagram">Instagram</option>
            <option value="YouTube">YouTube</option>
            <option value="Facebook">Facebook</option>
          </select>

          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            Post Link
          </label>
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://tiktok.com/@yourhandle/video/..."
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-normal mb-3 text-[14px]"
            required
          />

          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            Current Views (Minimum 1,000)
          </label>
          <input
            type="number"
            min="1000"
            value={claimedViews}
            onChange={(e) => setClaimedViews(e.target.value)}
            placeholder="e.g. 4820"
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold mb-3 text-[14px]"
            required
          />

          <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
            Analytics Screenshot (Proof)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              id="screenshot-input"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  setScreenshotName(e.target.files[0].name);
                }
              }}
            />
            <label
              htmlFor="screenshot-input"
              className="px-3 py-2 rounded-[8px] border border-[var(--line)] bg-[var(--bg)] text-[13px] font-semibold cursor-pointer hover:border-[var(--muted)] text-[var(--text)]"
            >
              Choose image
            </label>
            <span className="text-[12px] text-[var(--muted)] truncate">
              {screenshotName}
            </span>
          </div>
        </Card>

        <Card>
          <div className="text-[12px] text-[var(--muted)] space-y-1">
            <div>✓ Post must stay live for at least 30 days.</div>
            <div>✓ Under 1,000 views earns $0. Above it, $1.00 per 1,000 views.</div>
            <div>✓ No bought views or view pods (flagged by fraud checks).</div>
          </div>
        </Card>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit clip for verification'}
        </Button>
      </form>
    </div>
  );
};
