import React from 'react';

export interface FunnelStage {
  label: string;
  count: number;
  widthPercent: number; // e.g. 100, 84, 66, 48
}

export interface FunnelBarProps {
  stages: FunnelStage[];
  className?: string;
}

export const FunnelBar: React.FC<FunnelBarProps> = ({ stages, className = '' }) => {
  return (
    <div
      role="img"
      aria-label="Campaign Zero Funnel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
      }}
      className={className}
    >
      {stages.map((stage) => {
        return (
          <div
            key={stage.label}
            style={{
              width: `${stage.widthPercent}%`,
              padding: '11px 14px',
              margin: '0 auto 6px',
              borderRadius: '8px',
              background: 'var(--grad)',
              color: 'var(--ink)',
              fontWeight: 700,
              fontSize: '13px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxSizing: 'border-box',
              transition: 'width 0.3s ease',
            }}
          >
            <span>{stage.label}</span>
            <span>{stage.count.toLocaleString('en-US')}</span>
          </div>
        );
      })}
    </div>
  );
};
