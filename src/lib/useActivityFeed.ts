import { useEffect, useRef, useState } from 'react';
import { fetchActivity } from './api.ts';
import type { ActivityItem } from './firebase.ts';

const POLL_MS = 25_000;

export interface ActivityFeedState {
  /** The last-24h snapshot captured on first load, newest first. */
  initial: ActivityItem[];
  /** Events that arrived after the snapshot, newest first. */
  live: ActivityItem[];
  /** Approximate number of creators active in the last 24h. */
  todayCount: number;
  error: string | null;
}

/**
 * Polls the lightweight activity endpoint while the tab is visible.
 *
 * The cursor always comes from the server, so a wrong device clock cannot
 * replay or skip events. Every item is de-duplicated by id because the server
 * deliberately rewinds its cursor by one second to close a same-millisecond
 * race.
 */
export function useActivityFeed(enabled: boolean): ActivityFeedState {
  const [state, setState] = useState<ActivityFeedState>({
    initial: [],
    live: [],
    todayCount: 0,
    error: null,
  });

  const cursor = useRef<number | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const started = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: number | undefined;

    const stop = () => {
      if (timer) window.clearTimeout(timer);
      timer = undefined;
    };

    const schedule = (delay: number) => {
      stop();
      timer = window.setTimeout(() => {
        void tick();
      }, delay);
    };

    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.hidden) {
        schedule(POLL_MS);
        return;
      }

      const result = await fetchActivity(cursor.current);
      if (cancelled) return;

      if (!result.success || !result.data) {
        setState((current) => ({ ...current, error: result.success ? null : result.error }));
        // Back off politely instead of hammering a failing endpoint.
        schedule(Math.min(POLL_MS * 4, POLL_MS + 30_000));
        return;
      }

      const feed = result.data;
      cursor.current = feed.nextSince;

      const fresh = feed.items.filter((item) => {
        if (seen.current.has(item.id)) return false;
        seen.current.add(item.id);
        return true;
      });

      if (!started.current) {
        started.current = true;
        setState({
          initial: feed.items,
          live: [],
          todayCount: feed.items.length,
          error: null,
        });
      } else if (fresh.length > 0) {
        setState((current) => ({
          ...current,
          live: [...fresh, ...current.live].slice(0, 60),
          todayCount: current.todayCount + fresh.length,
          error: null,
        }));
      } else {
        setState((current) => (current.error ? { ...current, error: null } : current));
      }

      schedule(POLL_MS);
    };

    const onVisible = () => {
      if (typeof document !== 'undefined' && !document.hidden) schedule(0);
    };

    void tick();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);

  return state;
}
