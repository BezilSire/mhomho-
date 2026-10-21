import React from 'react';
import { Card } from './Card.tsx';

export interface TileProps {
  label: string;
  value: string | number;
  highlightGradient?: boolean;
  className?: string;
}

export const Tile: React.FC<TileProps> = ({
  label,
  value,
  highlightGradient = false,
  className = '',
}) => {
  return (
    <Card style={{ margin: 0 }} className={className}>
      <div style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '2px' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: '28px',
          fontWeight: 800,
          lineHeight: 1.1,
          fontFamily: 'var(--font)',
        }}
        className={highlightGradient ? 'text-gradient' : ''}
      >
        {value}
      </div>
    </Card>
  );
};

export const TilesContainer: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
        marginBottom: '12px',
      }}
      className={className}
    >
      {children}
    </div>
  );
};
