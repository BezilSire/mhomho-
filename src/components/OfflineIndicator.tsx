import { useOnlineStatus } from '../lib/useOnlineStatus.ts';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: '60px',
        left: '16px',
        right: '16px',
        maxWidth: '360px',
        margin: '0 auto',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderRadius: '10px',
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--warn)',
        color: 'var(--warn)',
        padding: '8px 12px',
        fontSize: '12px',
        fontWeight: 600,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: 'var(--warn)',
          display: 'inline-block',
        }}
      />
      Offline Mode · Cached data in use
    </div>
  );
};
