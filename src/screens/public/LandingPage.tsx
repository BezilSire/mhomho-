import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BookOpen,
  Check,
  ChevronDown,
  ClipboardCheck,
  Download,
  FileText,
  Menu,
  MessageCircle,
  Plus,
  Repeat2,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  User,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { DatabaseState } from '../../lib/firebase.ts';
import { MhomhoLogo } from '../../components/MhomhoLogo.tsx';
import { BrandBriefFlow, CreatorSignupFlow } from './LandingSignupFlows.tsx';

export interface LandingPageProps {
  db: DatabaseState;
  onCreatorApplySuccess: (newUid: string) => void;
  onOpenSignIn: () => void;
  onOpenGuide: () => void;
}

const SUPPORT_EMAIL = 'support@mhomho.work';
const APK_DOWNLOAD_URL = '/download/mhomho.apk?v=1.0.4';

// Creator Awards — one trophy per verified-view milestone in a single campaign month.
const AWARDS = [
  {
    tier: 'Bronze',
    views: '100,000',
    accent: '#CD7F32',
    image: '/awards/bronze-creator.jpg',
  },
  {
    tier: 'Silver',
    views: '300,000',
    accent: '#C9CDD4',
    image: '/awards/silver-creator.jpg',
  },
  {
    tier: 'Gold',
    views: '500,000',
    accent: '#F3C967',
    image: '/awards/gold-creator.jpg',
  },
  {
    tier: 'Legend',
    views: '1,000,000',
    accent: '#E0403E',
    image: '/awards/legend-creator.jpg',
  },
] as const;

// Crowd grid: a hundred visible faces standing in for a much larger network.
const ACTIVE_CROWD = new Set([
  2, 7, 11, 16, 21, 28, 33, 38, 42, 47, 51, 57, 63, 68, 72, 77, 81, 86, 91, 96,
]);
const CROWD = Array.from({ length: 100 }, (_, index) => index);

const contactLink = (message: string, subject = 'Mhomho enquiry') =>
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;

const SectionHeading: React.FC<{
  title: React.ReactNode;
  copy?: string;
  className?: string;
}> = ({ title, copy, className = '' }) => (
  <div className={className}>
    <h2 className="font-display text-[30px] font-semibold leading-[0.98] tracking-[-0.055em] text-[var(--text)] sm:text-[44px] lg:text-[52px]">
      {title}
    </h2>
    {copy && (
      <p className="mt-5 max-w-[54ch] text-[15px] leading-[1.75] text-[var(--muted)] sm:text-[16px]">
        {copy}
      </p>
    )}
  </div>
);

