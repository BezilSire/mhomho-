import React from 'react';

export interface ProgressBarProps {
  percentage: number; // 0 to 100
  className?: string;
  style?: React.CSSProperties;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  className = '',
  style,
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        height: '8px',
        backgroundColor: 'var(--line)',
        borderRadius: '8px',
        overflow: 'hidden',
        margin: '8px 0 6px',
        ...style,
      }}
      className={className}
    >
      <div
        style={{
          display: 'block',
          height: '100%',
          width: `${clamped}%`,
          background: 'var(--grad)',
          borderRadius: '8px',
          transition: 'width 0.3s ease-out',
        }}
      />
    </div>
  );
};
