import React from 'react';
import { ArrowRight, ShieldCheck, Smartphone, Wallet } from 'lucide-react';
import { Button } from '../../components/Button.tsx';
import { MhomhoLogo } from '../../components/MhomhoLogo.tsx';

export interface AppEntryScreenProps {
  onSignIn: () => void;
  onApply: () => void;
}

/**
 * App-only entry point for app.mhomho.work and the installed Android app.
 * Deliberately excludes the public landing page: signed-out creators get a
 * clean sign-in surface, signed-in creators go straight to the portal.
 */
export const AppEntryScreen: React.FC<AppEntryScreenProps> = ({
  onSignIn,
  onApply,
}) => {
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[var(--page)] font-montserrat text-[var(--text)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-[-10%] h-[340px] w-[340px] rounded-full bg-[var(--a1)]/12 blur-[90px]" />
        <div className="absolute -right-20 top-[28%] h-[300px] w-[300px] rounded-full bg-[var(--a2)]/10 blur-[90px]" />
        <div className="absolute inset-x-0 bottom-0 h-[42vh] bg-gradient-to-t from-[var(--page)] via-[var(--page)]/80 to-transparent" />
      </div>

      <header className="safe-top relative z-10 px-5 pt-4 sm:px-8">
        <MhomhoLogo className="h-7 w-auto sm:h-8" />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
        <div className="w-full max-w-[430px]">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)]/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted)] backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ok)]" />
            Creator app
          </div>

          <h1 className="text-[36px] font-extrabold leading-[0.98] tracking-[-0.045em] sm:text-[44px]">
            Your crowd.
            <br />
            Your earnings.
          </h1>
          <p className="mt-4 max-w-[36ch] text-[14px] leading-relaxed text-[var(--muted)]">
            Sign in to find campaigns, submit clips and track the EcoCash payouts our team sends
            directly.
          </p>

          <div className="mt-7 space-y-2.5">
            <Button onClick={onSignIn}>
              <span className="inline-flex items-center gap-2">
                Sign in
                <ArrowRight size={16} strokeWidth={2.4} />
              </span>
            </Button>
            <Button variant="ghost" onClick={onApply}>
              Create creator account
            </Button>
          </div>

          <div className="mt-7 grid gap-2.5 rounded-[18px] border border-[var(--line)] bg-[var(--surface)]/55 p-4 backdrop-blur">
            <div className="flex items-center gap-3 text-[12.5px] text-[var(--muted)]">
              <Wallet size={16} className="shrink-0 text-[var(--a1)]" />
              <span>
                <b className="font-semibold text-[var(--text)]">$1.00 CPM</b> base rate on verified
                views
              </span>
            </div>
            <div className="flex items-center gap-3 text-[12.5px] text-[var(--muted)]">
              <ShieldCheck size={16} className="shrink-0 text-[var(--a1)]" />
              <span>Every view is checked before it earns</span>
            </div>
            <div className="flex items-center gap-3 text-[12.5px] text-[var(--muted)]">
              <Smartphone size={16} className="shrink-0 text-[var(--a1)]" />
              <span>Payouts are sent manually to EcoCash</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="safe-bottom relative z-10 px-5 pb-5 text-center text-[10.5px] text-[var(--faint)] sm:px-8">
        <span>Mhomho Media · Creator app</span>
      </footer>
    </div>
  );
};
