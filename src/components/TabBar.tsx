import React from 'react';

export type CreatorTabId = 'home' | 'campaigns' | 'clips' | 'earnings' | 'profile';

export interface TabBarProps {
  activeTab: CreatorTabId;
  onTabChange: (tab: CreatorTabId) => void;
  badgeCounts?: Partial<Record<CreatorTabId, number>>;
}

const TABS: { id: CreatorTabId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'clips', label: 'Clips' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'profile', label: 'Profile' },
];

export const TabBar: React.FC<TabBarProps> = ({
  activeTab,
  onTabChange,
  badgeCounts,
}) => {
  return (
    <nav
      aria-label="Creator navigation"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        borderTop: '1px solid var(--line)',
        backgroundColor: 'var(--surface)',
        padding: '6px 0 max(10px, env(safe-area-inset-bottom, 10px))',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const count = badgeCounts?.[tab.id];

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              textAlign: 'center',
              fontSize: '11px',
              fontWeight: 600,
              color: isActive ? 'var(--text)' : 'var(--muted)',
              padding: '6px 0',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font)',
              position: 'relative',
            }}
          >
            {isActive && (
              <span
                style={{
                  display: 'block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--grad)',
                  marginBottom: '4px',
                }}
              />
            )}
            {!isActive && <span style={{ display: 'block', height: '6px', marginBottom: '4px' }} />}
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              {tab.label}
              {typeof count === 'number' && count > 0 && (
                <span
                  style={{
                    fontSize: '9px',
                    padding: '1px 4px',
                    borderRadius: '999px',
                    backgroundColor: 'var(--line)',
                    color: 'var(--text)',
                  }}
                >
                  {count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
