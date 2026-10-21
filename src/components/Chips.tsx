import React from 'react';

export interface ChipItem {
  id: string;
  label: string;
}

export interface ChipsProps {
  items: (string | ChipItem)[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
}

export const Chips: React.FC<ChipsProps> = ({
  items,
  selectedId,
  onSelect,
  className = '',
}) => {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        marginBottom: '14px',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: '2px',
      }}
      className={className}
    >
      {items.map((item) => {
        const id = typeof item === 'string' ? item : item.id;
        const label = typeof item === 'string' ? item : item.label;
        const isSelected = selectedId.toLowerCase() === id.toLowerCase();

        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect(id)}
            style={{
              whiteSpace: 'nowrap',
              padding: '8px 14px',
              border: isSelected ? '1px solid transparent' : '1px solid var(--line)',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 600,
              color: isSelected ? 'var(--ink)' : 'var(--muted)',
              background: isSelected ? 'var(--grad)' : 'transparent',
              fontFamily: 'var(--font)',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};
