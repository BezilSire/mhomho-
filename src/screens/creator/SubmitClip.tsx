import React, { useState } from 'react';
import { Card } from '../../components/Card.tsx';
import { Button } from '../../components/Button.tsx';
import { DatabaseState } from '../../lib/firebase.ts';
import { submitClip, uploadProof, type ClipSubmissionInput } from '../../lib/api.ts';

export interface SubmitClipProps {
  initialCampaignId?: string;
  db: DatabaseState;
  currentUid: string;
  onBack: () => void;
  onSuccess: () => void;
}

type Platform = 'TikTok' | 'Instagram' | 'YouTube' | 'Facebook';

const PLATFORMS: Platform[] = ['TikTok', 'Instagram', 'YouTube', 'Facebook'];

interface ClipDraft {
  platform: Platform;
  link: string;
  views: string;
  proofFile: File | null;
}

const emptyClip = (platform: Platform): ClipDraft => ({
  platform,
  link: '',
  views: '',
  proofFile: null,
});

export const SubmitClip: React.FC<SubmitClipProps> = ({
  initialCampaignId,
  db,
  currentUid,
  onBack,
  onSuccess,
}) => {
  const joinedCampaigns = Object.values(db.campaigns).filter(
    (c) => !!db.campaignMembers[`${c.id}_${currentUid}`]
  );

  const [campaignId, setCampaignId] = useState(
    initialCampaignId || joinedCampaigns[0]?.id || ''
  );
  const [clips, setClips] = useState<ClipDraft[]>([
    emptyClip('TikTok'),
    emptyClip('Instagram'),
  ]);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const secondHasData = Boolean(
    clips[1].link.trim() || clips[1].views.trim() || clips[1].proofFile
  );

  const updateClip = (index: number, patch: Partial<ClipDraft>) => {
    setClips((current) => {
      const next = [...current];
      next[index] = { ...next[index], ...patch };

      // A second clip may never share the first clip's platform.
      if (index === 0 && patch.platform && next[1].platform === patch.platform) {
        next[1] = {
          ...next[1],
          platform: PLATFORMS.find((platform) => platform !== patch.platform) ?? 'Instagram',
        };
      }
      return next;
    });
  };

  const validateClip = (clip: ClipDraft, label: string): string | null => {
    if (!clip.link.trim()) return `${label}: enter your live clip URL.`;
    const views = parseInt(clip.views, 10);
    if (isNaN(views) || views < 1) return `${label}: enter your current claimed view count.`;
    if (views < 1000) return `${label}: posts only qualify once they reach 1,000 views.`;
    if (!clip.proofFile) return `${label}: attach a screenshot of the public view count.`;
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!campaignId) {
      setErrorMsg('Join a campaign before submitting a clip.');
      return;
    }

    const firstError = validateClip(clips[0], 'Clip 1');
    if (firstError) {
      setErrorMsg(firstError);
      return;
    }
    if (secondHasData) {
      const secondError = validateClip(clips[1], 'Clip 2');
      if (secondError) {
        setErrorMsg(secondError);
        return;
      }
      if (clips[1].platform === clips[0].platform) {
        setErrorMsg('The two clips must be on different platforms.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const drafts = secondHasData ? [clips[0], clips[1]] : [clips[0]];
      const submissions: ClipSubmissionInput[] = [];

      for (let index = 0; index < drafts.length; index += 1) {
        const draft = drafts[index];
        const upload = await uploadProof(draft.proofFile as File);
        if (!upload.success) {
          setErrorMsg(upload.error || 'A proof screenshot could not be uploaded.');
          return;
        }
        if (!upload.data?.assetId) {
          setErrorMsg('A proof screenshot could not be uploaded.');
          return;
        }
        submissions.push({
          platform: draft.platform,
          postUrl: draft.link.trim(),
          claimedViews: parseInt(draft.views, 10),
          proofAssetId: upload.data.assetId,
        });
      }

      const res = await submitClip({ campaignId, clips: submissions });
      if (res.success) {
        onSuccess();
      } else {
        setErrorMsg(res.error || 'Failed to submit clips.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderClip = (index: number, optional: boolean) => {
    const clip = clips[index];
    const inputId = `screenshot-input-${index}`;

    return (
      <Card>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[13px] font-bold text-[var(--text)]">
            Clip {index + 1}
          </p>
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--faint)]">
            {optional ? 'Optional · more chances' : 'Required'}
          </span>
        </div>

        <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
          Platform
        </label>
        <select
          value={clip.platform}
          onChange={(e) => updateClip(index, { platform: e.target.value as Platform })}
          className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold mb-3 text-[14px]"
        >
          {PLATFORMS.map((platform) => (
            <option
              key={platform}
              value={platform}
              disabled={index === 1 && platform === clips[0].platform}
            >
              {platform}
            </option>
          ))}
        </select>

        <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
          Post Link
        </label>
        <input
          type="url"
          value={clip.link}
          onChange={(e) => updateClip(index, { link: e.target.value })}
          placeholder="https://tiktok.com/@yourhandle/video/..."
          className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-normal mb-3 text-[14px]"
          required={!optional}
        />

        <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
          Current Views (Minimum 1,000)
        </label>
        <input
          type="number"
          min="1000"
          value={clip.views}
          onChange={(e) => updateClip(index, { views: e.target.value })}
          placeholder="e.g. 4820"
          className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold mb-3 text-[14px]"
          required={!optional}
        />

        <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
          Analytics Screenshot (Proof)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            id={inputId}
            className="hidden"
            onChange={(e) => {
              updateClip(index, { proofFile: e.target.files?.[0] ?? null });
              setErrorMsg('');
            }}
          />
          <label
            htmlFor={inputId}
            className="px-3 py-2 rounded-[8px] border border-[var(--line)] bg-[var(--bg)] text-[13px] font-semibold cursor-pointer hover:border-[var(--muted)] text-[var(--text)]"
          >
            Choose image
          </label>
          <span className="text-[12px] text-[var(--muted)] truncate">
            {clip.proofFile?.name || 'PNG, JPEG or WebP · max 5 MB'}
          </span>
        </div>
      </Card>
    );
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
        Submit clips
      </h2>
      <p className="text-[13px] text-[var(--muted)] mb-4">
        Post on one platform, then add a second clip on a different platform to increase your
        chances. Each clip needs its own link, view count and screenshot.
      </p>

      {errorMsg && (
        <div className="p-3 mb-3 rounded-[10px] bg-[var(--err)]/10 text-[var(--err)] text-[13px] font-semibold border border-[var(--err)]/30">
          {errorMsg}
        </div>
      )}

      {joinedCampaigns.length === 0 && (
        <div className="p-3 mb-3 rounded-[10px] bg-[var(--warn)]/10 text-[var(--warn)] text-[13px] font-semibold border border-[var(--warn)]/30">
          You have not joined a campaign yet. Join one from the Campaigns tab first.
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
            className="w-full px-3 py-2.5 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold text-[14px]"
            disabled={joinedCampaigns.length === 0}
          >
            {joinedCampaigns.length === 0 ? (
              <option value="">No joined campaigns</option>
            ) : (
              joinedCampaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))
            )}
          </select>
        </Card>

        {renderClip(0, false)}
        {renderClip(1, true)}

        <Card>
          <div className="text-[12px] text-[var(--muted)] space-y-1">
            <div>✓ Each clip must be a different platform — one TikTok, one Instagram, etc.</div>
            <div>✓ Posts must stay live for at least 30 days.</div>
            <div>✓ Under 1,000 views earns $0. Above it, $1.00 per 1,000 views.</div>
            <div>✓ No bought views or view pods (flagged by fraud checks).</div>
          </div>
        </Card>

        <Button type="submit" disabled={isSubmitting || joinedCampaigns.length === 0}>
          {isSubmitting
            ? 'Submitting...'
            : secondHasData
              ? 'Submit both clips for verification'
              : 'Submit clip for verification'}
        </Button>
      </form>
    </div>
  );
};
