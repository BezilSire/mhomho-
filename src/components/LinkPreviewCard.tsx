import React, { useEffect, useState } from 'react';
import { Eye, Heart, Link2, Loader2 } from 'lucide-react';
import { isAllowedSocialUrl, type LinkPreview } from '../lib/firebase.ts';
import { previewLink } from '../lib/api.ts';

export interface LinkPreviewCardProps {
  url: string;
  /** Stored snapshot (admin views). When present the card never fetches. */
  preview?: LinkPreview | null;
  autoFetch?: boolean;
  className?: string;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

/**
 * Best-effort preview for a pasted post link. It only calls our own preview
 * endpoint, which in turn only talks to fixed platform hosts. A failure is
 * silent: the form still submits and an admin verifies the link.
 */
export const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({
  url,
  preview: stored,
  autoFetch = true,
  className = '',
}) => {
  const [fetched, setFetched] = useState<LinkPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const trimmed = url.trim();

  useEffect(() => {
    setFetched(null);
    setUnavailable(false);
    setLoading(false);
    if (!autoFetch || stored || !isAllowedSocialUrl(trimmed)) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const result = await previewLink(trimmed);
      if (cancelled) return;
      setLoading(false);
      if (result.success && result.data?.available && result.data.preview) {
        setFetched(result.data.preview);
      } else {
        setUnavailable(true);
      }
    }, 650);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trimmed, stored, autoFetch]);

  if (!trimmed) return null;

  const preview = stored ?? fetched;

  if (loading) {
    return (
      <div
        className={`mb-3 flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-[11.5px] text-[var(--muted)] ${className}`}
      >
        <Loader2 size={13} className="animate-spin" />
        Checking link preview…
      </div>
    );
  }

  if (!preview) {
    if (!unavailable) return null;
    return (
      <div
        className={`mb-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-[11.5px] text-[var(--faint)] ${className}`}
      >
        Preview unavailable — the link will still be submitted for manual review.
      </div>
    );
  }

  const hasCounts = preview.views !== null || preview.likes !== null;

  return (
    <div
      className={`mb-3 flex gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-2.5 ${className}`}
    >
      {preview.thumbnailUrl ? (
        <img
          src={preview.thumbnailUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-14 w-14 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--faint)]">
          <Link2 size={18} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[12px] font-semibold leading-snug text-[var(--text)]">
          {preview.title ?? 'Post preview'}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">
          {[preview.author, preview.provider].filter(Boolean).join(' · ') || 'Link preview'}
        </p>
        {hasCounts && (
          <div className="mt-1 flex items-center gap-3 text-[10.5px] font-semibold text-[var(--muted)]">
            {preview.views !== null && (
              <span className="inline-flex items-center gap-1">
                <Eye size={11} />
                {formatCount(preview.views)} views
              </span>
            )}
            {preview.likes !== null && (
              <span className="inline-flex items-center gap-1">
                <Heart size={11} />
                {formatCount(preview.likes)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
