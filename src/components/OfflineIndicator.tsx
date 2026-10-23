import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../lib/useOnlineStatus.ts';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-[999] flex w-[calc(100%-2rem)] max-w-[340px] -translate-x-1/2 items-center gap-2.5 rounded-xl border border-[var(--warn)]/40 bg-[var(--surface)] px-3.5 py-2.5 text-[12px] font-medium text-[var(--warn)] shadow-[var(--shadow-soft)]"
    >
      <WifiOff size={14} />
      Offline — showing cached data
    </div>
  );
};
