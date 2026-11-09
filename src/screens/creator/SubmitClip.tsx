import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Card } from '../../components/Card.tsx';
import { Button } from '../../components/Button.tsx';
import { LinkPreviewCard } from '../../components/LinkPreviewCard.tsx';
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
  proofFile: File | null;
}

const emptyClip = (platform: Platform): ClipDraft => ({
  platform,
  link: '',
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

  const secondHasData = Boolean(clips[1].link.trim() || clips[1].proofFile);

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
        let proofAssetId: string | null = null;

        if (draft.proofFile) {
          const upload = await uploadProof(draft.proofFile);
          if (!upload.success) {
            setErrorMsg(upload.error || 'A proof screenshot could not be uploaded.');
            return;
          }
          if (!upload.data?.assetId) {
            setErrorMsg('A proof screenshot could not be uploaded.');
            return;
          }
          proofAssetId = upload.data.assetId;
        }

        submissions.push({
          platform: draft.platform,
          postUrl: draft.link.trim(),
          proofAssetId,
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
          className="mb-3 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[14px] font-semibold text-[var(--text)]"
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
          inputMode="url"
          value={clip.link}
          onChange={(e) => updateClip(index, { link: e.target.value })}
          placeholder="https://tiktok.com/@yourhandle/video/..."
          className="mb-3 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[14px] font-normal text-[var(--text)]"
          autoComplete="off"
          spellCheck={false}
          required={!optional}
        />

        <LinkPreviewCard url={clip.link} />

        <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
          Analytics screenshot (optional)
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
            className="press inline-flex h-11 shrink-0 cursor-pointer items-center rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 text-[12.5px] font-semibold text-[var(--text)] hover:border-[var(--muted)]"
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
    <div className="app-scroll flex-1 overflow-y-auto px-4 pb-0 pt-4 sm:px-[18px] sm:pt-[22px]">
      <button
        type="button"
        onClick={onBack}
        className="press mb-2 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--line)] px-3 text-[12px] font-semibold text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
      >
        <ArrowLeft size={13} />
        Back
      </button>

      <h2 className="mb-1 text-[25px] font-extrabold leading-[1.15] tracking-[-0.03em]">
        Submit clips
      </h2>
      <p className="mb-4 text-[13px] leading-relaxed text-[var(--muted)]">
        Post on one platform, then add a second clip on a different platform to increase your
        chances. Each clip needs its own link. A screenshot is optional — our team verifies the
        live view count.
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
            className="h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[14px] font-semibold text-[var(--text)]"
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

        <div className="sticky bottom-0 z-20 -mx-4 border-t border-[var(--line)] bg-[var(--page)]/95 px-4 pb-3 pt-3 backdrop-blur-xl">
          <Button type="submit" disabled={isSubmitting || joinedCampaigns.length === 0}>
            {isSubmitting
              ? 'Submitting...'
              : secondHasData
                ? 'Submit both clips for verification'
                : 'Submit clip for verification'}
          </Button>
        </div>
      </form>
    </div>
  );
};
