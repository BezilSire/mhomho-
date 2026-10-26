import React from 'react';
import { MhomhoLogo, MhomhoMark } from './MhomhoLogo.tsx';

export interface BrandMarkProps {
  size?: number;
  className?: string;
}

/**
 * In-app brand mark: the official faceted M and crowd icon.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({ size = 32, className = '' }) => {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <MhomhoMark className="h-full w-full" />
    </span>
  );
};

export const BrandLockup: React.FC<{ size?: number; subtitle?: boolean }> = ({
  size = 32,
  subtitle = true,
}) => {
  return (
    <span className="flex items-center gap-2.5">
      <MhomhoLogo height={size} />
      {subtitle && (
        <span className="sr-only">Mhomho Media</span>
      )}
    </span>
  );
};
