import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
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
import { DatabaseState, createEnquiry, registerCreator } from '../../lib/firebase.ts';
import { createSalt, hashPassword } from '../../lib/auth.ts';
import { MhomhoLogo } from '../../components/MhomhoLogo.tsx';

export interface LandingPageProps {
  db: DatabaseState;
  onCreatorApplySuccess: (newUid: string) => void;
  onOpenSignIn: () => void;
}

const WA_NUMBER = '263786205197';

const PLATFORMS = ['TikTok', 'Instagram', 'YouTube', 'Facebook'] as const;
type Platform = (typeof PLATFORMS)[number];

const NICHES = [
  'Tech & gadgets',
  'Health & beauty',
  'Fashion & style',
  'Food & travel',
  'Business & money',
  'Entertainment & events',
  'Gaming',
  'Cars',
  'Real estate & home',
  'Education & careers',
  'Parenting & family',
  'Agriculture',
  'Sports',
  'Faith & motivation',
  'Other',
];

const BUDGETS = ['$100 – $250', '$250 – $500', '$500 – $1,000', '$1,000+', 'Not sure yet'];
const GOALS = ['More people knowing we exist', 'Sales or enquiries', 'Launch something new'];
const START = ['This week', 'In two weeks', 'This month', 'Just exploring'];

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

const FIELD =
  'h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 text-[14px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--faint)] focus:border-[var(--a1)]';
const LABEL = 'mb-1.5 block text-[12px] font-semibold text-[var(--muted)]';
const CHIP =
  'inline-flex h-10 items-center rounded-full border px-4 text-[13px] font-medium transition-colors cursor-pointer';

