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
    <div role="img" aria-label="Campaign Zero funnel" className={`space-y-4 ${className}`}>
      {stages.map((stage, index) => (
        <div key={stage.label}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-[12.5px]">
            <span className="font-semibold text-[var(--text)]">{stage.label}</span>
            <span className="tabular-nums text-[var(--muted)]">
              {stage.count.toLocaleString('en-US')}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${stage.widthPercent}%`,
                background:
                  'linear-gradient(90deg, rgba(255,159,10,0.95) 0%, rgba(240,25,27,0.62) 100%)',
                opacity: 1 - index * 0.08,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
