import React from 'react';

export interface BrandMarkProps {
  size?: number;
  className?: string;
}

/**
 * Mhomho mark: a crowd of voices. Three ascending bars on the brand gradient.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({ size = 32, className = '' }) => {
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center rounded-[26%] ${className}`}
      style={{ width: size, height: size, background: 'var(--grad)' }}
    >
      <span className="flex items-end gap-[2px]" style={{ height: size * 0.52 }}>
        {[0.62, 0.82, 1].map((scale, i) => (
          <span
            key={i}
            style={{
              width: Math.max(2, Math.round(size * 0.1)),
              height: `${scale * 100}%`,
              background: 'var(--ink)',
              borderRadius: 2,
            }}
          />
        ))}
      </span>
    </span>
  );
};

export const BrandLockup: React.FC<{ size?: number; subtitle?: boolean }> = ({
  size = 32,
  subtitle = true,
}) => {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[14px] font-extrabold tracking-[0.18em] text-[var(--text)]">
          MHOMHO
        </span>
        {subtitle && (
          <span className="mt-1 text-[8px] font-medium tracking-[0.42em] text-[var(--muted)]">
            MEDIA
          </span>
        )}
      </span>
    </span>
  );
};
