import React from 'react';
import { Home, Megaphone, Users, Video, Wallet } from 'lucide-react';

export type CreatorTabId = 'home' | 'campaigns' | 'clips' | 'community' | 'earnings' | 'profile';

export interface TabBarProps {
  activeTab: CreatorTabId;
  onTabChange: (tab: CreatorTabId) => void;
  badgeCounts?: Partial<Record<CreatorTabId, number>>;
  className?: string;
}

/**
 * Five primary destinations. Profile lives in the account menu so the bar
 * stays comfortable on 320px screens and keeps Community one tap away.
 */
const TABS: { id: CreatorTabId; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { id: 'clips', label: 'Clips', icon: Video },
  { id: 'community', label: 'Community', icon: Users },
  { id: 'earnings', label: 'Earnings', icon: Wallet },
];

export const TabBar: React.FC<TabBarProps> = ({
  activeTab,
  onTabChange,
  badgeCounts,
  className = '',
}) => {
  return (
    <nav
      aria-label="Creator navigation"
      className={`relative z-30 grid shrink-0 grid-cols-5 border-t border-[var(--line)] bg-[var(--surface)]/95 px-1 pb-[max(6px,env(safe-area-inset-bottom,6px))] pt-1.5 shadow-[0_-16px_36px_-24px_rgba(0,0,0,0.9)] backdrop-blur-2xl ${className}`}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const count = badgeCounts?.[tab.id];

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={tab.label}
            className={`press group relative flex min-h-[52px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 py-1 text-[9.5px] font-semibold tracking-[0.01em] transition-colors ${
              isActive ? 'text-[var(--text)]' : 'text-[var(--faint)]'
            }`}
          >
            <span
              className={`relative grid h-8 w-12 place-items-center rounded-full transition-colors ${
                isActive
                  ? 'bg-[var(--a1)]/12 text-[var(--a1)]'
                  : 'text-[var(--faint)] group-active:bg-[var(--surface-2)]'
              }`}
            >
              <tab.icon size={20} strokeWidth={isActive ? 2.3 : 1.8} />
              {typeof count === 'number' && count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--a1)] px-1 text-[8px] font-bold text-[var(--ink)] ring-2 ring-[var(--surface)]">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </span>
            <span className="max-w-full truncate">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
