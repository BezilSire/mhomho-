import React from 'react';
import { LISTING_BADGES } from '../lib/badges.ts';

/**
 * A slow horizontal drift of listing badges.
 *
 * The track holds two copies of the list and slides half its own width, so
 * the loop is seamless. Badges come from lib/badges.ts, so adding a listing
 * is one line there.
 */
export const BadgeMarquee: React.FC<{ className?: string }> = ({ className = '' }) => {
  if (LISTING_BADGES.length === 0) return null;
  const row = [...LISTING_BADGES, ...LISTING_BADGES];

  return (
    <div
      className={`badge-marquee-wrap relative overflow-hidden ${className}`}
      style={{
        maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)',
      }}
    >
      <div className="badge-marquee-track flex w-max items-center gap-10 sm:gap-14">
        {row.map((badge, index) => (
          <a
            key={`${badge.id}-${index}`}
            href={badge.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-hidden={index >= LISTING_BADGES.length ? 'true' : undefined}
            tabIndex={index >= LISTING_BADGES.length ? -1 : undefined}
            className="block shrink-0 opacity-85 transition-opacity duration-300 hover:opacity-100"
          >
            <img
              src={badge.src}
              alt={index >= LISTING_BADGES.length ? '' : badge.label}
              width={badge.width}
              height={badge.height}
              loading="lazy"
              decoding="async"
              className="h-9 w-auto rounded-md sm:h-11"
              onError={(event) => {
                // The mirrored copy is primary; the listing site is the fallback.
                const image = event.currentTarget;
                if (badge.fallbackSrc && !image.src.includes(badge.fallbackSrc)) {
                  image.src = badge.fallbackSrc;
                }
              }}
            />
          </a>
        ))}
      </div>
    </div>
  );
};