export const LandingPage: React.FC<LandingPageProps> = ({
  db,
  onCreatorApplySuccess,
  onOpenSignIn,
  onOpenGuide,
}) => {
  const [navOpen, setNavOpen] = useState(false);
  const [audience, setAudience] = useState<'brands' | 'creators'>('brands');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [flow, setFlow] = useState<'creator' | 'brand' | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      shell.style.setProperty(
        '--parallax-slow',
        reducedMotion.matches ? '0px' : `${Math.min(y * 0.055, 120)}px`,
      );
      shell.style.setProperty(
        '--parallax-fast',
        reducedMotion.matches ? '0px' : `${Math.max(y * -0.09, -180)}px`,
      );
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    reducedMotion.addEventListener('change', update);

    return () => {
      window.removeEventListener('scroll', onScroll);
      reducedMotion.removeEventListener('change', update);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const closeNav = () => setNavOpen(false);
  const openCreatorFlow = () => {
    closeNav();
    setFlow('creator');
  };
  const openBrandFlow = () => {
    closeNav();
    setFlow('brand');
  };
  const openGuide = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    closeNav();
    onOpenGuide();
  };

  const platforms: { id: 'brands' | 'creators'; label: string }[] = [
    { id: 'brands', label: 'For brands' },
    { id: 'creators', label: 'For creators' },
  ];

  return (
    <div
      ref={shellRef}
      className="landing-shell min-h-[100dvh] overflow-x-clip bg-[var(--page)] pb-[calc(84px+env(safe-area-inset-bottom))] text-[var(--text)] lg:pb-0"
    >
      {/* ============================== NAV ============================== */}
      <nav className="safe-top glass-nav sticky top-0 z-50 border-b border-[var(--line)]">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-4 sm:px-8">
          <a
            href="#top"
            className="flex items-center text-inherit no-underline"
            aria-label="Mhomho Media home"
          >
            <MhomhoLogo className="h-9 w-auto sm:h-10" />
          </a>

          <div className="hidden min-w-0 items-center gap-4 whitespace-nowrap xl:flex">
            {[
              ['#how', 'How it works'],
              ['#earnings', 'Earnings'],
              ['#creators', 'For creators'],
              ['#brands', 'For brands'],
              ['#partners', 'Partners'],
              ['/ambassadors/apply', 'Commercial Envoys'],
              ['/resources', 'Resources'],
              ['/blog', 'Journal'],
              ['/creator-guide', 'Creator guide'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                onClick={href === '/creator-guide' ? openGuide : undefined}
                className="text-[12px] font-medium tracking-[-0.01em] text-[var(--muted)] transition-colors hover:text-[var(--text)]"
              >
                {label}
              </a>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onOpenSignIn}
              className="hidden h-10 items-center whitespace-nowrap rounded-full px-3 text-[12px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)] sm:inline-flex cursor-pointer"
            >
              Sign in
            </button>
            <a
              href={APK_DOWNLOAD_URL}
              download
              className="press hidden h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--a1)] px-3 text-[11.5px] font-bold text-[var(--ink)] no-underline transition-transform hover:-translate-y-0.5 sm:inline-flex"
            >
              <Download size={14} strokeWidth={2.5} />
              Download app
            </a>
            <button
              type="button"
              onClick={openCreatorFlow}
              className="hidden h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-gradient-mhomho px-4 text-[12px] font-bold text-[var(--ink)] transition-transform hover:-translate-y-0.5 sm:inline-flex cursor-pointer"
            >
              Get paid to post
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => setNavOpen((open) => !open)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] text-[var(--text)] xl:hidden cursor-pointer"
              aria-label={navOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={navOpen}
            >
              {navOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {navOpen && (
          <div className="app-scroll max-h-[calc(100dvh-64px-env(safe-area-inset-top))] overflow-y-auto border-t border-[var(--line)] bg-[var(--page)]/95 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-2xl xl:hidden">
            <div className="flex flex-col gap-1">
              {[
                ['#how', 'How it works'],
                ['#creators', 'For creators'],
                ['#brands', 'For brands'],
                ['#partners', 'Partners'],
                ['/ambassadors/apply', 'Commercial Envoys'],
                ['/resources', 'Resources'],
                ['/blog', 'Journal'],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={closeNav}
                  className="rounded-xl px-3 py-3 text-[14px] font-medium text-[var(--muted)] no-underline transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
                >
                  {label}
                </a>
              ))}
              <a
                href="/creator-guide"
                onClick={openGuide}
                className="flex items-center gap-2 rounded-xl px-3 py-3 text-[14px] font-medium text-[var(--muted)] no-underline transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
              >
                <FileText size={15} className="text-[var(--a1)]" />
                Creator guide
                <span className="ml-auto rounded-full border border-[var(--line)] px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.14em] text-[var(--faint)]">
                  PDF
                </span>
              </a>
              <button
                type="button"
                onClick={() => {
                  closeNav();
                  onOpenSignIn();
                }}
                className="rounded-xl px-3 py-3 text-left text-[14px] font-medium text-[var(--muted)] cursor-pointer transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
              >
                Sign in
              </button>
              <a
                href={APK_DOWNLOAD_URL}
                download
                onClick={closeNav}
                className="press mt-2 flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--a1)] text-[14px] font-bold text-[var(--ink)] no-underline"
              >
                <Download size={16} strokeWidth={2.5} />
                Download Android app
              </a>
              <button
                type="button"
                onClick={openCreatorFlow}
                className="mt-2 flex h-11 items-center justify-center rounded-full bg-gradient-mhomho text-[14px] font-bold text-[var(--ink)] cursor-pointer"
              >
                Get paid to post
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* ============================== HERO ============================== */}
      <header id="top" className="relative overflow-hidden border-b border-[var(--line)]">
        <div
          aria-hidden="true"
          className="landing-orb orb-drift parallax-slow left-[8%] top-[-14%] h-[420px] w-[420px]"
          style={{ background: 'radial-gradient(circle, rgba(255,159,10,0.32), transparent 68%)' }}
        />
        <div
          aria-hidden="true"
          className="landing-orb orb-drift parallax-fast right-[-8%] top-[12%] h-[520px] w-[520px]"
          style={{ background: 'radial-gradient(circle, rgba(240,25,27,0.2), transparent 70%)' }}
        />
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-50" />

        <div className="relative mx-auto w-full max-w-[1400px] px-5 pb-16 pt-16 sm:px-8 sm:pb-24 sm:pt-24">
          <p className="rise text-[10px] font-semibold uppercase tracking-[0.36em] text-[var(--faint)] sm:text-[10.5px]">
            For brands + creators across Africa.
          </p>

          <h1 className="rise rise-1 font-display mt-6 text-[48px] font-semibold leading-[0.9] tracking-[-0.065em] sm:mt-7 sm:text-[76px] lg:text-[88px] xl:text-[96px]">
            Activate
            <br />
            <span className="text-gradient">your crowd.</span>
          </h1>

          <p className="rise rise-2 mt-6 max-w-[78ch] text-[16.5px] leading-[1.65] text-[var(--muted)] sm:mt-7 sm:text-[20px]">
            Imagine opening{' '}
            <span className="font-semibold text-[var(--text)]">
              TikTok, Facebook, YouTube and Instagram
            </span>{' '}
            and seeing hundreds of creators posting about your business. Taking over the For You Page
            and timelines — one video at a time.
          </p>

          <div className="rise rise-2 mt-6 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-[var(--a1)]/30 bg-[var(--a1)]/[0.06] px-4 py-2 text-[12.5px] text-[var(--muted)] sm:mt-7 sm:text-[13.5px]">
            <span className="font-semibold text-[var(--text)]">
              Creators get paid to post content.
            </span>
            <span>Base</span>
            <span className="font-display text-[18px] font-bold text-gradient">$1.00 CPM</span>
            <span>paid to EcoCash.</span>
          </div>

          <div className="mt-10 grid gap-12 sm:mt-14 xl:grid-cols-[0.95fr_1.05fr] xl:items-center xl:gap-16">
            <div className="min-w-0">
              <div className="rise rise-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--line)] bg-white/[0.03] p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--faint)]">
                    For brands
                  </p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--muted)]">
                    Brand campaigns are opening soon.
                  </p>
                  <button
                    type="button"
                    onClick={openBrandFlow}
                    className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--text)] px-4 text-[13px] font-bold text-[var(--page)] transition-transform hover:-translate-y-0.5 cursor-pointer"
                  >
                    Put my brand on waitlist
                    <ArrowRight size={15} />
                  </button>
                  <p className="mt-2 text-[10px] text-[var(--faint)]">Join the waitlist · no sign-up</p>
                </div>

                <div className="rounded-2xl border border-[var(--a1)]/30 bg-[var(--a1)]/[0.06] p-4">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--a1)]">
                    For creators
                  </p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--muted)]">
                    Get paid to post content you already make.
                  </p>
                  <button
                    type="button"
                    onClick={openCreatorFlow}
                    className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-mhomho px-4 text-[13px] font-bold text-[var(--ink)] transition-transform hover:-translate-y-0.5 cursor-pointer"
                  >
                    Get paid to post content
                    <ArrowRight size={15} />
                  </button>
                  <p className="mt-2 text-[10px] text-[var(--faint)]">
                    Base <span className="font-bold text-[var(--a1)]">$1.00 CPM</span> · paid to EcoCash
                  </p>
                </div>
              </div>

              <div className="rise rise-3 mt-6 rounded-2xl border border-[var(--line)] bg-white/[0.02] p-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--faint)]">
                  Expanding across Africa
                </p>
                <p className="mt-2 max-w-[46ch] text-[12.5px] leading-relaxed text-[var(--muted)]">
                  Zambia, Tanzania and Mozambique are underway. Brands and creators from other
                  countries can join now.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['Zambia', 'Tanzania', 'Mozambique'].map((country) => (
                    <span
                      key={country}
                      className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[10px] font-semibold text-[var(--muted)]"
                    >
                      {country}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="rise rise-3 relative min-w-0">
              <div
                aria-hidden="true"
                className="absolute -inset-10 rounded-[48px] bg-[var(--grad-soft)] opacity-30 blur-3xl"
              />

              <figure className="group relative overflow-hidden rounded-[32px] border border-[var(--line)] bg-[var(--surface)] shadow-[0_40px_100px_-45px_rgba(0,0,0,0.95)]">
                <img
                  src="/images/brands-2.jpg"
                  alt="A creator filming a beauty product with a ring light"
                  width={1271}
                  height={847}
                  loading="eager"
                  decoding="async"
                  className="aspect-[3/2] w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
              </figure>
            </div>
          </div>
        </div>
      </header>

      {/* ============================== CREATOR EARNINGS ============================== */}
      <section
        id="earnings"
        className="relative scroll-mt-24 overflow-hidden border-b border-[var(--line)] py-20 sm:py-28"
      >
        <div
          aria-hidden="true"
          className="landing-orb orb-drift right-[-12%] top-[8%] h-[520px] w-[520px] opacity-70"
          style={{ background: 'radial-gradient(circle, rgba(255,159,10,0.18), transparent 70%)' }}
        />

        <div className="relative mx-auto w-full max-w-[1400px] px-5 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--a1)]">
                Creator earnings
              </p>
              <h2 className="font-display mt-4 max-w-[20ch] text-[34px] font-semibold leading-[0.96] tracking-[-0.055em] sm:text-[48px]">
                Every view is visible.
                <br />
                <span className="text-gradient">Every dollar is tracked.</span>
              </h2>
            </div>
            <p className="max-w-[50ch] text-[14px] leading-[1.75] text-[var(--muted)] sm:text-[15px]">
              A preview of how creators see the campaign, the verified views and the earnings in one
              place.
            </p>
          </div>

          <div className="mt-10 overflow-hidden rounded-[32px] border border-black/10 bg-[#F7F4F0] p-2 shadow-[0_40px_120px_-60px_rgba(0,0,0,0.9)] sm:p-3">
            <img
              src="/images/feed-2.jpg"
              alt="Campaign performance dashboard listing creators, verified views and earnings"
              width={1408}
              height={768}
              loading="eager"
              decoding="async"
              className="w-full rounded-[24px]"
            />
          </div>
        </div>
      </section>

      {/* ============================== MISSION ============================== */}
      <section id="mission" className="scroll-mt-24 border-b border-[var(--line)] py-20 sm:py-32">
        <div className="mx-auto grid w-full max-w-[1200px] gap-14 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading
              title={
                <>
                  Africa’s
                  <br />
                  distribution network.
                </>
              }
              copy="Our mission is to become Africa’s distribution network — the first call for anyone with something to say, sell, launch or grow. Expansion to Zambia, Tanzania and Mozambique is underway."
            />
            <p className="font-display mt-8 text-[26px] font-medium leading-[1.08] tracking-[-0.04em] text-gradient sm:text-[34px]">
              Become impossible to ignore.
            </p>
            <p className="mt-3 max-w-[40ch] text-[12.5px] leading-relaxed text-[var(--muted)]">
              Not one account. Not one audience. A crowd that keeps showing up in the feeds that
              matter.
            </p>
          </div>

          <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {[
              {
                icon: Target,
                title: 'Music & entertainment',
                copy: 'You have a song, a show or a moment. We put it in front of new audiences until it’s too big to miss.',
              },
              {
                icon: Wallet,
                title: 'Businesses & services',
                copy: 'You need customers, not likes. We put your product or service in front of the people most likely to buy.',
              },
              {
                icon: Sparkles,
                title: 'Creators & talent',
                copy: 'You want to grow fast without waiting years for the algorithm. We give your face a shortcut into new audiences.',
              },
              {
                icon: Users,
                title: 'Parties, causes & movements',
                copy: 'You have a message that needs to move people. We get it into the right feeds, fast, at a scale one account can’t buy.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="group grid gap-4 py-7 transition-colors hover:bg-white/[0.015] sm:grid-cols-[auto_1fr] sm:gap-6 sm:py-8"
              >
                <span className="grid h-11 w-11 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--a1)] transition-colors group-hover:border-[var(--line-strong)]">
                  <item.icon size={18} />
                </span>
                <div>
                  <h3 className="font-display text-[18px] font-semibold leading-snug tracking-[-0.02em]">
                    {item.title}
                  </h3>
                  <p className="mt-2 max-w-[48ch] text-[13.5px] leading-[1.7] text-[var(--muted)]">
                    {item.copy}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-14 flex w-full max-w-[1200px] flex-col items-start justify-between gap-5 px-5 sm:flex-row sm:items-center sm:px-8">
          <p className="max-w-[64ch] text-[14px] leading-relaxed text-[var(--muted)]">
            Musician, business, creator or political party — if you need to reach people in
            Zimbabwe and beyond, we get you in front of them.
          </p>
          <button
            type="button"
            onClick={openBrandFlow}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-gradient-mhomho px-5 text-[12.5px] font-bold text-[var(--ink)] cursor-pointer"
          >
            Put my brand on waitlist
            <ArrowRight size={14} />
          </button>
        </div>
      </section>

      {/* ============================== THE PROBLEM ============================== */}
      <section
        id="problem"
        className="scroll-mt-24 border-b border-[var(--line)] bg-[var(--bg)] py-20 sm:py-32"
      >
        <div className="mx-auto grid w-full max-w-[1200px] gap-14 px-5 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-20">
          <div>
            <SectionHeading
              title={
                <>
                  Spray and pray
                  <br />
                  isn’t a media plan.
                </>
              }
              copy="Most campaigns here still look the same: pay one account a flat fee, post once, and hope. There’s no deliverable, no reach you can measure, and no way to know what the money bought."
            />

            <p className="mt-7 max-w-[46ch] text-[13px] leading-relaxed text-[var(--faint)]">
              It isn’t a campaign. It’s a lottery ticket with an invoice.
            </p>
          </div>

          <div className="glass-panel rounded-[28px] p-6 sm:p-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--faint)]">
              What we heard
            </p>
            <p className="font-display mt-6 text-[72px] font-semibold leading-none tracking-[-0.06em] sm:text-[92px]">
              230<span className="text-gradient">+</span>
            </p>
            <p className="mt-4 max-w-[34ch] text-[14px] leading-relaxed text-[var(--muted)]">
              Zimbabwean brands interviewed before we built Mhomho. The pattern was always the
              same.
            </p>

            <div className="mt-8 border-t border-[var(--line)] pt-6">
              <p className="text-[15px] font-semibold text-[var(--text)]">
                One post. One audience. One shot.
              </p>
              <p className="mt-2 max-w-[44ch] text-[13px] leading-relaxed text-[var(--muted)]">
                A flat fee, a screenshot, and no way to know what it moved. We built Mhomho to
                replace that with a crowd, a plan and proof.
              </p>
            </div>

            <div className="mt-6 flex items-start gap-2.5 rounded-2xl bg-white/[0.03] px-4 py-3 text-[12px] leading-relaxed text-[var(--muted)]">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[var(--a1)]" />
              The plan is agreed before launch. The report is checked after.
            </div>
          </div>
        </div>
      </section>

      {/* ============================== HOW IT WORKS ============================== */}
      <section id="how" className="scroll-mt-24 border-b border-[var(--line)] py-20 sm:py-32">
        <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              title={
                <>
                  From brief
                  <br />
                  to proof.
                </>
              }
              copy="Three steps, no platform to learn. Pick the side you’re on."
            />

            <div className="glass-panel inline-flex w-fit rounded-full p-1">
              {platforms.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAudience(item.id)}
                  className={`h-9 rounded-full px-4 text-[12.5px] font-semibold transition-colors cursor-pointer ${
                    audience === item.id
                      ? 'bg-[var(--text)] text-[var(--page)]'
                      : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel mt-12 overflow-hidden rounded-[28px]">
            <div className="grid md:grid-cols-3 md:divide-x md:divide-[var(--line)]">
              {(audience === 'brands'
                ? [
                    {
                      icon: FileText,
                      title: 'Brief us once',
                      copy: 'Tell us what you sell, who it’s for and your budget. We turn it into a delivery target.',
                    },
                    {
                      icon: Users,
                      title: 'Different accounts post',
                      copy: 'Your product goes out across creators in your niche, in different voices, in the same campaign window.',
                    },
                    {
                      icon: Wallet,
                      title: 'Pay for delivery that checks out',
                      copy: 'Delivery is checked clip by clip. The target is tracked in your report, and sub-1,000-view clips aren’t billed.',
                    },
                  ]
                : [
                    {
                      icon: ClipboardCheck,
                      title: 'Apply once',
                      copy: 'Send your handle, platform and niche. No follower minimum — new accounts are welcome.',
                    },
                    {
                      icon: UserCheck,
                      title: 'Get approved',
                      copy: 'We verify you’re real, then unlock campaigns, briefs and your content kit in your dashboard.',
                    },
                    {
                      icon: Banknote,
                      title: 'Clip and earn',
                      copy: 'Post, submit the link, and earn from a base $1 CPM — paid to EcoCash.',
                    },
                  ]
              ).map((step, index) => (
                <div
                  key={step.title}
                  className="p-7 transition-colors hover:bg-white/[0.02] sm:p-9"
                >
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--a1)]">
                      <step.icon size={18} />
                    </span>
                    <span className="font-display text-[11px] font-semibold tracking-[0.28em] text-[var(--faint)]">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="font-display mt-8 text-[20px] font-semibold leading-snug tracking-[-0.02em] text-[var(--text)]">
                    {step.title}
                  </h3>
                  <p className="mt-2.5 text-[13.5px] leading-[1.7] text-[var(--muted)]">
                    {step.copy}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================== THE CROWD ============================== */}
      <section id="crowd" className="scroll-mt-24 border-b border-[var(--line)] py-20 sm:py-32">
        <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
          <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20">
            <div>
              <SectionHeading
                title={
                  <>
                    Why a crowd
                    <br />
                    wins.
                  </>
                }
                copy="Don’t put everything behind one account. Put your product in the hands of a crowd — different creators, different audiences, all posting in the same campaign window."
              />

              <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] font-medium text-[var(--faint)]">
                <span>Different creators</span>
                <span aria-hidden="true">·</span>
                <span>Different audiences</span>
                <span aria-hidden="true">·</span>
                <span>One product</span>
              </div>

              <div className="mt-7 flex items-start gap-2.5 text-[12px] leading-relaxed text-[var(--muted)]">
                <Users size={14} className="mt-0.5 shrink-0 text-[var(--a1)]" />
                The point isn’t more posts. It’s more people hearing the same message.
              </div>
            </div>

            <div className="glass-panel rounded-[28px] p-5 sm:p-7">
              <div className="mb-5 flex items-center justify-between gap-3">
                <p className="text-[12px] font-semibold text-[var(--text)]">
                  The crowd behind one campaign
                </p>
                <span className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-[var(--faint)]">
                  One campaign
                </span>
              </div>

              <div className="grid grid-cols-10 gap-1.5 sm:gap-2" aria-hidden="true">
                {CROWD.map((index) => {
                  const active = ACTIVE_CROWD.has(index);
                  return (
                    <span
                      key={index}
                      className={`grid aspect-square place-items-center rounded-full ${
                        active
                          ? 'bg-gradient-mhomho text-[var(--ink)]'
                          : 'border border-[var(--line)] bg-[var(--surface)]/50 text-[var(--faint)]'
                      }`}
                    >
                      <User className="h-[42%] w-[42%]" strokeWidth={active ? 2.4 : 1.6} />
                    </span>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center justify-between gap-2 text-[10.5px] text-[var(--faint)]">
                <span>Different niches</span>
                <span>Different audiences</span>
                <span>Same brief</span>
              </div>
            </div>
          </div>

          <div className="mt-14 grid gap-8 border-t border-[var(--line)] pt-10 md:grid-cols-3">
            {[
              {
                icon: Repeat2,
                title: 'Frequency beats one big post',
                copy: 'People rarely buy the first time they see something. Repeated clips put your product in front of the same buyer more than once.',
              },
              {
                icon: Users,
                title: 'Every account is a new audience',
                copy: 'You’re not limited to one follower count. You’re entering different communities at once.',
              },
              {
                icon: MessageCircle,
                title: 'Native beats an ad',
                copy: 'A clip from someone people follow feels like a recommendation, not a sponsored interruption.',
              },
            ].map((reason) => (
              <div key={reason.title}>
                <reason.icon size={18} className="text-[var(--a1)]" />
                <h3 className="font-display mt-5 text-[17px] font-semibold leading-snug tracking-[-0.02em]">
                  {reason.title}
                </h3>
                <p className="mt-2 text-[13px] leading-[1.7] text-[var(--muted)]">
                  {reason.copy}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== CREATOR AWARDS ============================== */}
      <section
        id="awards"
        className="relative scroll-mt-24 overflow-hidden border-b border-[var(--line)] py-20 sm:py-32"
      >
        <div
          aria-hidden="true"
          className="landing-orb parallax-slow left-[-10%] top-[-10%] h-[480px] w-[480px] opacity-60"
          style={{ background: 'radial-gradient(circle, rgba(255,159,10,0.2), transparent 70%)' }}
        />

        <div className="relative mx-auto w-full max-w-[1200px] px-5 sm:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--a1)]">
                Recognition
              </p>

              <h2 className="font-display mt-5 max-w-[18ch] text-[34px] font-semibold leading-[0.96] tracking-[-0.055em] sm:text-[48px]">
                Mhomho Creator <span className="text-gradient">Awards.</span>
              </h2>

              <p className="mt-5 max-w-[58ch] text-[15px] leading-[1.75] text-[var(--muted)]">
                Four trophies for the creators who move the most people. Every campaign month we
                recognise the accounts that cross a verified-view milestone inside a single
                campaign month — from 100,000 to 1,000,000.
              </p>
            </div>

            <div className="shrink-0 border-l border-[var(--a1)]/40 pl-5">
              <p className="font-display text-[22px] font-medium leading-tight tracking-[-0.03em] text-gradient">
                Your reach.
                <br />
                Your legacy.
              </p>
            </div>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {AWARDS.map((award) => (
              <article
                key={award.tier}
                className="group relative flex overflow-hidden rounded-[22px] border border-[var(--line)] bg-[#060504] transition-[transform,border-color,box-shadow] duration-300 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-soft)] sm:block sm:hover:-translate-y-1"
              >
                <div className="relative w-[38%] shrink-0 overflow-hidden sm:w-full">
                  <img
                    src={award.image}
                    alt={`${award.tier} Creator Award trophy — ${award.views} verified views in a single campaign month`}
                    width={667}
                    height={800}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[5/6] w-full object-cover transition-transform duration-[700ms] group-hover:scale-[1.04]"
                  />
                  <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-t from-[#060504] via-transparent to-transparent sm:block" />
                  <span
                    className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.14em] backdrop-blur sm:right-4 sm:top-4 sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[9.5px] sm:tracking-[0.16em]"
                    style={{
                      borderColor: `${award.accent}59`,
                      background: `${award.accent}1A`,
                      color: award.accent,
                    }}
                  >
                    <Trophy size={10} className="hidden sm:block" />
                    {award.tier}
                  </span>
                </div>

                <div className="relative flex flex-1 flex-col justify-center px-4 py-4 sm:-mt-2 sm:block sm:px-5 sm:pb-5 sm:pt-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-[22px] font-semibold leading-none tracking-[-0.02em] text-[var(--text)] sm:text-[24px]">
                      {award.views}
                    </p>
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: award.accent }}
                    />
                  </div>
                  <p className="mt-2 text-[9.5px] font-medium uppercase leading-[1.5] tracking-[0.13em] text-[var(--faint)] sm:text-[10px] sm:tracking-[0.14em]">
                    verified views · one campaign month
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-[var(--line)] pt-6 sm:flex-row sm:items-center">
            <p className="max-w-[64ch] text-[12.5px] leading-relaxed text-[var(--muted)]">
              The first trophies go out with the next full campaign month. Only verified views count
              — bought views never will. Each tier is recorded on your creator profile.
            </p>
            <button
              type="button"
              onClick={openCreatorFlow}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-[var(--line-strong)] px-4 text-[12px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--muted)] cursor-pointer"
            >
              Apply as a creator
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* ============================== INTELLIGENCE ============================== */}
      <section id="why" className="scroll-mt-24 border-b border-[var(--line)] bg-[var(--bg)] py-20 sm:py-32">
        <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
          <div className="grid gap-14 lg:grid-cols-[0.92fr_1.08fr] lg:items-start lg:gap-20">
            <div>
              <SectionHeading
                title={
                  <>
                    We read the comments.
                    <br />
                    Not just the views.
                  </>
                }
                copy="Views tell you what was seen. Comments tell you what Zimbabwe actually felt. Our AI reads the comment sections of every post in a campaign — to understand internet trends, interests, objections and buying signals."
              />
              <p className="mt-7 max-w-[46ch] text-[13px] leading-relaxed text-[var(--faint)]">
                Every campaign teaches the next one. That is how we learn what Zimbabwe wants
                before it becomes obvious.
              </p>
            </div>

            <div className="glass-panel overflow-hidden rounded-[28px]">
              <div className="grid gap-px bg-[var(--line)] sm:grid-cols-2">
                {[
                  {
                    icon: MessageCircle,
                    title: 'Zimbabwean sentiment',
                    copy: 'Trained on how people here actually talk — not imported trend data.',
                  },
                  {
                    icon: Repeat2,
                    title: 'The whole conversation',
                    copy: 'All comments in the campaign, not a sample.',
                  },
                  {
                    icon: Target,
                    title: 'Interests & objections',
                    copy: 'See what people ask for, doubt and share — the signals behind the views.',
                  },
                  {
                    icon: Sparkles,
                    title: 'Smarter every campaign',
                    copy: 'Each campaign sharpens the next brief, creator match and creative direction.',
                  },
                ].map((item) => (
                  <div key={item.title} className="bg-[var(--surface)]/60 p-7 sm:p-8">
                    <item.icon size={19} className="text-[var(--a1)]" />
                    <h3 className="font-display mt-5 text-[16px] font-semibold leading-snug tracking-[-0.02em]">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-[13px] leading-[1.7] text-[var(--muted)]">
                      {item.copy}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-10 max-w-[58ch] border-l border-[var(--a1)]/40 pl-5 text-[14px] leading-[1.7] text-[var(--muted)]">
            The result is not a report full of numbers. It is a sharper read on what to say next.
          </p>
        </div>
      </section>

      {/* ============================== CREATORS ============================== */}
      <section id="creators" className="scroll-mt-24 border-b border-[var(--line)] py-20 sm:py-32">
        <div className="mx-auto grid w-full max-w-[1200px] gap-14 px-5 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-20">
          <div className="lg:self-start">
            <SectionHeading
              title={
                <>
                  Get paid
                  <br />
                  to post content.
                </>
              }
              copy="You already make content. Mhomho pays you to post it for brands. No follower minimum, no gatekeeping. A new account with one qualifying clip earns the same base rate as a page with 100,000 followers."
            />

            <div className="glass-panel mt-8 rounded-[24px] p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--faint)]">
                Base rate
              </p>
              <div className="mt-4 flex flex-wrap items-end gap-x-2 gap-y-1">
                <span className="font-display text-[52px] font-semibold leading-none tracking-[-0.06em]">
                  $1.00
                </span>
                <span className="pb-1 text-[13px] font-medium text-[var(--muted)]">
                  + / 1,000 verified views
                </span>
              </div>
              <p className="mt-5 border-t border-[var(--line)] pt-4 text-[12.5px] leading-relaxed text-[var(--muted)]">
                Final CPM depends on the campaign budget. Payouts go to EcoCash within 72 hours of a
                campaign closing.
              </p>
            </div>

            <div className="mt-8 border-t border-[var(--line)] pt-7">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--a1)]">
                    Campaign Zero
                  </p>
                  <p className="mt-1.5 text-[16px] font-semibold text-[var(--text)]">
                    Unlock your dashboard.
                  </p>
                </div>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--warn)]">
                  Required
                </span>
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--muted)]">
                The final step before approval. Prove you can make a clip people watch.
              </p>
              <ol className="mt-5 space-y-3">
                {[
                  'Follow any Mhomho social page',
                  'Post at least 1 clip featuring Mhomho (up to 3; extras optional)',
                  'Get 500+ views on one of those clips',
                ].map((item, index) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-[12.5px] leading-relaxed text-[var(--muted)]"
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[9.5px] font-bold text-[var(--text)]">
                      {index + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-[11px] leading-relaxed text-[var(--faint)]">
                Complete it inside your account within 15 days of sign-up. An admin verifies your
                views before the dashboard unlocks.
              </p>
            </div>

            <p className="mt-6 text-[12.5px] leading-relaxed text-[var(--muted)]">
              Any account size. No bought views. Applications are reviewed within 48 hours of
              completion.
            </p>
          </div>

          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="glass-panel rounded-[28px] p-7 sm:p-8">
              <h3 className="font-display text-[28px] font-semibold leading-[1.06] tracking-[-0.045em]">
                Your first clip could start it.
              </h3>
              <p className="mt-4 text-[13.5px] leading-[1.75] text-[var(--muted)]">
                Create your account, complete Campaign Zero, and get approved. It takes two minutes
                to start.
              </p>
              <ol className="mt-7 space-y-4">
                {[
                  ['Create your account', 'Name, email, handle and password.'],
                  ['Complete Campaign Zero', 'Post and submit your clip.'],
                  ['Get approved, then earn', 'Paid clips need 1,000+ verified views. Base $1 CPM.'],
                ].map(([title, copy], index) => (
                  <li key={title} className="flex items-start gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[10px] font-bold text-[var(--text)]">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-[13px] font-semibold text-[var(--text)]">
                        {title}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-relaxed text-[var(--muted)]">
                        {copy}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={openCreatorFlow}
                className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-mhomho text-[14px] font-bold text-[var(--ink)] transition-transform hover:-translate-y-0.5 cursor-pointer"
              >
                Get paid to post
                <ArrowRight size={16} />
              </button>
              <p className="mt-3 text-center text-[11.5px] text-[var(--faint)]">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={onOpenSignIn}
                  className="font-semibold text-[var(--muted)] underline underline-offset-2 hover:text-[var(--text)] cursor-pointer"
                >
                  Sign in
                </button>
              </p>
              <a
                href="/creator-guide"
                onClick={openGuide}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--line)] px-4 py-3 text-[12px] font-semibold text-[var(--muted)] no-underline transition-colors hover:border-[var(--line-strong)] hover:text-[var(--text)]"
              >
                <FileText size={13} className="text-[var(--a1)]" />
                Read the creator guide
                <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.12em] text-[var(--faint)]">
                  PDF
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== BRAND PROOF ============================== */}
      <section id="proof" className="scroll-mt-24 border-b border-[var(--line)] py-20 sm:py-28">
        <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--a1)]">
                In the wild
              </p>
              <h2 className="font-display mt-4 max-w-[20ch] text-[34px] font-semibold leading-[0.96] tracking-[-0.055em] sm:text-[48px]">
                Your product,
                <br />
                <span className="text-gradient">in feeds people already follow.</span>
              </h2>
            </div>
            <p className="max-w-[48ch] text-[14px] leading-[1.75] text-[var(--muted)] sm:text-[15px]">
              Not one post. A crowd of creators, each with their own audience, all showing what you
              sell in the same campaign window.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <figure className="group relative overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--surface)]">
              <img
                src="/images/brands-1.jpg"
                alt="A creator surrounded by social posts featuring food, fashion and travel brands"
                width={1191}
                height={888}
                loading="lazy"
                decoding="async"
                className="aspect-[4/3] w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
              <figcaption className="absolute bottom-4 left-4 right-4 rounded-2xl bg-[#F7F4F0]/95 p-4 text-[#15110E] backdrop-blur">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#C2410C]">
                  One product
                </p>
                <p className="mt-1 text-[13px] font-semibold">
                  A crowd of creators, one campaign window.
                </p>
              </figcaption>
            </figure>

            <figure className="group relative overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--surface)]">
              <img
                src="/images/brands-2.jpg"
                alt="A creator filming a beauty product with a ring light in her studio"
                width={1271}
                height={847}
                loading="lazy"
                decoding="async"
                className="aspect-[4/3] w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
              <figcaption className="absolute bottom-4 left-4 right-4 rounded-2xl bg-[#F7F4F0]/95 p-4 text-[#15110E] backdrop-blur">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#C2410C]">
                  Native content
                </p>
                <p className="mt-1 text-[13px] font-semibold">
                  Made by people their audience already trusts.
                </p>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ============================== BRANDS ============================== */}
      <section id="brands" className="scroll-mt-24 border-b border-[var(--line)] bg-[var(--bg)] py-20 sm:py-32">
        <div className="mx-auto grid w-full max-w-[1200px] gap-14 px-5 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading
              title={
                <>
                  Stop betting
                  <br />
                  on one account.
                </>
              }
              copy="Tell us what you sell and who it’s for. We turn your budget into a guaranteed delivery plan, put your product in front of creator audiences, and only bill for delivery verified as real."
            />

            <div className="mt-8 border-t border-[var(--line)] pt-7">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--a1)]">
                Included with every campaign
              </p>

              <h3 className="font-display mt-4 text-[26px] font-semibold leading-[1.08] tracking-[-0.04em]">
                No funnel?
                <br />
                We’ll build one.
              </h3>
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--muted)]">
                Run a campaign with Mhomho and get a conversion-ready sales funnel built at no extra
                cost. Traffic without a next step is just noise.
              </p>

              <div className="mt-6 space-y-3 border-t border-[var(--line)] pt-5">
                {[
                  'Landing page and offer',
                  'Tracking and follow-up',
                  'Built from your campaign brief',
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2.5 text-[12.5px] text-[var(--muted)]"
                  >
                    <Check size={14} className="shrink-0 text-[var(--a1)]" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="glass-panel rounded-[28px] p-7 sm:p-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--faint)]">
                Brand waitlist
              </p>
              <h3 className="font-display mt-4 text-[28px] font-semibold leading-[1.06] tracking-[-0.045em]">
                Brand campaigns are coming.
              </h3>
              <p className="mt-4 text-[13.5px] leading-[1.75] text-[var(--muted)]">
                Leave your details and we’ll contact you when campaigns open in your area. No
                sign-up, no commitment.
              </p>
              <ol className="mt-7 space-y-4">
                {[
                  ['Join the waitlist', 'Brand name, location and the right contact person.'],
                  ['We reach out', 'We confirm your details and what you want to promote.'],
                  ['Campaigns open', 'We build the creator plan and a delivery target.'],
                ].map(([title, copy], index) => (
                  <li key={title} className="flex items-start gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[10px] font-bold text-[var(--text)]">
                      {index + 1}
                    </span>
                    <span>
                      <span className="block text-[13px] font-semibold text-[var(--text)]">
                        {title}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-relaxed text-[var(--muted)]">
                        {copy}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={openBrandFlow}
                className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-mhomho text-[14px] font-bold text-[var(--ink)] transition-transform hover:-translate-y-0.5 cursor-pointer"
              >
                Put my brand on waitlist
                <ArrowRight size={16} />
              </button>
              <p className="mt-3 text-center text-[11.5px] text-[var(--faint)]">
                Prefer to talk first?{' '}
                <a
                  href={contactLink('Hi Mhomho, I’d like to talk about brand campaigns.')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[var(--muted)] underline underline-offset-2 hover:text-[var(--text)]"
                >
                  Email the team
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== PARTNERS ============================== */}
      <section id="partners" className="scroll-mt-24 border-b border-[var(--line)] py-20 sm:py-24">
        <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
          <div className="glass-panel flex flex-col items-start justify-between gap-8 rounded-[28px] p-7 sm:p-10 lg:flex-row lg:items-center">
            <div>
              <h2 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.04em] sm:text-[34px]">
                Bring your clients into the crowd.
              </h2>
              <p className="mt-3 max-w-[62ch] text-[13.5px] leading-relaxed text-[var(--muted)]">
                Agencies, managers, media houses and venues — partner with Mhomho to give your
                clients distribution at scale.
              </p>
            </div>
            <a
              href={contactLink('Hi Mhomho, I’d like to partner with you.')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-mhomho px-6 text-[13.5px] font-bold text-[var(--ink)] no-underline transition-transform hover:-translate-y-0.5"
            >
              Partner with us
              <ArrowRight size={15} />
            </a>
          </div>
        </div>
      </section>

      {/* ============================== FAQ ============================== */}
      <section className="py-20 sm:py-32">
        <div className="mx-auto grid w-full max-w-[1200px] gap-12 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <SectionHeading
            title={
              <>
                Creator
                <br />
                questions.
              </>
            }
            copy="What you earn, what we check and when you get paid. Still unsure? Email support@mhomho.work and a human will reply."
          />

          <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {[
              {
                q: 'Do I need followers, or pay a fee?',
                a: 'Neither. There is no follower minimum, no joining fee and no gatekeeping. A new account with one qualifying clip earns the same $1.00 base CPM as a page with 100,000 followers. All you need is a public account on TikTok, Instagram, YouTube or Facebook.',
              },
              {
                q: 'How do I join and get approved?',
                a: 'Create your account with your name, email, handle, platform and WhatsApp number. Then clear Campaign Zero: follow a Mhomho page, post at least 1 clip featuring Mhomho (up to 3 are allowed) and reach 500+ verified views on one clip. An admin checks the live post by hand before your dashboard unlocks. You have 15 days from sign-up, and if that window closes you can start a new one and try again.',
              },
              {
                q: 'What do I earn per clip?',
                a: 'The base rate is $1.00 per 1,000 verified views — 1,000 views is $1.00, 10,000 is $10.00, 100,000 is $100.00. A campaign can pay a higher CPM and the brief always wins. Paid clips need 1,000+ verified views unless the brief says otherwise.',
              },
              {
                q: 'What counts as a verified view?',
                a: 'Real views on the live public post, on the exact link you submitted, while that post stays live for 30 days. Bought views, engagement pods, private or deleted posts and views on a repost do not count. Every submission is verified manually against the live post.',
              },
              {
                q: 'Can I submit more than one clip?',
                a: 'Campaign Zero allows up to 3 clips and needs 1. For paid campaigns, follow the brief — each campaign sets its own limit. Post from the account you applied with, keep the post public, and never delete or private it before payout.',
              },
              {
                q: 'When and how do I get paid?',
                a: 'After the campaign closes and your clip has stayed live for the required 30 days. Payouts are manual and sent directly, so there is no withdrawal button inside the app. The minimum balance is $5, and EcoCash is used in supported markets with the payout method confirmed with you.',
              },
              {
                q: 'Do I need an invite code?',
                a: 'Not yet — sign-up is open while the roster grows. Once we reach 3,000 creator accounts, or if we switch it on earlier, you will need a single-use code that we send you. If you already have one, enter it on the first step of the form.',
              },
              {
                q: 'How do I track my clips and payouts?',
                a: 'In the Mhomho Android creator app. Download it from mhomho.work, sign in with the same details, and follow every submission from posted to verified to paid, with your earnings and payout history in one place.',
              },
              {
                q: 'Which countries can join?',
                a: 'Creators from any country can join. Zambia, Tanzania and Mozambique are underway, and payouts run through EcoCash in supported markets.',
              },
            ].map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-6 py-5 text-left cursor-pointer"
                  >
                    <span className="text-[15px] font-semibold text-[var(--text)]">{item.q}</span>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--line)] text-[var(--muted)]">
                      {isOpen ? <ChevronDown size={14} className="rotate-180" /> : <Plus size={14} />}
                    </span>
                  </button>
                  {isOpen && (
                    <p className="-mt-1 max-w-[62ch] pb-5 pr-10 text-[13.5px] leading-[1.7] text-[var(--muted)]">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================== CTA ============================== */}
      <section className="px-5 pb-24 sm:px-8 sm:pb-32">
        <div className="glass-panel relative mx-auto max-w-[1200px] overflow-hidden rounded-[30px] px-6 py-14 sm:px-12 sm:py-20">
          <div
            aria-hidden="true"
            className="landing-orb parallax-fast right-[-10%] top-[-30%] h-[420px] w-[420px] opacity-70"
            style={{ background: 'radial-gradient(circle, rgba(255,159,10,0.24), transparent 70%)' }}
          />
          <div className="relative flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--faint)]">
                Start here.
              </p>
              <h2 className="font-display mt-5 max-w-[20ch] text-[34px] font-semibold leading-[1.02] tracking-[-0.05em] sm:text-[46px]">
                Brand campaigns are coming.
              </h2>
              <p className="mt-4 max-w-[52ch] text-[14.5px] leading-relaxed text-[var(--muted)]">
                Join the waitlist and we’ll contact you when brand campaigns open. Creators can
                start getting paid now.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <button
                type="button"
                onClick={openBrandFlow}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-mhomho px-6 text-[13.5px] font-bold text-[var(--ink)] cursor-pointer"
              >
                Put my brand on waitlist
                <ArrowRight size={15} />
              </button>
              <button
                type="button"
                onClick={openCreatorFlow}
                className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--line-strong)] px-6 text-[13.5px] font-semibold text-[var(--text)] transition-colors hover:border-[var(--muted)] cursor-pointer"
              >
                Get paid to post
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== FOOTER ============================== */}
      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <MhomhoLogo className="h-12 w-auto" />
            <p className="mt-4 max-w-[36ch] text-[12.5px] leading-relaxed text-[var(--muted)]">
              Activate your crowd. Become impossible to ignore.
            </p>
            <a
              href={APK_DOWNLOAD_URL}
              download
              className="press mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--a1)] px-5 text-[12.5px] font-bold text-[var(--ink)] no-underline transition-transform hover:-translate-y-0.5"
            >
              <Download size={16} strokeWidth={2.5} />
              Download Android app
            </a>
            <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--faint)]">
              Direct APK · Free · Android 6+
            </p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
              Platform
            </p>
            <div className="mt-4 flex flex-col gap-2.5 text-[12.5px]">
              <a href="#problem" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
                The spray-and-pray problem
              </a>
              <a href="#mission" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
                Our mission
              </a>
              <a href="#how" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
                How it works
              </a>
              <a href="#earnings" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
                Creator earnings
              </a>
              <a href="#crowd" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
                Activate your crowd
              </a>
              <a href="#proof" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
                Brand proof
              </a>
              <a href="#why" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
                Intelligence
              </a>
              <a href="#creators" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
                Creator applications
              </a>
              <a
                href="/creator-guide"
                onClick={openGuide}
                className="inline-flex items-center gap-1.5 text-[var(--muted)] no-underline hover:text-[var(--text)]"
              >
                <FileText size={12} className="text-[var(--a1)]" />
                Creator guide
                <span className="rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--faint)]">
                  PDF
                </span>
              </a>
              <a href="#partners" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
                Partner with us
              </a>
              <a
                href="/resources"
                className="inline-flex items-center gap-1.5 text-[var(--muted)] no-underline hover:text-[var(--text)]"
              >
                <BookOpen size={12} className="text-[var(--a1)]" />
                Commercial Envoy programme
              </a>
              <a
                href="/blog"
                className="inline-flex items-center gap-1.5 text-[var(--muted)] no-underline hover:text-[var(--text)]"
              >
                <BookOpen size={12} className="text-[var(--a1)]" />
                Journal
              </a>
              <button
                type="button"
                onClick={onOpenSignIn}
                className="text-left text-[var(--muted)] cursor-pointer hover:text-[var(--text)]"
              >
                Sign in
              </button>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
              Contact
            </p>
            <div className="mt-4 flex flex-col gap-2.5 text-[12.5px]">
              <a
                href="mailto:support@mhomho.work"
                className="inline-flex items-center gap-1.5 text-[var(--muted)] no-underline hover:text-[var(--text)]"
              >
                support@mhomho.work
                <ArrowUpRight size={12} />
              </a>
              <span className="text-[var(--muted)]">Harare, Zimbabwe</span>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--line)]">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-5 py-5 text-[11.5px] text-[var(--faint)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <span>© {new Date().getFullYear()} Mhomho Media. All rights reserved.</span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <a href="#/terms" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
                Terms of Service
              </a>
              <a href="#/privacy" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
                Privacy Policy
              </a>
              <span>Built in Harare, for Africa.</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile app-style persistent action bar. */}
      <div className="glass-nav fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
          <button
            type="button"
            onClick={openCreatorFlow}
            className="press inline-flex h-12 items-center justify-center rounded-full bg-gradient-mhomho text-[12.5px] font-bold text-[var(--ink)] cursor-pointer"
          >
            Get paid to post
          </button>
          <button
            type="button"
            onClick={openBrandFlow}
            className="press glass-panel inline-flex h-12 items-center justify-center rounded-full text-[12.5px] font-semibold text-[var(--text)] cursor-pointer"
          >
            Put my brand on waitlist
          </button>
        </div>
      </div>

      {flow === 'creator' && (
        <CreatorSignupFlow
          onClose={() => setFlow(null)}
          onCreatorApplySuccess={onCreatorApplySuccess}
          onOpenSignIn={onOpenSignIn}
        />
      )}
      {flow === 'brand' && <BrandBriefFlow onClose={() => setFlow(null)} />}
    </div>
  );
};
