import React, { useState } from 'react';
import { Card } from '../../components/Card.tsx';
import { Tag } from '../../components/Tag.tsx';
import { Button } from '../../components/Button.tsx';
import {
  DatabaseState,
  ClipDoc,
  isAllowedSocialUrl,
} from '../../lib/firebase.ts';
import { rejectClip, verifyClip } from '../../lib/api.ts';
import { formatCents, formatViews } from '../../lib/money.ts';

export interface AdminVerificationQueueProps {
  db: DatabaseState;
}

export const AdminVerificationQueue: React.FC<AdminVerificationQueueProps> = ({ db }) => {
  const [selectedClip, setSelectedClip] = useState<ClipDoc | null>(null);
  const [verifiedViewsInput, setVerifiedViewsInput] = useState<string>('');
  const [verifyModalAction, setVerifyModalAction] = useState<'approve' | 'reject' | 'preview' | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // Clips waiting for review
  const pendingClips = Object.values(db.clips).filter((c) => c.status === 'submitted');

  const openApproveModal = (clip: ClipDoc) => {
    setSelectedClip(clip);
    // Prefill with publicViews or claimedViews
    setVerifiedViewsInput(String(clip.publicViews || clip.claimedViews));
    setVerifyModalAction('approve');
  };

  const openRejectModal = (clip: ClipDoc) => {
    setSelectedClip(clip);
    setVerifyModalAction('reject');
  };

  const openPreviewModal = (clip: ClipDoc) => {
    setSelectedClip(clip);
    setVerifyModalAction('preview');
  };

  const handleConfirmApprove = async () => {
    if (!selectedClip) return;
    const views = parseInt(verifiedViewsInput, 10);
    if (isNaN(views) || views <= 0) {
      setFeedbackMsg({ text: 'Enter valid verified views count.', isError: true });
      return;
    }

    const res = await verifyClip(selectedClip.id, views);
    if (!res.success) {
      setFeedbackMsg({ text: res.error || 'Verification failed', isError: true });
    } else {
      const earned = res.data?.earningsCents ?? 0;
      const shortfall = res.data?.shortfallCents ?? 0;
      setFeedbackMsg({
        text:
          `Approved! ${formatViews(views)} views verified · ${formatCents(earned)} earned` +
          (shortfall > 0 ? ` · ${formatCents(shortfall)} shortfall recorded` : ''),
      });
      setVerifyModalAction(null);
      setSelectedClip(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!selectedClip) return;
    const res = await rejectClip(selectedClip.id, 'Failed verification or fraudulent views');
    if (!res.success) {
      setFeedbackMsg({ text: res.error || 'Rejection failed', isError: true });
    } else {
      setFeedbackMsg({ text: 'Clip marked as rejected.' });
      setVerifyModalAction(null);
      setSelectedClip(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-[18px] pt-[22px] pb-[14px]">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
          Verification
        </span>
        <Tag variant="warn">{pendingClips.length} waiting</Tag>
      </div>

      <h2 className="text-[22px] font-extrabold leading-[1.2] mb-[14px]">
        Verify clips
      </h2>

      {feedbackMsg && (
        <div
          className={`p-3 rounded-[10px] mb-3 text-[13px] font-semibold border ${
            feedbackMsg.isError
              ? 'bg-[var(--err)]/10 text-[var(--err)] border-[var(--err)]/30'
              : 'bg-[var(--ok)]/10 text-[var(--ok)] border-[var(--ok)]/30'
          }`}
        >
          {feedbackMsg.text}
        </div>
      )}

      {/* Queue List */}
      {pendingClips.length === 0 ? (
        <Card className="text-center py-8 text-[var(--muted)] text-[14px]">
          All caught up! No clips waiting in verification queue.
        </Card>
      ) : (
        pendingClips.map((clip) => {
          return (
            <Card key={clip.id}>
              <div className="flex justify-between items-center gap-2 mb-1">
                <b className="text-[15px]">{clip.creatorHandle}</b>
                {clip.flagged ? (
                  <Tag variant="err">Spike 5×</Tag>
                ) : (
                  <Tag variant="warn">Submitted</Tag>
                )}
              </div>

              <div className="text-[13px] text-[var(--muted)]">
                {clip.flagged && clip.averageViews
                  ? `${clip.platform} · claimed ${clip.claimedViews.toLocaleString()} · avg ${clip.averageViews.toLocaleString()}`
                  : `${clip.platform} · claimed ${clip.claimedViews.toLocaleString()} · public ${clip.publicViews?.toLocaleString() || clip.claimedViews.toLocaleString()}`}
              </div>

              {clip.flagged && clip.spikeReason && (
                <div className="text-[12px] text-[var(--err)] mt-1 font-semibold">
                  ⚠️ {clip.spikeReason}
                </div>
              )}

              <div className="flex items-center gap-2 mt-3">
                <Button size="sm" onClick={() => openApproveModal(clip)}>
                  Approve
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openRejectModal(clip)}>
                  Reject
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openPreviewModal(clip)}>
                  Open post
                </Button>
              </div>
            </Card>
          );
        })
      )}

      {/* Verification Modal */}
      {verifyModalAction && selectedClip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-[14px] bg-[var(--surface)] border border-[var(--line)] p-5">
            {verifyModalAction === 'approve' && (
              <>
                <h3 className="text-[18px] font-extrabold mb-1">
                  Verify {selectedClip.creatorHandle}
                </h3>
                <p className="text-[13px] text-[var(--muted)] mb-3">
                  Check the live public view count on {selectedClip.platform}. Minimum 1,000 views required to qualify.
                </p>

                <div className="mb-4">
                  <label className="block text-[13px] font-semibold text-[var(--muted)] mb-1">
                    Verified Public Views
                  </label>
                  <input
                    type="number"
                    value={verifiedViewsInput}
                    onChange={(e) => setVerifiedViewsInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] text-[var(--text)] font-semibold"
                  />
                  <div className="text-[12px] text-[var(--muted)] mt-1">
                    Claimed by creator: {selectedClip.claimedViews.toLocaleString()}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setVerifyModalAction(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleConfirmApprove}>
                    Confirm & Settle Ledger
                  </Button>
                </div>
              </>
            )}

            {verifyModalAction === 'reject' && (
              <>
                <h3 className="text-[18px] font-extrabold mb-1">
                  Reject Submission
                </h3>
                <p className="text-[13px] text-[var(--muted)] mb-4">
                  Are you sure you want to reject this clip from {selectedClip.creatorHandle}? The clip will earn $0 and will not consume campaign pool budget.
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setVerifyModalAction(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleConfirmReject}>
                    Confirm Reject
                  </Button>
                </div>
              </>
            )}

            {verifyModalAction === 'preview' && (
              <>
                <h3 className="text-[18px] font-extrabold mb-1">
                  Clip Submission Details
                </h3>
                <div className="text-[13px] text-[var(--muted)] space-y-2 mb-4">
                  <div><strong>Creator:</strong> {selectedClip.creatorHandle}</div>
                  <div><strong>Platform:</strong> {selectedClip.platform}</div>
                  <div><strong>Claimed Views:</strong> {selectedClip.claimedViews.toLocaleString()}</div>
                  <div>
                    <strong>Post Link:</strong>{' '}
                    {isAllowedSocialUrl(selectedClip.link) ? (
                      <a
                        href={selectedClip.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--a1)] underline break-all"
                      >
                        {selectedClip.link}
                      </a>
                    ) : (
                      <span className="break-all">{selectedClip.link}</span>
                    )}
                  </div>
                  <div className="pt-2">
                    <span className="block text-[12px] font-semibold text-[var(--muted)] mb-1">Analytics Proof:</span>
                    {selectedClip.screenshotUrl ? (
                      <a href={selectedClip.screenshotUrl} target="_blank" rel="noopener noreferrer">
                        <img
                          src={selectedClip.screenshotUrl}
                          alt={`Proof screenshot for ${selectedClip.creatorHandle}`}
                          className="max-h-48 w-full rounded-[10px] border border-[var(--line)] object-contain bg-[var(--bg)]"
                        />
                      </a>
                    ) : (
                      <div className="h-32 rounded-[10px] bg-[var(--bg)] border border-[var(--line)] flex items-center justify-center text-[12px] text-[var(--muted)]">
                        No screenshot was attached.
                      </div>
                    )}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setVerifyModalAction(null)}>
                  Close
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
