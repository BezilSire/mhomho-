import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  ExternalLink,
  FileText,
  Globe2,
  ImagePlus,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Send,
  ShieldCheck,
  Upload,
  UserRound,
} from 'lucide-react';
import { MhomhoLogo } from '../../components/MhomhoLogo.tsx';
import {
  authenticateAmbassador,
  signOut as endSession,
} from '../../lib/auth.ts';
import { getSession, subscribeToSession, type AuthSession } from '../../lib/sessionStore.ts';
import {
  fetchAmbassadorMe,
  publishAmbassadorProfile,
  updateAmbassadorApplication,
  updateAmbassadorProfile,
  uploadAmbassadorFile,
  type AmbassadorMe,
} from '../../lib/api.ts';

export interface AmbassadorPortalPageProps {
  onBack: () => void;
  onApply: () => void;
}

const FIELD =
  'h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 text-[13.5px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--faint)] focus:border-[var(--a1)]';
const AREA =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-3 text-[13.5px] leading-relaxed text-[var(--text)] outline-none transition-colors placeholder:text-[var(--faint)] focus:border-[var(--a1)]';
const LABEL =
  'mb-1.5 block text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--faint)]';

const SECTORS = [
  'Brand partnerships',
  'Media buying',
  'Events & activations',
  'Retail & distribution',
  'Finance & insurance',
  'Technology',
  'Healthcare',
  'Agriculture',
  'Tourism & hospitality',
  'Education',
  'Real estate',
  'Logistics',
  'Professional services',
  'Other',
];

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'approved'
      ? 'border-[var(--ok)]/40 bg-[var(--ok)]/10 text-[var(--ok)]'
      : status === 'needs_info'
      ? 'border-[var(--a1)]/50 bg-[var(--a1)]/10 text-[var(--a1)]'
      : status === 'rejected' || status === 'suspended'
      ? 'border-[var(--err)]/40 bg-[var(--err)]/10 text-[var(--err)]'
      : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[9.5px] font-bold uppercase tracking-[0.14em] ${tone}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabel(status)}
    </span>
  );
}

export const AmbassadorPortalPage: React.FC<AmbassadorPortalPageProps> = ({
  onBack,
  onApply,
}) => {
  const [session, setSession] = useState<AuthSession | null>(() => getSession());
  const [me, setMe] = useState<AmbassadorMe | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => subscribeToSession(() => setSession(getSession())), []);

  useEffect(() => {
    if (session?.role !== 'business') {
      setMe(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchAmbassadorMe()
      .then((result) => {
        if (cancelled) return;
        if (result.success) setMe(result.data ?? null);
        else setError(result.error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.role, session?.uid]);

  const refresh = async () => {
    const result = await fetchAmbassadorMe();
    if (result.success) setMe(result.data ?? null);
    else setError(result.error);
  };

  const signOut = async () => {
    await endSession();
    setSession(null);
    setMe(null);
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--page)] text-[var(--text)]">
      <header className="safe-top sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--page)]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1000px] items-center justify-between px-4 sm:px-8">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to Mhomho"
            className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)]"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back to Mhomho</span>
          </button>
          <MhomhoLogo height={30} />
          {session?.role === 'business' ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--line)] px-3.5 text-[11.5px] font-bold text-[var(--muted)] transition-colors hover:text-[var(--text)]"
            >
              <LogOut size={13} />
              Sign out
            </button>
          ) : (
            <button
              type="button"
              onClick={onApply}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-mhomho px-4 text-[11.5px] font-bold text-[var(--ink)]"
            >
              Apply
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1000px] px-4 pb-20 pt-8 sm:px-8 sm:pt-12">
        {!session || session.role !== 'business' ? (
          <SignInPanel onSignedIn={() => setSession(getSession())} onApply={onApply} />
        ) : loading ? (
          <div className="flex items-center justify-center py-24 text-[var(--muted)]">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : !me ? (
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--bg)] p-8 text-center">
            <p className="text-[13px] text-[var(--muted)]">
              {error || 'We could not load your ambassador record.'}
            </p>
          </div>
        ) : me.application?.status === 'approved' && me.profile ? (
          <ApprovedPortal me={me} onRefresh={refresh} setNotice={setNotice} setError={setError} />
        ) : me.application ? (
          <ApplicantPortal
            me={me}
            onRefresh={refresh}
            setNotice={setNotice}
            setError={setError}
          />
        ) : (
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--bg)] p-8 text-center">
            <h1 className="font-display text-[24px] font-bold">No application found</h1>
            <p className="mt-2 text-[13px] text-[var(--muted)]">
              This account is signed in, but it does not have an ambassador application.
            </p>
            <button
              type="button"
              onClick={onApply}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-gradient-mhomho px-5 text-[12.5px] font-bold text-[var(--ink)]"
            >
              Start an application
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {notice && (
          <p className="mx-auto mt-4 max-w-2xl rounded-xl border border-[var(--ok)]/40 bg-[var(--ok)]/10 px-4 py-3 text-[12px] text-[var(--ok)]">
            {notice}
          </p>
        )}
        {error && session?.role === 'business' && me && (
          <p className="mx-auto mt-4 max-w-2xl rounded-xl border border-[var(--err)]/40 bg-[var(--err)]/10 px-4 py-3 text-[12px] text-[var(--err)]">
            {error}
          </p>
        )}
      </main>
    </div>
  );
};

