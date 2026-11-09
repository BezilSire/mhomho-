import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, LifeBuoy, LogOut, Moon, Sun, User, X } from 'lucide-react';
import { Avatar } from './Avatar.tsx';

export interface AccountMenuProps {
  label: string;
  sublabel?: string;
  handle?: string;
  avatarKey?: string | null;
  isAdmin?: boolean;
  active?: boolean;
  onProfile?: () => void;
  onSupport?: () => void;
  onPublic: () => void;
  showPublicSite?: boolean;
  onSignOut: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

/**
 * Compact account entry point. Keeps secondary actions out of the mobile
 * header while remaining a familiar dropdown on desktop.
 */
export const AccountMenu: React.FC<AccountMenuProps> = ({
  label,
  sublabel,
  handle,
  avatarKey,
  isAdmin = false,
  active = false,
  onProfile,
  onSupport,
  onPublic,
  showPublicSite = true,
  onSignOut,
  theme,
  onToggleTheme,
}) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border bg-[var(--surface)] transition-colors hover:border-[var(--line-strong)] ${
          active
            ? 'border-[var(--a1)] ring-2 ring-[var(--a1)]'
            : 'border-[var(--line)]'
        }`}
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar avatarKey={avatarKey} handle={handle || label} size={34} />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[85] flex items-end bg-black/45 backdrop-blur-[2px] sm:items-start sm:justify-end sm:bg-transparent sm:backdrop-blur-0"
            role="presentation"
            onClick={close}
          >
            <div
              role="menu"
              aria-label="Account menu"
              className="max-h-[85dvh] w-full overflow-y-auto rounded-t-[24px] border border-[var(--line)] bg-[var(--surface)] p-3 pb-[max(16px,env(safe-area-inset-bottom,16px))] shadow-[var(--shadow-soft)] sm:mr-5 sm:mt-[68px] sm:w-72 sm:rounded-[18px] sm:p-2"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="sheet-handle mb-3 mt-1 sm:hidden" />
              <div className="mb-2 flex items-center gap-3 rounded-xl px-2 py-2 sm:mb-1">
                <Avatar avatarKey={avatarKey} handle={handle || label} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-[var(--text)]">{label}</p>
                  <p className="truncate text-[11px] text-[var(--muted)]">
                    {sublabel || (isAdmin ? 'Mhomho operations' : 'Creator account')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] sm:hidden"
                  aria-label="Close account menu"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="my-2 h-px bg-[var(--line)] sm:my-1" />

              {onProfile && (
                <MenuItem
                  icon={<User size={16} />}
                  label="Profile"
                  onClick={() => {
                    close();
                    onProfile();
                  }}
                />
              )}

              {onSupport && (
                <MenuItem
                  icon={<LifeBuoy size={16} />}
                  label="Help and support"
                  onClick={() => {
                    close();
                    onSupport();
                  }}
                />
              )}

              <MenuItem
                icon={theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                onClick={() => {
                  close();
                  onToggleTheme();
                }}
              />

              {showPublicSite && (
                <MenuItem
                  icon={<ArrowLeft size={16} />}
                  label="Public site"
                  onClick={() => {
                    close();
                    onPublic();
                  }}
                />
              )}

              <div className="my-2 h-px bg-[var(--line)] sm:my-1" />

              <MenuItem
                icon={<LogOut size={16} />}
                label="Sign out"
                tone="danger"
                onClick={() => {
                  close();
                  onSignOut();
                }}
              />
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

const MenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
}> = ({ icon, label, onClick, tone = 'default' }) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    className={`press flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-[13px] font-semibold transition-colors ${
      tone === 'danger'
        ? 'text-[var(--err)] hover:bg-[var(--surface-2)]'
        : 'text-[var(--text)] hover:bg-[var(--surface-2)]'
    }`}
  >
    <span className={tone === 'danger' ? 'text-[var(--err)]' : 'text-[var(--muted)]'}>{icon}</span>
    {label}
  </button>
);
