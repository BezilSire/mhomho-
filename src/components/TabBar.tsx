import React from 'react';
import { Home, Megaphone, User, Users, Video, Wallet } from 'lucide-react';

export type CreatorTabId = 'home' | 'campaigns' | 'clips' | 'community' | 'earnings' | 'profile';

export interface TabBarProps {
  activeTab: CreatorTabId;
  onTabChange: (tab: CreatorTabId) => void;
  badgeCounts?: Partial<Record<CreatorTabId, number>>;
  className?: string;
}

const TABS: { id: CreatorTabId; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { id: 'clips', label: 'Clips', icon: Video },
  { id: 'community', label: 'Community', icon: Users },
  { id: 'earnings', label: 'Earnings', icon: Wallet },
  { id: 'profile', label: 'Profile', icon: User },
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
      className={`grid grid-cols-6 border-t border-[var(--line)] bg-[var(--surface)] px-0.5 pb-[max(10px,env(safe-area-inset-bottom,10px))] pt-1.5 ${className}`}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const count = badgeCounts?.[tab.id];

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`relative flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl py-2 text-[9px] font-semibold transition-colors sm:text-[10px] ${
              isActive ? 'text-[var(--text)]' : 'text-[var(--faint)]'
            }`}
          >
            <span className="relative">
              <tab.icon size={19} strokeWidth={isActive ? 2.2 : 1.8} />
              {typeof count === 'number' && count > 0 && (
                <span className="absolute -right-2 -top-1.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-[var(--a1)] px-1 text-[8px] font-bold text-[var(--ink)]">
                  {count}
                </span>
              )}
            </span>
            {tab.label}
            {isActive && (
              <span
                className="absolute -top-1.5 h-[2px] w-6 rounded-full"
                style={{ background: 'var(--grad)' }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
};
