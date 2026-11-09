import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ClipboardCheck,
  Copy,
  Database,
  ExternalLink,
  Globe2,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { MhomhoLogo } from '../../components/MhomhoLogo.tsx';

const STORAGE_KEY = 'mhomho.setup.v1';

type SetupItem = {
  id: string;
  title: string;
  detail: string;
  command?: string;
  optional?: boolean;
  done?: boolean;
  progress?: boolean;
};

type SetupSection = {
  id: string;
  title: string;
  caption: string;
  icon: typeof ClipboardCheck;
  items: SetupItem[];
};

const DEFAULT_DONE = ['domain', 'database', 'storage', 'subdomain', 'app-subdomain', 'pwa', 'android-apk', 'admin-path'];

const SECTIONS: SetupSection[] = [
  {
    id: 'infrastructure',
    title: 'Infrastructure',
    caption: 'Already handled in this deployment.',
    icon: Database,
    items: [
      {
        id: 'domain',
        title: 'Main domain + Worker',
        detail: 'mhomho.work is live on Cloudflare Workers with D1, KV and static assets.',
        done: true,
      },
      {
        id: 'database',
        title: 'D1 database + migrations',
        detail: 'The schema and every migration are applied on the remote database.',
        done: true,
      },
      {
        id: 'storage',
        title: 'KV proof storage',
        detail: 'Proof screenshots and campaign posters have a storage binding.',
        done: true,
      },
      {
        id: 'subdomain',
        title: 'Setup subdomain',
        detail: 'setup.mhomho.work points at this checklist.',
        done: true,
      },
      {
        id: 'app-subdomain',
        title: 'App subdomain',
        detail: 'app.mhomho.work is reserved for the creator app.',
        done: true,
      },
      {
        id: 'pwa',
        title: 'Mobile PWA build',
        detail: 'Installable app with manifest, icons, offline shell and service worker.',
        done: true,
      },
      {
        id: 'android-apk',
        title: 'Signed Android app (.apk)',
        detail: 'Fullscreen WebView app work.mhomho.app (1.0.4), signed and served from /download/mhomho.apk.',
        done: true,
      },
    ],
  },
  {
    id: 'secrets',
    title: 'Secrets only you can provide',
    caption: 'Run these in the project root. Never paste a secret into chat or source control.',
    icon: KeyRound,
    items: [
      {
        id: 'admin-path',
        title: 'ADMIN_PATH',
        detail: 'Already configured for the operations console. No action needed.',
        done: true,
      },
      {
        id: 'admin-token',
        title: 'ADMIN_SETUP_TOKEN',
        detail: 'One-time token used to create the first admin account. Delete it after setup.',
        command: 'npx wrangler secret put ADMIN_SETUP_TOKEN',
      },
      {
        id: 'ip-pepper',
        title: 'IP_PEPPER',
        detail: 'A long random string. Keep it permanent — changing it resets rate-limit and audit hashes.',
        command: 'npx wrangler secret put IP_PEPPER',
      },
      {
        id: 'youtube-key',
        title: 'YOUTUBE_API_KEY',
        detail: 'Optional. Adds official YouTube view and like counts to link previews.',
        command: 'npx wrangler secret put YOUTUBE_API_KEY',
        optional: true,
      },
    ],
  },
  {
    id: 'business',
    title: 'Business details',
    caption: 'The human side of the platform.',
    icon: Wallet,
    items: [
      {
        id: 'legal-entity',
        title: 'Legal entity + address',
        detail: 'Underway — you are handling this. No action needed here right now.',
        progress: true,
      },
      {
        id: 'support-contact',
        title: 'Support email + WhatsApp',
        detail: 'Where creators and brands reach a real person. Current public address: support@mhomho.work.',
      },
      {
        id: 'payout-process',
        title: 'Manual EcoCash payouts',
        detail: 'Payouts are sent directly by the team, not through the app. Confirm who approves them and what details creators must send.',
      },
      {
        id: 'legal-review',
        title: 'Terms + privacy review',
        detail: 'Have the legal pages reviewed before paid campaigns go live.',
      },
      {
        id: 'markets',
        title: 'Markets + expansion',
        detail: 'Zimbabwe live. Zambia, Tanzania and Mozambique underway. Confirm which markets can join now.',
      },
      {
        id: 'thresholds',
        title: 'Approval thresholds',
        detail: 'Campaign Zero needs 500 verified views. Paid campaign clips need 1,000 verified views unless the campaign says otherwise.',
      },
    ],
  },
  {
    id: 'launch',
    title: 'Go-live checks',
    caption: 'Prove the whole loop before inviting real users.',
    icon: ShieldCheck,
    items: [
      {
        id: 'first-admin',
        title: 'Create the first admin',
        detail: 'Open /console/<ADMIN_PATH> and create your operations account.',
      },
      {
        id: 'test-campaign',
        title: 'Create a test campaign',
        detail: 'Add a brief, budget and qualifying view threshold.',
      },
      {
        id: 'test-clip',
        title: 'Submit a test creator clip',
        detail: 'Use a real link and check the preview card and optional screenshot.',
      },
      {
        id: 'test-verify',
        title: 'Verify views + confirm manual payout',
        detail: 'Approve the clip, verify the views, then send the EcoCash payout directly outside the app.',
      },
      {
        id: 'test-preview',
        title: 'Test link previews',
        detail: 'YouTube counts are automatic with a key. TikTok, Instagram and Facebook show title and thumbnail only.',
      },
      {
        id: 'test-mobile',
        title: 'Install the Android app on a phone',
        detail: 'Download /download/mhomho.apk, install it, and run the creator flow end to end. The app opens fullscreen with no browser address bar.',
      },
    ],
  },
];