function SignInPanel({
  onSignedIn,
  onApply,
}: {
  onSignedIn: () => void;
  onApply: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const result = await authenticateAmbassador(email, password);
    setBusy(false);
    if (!result.success) {
      setError(result.error ?? 'Sign-in failed.');
      return;
    }
    onSignedIn();
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-[var(--a1)]">
          <ShieldCheck size={24} />
        </span>
        <h1 className="font-display mt-5 text-[30px] font-bold tracking-[-0.03em]">
          Ambassador portal
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">
          Sign in to track your application, add documents and manage your public profile after
          approval.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="mt-7 rounded-3xl border border-[var(--line)] bg-[var(--bg)] p-6 shadow-[var(--shadow-soft)]"
      >
        <label className={LABEL} htmlFor="portal-email">
          Email address
        </label>
        <input
          id="portal-email"
          type="email"
          className={FIELD}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
          required
        />
        <label className={`${LABEL} mt-4`} htmlFor="portal-password">
          Password
        </label>
        <input
          id="portal-password"
          type="password"
          className={FIELD}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Your password"
          autoComplete="current-password"
          required
        />
        {error && <p className="mt-3 text-[12px] text-[var(--err)]">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="press mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-mhomho text-[13px] font-bold text-[var(--ink)] disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
          {!busy && <ArrowRight size={15} />}
        </button>
        <button
          type="button"
          onClick={onApply}
          className="mt-3 inline-flex h-10 w-full items-center justify-center text-[11.5px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)]"
        >
          Not applied yet? Start an application
        </button>
      </form>
    </div>
  );
}

function ApplicantPortal({
  me,
  onRefresh,
  setNotice,
  setError,
}: {
  me: AmbassadorMe;
  onRefresh: () => Promise<void>;
  setNotice: (value: string) => void;
  setError: (value: string) => void;
}) {
  const application = me.application!;
  const [phone, setPhone] = useState(application.phone);
  const [city, setCity] = useState(application.city);
  const [country, setCountry] = useState(application.country);
  const [territory, setTerritory] = useState(application.territory ?? '');
  const [experience, setExperience] = useState(application.experience);
  const [motivation, setMotivation] = useState(application.motivation);
  const [response, setResponse] = useState(application.applicantResponse ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const canEdit = ['submitted', 'needs_info'].includes(application.status);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    setError('');
    const result = await updateAmbassadorApplication({
      phone,
      city,
      country,
      territory: territory || undefined,
      experience: experience || undefined,
      motivation: motivation || undefined,
      applicantResponse: response || undefined,
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setNotice('Application updated. The MHOMHO team can see your latest information.');
    await onRefresh();
  };

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setNotice('');
    setError('');
    let failed = 0;
    for (const file of files) {
      const result = await uploadAmbassadorFile(file, 'document');
      if (!result.success) failed += 1;
    }
    setUploading(false);
    event.target.value = '';
    if (failed) setError(`${failed} document${failed === 1 ? '' : 's'} could not be uploaded.`);
    else setNotice('Documents uploaded.');
    await onRefresh();
  };

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--bg)] p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <StatusPill status={application.status} />
            <h1 className="font-display mt-3 text-[30px] font-bold tracking-[-0.03em]">
              Your application
            </h1>
            <p className="mt-1 text-[12.5px] text-[var(--muted)]">
              Reference <span className="font-mono font-bold text-[var(--text)]">{application.reference}</span>
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]/50 px-4 py-3 text-[11.5px] text-[var(--muted)]">
            <p className="flex items-center gap-2">
              <Mail size={13} className="text-[var(--a1)]" />
              {application.email}
            </p>
            <p className="mt-1.5 flex items-center gap-2">
              <MapPin size={13} className="text-[var(--a1)]" />
              {application.city}, {application.country}
            </p>
          </div>
        </div>

        {application.status === 'needs_info' && application.requestedInfo && (
          <div className="mt-5 rounded-2xl border border-[var(--a1)]/40 bg-[var(--a1)]/10 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--a1)]">
              More information requested
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text)]">
              {application.requestedInfo}
            </p>
          </div>
        )}
        {application.status === 'under_review' && (
          <p className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)]/40 p-4 text-[12.5px] leading-relaxed text-[var(--muted)]">
            Your application is being reviewed. The team will update your status here.
          </p>
        )}
        {application.status === 'rejected' && (
          <p className="mt-5 rounded-2xl border border-[var(--err)]/40 bg-[var(--err)]/10 p-4 text-[12.5px] leading-relaxed text-[var(--err)]">
            This application was not approved. You can contact partnerships@mhomho.work if you
            believe this was a mistake.
          </p>
        )}
        {application.status === 'suspended' && (
          <p className="mt-5 rounded-2xl border border-[var(--err)]/40 bg-[var(--err)]/10 p-4 text-[12.5px] leading-relaxed text-[var(--err)]">
            This appointment is suspended. The public profile is not active. Contact
            partnerships@mhomho.work for clarification.
          </p>
        )}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-[var(--line)] bg-[var(--bg)] p-6">
          <h2 className="font-display text-[20px] font-bold">Application details</h2>
          <p className="mt-1 text-[11.5px] text-[var(--muted)]">
            You can update these details while the application is being reviewed.
          </p>
          <form onSubmit={save} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="p-phone">
                  Phone / WhatsApp
                </label>
                <input
                  id="p-phone"
                  className={FIELD}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="p-city">
                  City
                </label>
                <input
                  id="p-city"
                  className={FIELD}
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="p-country">
                  Country
                </label>
                <input
                  id="p-country"
                  className={FIELD}
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="p-territory">
                  Territory
                </label>
                <input
                  id="p-territory"
                  className={FIELD}
                  value={territory}
                  onChange={(event) => setTerritory(event.target.value)}
                  disabled={!canEdit}
                />
              </div>
            </div>
            <div>
              <label className={LABEL} htmlFor="p-experience">
                Relevant experience
              </label>
              <input
                id="p-experience"
                className={FIELD}
                value={experience}
                onChange={(event) => setExperience(event.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="p-motivation">
                Why MHOMHO?
              </label>
              <textarea
                id="p-motivation"
                className={AREA}
                rows={4}
                value={motivation}
                onChange={(event) => setMotivation(event.target.value)}
                disabled={!canEdit}
              />
            </div>
            {application.status === 'needs_info' && (
              <div>
                <label className={LABEL} htmlFor="p-response">
                  Your response to the request
                </label>
                <textarea
                  id="p-response"
                  className={AREA}
                  rows={3}
                  value={response}
                  onChange={(event) => setResponse(event.target.value)}
                  placeholder="Add the information the team asked for."
                />
              </div>
            )}
            {canEdit && (
              <button
                type="submit"
                disabled={saving}
                className="press inline-flex h-10 items-center gap-2 rounded-full bg-gradient-mhomho px-5 text-[12px] font-bold text-[var(--ink)] disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save changes'}
                {!saving && <Send size={13} />}
              </button>
            )}
          </form>
        </div>

        <div className="space-y-5">
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--bg)] p-6">
            <h2 className="font-display text-[20px] font-bold">Documents</h2>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--muted)]">
              These are visible only to you and the MHOMHO review team.
            </p>
            <ul className="mt-4 space-y-2">
              {me.documents.length === 0 && (
                <li className="text-[12px] text-[var(--faint)]">No documents uploaded yet.</li>
              )}
              {me.documents.map((document) => (
                <li
                  key={document.id}
                  className="flex items-center gap-2.5 rounded-xl border border-[var(--line)] px-3 py-2.5"
                >
                  <FileText size={15} className="shrink-0 text-[var(--a1)]" />
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-[var(--text)] no-underline hover:text-[var(--a1)]"
                  >
                    {document.originalName || 'Document'}
                  </a>
                  <span className="text-[9.5px] text-[var(--faint)]">
                    {(document.sizeBytes / 1024 / 1024).toFixed(1)} MB
                  </span>
                </li>
              ))}
            </ul>
            {canEdit && (
              <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--line)] px-3 py-3 text-[11.5px] font-semibold text-[var(--muted)] transition-colors hover:border-[var(--a1)] hover:text-[var(--text)]">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? 'Uploading…' : 'Add documents'}
                <input
                  type="file"
                  multiple
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={upload}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)]/40 p-6">
            <h2 className="font-display text-[20px] font-bold">What happens next</h2>
            <ol className="mt-3 space-y-2.5 text-[11.5px] leading-relaxed text-[var(--muted)]">
              <li className="flex gap-2.5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[9px] font-bold text-[var(--a1)]">
                  1
                </span>
                Private review of your application and documents.
              </li>
              <li className="flex gap-2.5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[9px] font-bold text-[var(--a1)]">
                  2
                </span>
                If approved, you receive an Ambassador ID and profile editor.
              </li>
              <li className="flex gap-2.5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[9px] font-bold text-[var(--a1)]">
                  3
                </span>
                Publish your public profile only when you are ready.
              </li>
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}

