import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Mail,
  X,
} from 'lucide-react';
import { createEnquiry, fetchSignupConfig, registerCreator } from '../../lib/api.ts';

const SUPPORT_EMAIL = 'support@mhomho.work';

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

const FIELD =
  'h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 text-[14px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--faint)] focus:border-[var(--a1)]';
const LABEL = 'mb-1.5 block text-[12px] font-semibold text-[var(--muted)]';
const CHIP =
  'inline-flex h-10 items-center rounded-full border px-4 text-[13px] font-medium transition-colors cursor-pointer';

const contactLink = (message: string, subject = 'Mhomho enquiry') =>
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;

interface FlowShellProps {
  eyebrow: string;
  title: string;
  stepLabel?: string;
  onBack?: () => void;
  onClose: () => void;
  manageHistory?: boolean;
  footer: React.ReactNode;
  children: React.ReactNode;
}

const FlowShell: React.FC<FlowShellProps> = ({
  eyebrow,
  title,
  stepLabel,
  onBack,
  onClose,
  manageHistory = true,
  footer,
  children,
}) => {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKeyDown);

    const onPopState = () => {
      if (!window.history.state?.mhomhoFlow) closeRef.current();
    };
    if (manageHistory) {
      window.history.pushState({ ...(window.history.state || {}), mhomhoFlow: true }, '');
      window.addEventListener('popstate', onPopState);
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('popstate', onPopState);
      if (manageHistory && window.history.state?.mhomhoFlow) window.history.back();
    };
  }, [manageHistory]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--page)] sm:h-[min(92dvh,880px)] sm:max-w-3xl sm:rounded-[28px] sm:border sm:border-[var(--line)] sm:shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="safe-top border-b border-[var(--line)] px-5 pb-4 pt-3 sm:px-8 sm:pt-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-2.5">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  aria-label="Back"
                  className="press mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--line)] text-[var(--muted)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--text)]"
                >
                  <ArrowLeft size={17} />
                </button>
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--a1)]">
                  {eyebrow}
                </p>
                <h2 className="font-display mt-1 truncate text-[21px] font-bold tracking-[-0.02em] text-[var(--text)]">
                  {title}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="press grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--line)] text-[var(--muted)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--text)]"
            >
              <X size={18} />
            </button>
          </div>
          {stepLabel && (
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
              {stepLabel}
            </p>
          )}
        </header>

        <div className="app-scroll flex-1 overflow-y-auto overscroll-contain px-5 pb-8 pt-5 sm:px-8">
          {children}
        </div>

        <footer className="border-t border-[var(--line)] bg-[var(--page)]/95 px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:px-8 sm:pb-5">
          {footer}
        </footer>
      </div>
    </div>
  );
};

interface CreatorSignupFlowProps {
  onClose: () => void;
  onCreatorApplySuccess: (newUid: string) => void;
  onOpenSignIn: () => void;
  manageHistory?: boolean;
}