function readStored(): Record<string, boolean> {
  const base = Object.fromEntries(DEFAULT_DONE.map((id) => [id, true]));
  if (typeof window === 'undefined') return base;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    return { ...base, ...(JSON.parse(raw) as Record<string, boolean>) };
  } catch {
    return base;
  }
}

function homeHref(): string {
  if (typeof window === 'undefined') return 'https://mhomho.work';
  return window.location.hostname === 'setup.mhomho.work' ? 'https://mhomho.work' : '/';
}

export function SetupPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>(readStored);
  const [copied, setCopied] = useState('');

  const allItems = useMemo(() => SECTIONS.flatMap((section) => section.items), []);
  const complete = allItems.filter((item) => item.done || checked[item.id]).length;
  const percent = Math.round((complete / allItems.length) * 100);

  const toggle = (id: string) => {
    setChecked((current) => {
      const next = { ...current, [id]: !current[id] };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Progress is a convenience, not a requirement.
      }
      return next;
    });
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(''), 1800);
    } catch {
      setCopied('');
    }
  };

  const remaining = allItems.filter(
    (item) => !item.done && !item.progress && !checked[item.id]
  );
  const copyRemaining = () =>
    copy(
      [
        'Mhomho setup — remaining items',
        '',
        ...remaining.map((item, index) => `${index + 1}. ${item.title} — ${item.detail}`),
      ].join('\n'),
      'remaining'
    );

  const reset = () => {
    const base = Object.fromEntries(DEFAULT_DONE.map((id) => [id, true]));
    setChecked(base);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
    } catch {
      // Ignore storage failures.
    }
  };

  return (
    <div className="min-h-screen bg-[var(--page)] font-montserrat text-[var(--text)]">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--page)]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[980px] items-center justify-between gap-3 px-5 sm:px-8">
          <a href={homeHref()} className="flex items-center gap-3 no-underline text-inherit">
            <MhomhoLogo className="h-8 w-auto" />
            <span className="hidden h-5 w-px bg-[var(--line)] sm:block" />
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--faint)] sm:block">
              Setup
            </span>
          </a>
          <a
            href={homeHref()}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--muted)] no-underline transition-colors hover:text-[var(--text)]"
          >
            <ArrowLeft size={14} />
            Back to site
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[980px] px-5 pb-20 pt-12 sm:px-8 sm:pt-20">
        <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--a1)]">
          <Sparkles size={13} />
          Launch checklist
        </p>
        <h1 className="font-display mt-4 max-w-[18ch] text-[38px] font-semibold leading-[0.98] tracking-[-0.055em] sm:text-[58px]">
          Let’s get Mhomho
          <br />
          <span className="text-gradient">launch-ready.</span>
        </h1>
        <p className="mt-5 max-w-[62ch] text-[14.5px] leading-[1.75] text-[var(--muted)] sm:text-[16px]">
          Here is exactly what I need from you. Check items off as we go — progress is saved on this
          device. The infrastructure is already live; the rest needs your details or a decision.
        </p>

        <div className="mt-8 rounded-2xl border border-[var(--line)] bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--faint)]">
                Progress
              </p>
              <p className="mt-1 font-display text-[24px] font-semibold tracking-[-0.03em]">
                {complete} of {allItems.length} complete
              </p>
            </div>
            <span className="font-display text-[28px] font-semibold text-gradient">{percent}%</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-mhomho transition-[width] duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyRemaining}
              disabled={remaining.length === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-mhomho px-4 text-[11.5px] font-bold text-[var(--ink)] transition-opacity disabled:opacity-40 cursor-pointer"
            >
              <Copy size={13} />
              {copied === 'remaining' ? 'Copied' : 'Copy what’s left'}
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-9 items-center rounded-full border border-[var(--line)] px-4 text-[11.5px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)] cursor-pointer"
            >
              Reset progress
            </button>
          </div>
        </div>

        <div className="mt-10 space-y-10">
          {SECTIONS.map((section) => {
            const SectionIcon = section.icon;
            const sectionComplete = section.items.filter(
              (item) => item.done || checked[item.id]
            ).length;

            return (
              <section key={section.id}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--a1)]">
                      <SectionIcon size={16} />
                    </span>
                    <div>
                      <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em]">
                        {section.title}
                      </h2>
                      <p className="mt-0.5 text-[12px] text-[var(--muted)]">{section.caption}</p>
                    </div>
                  </div>
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
                    {sectionComplete}/{section.items.length}
                  </span>
                </div>

                <div className="mt-4 divide-y divide-[var(--line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-white/[0.015]">
                  {section.items.map((item) => {
                    const isDone = Boolean(item.done || checked[item.id]);
                    return (
                      <div key={item.id} className="flex gap-3 p-4 sm:gap-4 sm:p-5">
                        <button
                          type="button"
                          onClick={() => !item.done && toggle(item.id)}
                          disabled={item.done}
                          aria-pressed={isDone}
                          aria-label={`Mark ${item.title} complete`}
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors ${
                            isDone
                              ? 'border-[var(--a1)] bg-gradient-mhomho text-[var(--ink)]'
                              : 'border-[var(--line-strong)] text-transparent hover:border-[var(--muted)]'
                          } ${item.done ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          <Check size={12} strokeWidth={3} />
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3
                              className={`text-[13.5px] font-semibold ${
                                isDone ? 'text-[var(--muted)] line-through' : 'text-[var(--text)]'
                              }`}
                            >
                              {item.title}
                            </h3>
                            {item.done && (
                              <span className="rounded-full border border-[var(--ok)]/30 bg-[var(--ok)]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--ok)]">
                                Done
                              </span>
                            )}
                            {item.progress && !isDone && (
                              <span className="rounded-full border border-[var(--warn)]/30 bg-[var(--warn)]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--warn)]">
                                Underway
                              </span>
                            )}
                            {item.optional && (
                              <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">
                                Optional
                              </span>
                            )}
                          </div>
                          <p className="mt-1.5 max-w-[66ch] text-[12.5px] leading-relaxed text-[var(--muted)]">
                            {item.detail}
                          </p>
                          {item.command && (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <code className="max-w-full overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] text-[var(--text)]">
                                {item.command}
                              </code>
                              <button
                                type="button"
                                onClick={() => copy(item.command!, item.id)}
                                className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--line)] px-2 text-[10px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)] cursor-pointer"
                              >
                                <Copy size={11} />
                                {copied === item.id ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-12 rounded-2xl border border-[var(--a1)]/25 bg-[var(--a1)]/[0.05] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--a1)]/30 bg-[var(--a1)]/10 text-[var(--a1)]">
              <Globe2 size={18} />
            </span>
            <div>
              <h2 className="font-display text-[19px] font-semibold tracking-[-0.02em]">
                When the secrets are set, tell me.
              </h2>
              <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-[var(--muted)]">
                I’ll finish the admin setup, run the test loop with you, and confirm both subdomains.
                Payouts stay manual: the app verifies views, you send EcoCash directly.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href="mailto:support@mhomho.work?subject=Mhomho%20setup"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-mhomho px-4 text-[11.5px] font-bold text-[var(--ink)] no-underline"
                >
                  Email support@mhomho.work
                  <ExternalLink size={12} />
                </a>
                <a
                  href={homeHref()}
                  className="inline-flex h-9 items-center rounded-full border border-[var(--line)] px-4 text-[11.5px] font-semibold text-[var(--muted)] no-underline transition-colors hover:text-[var(--text)]"
                >
                  Back to the site
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
