import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCheck, X } from 'lucide-react';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '../lib/api.ts';
import { relativeTime } from '../lib/relativeTime.ts';

export interface NotificationBellProps {
  className?: string;
}

/**
 * Creator/applicant notification centre: a bell with an unread badge that opens
 * a lightweight sheet. Polls once a minute and pauses while the tab is hidden.
 */
export const NotificationBell: React.FC<NotificationBellProps> = ({ className = '' }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const result = await fetchNotifications();
    if (!result.success) {
      setError(result.error);
      return;
    }
    setError('');
    setItems(result.data?.items ?? []);
    setUnread(result.data?.unread ?? 0);
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const handleOpen = async () => {
    setOpen(true);
    setLoading(true);
    await load();
    setLoading(false);
  };

  const handleRead = async (item: NotificationItem) => {
    if (item.readAt) return;
    setItems((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, readAt: Date.now() } : entry))
    );
    setUnread((current) => Math.max(0, current - 1));
    await markNotificationRead(item.id);
  };

  const handleReadAll = async () => {
    setItems((current) => current.map((entry) => ({ ...entry, readAt: entry.readAt ?? Date.now() })));
    setUnread(0);
    await markAllNotificationsRead();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleOpen()}
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] transition-colors hover:text-[var(--text)] cursor-pointer ${className}`}
        title="Notifications"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      >
        <Bell size={15} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--a1)] px-1 text-[9px] font-bold text-[var(--ink)]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Notifications"
            onClick={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
          <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-[22px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-soft)] sm:rounded-[22px]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3.5">
              <div>
                <p className="font-display text-[15px] font-bold leading-tight">Notifications</p>
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                  {unread > 0 ? `${unread} unread` : 'You are all caught up'}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {items.some((item) => !item.readAt) && (
                  <button
                    type="button"
                    onClick={() => void handleReadAll()}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--line)] px-3 text-[11px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)] cursor-pointer"
                  >
                    <CheckCheck size={12} />
                    Read all
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] cursor-pointer"
                  aria-label="Close notifications"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading && items.length === 0 ? (
                <p className="px-4 py-8 text-center text-[12px] text-[var(--muted)]">Loading…</p>
              ) : error ? (
                <p className="px-4 py-8 text-center text-[12px] text-[var(--err)]">{error}</p>
              ) : items.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] text-[var(--faint)]">
                    <Bell size={18} />
                  </span>
                  <p className="mt-3 text-[13px] font-semibold text-[var(--text)]">No notifications yet</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
                    Announcements from the Mhomho team and support replies will appear here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-[var(--line)]">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => void handleRead(item)}
                        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--surface-2)]/60 cursor-pointer"
                      >
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                            item.readAt ? 'bg-transparent' : 'bg-[var(--a1)]'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span
                              className={`truncate text-[13px] ${
                                item.readAt
                                  ? 'font-medium text-[var(--muted)]'
                                  : 'font-bold text-[var(--text)]'
                              }`}
                            >
                              {item.title}
                            </span>
                            <span className="shrink-0 text-[10px] text-[var(--faint)]">
                              {relativeTime(item.createdAt)}
                            </span>
                          </span>
                          <span className="mt-1 block whitespace-pre-line text-[12px] leading-relaxed text-[var(--muted)]">
                            {item.body}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-[var(--line)] p-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-full items-center justify-center rounded-full border border-[var(--line)] text-[12.5px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
          document.body
        )}
    </>
  );
};
