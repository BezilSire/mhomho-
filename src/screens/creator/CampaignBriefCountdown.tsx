import React, { useEffect, useState } from 'react';
import { CalendarClock, Sparkles } from 'lucide-react';

/** Display-only target. Access control must be enforced by the server. */
export const CAMPAIGN_BRIEFS_START = '2026-12-25T00:00:00+02:00';
const TARGET_MS = new Date(CAMPAIGN_BRIEFS_START).getTime();
const TARGET_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Africa/Harare',
}).format(new Date(CAMPAIGN_BRIEFS_START));

const pad = (value: number) => String(value).padStart(2, '0');

export const CampaignBriefCountdown: React.FC = () => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setInterval(tick, 1000);
    const onVisibilityChange = () => {
      if (!document.hidden) tick();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const remainingSeconds = Math.max(0, Math.floor((TARGET_MS - now) / 1000));
  const days = Math.floor(remainingSeconds / 86_400);
  const hours = Math.floor((remainingSeconds % 86_400) / 3_600);
  const minutes = Math.floor((remainingSeconds % 3_600) / 60);
  const seconds = remainingSeconds % 60;
  const isLive = remainingSeconds === 0;

  return (
    <section
      className="relative mb-3 overflow-hidden rounded-[22px] border border-[var(--a1)]/30 bg-[linear-gradient(120deg,rgba(255,159,10,0.16),rgba(240,25,27,0.08)_58%,rgba(255,255,255,0.02))] p-4"
      aria-label="Campaign brief countdown"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-[var(--a1)]/20 blur-3xl"
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--a1)]">
              <Sparkles size={12} />
              Next campaign drop
            </p>
            <p className="mt-1.5 text-[15px] font-bold leading-tight text-[var(--text)]">
              {isLive ? 'Campaign briefs are live' : 'Campaign briefs open'}
            </p>
            <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">
              {TARGET_DATE} · 00:00 CAT
            </p>
          </div>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--a1)]/25 bg-[var(--page)]/40 text-[var(--a1)]">
            <CalendarClock size={16} />
          </span>
        </div>

        {isLive ? (
          <p className="mt-4 rounded-xl border border-[var(--ok)]/25 bg-[var(--ok)]/[0.07] px-3 py-2.5 text-[12px] font-medium text-[var(--ok)]">
            Briefs are now available in Campaigns.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-4 gap-1.5" role="timer" aria-live="off">
            {[
              [days, 'days'],
              [hours, 'hrs'],
              [minutes, 'min'],
              [seconds, 'sec'],
            ].map(([value, label]) => (
              <div
                key={label}
                className="rounded-xl border border-[var(--line)] bg-[var(--page)]/55 px-1 py-2 text-center"
              >
                <span className="block font-display text-[22px] font-bold leading-none tracking-[-0.04em] tabular-nums text-[var(--text)]">
                  {pad(Number(value))}
                </span>
                <span className="mt-1 block text-[8.5px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="mt-2.5 text-[10px] leading-relaxed text-[var(--faint)]">
          Display only. Briefs unlock automatically on schedule.
        </p>
      </div>
    </section>
  );
};
