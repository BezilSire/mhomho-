import React from 'react';

export interface DataPoint {
  label: string; // e.g. "Day 1", "12 Oct"
  value: number; // e.g. 15000, 32000
}

export interface LineChartProps {
  data?: DataPoint[];
  ariaLabel?: string;
  height?: number;
  className?: string;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  ariaLabel = 'Views over time',
  height = 80,
  className = '',
}) => {
  // If data provided, calculate svg points scaled to 300x(height - 16)
  let pointsStr = '4,72 50,64 100,52 150,40 200,28 250,16 296,8';

  if (data && data.length > 1) {
    const minVal = Math.min(...data.map((d) => d.value));
    const maxVal = Math.max(...data.map((d) => d.value));
    const range = maxVal - minVal || 1;
    const paddingX = 8;
    const paddingY = 8;
    const usableWidth = 300 - paddingX * 2;
    const usableHeight = height - paddingY * 2;

    const computed = data.map((d, index) => {
      const x = Math.round(paddingX + (index / (data.length - 1)) * usableWidth);
      const normalized = (d.value - minVal) / range;
      const y = Math.round(height - paddingY - normalized * usableHeight);
      return `${x},${y}`;
    });
    pointsStr = computed.join(' ');
  }

  return (
    <div className={`w-full overflow-hidden ${className}`}>
      <svg
        viewBox={`0 0 300 ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={ariaLabel}
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id="chart-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--a1)" />
            <stop offset="100%" stopColor="var(--a2)" />
          </linearGradient>
        </defs>
        {/* Subtle baseline */}
        <line
          x1="0"
          y1={height - 2}
          x2="300"
          y2={height - 2}
          stroke="var(--line)"
          strokeWidth="1"
        />
        {/* Polyline */}
        <polyline
          fill="none"
          stroke="url(#chart-grad)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={pointsStr}
        />
      </svg>
    </div>
  );
};
