import React from 'react';

export interface ListRowProps {
  left: React.ReactNode;
  right?: React.ReactNode;
  isLast?: boolean;
  className?: string;
  onClick?: () => void;
}

export const ListRow: React.FC<ListRowProps> = ({
  left,
  right,
  isLast = false,
  className = '',
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '10px',
        padding: isLast ? '12px 0 0' : '12px 0',
        borderBottom: isLast ? 'none' : '1px solid var(--line)',
        fontSize: '14px',
        cursor: onClick ? 'pointer' : 'default',
      }}
      className={className}
    >
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        {typeof left === 'string' ? <b>{left}</b> : left}
      </div>
      {right && (
        <div style={{ flex: '0 0 auto', textAlign: 'right' }}>
          {right}
        </div>
      )}
    </div>
  );
};
