import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Menu, X } from 'lucide-react';

export interface AdminNavItem {
  id: string;
  label: string;
}

export interface AdminNavProps {
  tabs: AdminNavItem[];
  activeTab: string;
  counts?: Record<string, number>;
  onChange: (id: string) => void;
}

/**
 * Desktop keeps the quick pill switcher. Mobile gets one clear entry point
 * instead of eight horizontally scrolling targets.
 */
export const AdminNav: React.FC<AdminNavProps> = ({ tabs, activeTab, counts, onChange }) => {
  const [open, setOpen] = useState(false);
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const select = (id: string) => {
    setOpen(false);
    onChange(id);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 text-left sm:hidden"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Open operations menu, currently ${active?.label ?? 'Overview'}`}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Menu size={17} className="shrink-0 text-[var(--muted)]" />
          <span className="truncate text-[13px] font-bold text-[var(--text)]">
            {active?.label ?? 'Overview'}
          </span>
          {active && (counts?.[active.id] ?? 0) > 0 && (
            <CountBadge count={counts?.[active.id] ?? 0} />
          )}
        </span>
        <ChevronDown size={17} className="shrink-0 text-[var(--muted)]" />
      </button>

      <div className="hidden items-center gap-1.5 overflow-x-auto sm:flex">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = counts?.[tab.id] ?? 0;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[12.5px] font-semibold transition-colors ${
                isActive
                  ? 'bg-[var(--text)] text-[var(--page)]'
                  : 'border border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {tab.label}
              {count > 0 && <CountBadge count={count} active={isActive} />}
            </button>
          );
        })}
      </div>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[85] flex items-end bg-black/45 backdrop-blur-[2px] sm:hidden"
            role="presentation"
            onClick={() => setOpen(false)}
          >
            <div
              role="menu"
              aria-label="Operations"
              className="max-h-[86dvh] w-full overflow-y-auto rounded-t-[22px] border border-[var(--line)] bg-[var(--surface)] pb-[max(16px,env(safe-area-inset-bottom,16px))] shadow-[var(--shadow-soft)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3.5">
                <div>
                  <p className="font-display text-[15px] font-bold leading-tight">Operations</p>
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">Choose a workspace</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                  aria-label="Close operations menu"
                >
                  <X size={17} />
                </button>
              </div>
              <div className="p-2">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const count = counts?.[tab.id] ?? 0;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="menuitem"
                      onClick={() => select(tab.id)}
                      className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[13.5px] font-semibold transition-colors ${
                        isActive
                          ? 'bg-[var(--surface-2)] text-[var(--text)]'
                          : 'text-[var(--muted)] hover:bg-[var(--surface-2)]/70 hover:text-[var(--text)]'
                      }`}
                    >
                      <span className="grid h-5 w-5 shrink-0 place-items-center">
                        {isActive ? <Check size={16} className="text-[var(--a1)]" /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{tab.label}</span>
                      {count > 0 && <CountBadge count={count} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

const CountBadge: React.FC<{ count: number; active?: boolean }> = ({ count, active }) => (
  <span
    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
      active
        ? 'bg-[var(--page)]/15 text-[var(--page)]'
        : 'bg-[var(--surface-2)] text-[var(--a1)]'
    }`}
  >
    {count}
  </span>
);