export const CreatorSignupFlow: React.FC<CreatorSignupFlowProps> = ({
  onClose,
  onCreatorApplySuccess,
  onOpenSignIn,
  manageHistory = true,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    name: '',
    email: '',
    handle: '',
    platform: 'TikTok' as Platform,
    followers: '',
    niche: NICHES[0],
    whatsapp: '',
    password: '',
    confirmPassword: '',
    inviteCode: '',
    agreed: false,
  });
  const [inviteRequired, setInviteRequired] = useState(false);
  const [inviteThreshold, setInviteThreshold] = useState(3000);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSignupConfig()
      .then((result) => {
        if (cancelled || !result.success || !result.data) return;
        setInviteRequired(result.data.inviteRequired);
        setInviteThreshold(result.data.threshold);
      })
      .catch(() => {
        // The server is the authority: if the gate is on, registration still
        // fails safely without this hint.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = Boolean(
    form.name ||
      form.email ||
      form.handle ||
      form.followers ||
      form.whatsapp ||
      form.password ||
      form.confirmPassword ||
      form.inviteCode ||
      form.agreed ||
      form.platform !== 'TikTok' ||
      form.niche !== NICHES[0]
  );

  const requestClose = () => {
    if (dirty && !window.confirm('Discard your progress?')) return;
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (step === 1) {
      if (inviteRequired && !form.inviteCode.trim()) {
        setError('Enter your invite code to continue.');
        return;
      }
      if (!form.name.trim() || !form.email.trim() || !form.handle.trim()) {
        setError('Add your name, email and handle to continue.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        setError('Enter a valid email address.');
        return;
      }
      setStep(2);
      return;
    }

    if (!form.agreed) {
      setError('Please confirm you understand Campaign Zero and how creators get paid.');
      return;
    }
    if (!form.whatsapp.trim()) {
      setError('Add your WhatsApp number.');
      return;
    }
    if (form.password.length < 12) {
      setError('Use at least 12 characters for your password.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Those passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await registerCreator({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        handle: form.handle,
        platform: form.platform,
        niche: form.niche,
        followers: parseInt(form.followers, 10) || 0,
        whatsappNumber: form.whatsapp,
        password: form.password,
        inviteCode: form.inviteCode.trim() || undefined,
      });

      if (!result.success) {
        setError(result.error || 'Could not create your account. Try again.');
        return;
      }

      if (result.data?.uid) {
        onClose();
        onCreatorApplySuccess(result.data.uid);
      } else {
        setError('Account created, but we could not sign you in. Try signing in.');
      }
    } catch {
      setError('Secure account creation is unavailable. Open the app on localhost or HTTPS.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FlowShell
      eyebrow="For creators"
      title={step === 1 ? 'Join Mhomho' : 'Secure your account'}
      stepLabel={`Step ${step} of 2`}
      onBack={
        step === 2
          ? () => {
              setStep(1);
              setError('');
            }
          : undefined
      }
      onClose={requestClose}
      manageHistory={manageHistory}
      footer={
        <div>
          <button
            form="creator-signup-form"
            type="submit"
            disabled={submitting}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-mhomho text-[14px] font-bold text-[var(--ink)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {step === 1 ? 'Continue' : submitting ? 'Creating account…' : 'Create account'}
            <ArrowRight size={16} />
          </button>
          <p className="mt-3 text-center text-[11.5px] text-[var(--faint)]">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => {
                onOpenSignIn();
              }}
              className="font-semibold text-[var(--muted)] underline underline-offset-2 hover:text-[var(--text)]"
            >
              Sign in
            </button>
          </p>
        </div>
      }
    >
      <form id="creator-signup-form" onSubmit={handleSubmit}>
        {step === 1 ? (
          <div>
            {inviteRequired && (
              <div className="mb-5 rounded-xl border border-[var(--a1)]/30 bg-[var(--a1)]/10 p-3.5">
                <p className="text-[12.5px] font-semibold text-[var(--text)]">
                  Mhomho is invite-only right now
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--muted)]">
                  We keep the roster close while we grow to{' '}
                  {inviteThreshold.toLocaleString()} creators. Enter your invite code below, or
                  email{' '}
                  <a
                    href={contactLink(
                      'Hi Mhomho, I would like to request an invite code to join as a creator.'
                    )}
                    className="font-semibold text-[var(--text)] underline underline-offset-2 hover:text-[var(--a1)]"
                  >
                    {SUPPORT_EMAIL}
                  </a>{' '}
                  to request one.
                </p>
                <label className={`${LABEL} mt-3`} htmlFor="creator-invite">
                  Invite code
                </label>
                <input
                  id="creator-invite"
                  value={form.inviteCode}
                  onChange={(event) => setForm({ ...form, inviteCode: event.target.value })}
                  className={FIELD}
                  placeholder="MHOM-XXXX-XXXX-XXXX"
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
              </div>
            )}

            <p className="text-[13.5px] leading-relaxed text-[var(--muted)]">
              Takes two minutes. Campaign Zero starts after sign-up.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="creator-name">
                  Full name
                </label>
                <input
                  id="creator-name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
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
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
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
                  value={form.handle}
                  onChange={(event) => setForm({ ...form, handle: event.target.value })}
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
                  value={form.platform}
                  onChange={(event) =>
                    setForm({ ...form, platform: event.target.value as Platform })
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
                  value={form.followers}
                  onChange={(event) => setForm({ ...form, followers: event.target.value })}
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
                  value={form.niche}
                  onChange={(event) => setForm({ ...form, niche: event.target.value })}
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
          </div>
        ) : (
          <div>
            <p className="text-[13.5px] leading-relaxed text-[var(--muted)]">
              You’re joining as{' '}
              <span className="font-semibold text-[var(--text)]">
                @{form.handle.replace(/^@+/, '')}
              </span>{' '}
              on {form.platform}.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={LABEL} htmlFor="creator-whatsapp">
                  WhatsApp number
                </label>
                <input
                  id="creator-whatsapp"
                  type="tel"
                  value={form.whatsapp}
                  onChange={(event) => setForm({ ...form, whatsapp: event.target.value })}
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
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  className={FIELD}
                  placeholder="At least 12 characters"
                  autoComplete="new-password"
                  minLength={12}
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
                  value={form.confirmPassword}
                  onChange={(event) =>
                    setForm({ ...form, confirmPassword: event.target.value })
                  }
                  className={FIELD}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                />
              </div>
            </div>

            <label className="mt-5 flex cursor-pointer items-start gap-3 text-[12.5px] leading-[1.55] text-[var(--muted)]">
              <input
                type="checkbox"
                checked={form.agreed}
                onChange={(event) => setForm({ ...form, agreed: event.target.checked })}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--a1)]"
              />
              <span>
                I’ll complete Campaign Zero (follow a Mhomho page, post at least 1 clip, one at
                500+ views) and keep clips live for 30 days. I understand paid campaigns require
                1,000+ verified views per clip and pay $1.00 per 1,000 verified views. I agree to the{' '}
                <a
                  href="#/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[var(--text)] underline underline-offset-2 hover:text-[var(--a1)]"
                >
                  Terms of Service
                </a>{' '}
                and{' '}
                <a
                  href="#/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[var(--text)] underline underline-offset-2 hover:text-[var(--a1)]"
                >
                  Privacy Policy
                </a>
                .
              </span>
            </label>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-[var(--err)]/30 bg-[var(--err)]/10 px-3 py-2.5 text-[12.5px] font-medium text-[var(--err)]">
            {error}
          </p>
        )}
      </form>
    </FlowShell>
  );
};