function ApprovedPortal({
  me,
  onRefresh,
  setNotice,
  setError,
}: {
  me: AmbassadorMe;
  onRefresh: () => Promise<void>;
  setNotice: (value: string) => void;
  setError: (value: string) => void;
}) {
  const profile = me.profile!;
  const [publicName, setPublicName] = useState(profile.publicName);
  const [bio, setBio] = useState(profile.bio);
  const [country, setCountry] = useState(profile.country);
  const [city, setCity] = useState(profile.city);
  const [languages, setLanguages] = useState(profile.languages.join(', '));
  const [sectors, setSectors] = useState<string[]>(profile.sectors);
  const [contactEmail, setContactEmail] = useState(profile.contactEmail ?? '');
  const [contactWhatsapp, setContactWhatsapp] = useState(profile.contactWhatsapp ?? '');
  const [linkedin, setLinkedin] = useState(profile.socialLinks.linkedin ?? '');
  const [instagram, setInstagram] = useState(profile.socialLinks.instagram ?? '');
  const [website, setWebsite] = useState(profile.socialLinks.website ?? '');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const publicPath = `/ambassadors/${profile.username}`;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    setError('');
    const socialLinks: Record<string, string> = {};
    if (linkedin.trim()) socialLinks.linkedin = linkedin.trim();
    if (instagram.trim()) socialLinks.instagram = instagram.trim();
    if (website.trim()) socialLinks.website = website.trim();
    const result = await updateAmbassadorProfile({
      publicName,
      bio,
      country,
      city,
      languages: splitList(languages),
      sectors,
      contactEmail: contactEmail.trim() || null,
      contactWhatsapp: contactWhatsapp.trim() || null,
      socialLinks,
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setNotice('Profile saved.');
    await onRefresh();
  };

  const uploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setNotice('');
    setError('');
    const result = await uploadAmbassadorFile(file, 'photo');
    setUploading(false);
    event.target.value = '';
    if (!result.success) {
      setError(result.error);
      return;
    }
    setNotice('Photograph uploaded.');
    await onRefresh();
  };

  const publish = async () => {
    setPublishing(true);
    setNotice('');
    setError('');
    const result = await publishAmbassadorProfile();
    setPublishing(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setNotice('Your public profile is live.');
    await onRefresh();
  };

  const toggleSector = (sector: string) => {
    setSectors((current) =>
      current.includes(sector)
        ? current.filter((item) => item !== sector)
        : current.length >= 6
        ? current
        : [...current, sector]
    );
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--bg)] shadow-[var(--shadow-soft)]">
        <div className="relative border-b border-[var(--line)] bg-gradient-to-br from-[var(--surface-2)] to-[var(--bg)] px-6 py-7 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
              {profile.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt={profile.publicName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-[var(--a1)]">
                  <UserRound size={30} />
                </div>
              )}
              <label className="absolute inset-x-0 bottom-0 flex cursor-pointer items-center justify-center gap-1 bg-black/70 py-1.5 text-[8.5px] font-bold uppercase tracking-[0.12em] text-white">
                {uploading ? <Loader2 size={10} className="animate-spin" /> : <ImagePlus size={10} />}
                {uploading ? 'Uploading' : 'Photo'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={uploadPhoto}
                  disabled={uploading}
                />
              </label>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--a1)]/40 bg-[var(--a1)]/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--a1)]">
                  <BadgeCheck size={11} />
                  Verified appointment
                </span>
                <StatusPill status={profile.status} />
              </div>
              <h1 className="font-display mt-3 text-[30px] font-bold tracking-[-0.03em]">
                {profile.publicName}
              </h1>
              <p className="mt-1 text-[12px] font-semibold text-[var(--muted)]">
                {profile.title} · {profile.ambassadorId}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="text-[11.5px] leading-relaxed text-[var(--muted)]">
            {profile.status === 'published'
              ? 'Your public profile is live. Share it with your network.'
              : 'Your profile is not public yet. Add a photograph, biography and public contact method, then publish.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {profile.status === 'published' && (
              <a
                href={publicPath}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--line)] px-4 text-[11px] font-bold text-[var(--text)] no-underline transition-colors hover:border-[var(--a1)]"
              >
                <ExternalLink size={12} />
                View public page
              </a>
            )}
            <button
              type="button"
              onClick={() => void publish()}
              disabled={publishing}
              className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-mhomho px-4 text-[11px] font-bold text-[var(--ink)] disabled:opacity-50"
            >
              {publishing ? <Loader2 size={12} className="animate-spin" /> : <Globe2 size={12} />}
              {profile.status === 'published' ? 'Republish' : 'Publish profile'}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <form
          onSubmit={save}
          className="rounded-3xl border border-[var(--line)] bg-[var(--bg)] p-6"
        >
          <h2 className="font-display text-[20px] font-bold">Public profile</h2>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--muted)]">
            You control these fields. MHOMHO controls the title, Ambassador ID, verification badge
            and appointment status.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={LABEL} htmlFor="pub-name">
                Public name
              </label>
              <input
                id="pub-name"
                className={FIELD}
                value={publicName}
                onChange={(event) => setPublicName(event.target.value)}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL} htmlFor="pub-bio">
                Biography
              </label>
              <textarea
                id="pub-bio"
                className={AREA}
                rows={5}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="Introduce your commercial background, network and the value you bring."
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="pub-country">
                Country
              </label>
              <input
                id="pub-country"
                className={FIELD}
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                required
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="pub-city">
                City
              </label>
              <input
                id="pub-city"
                className={FIELD}
                value={city}
                onChange={(event) => setCity(event.target.value)}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL} htmlFor="pub-languages">
                Languages
              </label>
              <input
                id="pub-languages"
                className={FIELD}
                value={languages}
                onChange={(event) => setLanguages(event.target.value)}
                placeholder="English, Shona"
              />
            </div>
          </div>

          <div className="mt-4">
            <span className={LABEL}>Business sectors</span>
            <div className="flex flex-wrap gap-2">
              {SECTORS.map((sector) => {
                const active = sectors.includes(sector);
                return (
                  <button
                    key={sector}
                    type="button"
                    onClick={() => toggleSector(sector)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10.5px] font-semibold transition-colors ${
                      active
                        ? 'border-[var(--a1)] bg-[var(--a1)]/12 text-[var(--text)]'
                        : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--faint)]'
                    }`}
                  >
                    {active && <Check size={10} className="text-[var(--a1)]" />}
                    {sector}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="pub-email">
                Public email
              </label>
              <input
                id="pub-email"
                type="email"
                className={FIELD}
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="pub-whatsapp">
                Public WhatsApp
              </label>
              <input
                id="pub-whatsapp"
                className={FIELD}
                value={contactWhatsapp}
                onChange={(event) => setContactWhatsapp(event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="pub-linkedin">
                LinkedIn
              </label>
              <input
                id="pub-linkedin"
                className={FIELD}
                value={linkedin}
                onChange={(event) => setLinkedin(event.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="pub-instagram">
                Instagram
              </label>
              <input
                id="pub-instagram"
                className={FIELD}
                value={instagram}
                onChange={(event) => setInstagram(event.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL} htmlFor="pub-website">
                Website
              </label>
              <input
                id="pub-website"
                className={FIELD}
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="press mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-gradient-mhomho px-5 text-[12.5px] font-bold text-[var(--ink)] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save profile'}
            {!saving && <Send size={14} />}
          </button>
        </form>

        <div className="space-y-5">
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)]/40 p-6">
            <h2 className="font-display text-[20px] font-bold">Controlled by MHOMHO</h2>
            <ul className="mt-4 space-y-3 text-[11.5px] leading-relaxed text-[var(--muted)]">
              <li className="flex gap-2.5">
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--a1)]" />
                Official title and appointment status.
              </li>
              <li className="flex gap-2.5">
                <BadgeCheck size={15} className="mt-0.5 shrink-0 text-[var(--a1)]" />
                Ambassador ID and verified appointment badge.
              </li>
              <li className="flex gap-2.5">
                <Globe2 size={15} className="mt-0.5 shrink-0 text-[var(--a1)]" />
                MHOMHO branding and the public appointment description.
              </li>
            </ul>
          </div>
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--bg)] p-6">
            <h2 className="font-display text-[20px] font-bold">Public page</h2>
            <p className="mt-2 break-all font-mono text-[11px] text-[var(--a1)]">
              {publicPath}
            </p>
            <p className="mt-3 text-[11.5px] leading-relaxed text-[var(--muted)]">
              Only approved ambassadors with a published profile appear publicly. If your
              appointment is suspended, the page stops presenting you as an active ambassador.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
