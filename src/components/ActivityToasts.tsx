import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Users, X } from 'lucide-react';
import { useActivityFeed } from '../lib/useActivityFeed.ts';
import { initials, relativeTime } from '../lib/relativeTime.ts';
import type { ActivityItem } from '../lib/firebase.ts';

export interface ActivityToastsProps {
  /** Disabled on the brand report, which is a different audience entirely. */
  enabled: boolean;
  /** Signed-in creators and admins see handles; the public sees first names. */
  showHandles: boolean;
}

const TOAST_MS = 6_500;
const MAX_VISIBLE = 3;
const MAX_LIST = 24;

function displayName(item: ActivityItem, showHandles: boolean): string {
  if (showHandles && item.handle) return item.handle;
  return item.firstName;
}

function actionLabel(item: ActivityItem): string {
  return item.type === 'join' && item.campaignTitle
    ? `joined ${item.campaignTitle}`
    : 'joined Mhomho';
}

export const ActivityToasts: React.FC<ActivityToastsProps> = ({ enabled, showHandles }) => {
  const { initial, live, todayCount } = useActivityFeed(enabled);
  const [visible, setVisible] = useState<ActivityItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [stripDismissed, setStripDismissed] = useState(false);
  const [now, setNow] = useState(Date.now());

  const announced = useRef<Set<string>>(new Set());
  const timers = useRef<number[]>([]);
  const initialDone = useRef(false);

  const dismiss = useCallback((id: string) => {
    setVisible((current) => current.filter((item) => item.id !== id));
  }, []);

  const announce = useCallback(
    (item: ActivityItem) => {
      if (announced.current.has(item.id)) return;
      announced.current.add(item.id);
      setVisible((current) => [item, ...current].slice(0, MAX_VISIBLE));
      const timer = window.setTimeout(() => dismiss(item.id), TOAST_MS);
      timers.current.push(timer);
    },
    [dismiss]
  );

  // First load: the three most recent joins, staggered so they do not all
  // appear at once. The rest live behind the "joined today" strip.
  useEffect(() => {
    if (initialDone.current || initial.length === 0) return;
    initialDone.current = true;
    const first = initial.slice(0, MAX_VISIBLE).reverse();
    first.forEach((item, index) => {
      const timer = window.setTimeout(() => announce(item), 500 + index * 650);
      timers.current.push(timer);
    });
  }, [initial, announce]);

  // Everything after the snapshot arrives in real time.
  useEffect(() => {
    if (live.length === 0) return;
    [...live].reverse().forEach((item) => announce(item));
  }, [live, announce]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current = [];
    },
    []
  );

  const all = useMemo(() => {
    const map = new Map<string, ActivityItem>();
    for (const item of [...initial, ...live]) map.set(item.id, item);
    return [...map.values()].sort((left, right) => right.at - left.at).slice(0, MAX_LIST);
  }, [initial, live]);

  if (!enabled) return null;

  const hasContent = visible.length > 0 || (todayCount > 0 && !stripDismissed) || expanded;
  if (!hasContent) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-3 bottom-[78px] z-[70] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[360px]"
      aria-live="polite"
      role="status"
    >
      {expanded && (
        <div className="pointer-events-auto overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-3.5 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
              Last 24 hours
            </p>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="grid h-6 w-6 place-items-center rounded-full text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
              aria-label="Hide activity list"
            >
              <X size={13} />
            </button>
          </div>
          <div className="max-h-[45vh] divide-y divide-[var(--line)] overflow-y-auto">
            {all.length === 0 ? (
              <p className="px-3.5 py-4 text-[12px] text-[var(--muted)]">
                Nothing yet. New creators will appear here.
              </p>
            ) : (
              all.map((item) => (
                <div key={item.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[9.5px] font-bold text-[var(--a1)]">
                    {initials(displayName(item, showHandles))}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-[var(--text)]">
                      {displayName(item, showHandles)}{' '}
                      <span className="font-normal text-[var(--muted)]">{actionLabel(item)}</span>
                    </p>
                    <p className="text-[10.5px] text-[var(--faint)]">
                      {item.platform} · {relativeTime(item.at, now)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {visible.map((item) => (
        <div
          key={item.id}
          className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)]/95 p-3 pl-3.5 shadow-[var(--shadow-soft)] backdrop-blur-md"
        >
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-mhomho text-[11px] font-extrabold text-[var(--ink)]">
            {initials(displayName(item, showHandles))}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] leading-snug text-[var(--text)]">
              <b className="font-bold">{displayName(item, showHandles)}</b>{' '}
              <span className="text-[var(--muted)]">{actionLabel(item)}</span>
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[10.5px] font-medium text-[var(--faint)]">
              <Sparkles size={10} className="text-[var(--a1)]" />
              {item.platform} · {relativeTime(item.at, now)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => dismiss(item.id)}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[var(--faint)] transition-colors hover:text-[var(--text)] cursor-pointer"
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      ))}

      {todayCount > 0 && !stripDismissed && !expanded && (
        <div className="pointer-events-auto flex items-center gap-2 self-start rounded-full border border-[var(--line)] bg-[var(--surface)]/95 px-3 py-1.5 shadow-[var(--shadow-soft)] backdrop-blur-md sm:self-end">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--ok)] opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--ok)]" />
          </span>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
          >
            <Users size={11} />
            {todayCount >= 50 ? '50+' : todayCount} joined today
            <span className="text-[var(--faint)]">·</span>
            <span className="text-[var(--a1)]">See all</span>
          </button>
          <button
            type="button"
            onClick={() => setStripDismissed(true)}
            className="grid h-5 w-5 place-items-center rounded-full text-[var(--faint)] hover:text-[var(--text)] cursor-pointer"
            aria-label="Hide activity counter"
          >
            <X size={10} />
          </button>
        </div>
      )}
    </div>
  );
};