interface BrandBriefFlowProps {
  onClose: () => void;
}

export const BrandBriefFlow: React.FC<BrandBriefFlowProps> = ({ onClose }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    biz: '',
    name: '',
    phone: '',
    promo: '',
    niche: NICHES[0],
    budget: BUDGETS[1],
    goals: [GOALS[1]] as string[],
    start: START[0],
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const dirty = Boolean(
    form.biz ||
      form.name ||
      form.phone ||
      form.promo ||
      form.goals.length !== 1 ||
      form.niche !== NICHES[0] ||
      form.budget !== BUDGETS[1] ||
      form.start !== START[0]
  );

  const requestClose = () => {
    if (dirty && !window.confirm('Discard your progress?')) return;
    onClose();
  };

  const brandBrief = [
    'Mhomho Media: campaign brief',
    `Business: ${form.biz}`,
    `Promoting: ${form.promo}`,
    `Niche: ${form.niche}`,
    `Goals: ${form.goals.join(', ')}`,
    `Budget: ${form.budget}`,
    `Start: ${form.start}`,
    `Contact: ${form.name} · ${form.phone}`,
  ].join('\n');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (step === 1) {
      if (!form.biz.trim() || !form.name.trim() || !form.phone.trim()) {
        setError('Add your business name, your name and a phone number.');
        return;
      }
      setStep(2);
      return;
    }

    if (!form.promo.trim()) {
      setError('Tell us what you want to promote.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await createEnquiry({
        bizName: form.biz.trim(),
        contactName: form.name.trim(),
        phone: form.phone.trim(),
        niche: form.niche,
        promo: form.promo.trim(),
        goals: form.goals,
        budget: form.budget,
        start: form.start,
        bestTimes: [],
      });

      if (!result.success) {
        setError(result.error || 'We could not send your brief. Please try again.');
        return;
      }

      setSent(true);
    } catch {
      setError('We could not send your brief. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setForm({
      biz: '',
      name: '',
      phone: '',
      promo: '',
      niche: NICHES[0],
      budget: BUDGETS[1],
      goals: [GOALS[1]],
      start: START[0],
    });
    setStep(1);
    setError('');
    setSent(false);
  };

  return (
    <FlowShell
      eyebrow="For brands"
      title={sent ? 'Brief received' : step === 1 ? 'Start a campaign' : 'The campaign'}
      stepLabel={sent ? undefined : `Step ${step} of 2`}
      onClose={sent ? onClose : requestClose}
      footer={
        sent ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-mhomho text-[14px] font-bold text-[var(--ink)]"
          >
            Done
            <Check size={16} />
          </button>
        ) : (
          <div>
            <button
              form="brand-brief-form"
              type="submit"
              disabled={submitting}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-mhomho text-[14px] font-bold text-[var(--ink)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {step === 1
                ? 'Continue'
                : submitting
                  ? 'Sending brief…'
                  : 'Get my campaign plan'}
              <ArrowRight size={16} />
            </button>
            <p className="mt-3 text-center text-[11.5px] text-[var(--faint)]">
              No sign-up. We reply with a plan and a guaranteed delivery target.
            </p>
          </div>
        )
      }
    >
      {sent ? (
        <div>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--ok)]/12 text-[var(--ok)]">
            <CheckCircle2 size={24} />
          </span>
          <h3 className="font-display mt-5 text-[26px] font-bold leading-tight">
            Thanks {form.name.split(' ')[0] || 'there'} — we’ve got it.
          </h3>
          <p className="mt-2 max-w-[44ch] text-[14px] leading-[1.7] text-[var(--muted)]">
            We’ll come back with a creator plan for {form.biz} and a guaranteed delivery target.
            Usually within one working day.
          </p>

          <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4">
            <dl className="space-y-2 text-[12.5px]">
              {[
                ['Promoting', form.promo],
                ['Niche', form.niche],
                ['Budget', form.budget],
                ['Start', form.start],
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
              href={contactLink(`Hi Mhomho, here’s my campaign brief.\n\n${brandBrief}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--line-strong)] text-[13.5px] font-semibold text-[var(--text)] no-underline hover:border-[var(--muted)]"
            >
              <Mail size={15} />
              Email the brief
            </a>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-[var(--line-strong)] text-[13.5px] font-semibold text-[var(--text)] hover:border-[var(--muted)]"
            >
              Send another brief
            </button>
          </div>
        </div>
      ) : (
        <form id="brand-brief-form" onSubmit={handleSubmit}>
          {step === 1 ? (
            <div>
              <p className="text-[13.5px] leading-relaxed text-[var(--muted)]">
                Tell us who you are. No account needed.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL} htmlFor="brand-biz">
                    Business name
                  </label>
                  <input
                    id="brand-biz"
                    value={form.biz}
                    onChange={(event) => setForm({ ...form, biz: event.target.value })}
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
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    className={FIELD}
                    placeholder="Rudo Chikafu"
                    required
                  />
                </div>
                <div>
                  <label className={LABEL} htmlFor="brand-phone">
                    Phone number
                  </label>
                  <input
                    id="brand-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
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
                    value={form.niche}
                    onChange={(event) => setForm({ ...form, niche: event.target.value })}
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
            </div>
          ) : (
            <div>
              <p className="text-[13.5px] leading-relaxed text-[var(--muted)]">
                Tell us what you want the crowd to do.
              </p>
              <div className="mt-6">
                <label className={LABEL} htmlFor="brand-promo">
                  What are you promoting?
                </label>
                <textarea
                  id="brand-promo"
                  value={form.promo}
                  onChange={(event) => setForm({ ...form, promo: event.target.value })}
                  className="min-h-[110px] w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--bg)] p-3.5 text-[14px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--faint)] focus:border-[var(--a1)]"
                  placeholder="A new skincare line, a data bundle, a weekend event…"
                  required
                />
              </div>

              <div className="mt-5">
                <p className={LABEL}>Budget</p>
                <div className="flex flex-wrap gap-2">
                  {BUDGETS.map((budget) => {
                    const selected = form.budget === budget;
                    return (
                      <button
                        key={budget}
                        type="button"
                        onClick={() => setForm({ ...form, budget })}
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
                    const selected = form.goals.includes(goal);
                    return (
                      <button
                        key={goal}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            goals: selected
                              ? form.goals.filter((item) => item !== goal)
                              : [...form.goals, goal],
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
                      onClick={() => setForm({ ...form, start })}
                      className={`${CHIP} ${
                        form.start === start
                          ? 'border-transparent bg-[var(--text)] text-[var(--page)]'
                          : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--text)]'
                      }`}
                    >
                      {start}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-[var(--err)]/30 bg-[var(--err)]/10 px-3 py-2.5 text-[12.5px] font-medium text-[var(--err)]">
              {error}
            </p>
          )}
        </form>
      )}
    </FlowShell>
  );
};
