import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  X,
} from 'lucide-react';
import { fetchSignupConfig, joinBrandWaitlist, registerCreator } from '../../lib/api.ts';

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

const FIELD =
  'h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 text-[14px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--faint)] focus:border-[var(--a1)]';
const LABEL = 'mb-1.5 block text-[12px] font-semibold text-[var(--muted)]';

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
  const [form, setForm] = useState({
    brandName: '',
    location: '',
    industry: NICHES[0],
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  });
  const [company, setCompany] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const dirty = Boolean(
    form.brandName ||
      form.location ||
      form.contactName ||
      form.contactEmail ||
      form.contactPhone ||
      form.industry !== NICHES[0]
  );

  const requestClose = () => {
    if (dirty && !window.confirm('Discard your waitlist details?')) return;
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (
      !form.brandName.trim() ||
      !form.location.trim() ||
      !form.contactName.trim() ||
      !form.contactEmail.trim() ||
      !form.contactPhone.trim()
    ) {
      setError('Add the brand name, location, contact person, email and phone number.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await joinBrandWaitlist({
        brandName: form.brandName.trim(),
        location: form.location.trim(),
        industry: form.industry,
        contactName: form.contactName.trim(),
        contactEmail: form.contactEmail.trim(),
        contactPhone: form.contactPhone.trim(),
        company,
      });

      if (!result.success) {
        setError(result.error || 'We could not add your brand to the waitlist. Please try again.');
        return;
      }

      setSent(true);
    } catch {
      setError('We could not add your brand to the waitlist. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FlowShell
      eyebrow="For brands"
      title={sent ? "You're on the list" : 'Join the brand waitlist'}
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
              form="brand-waitlist-form"
              type="submit"
              disabled={submitting}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-mhomho text-[14px] font-bold text-[var(--ink)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {submitting ? 'Adding your brand…' : 'Put my brand on waitlist'}
              <ArrowRight size={16} />
            </button>
            <p className="mt-3 text-center text-[11.5px] text-[var(--faint)]">
              No sign-up. We’ll contact you when brand campaigns open.
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
            Thanks {form.contactName.split(' ')[0] || 'there'} — you’re on the waitlist.
          </h3>
          <p className="mt-2 max-w-[44ch] text-[14px] leading-[1.7] text-[var(--muted)]">
            We’ve saved {form.brandName}. We’ll reach out on {form.contactEmail} or{' '}
            {form.contactPhone} when brand campaigns open in your area.
          </p>

          <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--bg)] p-4">
            <dl className="space-y-2 text-[12.5px]">
              {[
                ['Brand', form.brandName],
                ['Location', form.location],
                ['Industry', form.industry],
                ['Contact', form.contactName],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-6">
                  <dt className="shrink-0 text-[var(--faint)]">{label}</dt>
                  <dd className="m-0 text-right font-medium text-[var(--text)]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : (
        <form id="brand-waitlist-form" onSubmit={handleSubmit}>
          <p className="text-[13.5px] leading-relaxed text-[var(--muted)]">
            Brand campaigns aren’t open yet. Leave your details and we’ll contact you when they
            are.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="brand-waitlist-name">
                Brand name
              </label>
              <input
                id="brand-waitlist-name"
                value={form.brandName}
                onChange={(event) => setForm({ ...form, brandName: event.target.value })}
                className={FIELD}
                placeholder="Glow Beauty Labs"
                required
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="brand-waitlist-location">
                Location
              </label>
              <input
                id="brand-waitlist-location"
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
                className={FIELD}
                placeholder="Harare, Zimbabwe"
                required
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="brand-waitlist-industry">
                Industry
              </label>
              <select
                id="brand-waitlist-industry"
                value={form.industry}
                onChange={(event) => setForm({ ...form, industry: event.target.value })}
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
              <label className={LABEL} htmlFor="brand-waitlist-contact">
                Contact person
              </label>
              <input
                id="brand-waitlist-contact"
                value={form.contactName}
                onChange={(event) => setForm({ ...form, contactName: event.target.value })}
                className={FIELD}
                placeholder="Rudo Chikafu"
                required
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="brand-waitlist-email">
                Contact email
              </label>
              <input
                id="brand-waitlist-email"
                type="email"
                value={form.contactEmail}
                onChange={(event) => setForm({ ...form, contactEmail: event.target.value })}
                className={FIELD}
                placeholder="you@gmail.com"
                required
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="brand-waitlist-phone">
                Contact phone
              </label>
              <input
                id="brand-waitlist-phone"
                type="tel"
                value={form.contactPhone}
                onChange={(event) => setForm({ ...form, contactPhone: event.target.value })}
                className={FIELD}
                placeholder="+263 77 000 0000"
                required
              />
            </div>
            <div className="hidden" aria-hidden="true">
              <label htmlFor="brand-waitlist-company">Company</label>
              <input
                id="brand-waitlist-company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
          </div>

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
