import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Download,
  FileText,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { MhomhoLogo } from '../../components/MhomhoLogo.tsx';
import {
  GUIDE_EDITION,
  GUIDE_PDF_URL,
  GUIDE_READ_TIME,
  GUIDE_SECTIONS,
  GUIDE_STATS,
  GUIDE_SUPPORT_EMAIL,
  type GuideBlock,
} from '../../content/creatorGuide.ts';

export interface CreatorGuidePageProps {
  onBack: () => void;
  onApply: () => void;
  onOpenSignIn: () => void;
}

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

const formatViews = (views: number) => new Intl.NumberFormat('en-US').format(views);

const GuideBlockView: React.FC<{ block: GuideBlock }> = ({ block }) => {
  if (block.type === 'paragraph') {
    return (
      <p className="max-w-[70ch] text-[14.5px] leading-[1.8] text-[var(--muted)] sm:text-[15.5px]">
        {block.text}
      </p>
    );
  }

  if (block.type === 'cards') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {block.items.map((item, index) => (
          <article
            key={item.title}
            className="lift rounded-[22px] border border-[var(--line)] bg-white/[0.025] p-5 sm:p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--a1)]">
                {item.tag ?? `0${index + 1}`}
              </span>
              <span className="grid h-7 w-7 place-items-center rounded-full border border-[var(--line)] text-[var(--faint)]">
                <ArrowUpRight size={13} />
              </span>
            </div>
            <h3 className="font-display mt-5 text-[20px] font-semibold leading-[1.08] tracking-[-0.035em] text-[var(--text)]">
              {item.title}
            </h3>
            <p className="mt-3 text-[12.5px] leading-[1.7] text-[var(--muted)]">{item.body}</p>
          </article>
        ))}
      </div>
    );
  }

  if (block.type === 'steps') {
    return (
      <ol className="relative mt-2 space-y-7">
        <span
          aria-hidden="true"
          className="absolute bottom-3 left-[15px] top-3 w-px bg-gradient-to-b from-[var(--a1)]/60 via-[var(--line-strong)] to-transparent"
        />
        {block.items.map((item, index) => (
          <li key={item.title} className="relative flex gap-4">
            <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--a1)]/35 bg-[var(--page)] text-[10px] font-bold text-[var(--a1)]">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="pt-1">
              <span className="block text-[14.5px] font-semibold text-[var(--text)]">
                {item.title}
              </span>
              <span className="mt-1 block max-w-[64ch] text-[12.5px] leading-[1.7] text-[var(--muted)]">
                {item.body}
              </span>
            </span>
          </li>
        ))}
      </ol>
    );
  }

  if (block.type === 'checklist') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[22px] border border-[var(--ok)]/25 bg-[var(--ok)]/[0.06] p-5">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ok)]">
            <Check size={14} strokeWidth={2.8} />
            Do this
          </p>
          <ul className="mt-4 space-y-3">
            {block.do.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-[12.5px] leading-[1.6] text-[var(--muted)]"
              >
                <Check size={13} className="mt-1 shrink-0 text-[var(--ok)]" strokeWidth={2.6} />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[22px] border border-[var(--err)]/25 bg-[var(--err)]/[0.06] p-5">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--err)]">
            <X size={14} strokeWidth={2.8} />
            Not this
          </p>
          <ul className="mt-4 space-y-3">
            {block.dont.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-[12.5px] leading-[1.6] text-[var(--muted)]"
              >
                <X size={13} className="mt-1 shrink-0 text-[var(--err)]" strokeWidth={2.6} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (block.type === 'table') {
    return (
      <div className="overflow-hidden rounded-[22px] border border-[var(--line)]">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--line)] bg-white/[0.035]">
              {block.headers.map((header) => (
                <th
                  key={header}
                  className="px-4 py-3 text-[9.5px] font-bold uppercase tracking-[0.18em] text-[var(--faint)] sm:px-5"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr
                key={row.join('|')}
                className={rowIndex === block.rows.length - 1 ? '' : 'border-b border-[var(--line)]'}
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${cellIndex}-${cell}`}
                    className={`px-4 py-3.5 text-[12.5px] leading-relaxed sm:px-5 ${
                      cellIndex === 0
                        ? 'font-medium text-[var(--text)]'
                        : 'text-[var(--muted)]'
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.type === 'faq') {
    return (
      <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {block.items.map((item) => (
          <details key={item.q} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 [&::-webkit-details-marker]:hidden">
              <span className="text-[14px] font-semibold text-[var(--text)] sm:text-[15px]">
                {item.q}
              </span>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--line)] text-[var(--muted)] transition-transform group-open:rotate-45">
                <Plus size={14} />
              </span>
            </summary>
            <p className="-mt-1 max-w-[66ch] pb-5 pr-10 text-[13px] leading-[1.75] text-[var(--muted)]">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    );
  }

  if (block.type === 'hooks') {
    return (
      <div className="rounded-[22px] border border-[var(--line)] bg-white/[0.02] p-5 sm:p-6">
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--faint)]">
          <BookOpen size={14} className="text-[var(--a1)]" />
          Hook starters
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {block.items.map((item) => (
            <span
              key={item}
              className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-[12px] text-[var(--muted)]"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[22px] border border-[var(--a1)]/30 bg-[var(--a1)]/[0.07] p-5 sm:p-6">
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--a1)]">
        <Sparkles size={14} />
        {block.label}
      </p>
      <p className="mt-3 max-w-[72ch] text-[13px] leading-[1.75] text-[var(--muted)]">
        {block.text}
      </p>
    </div>
  );
};

const EarningsEstimator: React.FC = () => {
  const [views, setViews] = useState(5000);
  const estimated = (views / 1000) * 1;

  return (
    <div className="glass-panel relative overflow-hidden rounded-[28px] p-6 sm:p-8">
      <div
        aria-hidden="true"
        className="landing-orb right-[-20%] top-[-40%] h-[280px] w-[280px] opacity-70"
        style={{ background: 'radial-gradient(circle, rgba(255,159,10,0.3), transparent 70%)' }}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--faint)]">
              Earnings estimate
            </p>
            <h3 className="font-display mt-2 text-[24px] font-semibold leading-none tracking-[-0.045em] text-[var(--text)]">
              What could 500k views pay?
            </h3>
          </div>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--a1)]/12 text-[var(--a1)]">
            <TrendingUp size={18} />
          </span>
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-x-2 gap-y-1">
          <span className="font-display text-[54px] font-semibold leading-none tracking-[-0.065em] text-gradient">
            {currency.format(estimated)}
          </span>
          <span className="pb-1 text-[12px] font-medium text-[var(--muted)]">
            at base $1.00 CPM
          </span>
        </div>

        <label htmlFor="guide-views" className="mt-6 block text-[11px] font-semibold text-[var(--muted)]">
          Verified views
        </label>
        <input
          id="guide-views"
          type="range"
          min={1000}
          max={500000}
          step={1000}
          value={views}
          onChange={(event) => setViews(Number(event.target.value))}
          className="mt-3 w-full accent-[var(--a1)]"
        />
        <div className="mt-2 flex items-center justify-between gap-4 text-[11px] font-medium text-[var(--faint)]">
          <span>1,000</span>
          <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-[var(--text)]">
            {formatViews(views)} views
          </span>
          <span>500,000</span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {[5000, 50000, 100000, 500000].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setViews(preset)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer ${
                views === preset
                  ? 'border-[var(--a1)] bg-[var(--a1)]/12 text-[var(--a1)]'
                  : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--text)]'
              }`}
            >
              {formatViews(preset)}
            </button>
          ))}
        </div>

        <p className="mt-5 border-t border-[var(--line)] pt-4 text-[11px] leading-relaxed text-[var(--faint)]">
          Estimate only. Base rate is $1.00 per 1,000 verified views. Campaign CPM and qualifying
          thresholds can differ; the brief always wins.
        </p>
      </div>
    </div>
  );
};

export const CreatorGuidePage: React.FC<CreatorGuidePageProps> = ({
  onBack,
  onApply,
  onOpenSignIn,
}) => {
  return (
    <div className="landing-shell min-h-[100dvh] bg-[var(--page)] text-[var(--text)]">
      <nav className="safe-top glass-nav sticky top-0 z-50 border-b border-[var(--line)]">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-8">
          <button
            type="button"
            onClick={onBack}
            className="press flex min-w-0 shrink-0 items-center gap-2 text-inherit cursor-pointer"
            aria-label="Back to Mhomho home"
            title="Back to mhomho.work"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--line)] text-[var(--muted)]">
              <ArrowLeft size={14} />
            </span>
            <MhomhoLogo className="h-8 w-auto sm:h-9" />
          </button>

          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-full border border-[var(--line)] px-3 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--faint)]">
              Creator guide
            </span>
            <span className="text-[10px] font-medium text-[var(--faint)]">{GUIDE_READ_TIME}</span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <a
              href={GUIDE_PDF_URL}
              download
              className="press inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--line-strong)] px-3 text-[11.5px] font-semibold text-[var(--text)] no-underline transition-colors hover:border-[var(--a1)]/60 hover:text-[var(--a1)]"
            >
              <Download size={13} />
              <span className="hidden sm:inline">PDF</span>
            </a>
            <button
              type="button"
              onClick={onApply}
              className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--a1)] px-4 text-[11.5px] font-bold text-[var(--ink)] cursor-pointer"
            >
              Apply
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        <div className="border-t border-[var(--line)]">
          <div className="no-scrollbar mx-auto flex w-full max-w-[1200px] gap-1 overflow-x-auto px-3 py-2 sm:px-6">
            {GUIDE_SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="shrink-0 rounded-full px-3 py-1.5 text-[10.5px] font-semibold text-[var(--faint)] no-underline transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
              >
                {section.number} · {section.eyebrow}
              </a>
            ))}
          </div>
        </div>
      </nav>

      <main>
        <header className="relative overflow-hidden border-b border-[var(--line)]">
          <div
            aria-hidden="true"
            className="landing-orb orb-drift left-[6%] top-[-18%] h-[420px] w-[420px]"
            style={{ background: 'radial-gradient(circle, rgba(255,159,10,0.3), transparent 68%)' }}
          />
          <div
            aria-hidden="true"
            className="landing-orb orb-drift right-[-10%] top-[8%] h-[520px] w-[520px]"
            style={{ background: 'radial-gradient(circle, rgba(240,25,27,0.18), transparent 70%)' }}
          />
          <div className="grid-lines pointer-events-none absolute inset-0 opacity-40" />

          <div className="relative mx-auto grid w-full max-w-[1200px] gap-10 px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
            <div>
              <p className="rise text-[10px] font-semibold uppercase tracking-[0.34em] text-[var(--faint)]">
                Mhomho creator guide · {GUIDE_EDITION}
              </p>
              <h1 className="rise rise-1 font-display mt-5 text-[42px] font-semibold leading-[0.92] tracking-[-0.06em] sm:text-[64px] lg:text-[72px]">
                Make the crowd
                <br />
                <span className="text-gradient">notice you.</span>
              </h1>
              <p className="rise rise-2 mt-6 max-w-[56ch] text-[15.5px] leading-[1.75] text-[var(--muted)] sm:text-[18px]">
                The field guide to Campaign Zero, better clips, verified views and getting paid
                on Mhomho. Built for Africa&apos;s distribution network.
              </p>

              <div className="rise rise-3 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href={GUIDE_PDF_URL}
                  download
                  className="press inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-mhomho px-6 text-[13.5px] font-bold text-[var(--ink)] no-underline transition-transform hover:-translate-y-0.5"
                >
                  <Download size={16} strokeWidth={2.5} />
                  Download the guide
                </a>
                <button
                  type="button"
                  onClick={onApply}
                  className="press inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--line-strong)] px-6 text-[13.5px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--muted)] cursor-pointer"
                >
                  Start creator application
                  <ArrowRight size={15} />
                </button>
              </div>

              <p className="rise rise-3 mt-4 text-[11px] font-medium text-[var(--faint)]">
                Free PDF · {GUIDE_READ_TIME} online · No follower minimum
              </p>
            </div>

            <div className="rise rise-2 glass-panel relative overflow-hidden rounded-[30px] p-5 sm:p-7">
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--a1)]/70 to-transparent"
              />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.22em] text-[var(--a1)]">
                    The numbers that matter
                  </p>
                  <p className="mt-1.5 text-[12.5px] font-medium text-[var(--muted)]">
                    Everything else is detail.
                  </p>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--a1)]/12 text-[var(--a1)]">
                  <ShieldCheck size={18} />
                </span>
              </div>

              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {GUIDE_STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-[var(--line)] bg-white/[0.025] p-4"
                  >
                    <p className="font-display text-[30px] font-semibold leading-none tracking-[-0.055em] text-[var(--text)]">
                      {stat.value}
                    </p>
                    <p className="mt-2 text-[10.5px] leading-[1.5] text-[var(--muted)]">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-[var(--a1)]/25 bg-[var(--a1)]/[0.06] p-4">
                <p className="flex items-center gap-2 text-[9.5px] font-bold uppercase tracking-[0.18em] text-[var(--a1)]">
                  <Wallet size={13} />
                  Paid to post content
                </p>
                <p className="mt-2 text-[11.5px] leading-[1.65] text-[var(--muted)]">
                  Base $1.00 CPM. Payouts are manual, sent directly, and confirmed with you. The app
                  does not process withdrawals.
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
          {GUIDE_SECTIONS.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              className={`scroll-mt-32 border-b border-[var(--line)] py-14 sm:py-20 ${
                index === GUIDE_SECTIONS.length - 1 ? 'border-b-0' : ''
              }`}
            >
              <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
                <div className="lg:sticky lg:top-32 lg:self-start">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full border border-[var(--a1)]/30 bg-[var(--a1)]/[0.08] text-[10px] font-bold text-[var(--a1)]">
                      {section.number}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--faint)]">
                      {section.eyebrow}
                    </span>
                  </div>
                  <h2 className="font-display mt-5 max-w-[18ch] text-[30px] font-semibold leading-[0.98] tracking-[-0.05em] text-[var(--text)] sm:text-[40px]">
                    {section.title}
                  </h2>
                  {section.intro && (
                    <p className="mt-4 max-w-[42ch] text-[13.5px] leading-[1.75] text-[var(--muted)]">
                      {section.intro}
                    </p>
                  )}
                </div>

                <div className="min-w-0 space-y-5">
                  {section.id === 'earnings' && <EarningsEstimator />}
                  {section.blocks.map((block, blockIndex) => (
                    <GuideBlockView key={`${section.id}-${block.type}-${blockIndex}`} block={block} />
                  ))}
                </div>
              </div>
            </section>
          ))}

          <section className="py-14 sm:py-20">
            <div className="glass-panel relative overflow-hidden rounded-[30px] px-6 py-12 sm:px-12 sm:py-16">
              <div
                aria-hidden="true"
                className="landing-orb right-[-12%] top-[-40%] h-[380px] w-[380px] opacity-70"
                style={{
                  background: 'radial-gradient(circle, rgba(255,159,10,0.26), transparent 70%)',
                }}
              />
              <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--faint)]">
                    Take it with you
                  </p>
                  <h2 className="font-display mt-4 max-w-[22ch] text-[32px] font-semibold leading-[1] tracking-[-0.05em] sm:text-[44px]">
                    The guide is free. The first clip is yours.
                  </h2>
                  <p className="mt-4 max-w-[54ch] text-[13.5px] leading-relaxed text-[var(--muted)]">
                    Download the PDF, keep it next to your camera, and start with Campaign Zero.
                  </p>
                  <button
                    type="button"
                    onClick={onOpenSignIn}
                    className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--muted)] underline underline-offset-4 hover:text-[var(--text)] cursor-pointer"
                  >
                    Already a creator? Sign in
                    <ArrowUpRight size={13} />
                  </button>
                </div>
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                  <a
                    href={GUIDE_PDF_URL}
                    download
                    className="press inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-mhomho px-6 text-[13.5px] font-bold text-[var(--ink)] no-underline transition-transform hover:-translate-y-0.5"
                  >
                    <Download size={16} />
                    Download PDF
                  </a>
                  <button
                    type="button"
                    onClick={onApply}
                    className="press inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--line-strong)] px-6 text-[13.5px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--muted)] cursor-pointer"
                  >
                    Apply as creator
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-3">
            <MhomhoLogo className="h-8 w-auto" />
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--faint)]">
              {GUIDE_EDITION}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-[var(--faint)]">
            <a
              href={`mailto:${GUIDE_SUPPORT_EMAIL}`}
              className="text-[var(--muted)] no-underline hover:text-[var(--text)]"
            >
              {GUIDE_SUPPORT_EMAIL}
            </a>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--text)] cursor-pointer"
            >
              <ArrowLeft size={13} />
              Back to mhomho.work
            </button>
            <span className="inline-flex items-center gap-1.5">
              <FileText size={12} />
              PDF included
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