const whatsappLink = (message: string) =>
  `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;

const SectionHeading: React.FC<{
  eyebrow: string;
  title: React.ReactNode;
  copy?: string;
  className?: string;
}> = ({ eyebrow, title, copy, className = '' }) => (
  <div className={className}>
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
      <span className="h-1 w-1 rounded-full bg-[var(--a1)]" />
      {eyebrow}
    </span>
    <h2 className="font-display mt-5 text-[32px] font-bold leading-[1.02] text-[var(--text)] sm:text-[42px]">
      {title}
    </h2>
    {copy && (
      <p className="mt-4 max-w-[54ch] text-[16px] leading-[1.7] text-[var(--muted)]">{copy}</p>
    )}
  </div>
);

export const LandingPage: React.FC<LandingPageProps> = ({
  db,
  onCreatorApplySuccess,
  onOpenSignIn,
}) => {
  const [navOpen, setNavOpen] = useState(false);
  const [audience, setAudience] = useState<'brands' | 'creators'>('brands');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Creator application
  const [creatorForm, setCreatorForm] = useState({
    name: '',
    email: '',
    handle: '',
    platform: 'TikTok' as Platform,
    followers: '',
    niche: NICHES[0],
    whatsapp: '',
    password: '',
    confirmPassword: '',
    agreed: false,
  });
  const [creatorError, setCreatorError] = useState('');
  const [creatorSubmitting, setCreatorSubmitting] = useState(false);
  const [appliedUid, setAppliedUid] = useState<string | null>(null);

  // Brand enquiry
  const [brandForm, setBrandForm] = useState({
    biz: '',
    name: '',
    phone: '',
    promo: '',
    niche: NICHES[0],
    budget: BUDGETS[1],
    goals: [GOALS[1]] as string[],
    start: START[0],
  });
  const [brandError, setBrandError] = useState('');
  const [brandSent, setBrandSent] = useState(false);

  const closeNav = () => setNavOpen(false);

  const handleCreatorSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreatorError('');

    if (!creatorForm.agreed) {
      setCreatorError('Please confirm you understand Campaign Zero and how creators get paid.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(creatorForm.email.trim())) {
      setCreatorError('Enter a valid email address.');
      return;
    }
    if (creatorForm.password.length < 8) {
      setCreatorError('Use at least 8 characters for your password.');
      return;
    }
    if (creatorForm.password !== creatorForm.confirmPassword) {
      setCreatorError('Those passwords do not match.');
      return;
    }

    setCreatorSubmitting(true);
    try {
      const salt = createSalt();
      const passwordHash = await hashPassword(creatorForm.password, salt);
      const result = registerCreator({
        name: creatorForm.name,
        email: creatorForm.email,
        handle: creatorForm.handle,
        platform: creatorForm.platform,
        niche: creatorForm.niche,
        followers: parseInt(creatorForm.followers, 10) || 0,
        whatsappNumber: creatorForm.whatsapp,
        passwordSalt: salt,
        passwordHash,
      });

      if (!result.success || !result.uid) {
        setCreatorError(result.error || 'Could not create your account. Try again.');
        return;
      }

      setCreatorForm((current) => ({
        ...current,
        password: '',
        confirmPassword: '',
      }));
      setAppliedUid(result.uid);
    } catch {
      setCreatorError('Secure account creation is unavailable. Open the app on localhost or HTTPS.');
    } finally {
      setCreatorSubmitting(false);
    }
  };

  const handleBrandSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setBrandError('');

    if (!brandForm.biz.trim() || !brandForm.name.trim() || !brandForm.phone.trim()) {
      setBrandError('Add your business name, your name and a WhatsApp number.');
      return;
    }
    if (!brandForm.promo.trim()) {
      setBrandError('Tell us what you want to promote.');
      return;
    }

    createEnquiry({
      bizName: brandForm.biz.trim(),
      contactName: brandForm.name.trim(),
      phone: brandForm.phone.trim(),
      niche: brandForm.niche,
      promo: brandForm.promo.trim(),
      goals: brandForm.goals,
      budget: brandForm.budget,
      start: brandForm.start,
      bestTimes: [],
    });

    setBrandSent(true);
  };

  const brandBrief = [
    'Mhomho Media: campaign brief',
    `Business: ${brandForm.biz}`,
    `Promoting: ${brandForm.promo}`,
    `Niche: ${brandForm.niche}`,
    `Goals: ${brandForm.goals.join(', ')}`,
    `Budget: ${brandForm.budget}`,
    `Start: ${brandForm.start}`,
    `Contact: ${brandForm.name} · ${brandForm.phone}`,
  ].join('\n');

  const platforms: { id: 'brands' | 'creators'; label: string }[] = [
    { id: 'brands', label: 'For brands' },
    { id: 'creators', label: 'For creators' },
  ];

  return (
    <div className="min-h-screen bg-[var(--page)] text-[var(--text)]">
      {/* ============================== NAV ============================== */}
      <nav className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--page)]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-5 sm:px-8">
          <a
            href="#top"
            className="flex items-center text-inherit no-underline"
            aria-label="Mhomho Media home"
          >
            <MhomhoLogo className="h-11 w-auto sm:h-[52px]" />
          </a>

          <div className="hidden items-center gap-6 whitespace-nowrap lg:flex">
            <a href="#how" className="text-[13px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]">
              How it works
            </a>
            <a href="#awards" className="text-[13px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]">
              Awards
            </a>
            <a href="#why" className="text-[13px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]">
              Intelligence
            </a>
            <a href="#creators" className="text-[13px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]">
              For creators
            </a>
            <a href="#brands" className="text-[13px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]">
              For brands
            </a>
            <a href="#partners" className="text-[13px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]">
              Partners
            </a>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenSignIn}
              className="hidden h-10 items-center rounded-full px-4 text-[13px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)] sm:inline-flex cursor-pointer"
            >
              Sign in
            </button>
            <a
              href="#creators"
              className="hidden h-10 items-center gap-1.5 rounded-full bg-gradient-mhomho px-5 text-[13px] font-bold text-[var(--ink)] no-underline transition-transform hover:-translate-y-0.5 sm:inline-flex"
            >
              Get paid to post
              <ArrowRight size={15} />
            </a>
            <button
              type="button"
              onClick={() => setNavOpen((open) => !open)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] text-[var(--text)] lg:hidden cursor-pointer"
              aria-label={navOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={navOpen}
            >
              {navOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {navOpen && (
          <div className="border-t border-[var(--line)] bg-[var(--page)] px-5 py-4 lg:hidden">
            <div className="flex flex-col gap-1">
              {[
                ['#how', 'How it works'],
                ['#awards', 'Creator Awards'],
                ['#why', 'Intelligence'],
                ['#creators', 'For creators'],
                ['#brands', 'For brands'],
                ['#partners', 'Partners'],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={closeNav}
                  className="rounded-lg px-2 py-3 text-[14px] font-medium text-[var(--muted)] no-underline hover:bg-[var(--surface)] hover:text-[var(--text)]"
                >
                  {label}
                </a>
              ))}
              <button
                type="button"
                onClick={() => {
                  closeNav();
                  onOpenSignIn();
                }}
                className="rounded-lg px-2 py-3 text-left text-[14px] font-medium text-[var(--muted)] cursor-pointer hover:bg-[var(--surface)] hover:text-[var(--text)]"
              >
                Sign in
              </button>
              <a
                href="#creators"
                onClick={closeNav}
                className="mt-2 flex h-11 items-center justify-center rounded-full bg-gradient-mhomho text-[14px] font-bold text-[var(--ink)] no-underline"
              >
                Get paid to post
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* ============================== TAGLINE ============================== */}
      <div className="border-b border-[var(--line)] bg-[var(--bg)]">
        <p className="mx-auto flex w-full max-w-[1200px] items-center justify-center gap-3 px-5 py-3.5 text-[10.5px] font-semibold uppercase tracking-[0.28em] text-[var(--muted)] sm:gap-4 sm:text-[11.5px] sm:tracking-[0.36em]">
          <span aria-hidden="true" className="h-px w-8 bg-[var(--line-strong)] sm:w-12" />
          <span className="text-center">Too many to ignore.</span>
          <span aria-hidden="true" className="h-px w-8 bg-[var(--line-strong)] sm:w-12" />
        </p>
      </div>

      {/* ============================== HERO ============================== */}
      <header id="top" className="relative overflow-hidden border-b border-[var(--line)]">
        <div className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-[560px]" />
        <div className="grid-lines pointer-events-none absolute inset-0" />

        <div className="relative mx-auto grid w-full max-w-[1200px] gap-14 px-5 pb-20 pt-16 sm:px-8 sm:pb-24 sm:pt-24 lg:grid-cols-[1.03fr_0.97fr] lg:items-center lg:gap-16">
          <div className="min-w-0">
            <span className="rise inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)]/80 px-3 py-1.5 text-[11px] font-semibold text-[var(--muted)] backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--a1)] opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--a1)]" />
              </span>
              Mhomho Media · Zimbabwe
            </span>

            <h1 className="rise rise-1 font-display mt-6 text-[34px] font-bold leading-[0.98] tracking-[-0.04em] sm:text-[60px] lg:text-[56px] xl:text-[66px]">
              Activate
              <br />
              <span className="text-gradient">your crowd.</span>
            </h1>

            <p className="rise rise-2 mt-6 max-w-[52ch] text-[16px] leading-[1.7] text-[var(--muted)] sm:text-[17px]">
              Brands get hundreds of different accounts posting about them. Creators get paid to
              post content. One brief, one crowd, and an outcome you can actually measure — not
              another post you hope works.
            </p>

            <div className="rise rise-3 mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#brands"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-mhomho px-6 text-[14px] font-bold text-[var(--ink)] no-underline transition-transform hover:-translate-y-0.5"
              >
                Start a campaign
                <ArrowRight size={16} />
              </a>
              <a
                href="#creators"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--line-strong)] bg-[var(--surface)]/50 px-6 text-[14px] font-semibold text-[var(--text)] no-underline transition-colors hover:border-[var(--muted)]"
              >
                Get paid to post
              </a>
            </div>

            <div className="rise rise-4 mt-8 flex flex-wrap gap-x-5 gap-y-2.5">
              {['Hundreds of accounts, not one', 'Creators paid from $1 CPM', 'Free funnel on every campaign', 'Verified before billing'].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--muted)]">
                  <Check size={14} className="text-[var(--a1)]" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Creator offer panel */}
          <div className="rise rise-3 relative min-w-0">
            <div className="absolute -inset-5 rounded-[36px] bg-[var(--grad-soft)] opacity-60 blur-3xl" />

            <div className="relative overflow-hidden rounded-[24px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] sm:p-8">
              <div
                className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-20 blur-3xl"
                style={{ background: 'var(--grad)' }}
              />
              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--a1)]/25 bg-[var(--a1)]/8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--a1)]">
                    <Banknote size={12} />
                    For creators
                  </span>
                  <span className="text-[11px] font-medium text-[var(--faint)]">Zimbabwe</span>
                </div>

                <h2 className="font-display mt-6 text-[34px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[40px]">
                  Get paid
                  <br />
                  to post.
                </h2>
                <p className="mt-3 max-w-[38ch] text-[14px] leading-relaxed text-[var(--muted)]">
                  You already make content. Post it for brands, get views, get paid. No follower
                  minimum.
                </p>

                <div className="mt-6 flex items-end gap-2 border-b border-[var(--line)] pb-5">
                  <span className="font-display text-[38px] font-bold leading-none tracking-[-0.03em] text-[var(--text)]">
                    $1.00+
                  </span>
                  <span className="pb-1 text-[12px] font-medium text-[var(--muted)]">
                    / 1,000 verified views
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {[
                    'New accounts welcome',
                    'Campaign Zero unlocks paid campaigns',
                    'EcoCash payouts within 72 hours',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2.5 text-[12.5px] text-[var(--muted)]">
                      <Check size={14} className="shrink-0 text-[var(--a1)]" />
                      {item}
                    </div>
                  ))}
                </div>

                <a
                  href="#creators"
                  className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-mhomho text-[13px] font-bold text-[var(--ink)] no-underline transition-transform hover:-translate-y-0.5"
                >
                  Get paid to post
                  <ArrowRight size={15} />
                </a>
                <p className="mt-3 text-center text-[10.5px] text-[var(--faint)]">
                  Base CPM. Final rate depends on campaign budget.
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ============================== TWO WAYS IN ============================== */}
      <section className="border-b border-[var(--line)] bg-[var(--bg)]">
        <div className="mx-auto grid w-full max-w-[1200px] sm:grid-cols-2">
          <a
            href="#creators"
            className="group flex flex-col justify-between gap-6 border-b border-[var(--line)] px-5 py-7 no-underline sm:border-b-0 sm:border-r sm:px-8 sm:py-8"
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--a1)]">
                For creators
              </p>
              <p className="font-display mt-2 text-[24px] font-bold leading-tight tracking-[-0.02em] text-[var(--text)]">
                Get paid to post content.
              </p>
              <p className="mt-2 max-w-[36ch] text-[13px] leading-relaxed text-[var(--muted)]">
                No follower minimum. Base $1 CPM. EcoCash payouts.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text)]">
              Start earning
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </a>

          <a
            href="#brands"
            className="group flex flex-col justify-between gap-6 px-5 py-7 no-underline sm:px-8 sm:py-8"
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--a1)]">
                For brands
              </p>
              <p className="font-display mt-2 text-[24px] font-bold leading-tight tracking-[-0.02em] text-[var(--text)]">
                Activate a crowd, not a post.
              </p>
              <p className="mt-2 max-w-[36ch] text-[13px] leading-relaxed text-[var(--muted)]">
                Hundreds of accounts. Guaranteed delivery. AI learning.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text)]">
              Start a campaign
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </a>
        </div>
      </section>

      {/* ============================== MISSION ============================== */}
      <section id="mission" className="scroll-mt-20 border-b border-[var(--line)] py-20 sm:py-28">
        <div className="mx-auto grid w-full max-w-[1200px] gap-12 px-5 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:gap-16">
          <div className="lg:sticky lg:top-24">
            <SectionHeading
              eyebrow="The mission"
              title={
                <>
                  Zimbabwe’s
                  <br />
                  distribution network.
                </>
              }
              copy="Our mission is to become the best distribution network in Zimbabwe — the first call for anyone with something to say, sell, launch or grow."
            />
            <p className="font-display mt-6 text-[24px] font-bold leading-tight text-gradient">
              Too many to ignore.
            </p>
            <p className="mt-2 max-w-[40ch] text-[12.5px] leading-relaxed text-[var(--muted)]">
              Not one account. Not one audience. A crowd that keeps showing up in the feeds that
              matter.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                icon: Target,
                title: 'Music & entertainment',
                copy: 'You have a song, a show or a moment. We put it in front of hundreds of audiences until it’s too big to miss.',
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
                className="lift rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6"
              >
                <item.icon size={20} className="text-[var(--a1)]" />
                <h3 className="font-display mt-5 text-[17px] font-bold leading-snug">
                  {item.title}
                </h3>
                <p className="mt-2 text-[13.5px] leading-[1.65] text-[var(--muted)]">
                  {item.copy}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-10 w-full max-w-[1200px] px-5 sm:px-8">
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-6 py-5 sm:flex-row sm:items-center">
            <p className="max-w-[64ch] text-[14px] leading-relaxed text-[var(--muted)]">
              Musician, business, creator or political party — if you need to reach people in
              Zimbabwe, we get you in front of them.
            </p>
            <a
              href="#brands"
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-gradient-mhomho px-5 text-[12.5px] font-bold text-[var(--ink)] no-underline"
            >
              Start a campaign
              <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </section>

      {/* ============================== THE PROBLEM ============================== */}
      <section
        id="problem"
        className="scroll-mt-20 border-b border-[var(--line)] bg-[var(--bg)] py-20 sm:py-28"
      >
        <div className="mx-auto grid w-full max-w-[1200px] gap-12 px-5 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-16">
          <div>
            <SectionHeading
              eyebrow="The problem"
              title={
                <>
                  Spray and pray
                  <br />
                  isn’t a media plan.
                </>
              }
              copy="Most campaigns here still look the same: pay one account a flat fee, post once, and hope. There’s no deliverable to check, no guaranteed reach and no way to know what the money bought."
            />

            <p className="mt-6 max-w-[46ch] text-[13px] leading-relaxed text-[var(--faint)]">
              It isn’t a campaign. It’s a lottery ticket with an invoice.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
            <p className="font-display text-gradient text-[64px] font-bold leading-none tracking-[-0.04em]">
              230+
            </p>
            <p className="mt-3 max-w-[34ch] text-[14px] leading-relaxed text-[var(--muted)]">
              Zimbabwean brands interviewed before we built Mhomho. The pattern was always the
              same.
            </p>

            <div className="mt-7 border-t border-[var(--line)] pt-5">
              <p className="text-[15px] font-semibold text-[var(--text)]">
                One post. One audience. One shot.
              </p>
              <p className="mt-2 max-w-[44ch] text-[13px] leading-relaxed text-[var(--muted)]">
                A flat fee, a screenshot, and no way to know what it moved. We built Mhomho to
                replace that with a crowd, a guarantee and proof.
              </p>
            </div>

            <div className="mt-6 flex items-start gap-2 rounded-xl bg-[var(--surface-2)] px-4 py-3 text-[12px] leading-relaxed text-[var(--muted)]">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[var(--a1)]" />
              Every campaign starts with a guaranteed delivery target and ends with something you
              can check.
            </div>
          </div>
        </div>
      </section>

      {/* ============================== HOW IT WORKS ============================== */}
      <section id="how" className="scroll-mt-20 border-b border-[var(--line)] py-20 sm:py-28">
        <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading
              eyebrow="How it works"
              title={
                <>
                  One brief.
                  <br />
                  Hundreds of voices.
                </>
              }
              copy="Three steps, no platform to learn. Pick the side you’re on."
            />

            <div className="inline-flex w-fit rounded-full border border-[var(--line)] bg-[var(--surface)] p-1">
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

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {(audience === 'brands'
              ? [
                  {
                    icon: FileText,
                    title: 'Brief us once',
                    copy: 'Tell us what you sell, who it’s for and your budget. We turn it into a guaranteed delivery target.',
                  },
                  {
                    icon: Users,
                    title: 'Hundreds of accounts post',
                    copy: 'Your product goes out across hundreds of creators in your niche, in hundreds of different voices, in the same campaign window.',
                  },
                  {
                    icon: Wallet,
                    title: 'Pay for verified delivery',
                    copy: 'Delivery is checked clip by clip. The guaranteed target is tracked in your report, and sub-1,000-view clips aren’t billed.',
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
                    copy: 'We verify you’re real, then unlock campaigns, briefs and your content kit on WhatsApp.',
                  },
                  {
                    icon: Banknote,
                    title: 'Clip and earn',
                    copy: 'Post, submit the link, and earn from a base $1 CPM — $1.00+ per 1,000 verified views, paid to EcoCash.',
                  },
                ]
            ).map((step, index) => (
              <div
                key={step.title}
                className="lift rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-[var(--a1)]">
                    <step.icon size={18} />
                  </span>
                  <span className="font-display text-[12px] font-semibold tracking-[0.2em] text-[var(--faint)]">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="font-display mt-5 text-[18px] font-bold text-[var(--text)]">{step.title}</h3>
                <p className="mt-2 text-[14px] leading-[1.65] text-[var(--muted)]">{step.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== THE CROWD ============================== */}
      <section id="crowd" className="scroll-mt-20 border-b border-[var(--line)] py-20 sm:py-28">
        <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
            <div>
              <SectionHeading
                eyebrow="The crowd"
                title={
                  <>
                    Activate
                    <br />
                    your crowd.
                  </>
                }
                copy="Don’t put everything behind one account. Put your product in the hands of a crowd. One brief, hundreds of creators, hundreds of audiences — all posting in the same campaign window."
              />

              <div className="mt-6 flex flex-wrap gap-2">
                {['Hundreds of creators', 'Hundreds of audiences', 'One product'].map((item) => (
                  <span
                    key={item}
                    className="inline-flex h-8 items-center rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 text-[11.5px] font-semibold text-[var(--muted)]"
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-6 flex items-start gap-2 text-[12px] leading-relaxed text-[var(--muted)]">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[var(--ok)]" />
                Every campaign is planned against a guaranteed delivery target and verified before
                you’re billed.
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-[12px] font-semibold text-[var(--text)]">
                  The crowd behind one campaign
                </p>
                <span className="text-[11px] font-medium text-[var(--faint)]">Hundreds of accounts</span>
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
                          : 'border border-[var(--line)] bg-[var(--surface-2)] text-[var(--faint)]'
                      }`}
                    >
                      <User className="h-[42%] w-[42%]" strokeWidth={active ? 2.4 : 1.6} />
                    </span>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 text-[10.5px] text-[var(--faint)]">
                <span>Different niches</span>
                <span>Different audiences</span>
                <span>Same brief</span>
              </div>
            </div>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Repeat2,
                title: 'Frequency beats one big post',
                copy: 'People rarely buy the first time they see something. Hundreds of clips put your product in front of the same buyer more than once.',
              },
              {
                icon: Users,
                title: 'Every account is a new audience',
                copy: 'You’re not limited to one follower count. You’re entering hundreds of communities at once.',
              },
              {
                icon: MessageCircle,
                title: 'Native beats an ad',
                copy: 'A clip from someone people follow feels like a recommendation, not a sponsored interruption.',
              },
            ].map((reason) => (
              <div
                key={reason.title}
                className="lift rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6"
              >
                <reason.icon size={20} className="text-[var(--a1)]" />
                <h3 className="font-display mt-5 text-[17px] font-bold leading-snug">
                  {reason.title}
                </h3>
                <p className="mt-2 text-[13.5px] leading-[1.65] text-[var(--muted)]">
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
        className="relative scroll-mt-20 overflow-hidden border-b border-[var(--line)] py-20 sm:py-28"
      >
        <div className="hero-glow pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-80" />

        <div className="relative mx-auto w-full max-w-[1200px] px-5 sm:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--a1)]/30 bg-[var(--a1)]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--a1)]">
                <Trophy size={12} />
                Coming soon
              </span>

              <h2 className="font-display mt-5 max-w-[18ch] text-[34px] font-bold leading-[0.98] tracking-[-0.03em] sm:text-[48px]">
                Mhomho Creator <span className="text-gradient">Awards.</span>
              </h2>

              <p className="mt-4 max-w-[58ch] text-[15px] leading-[1.7] text-[var(--muted)]">
                Four trophies for the creators who move the most people. Every campaign month we
                recognise the accounts that cross a verified-view milestone inside a single
                campaign month — from 100,000 to 1,000,000.
              </p>
            </div>

            <div className="shrink-0 border-l-2 border-[var(--a1)]/40 pl-5">
              <p className="font-display text-gradient text-[22px] font-bold leading-tight">
                Your reach.
                <br />
                Your legacy.
              </p>
              <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--faint)]">
                The Mhomho standard
              </p>
            </div>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {AWARDS.map((award) => (
              <article
                key={award.tier}
                className="group relative flex overflow-hidden rounded-2xl border border-[var(--line)] bg-[#060504] transition-[transform,border-color,box-shadow] duration-300 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-soft)] sm:block sm:hover:-translate-y-1"
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
                    <p className="font-display text-[22px] font-bold leading-none tracking-[-0.02em] text-[var(--text)] sm:text-[24px]">
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

          <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-5 py-4 sm:flex-row sm:items-center">
            <p className="max-w-[64ch] text-[12.5px] leading-relaxed text-[var(--muted)]">
              Awards launch with the next full campaign month. Only verified views count — bought
              views never will. Trophies are awarded per tier and recorded on your creator profile.
            </p>
            <a
              href="#creators"
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-[var(--line-strong)] px-4 text-[12px] font-semibold text-[var(--text)] no-underline transition-colors hover:border-[var(--muted)]"
            >
              Apply as a creator
              <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </section>

      {/* ============================== INTELLIGENCE ============================== */}
      <section id="why" className="scroll-mt-20 border-b border-[var(--line)] bg-[var(--bg)] py-20 sm:py-28">
        <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-start lg:gap-16">
            <div>
              <SectionHeading
                eyebrow="The intelligence"
                title={
                  <>
                    We read the comments.
                    <br />
                    Not just the views.
                  </>
                }
                copy="Views tell you what was seen. Comments tell you what Zimbabwe actually felt. Our AI analyzes sentiment across the comment sections of hundreds of posts in every campaign — to understand internet trends, interests, objections and buying signals."
              />
              <p className="mt-6 max-w-[46ch] text-[13px] leading-relaxed text-[var(--faint)]">
                Every campaign teaches the next one. That is how we learn what Zimbabwe wants
                before it becomes obvious.
              </p>
            </div>

            <div className="grid gap-px overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2">
              {[
                {
                  icon: MessageCircle,
                  title: 'Zimbabwean sentiment',
                  copy: 'Trained on how people here actually talk — not imported trend data.',
                },
                {
                  icon: Repeat2,
                  title: 'Every comment, not a sample',
                  copy: 'We analyze the comment sections of each post in the campaign, at scale.',
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
                <div key={item.title} className="bg-[var(--surface)] p-6">
                  <item.icon size={19} className="text-[var(--a1)]" />
                  <h3 className="font-display mt-4 text-[16px] font-bold leading-snug">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-[1.65] text-[var(--muted)]">
                    {item.copy}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex items-start gap-2.5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-5 py-4 text-[13px] leading-relaxed text-[var(--muted)]">
            <Sparkles size={15} className="mt-0.5 shrink-0 text-[var(--a1)]" />
            The result is not a report full of numbers. It is a sharper read on what to say next.
          </div>
        </div>
      </section>

      {/* ============================== CREATORS ============================== */}
      <section id="creators" className="scroll-mt-20 border-b border-[var(--line)] py-20 sm:py-28">
        <div className="mx-auto grid w-full max-w-[1200px] gap-12 px-5 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
          <div className="lg:self-start">
            <SectionHeading
              eyebrow="For creators"
              title={
                <>
                  Get paid
                  <br />
                  to post content.
                </>
              }
              copy="You already make content. Mhomho pays you to post it for brands. No follower minimum, no gatekeeping. A new account with one clip at 1,000 views earns the same base $1 CPM as a page with 100,000 followers."
            />

            <div className="mt-7 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
                    Creator CPM · base rate
                  </p>
                  <p className="font-display mt-1 text-[40px] font-bold leading-none tracking-[-0.03em]">
                    $1.00+
                    <span className="ml-1.5 text-[13px] font-medium tracking-normal text-[var(--muted)]">
                      / 1,000 verified views
                    </span>
                  </p>
                </div>
                <Banknote size={22} className="mb-1.5 shrink-0 text-[var(--a1)]" />
              </div>
              <div className="mt-4 border-t border-[var(--line)] pt-4">
                <p className="text-[12.5px] leading-relaxed text-[var(--muted)]">
                  Base rate for 1,000 verified views. Final CPM depends on the campaign budget.
                  Payouts go to EcoCash within 72 hours of a campaign closing.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[var(--a1)]">
                    Campaign Zero
                  </p>
                  <p className="mt-1 text-[15px] font-bold text-[var(--text)]">
                    Unlock your dashboard.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--warn)]/12 px-2.5 py-1 text-[9.5px] font-bold text-[var(--warn)]">
                  Required
                </span>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted)]">
                The final step before approval. Prove you can make a clip people watch.
              </p>
              <ol className="mt-3 space-y-2.5">
                {[
                  'Follow any Mhomho social page',
                  'Post at least 3 clips featuring Mhomho',
                  'Get 1,000+ views on one of those clips',
                ].map((item, index) => (
                  <li key={item} className="flex items-start gap-2.5 text-[12px] leading-relaxed text-[var(--muted)]">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[9.5px] font-bold text-[var(--text)]">
                      {index + 1}
                    </span>
                    {item}
                  </li>
                ))}
              </ol>
              <p className="mt-3 border-t border-[var(--line)] pt-3 text-[11px] leading-relaxed text-[var(--faint)]">
                Complete it inside your account after sign-up. An admin verifies your views before
                the dashboard unlocks.
              </p>
            </div>

            <p className="mt-5 text-[12.5px] leading-relaxed text-[var(--muted)]">
              Any account size. A clip qualifies at 1,000 views. No bought views.
            </p>

            <p className="mt-6 text-[12px] text-[var(--faint)]">
              After Campaign Zero is complete, applications are reviewed within 48 hours.
            </p>
          </div>

          <div>
            {appliedUid ? (
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--ok)]/12 text-[var(--ok)]">
                  <CheckCircle2 size={24} />
                </span>
                <h3 className="font-display mt-5 text-[26px] font-bold leading-tight">
                  Account created.
                  <br />
                  Campaign Zero starts now.
                </h3>
                <p className="mt-2 max-w-[46ch] text-[14px] leading-[1.7] text-[var(--muted)]">
                  You’re signed in as{' '}
                  <span className="font-semibold text-[var(--text)]">
                    @{creatorForm.handle.replace(/^@+/, '')}
                  </span>{' '}
                  on {creatorForm.platform}. Your dashboard is locked until you follow a Mhomho
                  page, post 3 clips and get 1,000+ views on one of them.
                </p>

                <div className="mt-6 space-y-0 rounded-xl border border-[var(--line)]">
                  {[
                    ['Account created', 'Just now', true],
                    ['Campaign Zero', 'Next step', false],
                    ['Dashboard unlocked', 'After approval', false],
                  ].map(([label, meta, done], index) => (
                    <div
                      key={String(label)}
                      className={`flex items-center gap-3 px-4 py-3.5 ${
                        index !== 2 ? 'border-b border-[var(--line)]' : ''
                      }`}
                    >
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                          done
                            ? 'bg-[var(--ok)]/15 text-[var(--ok)]'
                            : 'border border-[var(--line)] text-[var(--faint)]'
                        }`}
                      >
                        {done ? <Check size={12} /> : index + 1}
                      </span>
                      <span className="flex-1 text-[13px] font-medium text-[var(--text)]">{label}</span>
                      <span className="text-[11.5px] text-[var(--faint)]">{meta}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => onCreatorApplySuccess(appliedUid)}
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-mhomho text-[13.5px] font-bold text-[var(--ink)] transition-transform hover:-translate-y-0.5 cursor-pointer"
                  >
                    Start Campaign Zero
                    <ArrowRight size={15} />
                  </button>
                  <a
                    href={whatsappLink(
                      `Hi Mhomho, I just applied as a creator. My handle is @${creatorForm.handle.replace(/^@+/, '')}.`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--line-strong)] text-[13.5px] font-semibold text-[var(--text)] no-underline hover:border-[var(--muted)]"
                  >
                    <MessageCircle size={15} />
                    Message onboarding
                  </a>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleCreatorSubmit}
                className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-[22px] font-bold">Create your account</h3>
                    <p className="mt-1 text-[13px] text-[var(--muted)]">
                      Takes two minutes. Campaign Zero starts after sign-up.
                    </p>
                  </div>
                  <span className="hidden shrink-0 rounded-full border border-[var(--line)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)] sm:inline-flex">
                    Free
                  </span>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={LABEL} htmlFor="creator-name">
                      Full name
                    </label>
                    <input
                      id="creator-name"
                      value={creatorForm.name}
                      onChange={(e) => setCreatorForm({ ...creatorForm, name: e.target.value })}
                      className={FIELD}
                      placeholder="Tendai Moyo"
                      autoComplete="name"
                      required
                    />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="creator-email">
                      Email
                    </label>
                    <input
                      id="creator-email"
                      type="email"
                      value={creatorForm.email}
                      onChange={(e) => setCreatorForm({ ...creatorForm, email: e.target.value })}
                      className={FIELD}
                      placeholder="you@email.com"
                      autoComplete="email"
                      spellCheck={false}
                      required
                    />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="creator-handle">
                      Handle
                    </label>
                    <input
                      id="creator-handle"
                      value={creatorForm.handle}
                      onChange={(e) => setCreatorForm({ ...creatorForm, handle: e.target.value })}
                      className={FIELD}
                      placeholder="@yourhandle"
                      required
                    />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="creator-platform">
                      Main platform
                    </label>
                    <select
                      id="creator-platform"
                      value={creatorForm.platform}
                      onChange={(e) =>
                        setCreatorForm({ ...creatorForm, platform: e.target.value as Platform })
                      }
                      className={FIELD}
                    >
                      {PLATFORMS.map((platform) => (
                        <option key={platform} value={platform}>
                          {platform}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="creator-followers">
                      Followers (optional)
                    </label>
                    <input
                      id="creator-followers"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={creatorForm.followers}
                      onChange={(e) => setCreatorForm({ ...creatorForm, followers: e.target.value })}
                      className={FIELD}
                      placeholder="0 if brand new"
                    />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="creator-niche">
                      Your niche
                    </label>
                    <select
                      id="creator-niche"
                      value={creatorForm.niche}
                      onChange={(e) => setCreatorForm({ ...creatorForm, niche: e.target.value })}
                      className={FIELD}
                    >
                      {NICHES.map((niche) => (
                        <option key={niche} value={niche}>
                          {niche}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="creator-whatsapp">
                      WhatsApp number
                    </label>
                    <input
                      id="creator-whatsapp"
                      type="tel"
                      value={creatorForm.whatsapp}
                      onChange={(e) => setCreatorForm({ ...creatorForm, whatsapp: e.target.value })}
                      className={FIELD}
                      placeholder="+263 77 000 0000"
                      autoComplete="tel"
                      required
                    />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="creator-password">
                      Password
                    </label>
                    <input
                      id="creator-password"
                      type="password"
                      value={creatorForm.password}
                      onChange={(e) => setCreatorForm({ ...creatorForm, password: e.target.value })}
                      className={FIELD}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="creator-confirm-password">
                      Confirm password
                    </label>
                    <input
                      id="creator-confirm-password"
                      type="password"
                      value={creatorForm.confirmPassword}
                      onChange={(e) =>
                        setCreatorForm({ ...creatorForm, confirmPassword: e.target.value })
                      }
                      className={FIELD}
                      placeholder="Repeat password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                  </div>
                </div>

                <label className="mt-5 flex cursor-pointer items-start gap-3 text-[12.5px] leading-[1.55] text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={creatorForm.agreed}
                    onChange={(e) => setCreatorForm({ ...creatorForm, agreed: e.target.checked })}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--a1)]"
                  />
                  <span>
                    I’ll complete Campaign Zero (follow a Mhomho page, post 3 clips, one at 1,000+
                    views) and keep clips live for 30 days. I understand I’m paid $1.00 per 1,000
                    verified views after approval.
                  </span>
                </label>

                {creatorError && (
                  <p className="mt-4 rounded-lg border border-[var(--err)]/30 bg-[var(--err)]/10 px-3 py-2.5 text-[12.5px] font-medium text-[var(--err)]">
                    {creatorError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={creatorSubmitting}
                  className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-mhomho text-[14px] font-bold text-[var(--ink)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 cursor-pointer"
                >
                  {creatorSubmitting ? 'Creating account…' : 'Create account & start Campaign Zero'}
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
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ============================== BRANDS ============================== */}
      <section id="brands" className="scroll-mt-20 border-b border-[var(--line)] bg-[var(--bg)] py-20 sm:py-28">
        <div className="mx-auto grid w-full max-w-[1200px] gap-12 px-5 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <SectionHeading
              eyebrow="For brands"
              title={
                <>
                  Stop betting
                  <br />
                  on one account.
                </>
              }
              copy="Tell us what you sell and who it’s for. We turn your budget into a guaranteed delivery plan, put your product in front of hundreds of creator audiences, and only bill for delivery verified as real."
            />

            <div className="mt-7 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--a1)]">
                  Included free
                </p>
                <span className="rounded-full bg-[var(--ok)]/10 px-2.5 py-1 text-[10px] font-semibold text-[var(--ok)]">
                  With every campaign
                </span>
              </div>

              <h3 className="font-display mt-4 text-[24px] font-bold leading-tight tracking-[-0.02em]">
                No funnel?
                <br />
                We’ll build one.
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">
                Run a campaign with Mhomho and get a conversion-ready sales funnel built at no
                extra cost. Traffic without a next step is just noise.
              </p>

              <div className="mt-5 space-y-3 border-t border-[var(--line)] pt-4">
                {[
                  'Landing page and offer',
                  'Tracking and follow-up',
                  'Shaped by campaign comments',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2.5 text-[12.5px] text-[var(--muted)]">
                    <Check size={14} className="shrink-0 text-[var(--a1)]" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

          </div>

          <div>
            {brandSent ? (
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--ok)]/12 text-[var(--ok)]">
                  <CheckCircle2 size={24} />
                </span>
                <h3 className="font-display mt-5 text-[26px] font-bold leading-tight">
                  Brief received.
                </h3>
                <p className="mt-2 max-w-[44ch] text-[14px] leading-[1.7] text-[var(--muted)]">
                  Thanks {brandForm.name.split(' ')[0] || 'there'} — we’ll come back with a creator
                  plan for {brandForm.biz} and a guaranteed delivery target. Usually within one working
                  day.
                </p>

                <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4">
                  <dl className="space-y-2 text-[12.5px]">
                    {[
                      ['Promoting', brandForm.promo],
                      ['Niche', brandForm.niche],
                      ['Budget', brandForm.budget],
                      ['Start', brandForm.start],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-6">
                        <dt className="shrink-0 text-[var(--faint)]">{label}</dt>
                        <dd className="m-0 text-right font-medium text-[var(--text)]">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                  <a
                    href={whatsappLink(`Hi Mhomho, here’s my campaign brief.\n\n${brandBrief}`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-mhomho text-[13.5px] font-bold text-[var(--ink)] no-underline transition-transform hover:-translate-y-0.5"
                  >
                    <MessageCircle size={15} />
                    Book a call on WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={() => setBrandSent(false)}
                    className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-[var(--line-strong)] text-[13.5px] font-semibold text-[var(--text)] cursor-pointer hover:border-[var(--muted)]"
                  >
                    Send another brief
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleBrandSubmit}
                className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 sm:p-8"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-[22px] font-bold">Start a campaign</h3>
                    <p className="mt-1 text-[13px] text-[var(--muted)]">
                      No sign-up. We reply with a plan and a guaranteed delivery target.
                    </p>
                  </div>
                  <span className="hidden shrink-0 rounded-full border border-[var(--line)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)] sm:inline-flex">
                    1 min
                  </span>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={LABEL} htmlFor="brand-biz">
                      Business name
                    </label>
                    <input
                      id="brand-biz"
                      value={brandForm.biz}
                      onChange={(e) => setBrandForm({ ...brandForm, biz: e.target.value })}
                      className={FIELD}
                      placeholder="Glow Beauty Labs"
                      required
                    />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="brand-name">
                      Your name
                    </label>
                    <input
                      id="brand-name"
                      value={brandForm.name}
                      onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
                      className={FIELD}
                      placeholder="Rudo Chikafu"
                      required
                    />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="brand-phone">
                      WhatsApp number
                    </label>
                    <input
                      id="brand-phone"
                      type="tel"
                      value={brandForm.phone}
                      onChange={(e) => setBrandForm({ ...brandForm, phone: e.target.value })}
                      className={FIELD}
                      placeholder="+263 77 000 0000"
                      required
                    />
                  </div>
                  <div>
                    <label className={LABEL} htmlFor="brand-niche">
                      Industry
                    </label>
                    <select
                      id="brand-niche"
                      value={brandForm.niche}
                      onChange={(e) => setBrandForm({ ...brandForm, niche: e.target.value })}
                      className={FIELD}
                    >
                      {NICHES.map((niche) => (
                        <option key={niche} value={niche}>
                          {niche}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4">
                  <label className={LABEL} htmlFor="brand-promo">
                    What are you promoting?
                  </label>
                  <textarea
                    id="brand-promo"
                    value={brandForm.promo}
                    onChange={(e) => setBrandForm({ ...brandForm, promo: e.target.value })}
                    className="min-h-[96px] w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3.5 text-[14px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--faint)] focus:border-[var(--a1)]"
                    placeholder="A new skincare line, a data bundle, a weekend event…"
                    required
                  />
                </div>

                <div className="mt-5">
                  <p className={LABEL}>Budget</p>
                  <div className="flex flex-wrap gap-2">
                    {BUDGETS.map((budget) => {
                      const selected = brandForm.budget === budget;
                      return (
                        <button
                          key={budget}
                          type="button"
                          onClick={() => setBrandForm({ ...brandForm, budget })}
                          className={`${CHIP} ${
                            selected
                              ? 'border-transparent bg-[var(--text)] text-[var(--page)]'
                              : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--text)]'
                          }`}
                        >
                          {budget}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5">
                  <p className={LABEL}>What would make this a win?</p>
                  <div className="flex flex-wrap gap-2">
                    {GOALS.map((goal) => {
                      const selected = brandForm.goals.includes(goal);
                      return (
                        <button
                          key={goal}
                          type="button"
                          onClick={() =>
                            setBrandForm({
                              ...brandForm,
                              goals: selected
                                ? brandForm.goals.filter((item) => item !== goal)
                                : [...brandForm.goals, goal],
                            })
                          }
                          className={`${CHIP} ${
                            selected
                              ? 'border-[var(--a1)]/40 bg-[var(--a1)]/10 text-[var(--text)]'
                              : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--text)]'
                          }`}
                        >
                          {selected && <Check size={13} className="mr-1.5 text-[var(--a1)]" />}
                          {goal}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5">
                  <p className={LABEL}>When do you want to start?</p>
                  <div className="flex flex-wrap gap-2">
                    {START.map((start) => (
                      <button
                        key={start}
                        type="button"
                        onClick={() => setBrandForm({ ...brandForm, start })}
                        className={`${CHIP} ${
                          brandForm.start === start
                            ? 'border-transparent bg-[var(--text)] text-[var(--page)]'
                            : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--text)]'
                        }`}
                      >
                        {start}
                      </button>
                    ))}
                  </div>
                </div>

                {brandError && (
                  <p className="mt-4 rounded-lg border border-[var(--err)]/30 bg-[var(--err)]/10 px-3 py-2.5 text-[12.5px] font-medium text-[var(--err)]">
                    {brandError}
                  </p>
                )}

                <button
                  type="submit"
                  className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-mhomho text-[14px] font-bold text-[var(--ink)] transition-transform hover:-translate-y-0.5 cursor-pointer"
                >
                  Get my campaign plan
                  <ArrowRight size={16} />
                </button>

                <p className="mt-3 text-center text-[11.5px] text-[var(--faint)]">
                  Prefer to talk first?{' '}
                  <a
                    href={whatsappLink('Hi Mhomho, I’d like to talk about a campaign.')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[var(--muted)] underline underline-offset-2 hover:text-[var(--text)]"
                  >
                    WhatsApp the team
                  </a>
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ============================== PARTNERS ============================== */}
      <section id="partners" className="scroll-mt-20 border-b border-[var(--line)] py-14 sm:py-16">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-start justify-between gap-7 px-5 sm:px-8 lg:flex-row lg:items-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--a1)]">
              Partners
            </p>
            <h2 className="font-display mt-2 text-[28px] font-bold leading-tight tracking-[-0.02em] sm:text-[32px]">
              Bring your clients into the crowd.
            </h2>
            <p className="mt-2 max-w-[62ch] text-[13.5px] leading-relaxed text-[var(--muted)]">
              Agencies, managers, media houses and venues — partner with Mhomho to give your
              clients distribution at scale.
            </p>
          </div>
          <a
            href={whatsappLink('Hi Mhomho, I’d like to partner with you.')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-mhomho px-6 text-[13.5px] font-bold text-[var(--ink)] no-underline transition-transform hover:-translate-y-0.5"
          >
            Partner with us
            <ArrowRight size={15} />
          </a>
        </div>
      </section>

      {/* ============================== FAQ ============================== */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <SectionHeading
            eyebrow="Questions"
            title={
              <>
                The short
                <br />
                answers.
              </>
            }
            copy="Still unsure? Message us on WhatsApp and a human will reply."
          />

          <div className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {[
              {
                q: 'What is Campaign Zero?',
                a: 'Campaign Zero is the entry challenge for new creators. Follow a Mhomho social page, post at least 3 clips featuring Mhomho, and get 1,000+ views on one clip. Submit the links in your account and an admin verifies the views before unlocking the dashboard.',
              },
              {
                q: 'Is delivery really guaranteed?',
                a: 'Yes. Every campaign is planned against a guaranteed delivery target based on your budget. You are buying the outcome of hundreds of accounts posting about you — not a single post and a hope. Delivery is tracked and you only pay for verified delivery.',
              },
              {
                q: 'What does the AI actually analyze?',
                a: 'We analyze sentiment across the comment sections of hundreds of posts in each campaign — not just the view count. That helps us understand internet trends in Zimbabwe, what people are interested in, what they doubt, and what they want to see next.',
              },
              {
                q: 'Do I need a sales funnel?',
                a: 'No. If you run a campaign with Mhomho and don’t have one, we’ll build a conversion-ready funnel for free — landing page, offer, tracking and follow-up.',
              },
              {
                q: 'How many creators will post my product?',
                a: 'Hundreds of accounts per campaign, matched to your niche. Depending on budget and category it can be hundreds or even thousands of clips. The goal is always the same: put your product in front of as many different audiences as possible.',
              },
              {
                q: 'How is the creator CPM decided?',
                a: 'The base creator rate is $1 per 1,000 verified views. Final CPM can depend on the campaign budget — larger or more complex campaigns can support a higher rate. The exact CPM is agreed before the campaign starts.',
              },
              {
                q: 'When do creators get paid?',
                a: 'EcoCash payouts go out 72 hours after a campaign closes, once the clip has stayed live for the required 30 days. The minimum balance is $5.',
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
      <section className="px-5 pb-20 sm:px-8">
        <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[26px] border border-[var(--line)] bg-[var(--surface)] px-6 py-12 sm:px-12 sm:py-16">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-[360px] w-[360px] rounded-full opacity-40 blur-3xl"
            style={{ background: 'var(--grad)' }}
          />
          <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div>
              <h2 className="font-display max-w-[20ch] text-[30px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[40px]">
                Activate your crowd.
              </h2>
              <p className="mt-3 max-w-[52ch] text-[14.5px] leading-relaxed text-[var(--muted)]">
                Brands get a crowd. Creators get paid. One brief puts your product in front of
                hundreds of different audiences — guaranteed delivery, creators paid from a base
                $1 CPM, and a free funnel if you need one.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <a
                href="#brands"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-mhomho px-6 text-[13.5px] font-bold text-[var(--ink)] no-underline"
              >
                Start a campaign
                <ArrowRight size={15} />
              </a>
              <a
                href="#creators"
                className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--line-strong)] px-6 text-[13.5px] font-semibold text-[var(--text)] no-underline hover:border-[var(--muted)]"
              >
                Get paid to post
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== FOOTER ============================== */}
      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <MhomhoLogo className="h-14 w-auto" />
            <p className="mt-4 max-w-[36ch] text-[12.5px] leading-relaxed text-[var(--muted)]">
              Activate your crowd. Too many to ignore. Hundreds of creator accounts posting about
              your product, creator payouts from a base $1 CPM, and AI that learns from every
              campaign.
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
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
              <a href="#crowd" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
                Activate your crowd
              </a>
              <a href="#awards" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
                Creator Awards
              </a>
              <a href="#why" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
                Intelligence
              </a>
              <a href="#creators" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
                Creator applications
              </a>
              <a href="#partners" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
                Partner with us
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
              Contact
            </p>
            <div className="mt-4 flex flex-col gap-2.5 text-[12.5px]">
              <a
                href={whatsappLink('Hi Mhomho, I’d like to know more.')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[var(--muted)] no-underline hover:text-[var(--text)]"
              >
                WhatsApp +263 78 620 5197
                <ArrowUpRight size={12} />
              </a>
              <span className="text-[var(--muted)]">Harare, Zimbabwe</span>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--line)]">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 px-5 py-5 text-[11.5px] text-[var(--faint)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <span>© {new Date().getFullYear()} Mhomho Media. All rights reserved.</span>
            <span>Built in Harare, for Zimbabwe.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
