import React from 'react';

export interface ProgressRingProps {
  percentage: number;
  size?: number;
  label?: string;
  className?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  percentage,
  size = 128,
  label,
  className = '',
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const radius = 52;
  const circumference = 2 * Math.PI * radius; // ~326.73
  const strokeDashoffset = Math.round((clamped / 100) * circumference);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={label || `${clamped}% delivered`}
      style={{ display: 'block', margin: '6px auto 10px' }}
      className={className}
    >
      <defs>
        <linearGradient id="progress-ring-grad" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--a1)" />
          <stop offset="100%" stopColor="var(--a2)" />
        </linearGradient>
      </defs>
      {/* Background track */}
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke="var(--line)"
        strokeWidth="12"
      />
      {/* Active progress fill */}
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke="url(#progress-ring-grad)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${strokeDashoffset} ${Math.round(circumference)}`}
        transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dasharray 0.4s ease' }}
      />
      {/* Centered percentage text */}
      <text
        x="60"
        y="67"
        textAnchor="middle"
        fontSize="22"
        fontWeight="800"
        fill="var(--text)"
        fontFamily="var(--font)"
      >
        {clamped}%
      </text>
    </svg>
  );
};
