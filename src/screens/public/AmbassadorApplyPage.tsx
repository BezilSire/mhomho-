import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  Download,
  FileText,
  Globe2,
  Mail,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import { MhomhoLogo } from '../../components/MhomhoLogo.tsx';
import {
  applyAmbassador,
  fetchAmbassadorMe,
  uploadAmbassadorFile,
  type AmbassadorMe,
} from '../../lib/api.ts';
import {
  ambassadorApplicationMailto,
  buildAmbassadorApplicationPdf,
  downloadAmbassadorApplicationPdf,
} from '../../lib/ambassadorPdf.ts';

export interface AmbassadorApplyPageProps {
  onBack: () => void;
  onOpenPortal: () => void;
}

const FIELD =
  'h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 text-[14px] text-[var(--text)] outline-none transition-colors placeholder:text-[var(--faint)] focus:border-[var(--a1)]';
const AREA =
  'w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3.5 py-3 text-[14px] leading-relaxed text-[var(--text)] outline-none transition-colors placeholder:text-[var(--faint)] focus:border-[var(--a1)]';
const LABEL =
  'mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--faint)]';

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

export const AmbassadorApplyPage: React.FC<AmbassadorApplyPageProps> = ({
  onBack,
  onOpenPortal,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Zimbabwe');
  const [territory, setTerritory] = useState('');
  const [languages, setLanguages] = useState('English, Shona');
  const [sectors, setSectors] = useState<string[]>(['Brand partnerships']);
  const [experience, setExperience] = useState('');
  const [motivation, setMotivation] = useState('');
  const [personalStatement, setPersonalStatement] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [instagram, setInstagram] = useState('');
  const [xLink, setXLink] = useState('');
  const [facebook, setFacebook] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [youtube, setYoutube] = useState('');
  const [otherLink, setOtherLink] = useState('');
  const [website, setWebsite] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [result, setResult] = useState<AmbassadorMe | null>(null);
  const [uploadWarning, setUploadWarning] = useState('');

  const application = result?.application ?? null;
  const selectedSectors = useMemo(() => sectors, [sectors]);

  const toggleSector = (sector: string) => {
    setSectors((current) =>
      current.includes(sector)
        ? current.filter((item) => item !== sector)
        : current.length >= 6
        ? current
        : [...current, sector]
    );
  };

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = Array.from(event.target.files ?? []).slice(0, 5);
    setFiles(next);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setUploadWarning('');

    if (password.length < 12) {
      setError('Use a password of at least 12 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    if (!selectedSectors.length) {
      setError('Choose at least one business sector.');
      return;
    }
    if (!consentTerms || !consentPrivacy) {
      setError('Please accept the appointment terms and privacy notice.');
      return;
    }

    setBusy(true);
    try {
      const socialLinks: Record<string, string> = {};
      if (linkedin.trim()) socialLinks.linkedin = linkedin.trim();
      if (instagram.trim()) socialLinks.instagram = instagram.trim();
      if (xLink.trim()) socialLinks.x = xLink.trim();
      if (facebook.trim()) socialLinks.facebook = facebook.trim();
      if (tiktok.trim()) socialLinks.tiktok = tiktok.trim();
      if (youtube.trim()) socialLinks.youtube = youtube.trim();
      if (otherLink.trim()) socialLinks.other = otherLink.trim();
      if (website.trim()) socialLinks.website = website.trim();

      const applied = await applyAmbassador({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        city: city.trim(),
        country: country.trim(),
        territory: territory.trim() || undefined,
        languages: splitList(languages),
        sectors: selectedSectors,
        experience: experience.trim() || undefined,
        motivation: motivation.trim() || undefined,
        personalStatement: personalStatement.trim() || undefined,
        socialLinks,
        password,
        consentTerms,
        consentPrivacy,
      });

      if (!applied.success) {
        setError(applied.error);
        return;
      }

      let failedUploads = 0;
      for (const file of files) {
        const upload = await uploadAmbassadorFile(file, 'document');
        if (!upload.success) failedUploads += 1;
      }
      if (failedUploads) {
        setUploadWarning(
          `${failedUploads} document${failedUploads === 1 ? '' : 's'} could not be uploaded. You can add them from the ambassador portal.`
        );
      }

      const refreshed = await fetchAmbassadorMe();
      setResult((refreshed.success ? refreshed.data : applied.data) ?? null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async () => {
    if (!application) return;
    setPdfBusy(true);
    setPdfError('');
    try {
      const bytes = await buildAmbassadorApplicationPdf(application);
      downloadAmbassadorApplicationPdf(bytes, application.reference);
    } catch {
      setPdfError('The PDF could not be generated. You can still open the email draft.');
    } finally {
      setPdfBusy(false);
    }
  };

  const openEmail = () => {
    if (!application) return;
    window.location.href = ambassadorApplicationMailto(application);
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--page)] text-[var(--text)]">
      <header className="safe-top sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--page)]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1100px] items-center justify-between px-4 sm:px-8">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to Mhomho"
            className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)]"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back to Mhomho</span>
          </button>
          <button type="button" onClick={onOpenPortal} aria-label="Open Commercial Envoy portal">
            <MhomhoLogo height={30} />
          </button>
          <button
            type="button"
            onClick={onOpenPortal}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--line)] px-3.5 text-[11.5px] font-bold text-[var(--text)] transition-colors hover:border-[var(--a1)]"
          >
            <span className="hidden sm:inline">Commercial Envoy sign in</span>
            <span className="sm:hidden">Sign in</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] px-4 pb-20 pt-10 sm:px-8 sm:pt-16">
        {!result ? (
          <>
            <section className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.18em] text-[var(--a1)]">
                <Sparkles size={12} />
                Applications reviewed individually
              </span>
              <h1 className="font-display mt-5 text-[38px] font-bold leading-[1.02] tracking-[-0.04em] sm:text-[58px]">
                Become an{' '}
                <span className="text-gradient">
                  MHOMHO Commercial Envoy
                </span>
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-[14px] leading-relaxed text-[var(--muted)] sm:text-[15px]">
                A selective commercial appointment for credible business connectors who can open doors
                for brands and creators. This is not a job application — it is an invitation to represent
                MHOMHO in your market.
              </p>
              <div className="mt-7 rounded-xl border border-[var(--line)] bg-[var(--bg)]/60 p-5 sm:p-7 text-[12.5px] leading-relaxed text-[var(--muted)]">
                <p className="mb-3"><strong className="text-[var(--text)]">What you are getting into.</strong> You are applying to be formally appointed as a MHOMHO Commercial Envoy. Authorisation only begins after the MHOMHO team reviews and approves your application personally — nothing is automatic.</p>
                <p className="mb-3"><strong className="text-[var(--text)]">What you get from us.</strong> On approval you receive a Commercial Envoy ID, a public verified profile page, and a place in our international network of brand connectors.</p>
                <p className="mb-0"><strong className="text-[var(--text)]">A big opportunity.</strong> This is for people who want to win — introduce credible businesses to MHOMHO and earn from the relationships you bring.</p>
              </div>
              <p className="mt-4 text-[11.5px] text-[var(--faint)]">
                Read the full{' '}
                <a href="/resources" className="text-[var(--a1)] underline underline-offset-4 hover:text-[var(--text)]">
                  Commercial Envoy programme
                </a>{' '}
                before you apply.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[11.5px] font-semibold text-[var(--muted)]">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-[var(--a1)]" />
                  Admin-approved appointment
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheck size={14} className="text-[var(--a1)]" />
                  Public verified profile
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Globe2 size={14} className="text-[var(--a1)]" />
                  International network
                </span>
              </div>
            </section>

            <form
              onSubmit={submit}
              className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-[26px] border border-[var(--line)] bg-[var(--bg)] shadow-[var(--shadow-soft)]"
            >
              <div className="border-b border-[var(--line)] px-5 py-5 sm:px-8">
                <h2 className="font-display text-[22px] font-bold tracking-[-0.02em]">
                  Your application
                </h2>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--muted)]">
                  Everything you submit is reviewed privately by the MHOMHO team. Nothing becomes
                  public unless your appointment is approved and you publish a profile.
                </p>
              </div>

              <div className="space-y-8 px-5 py-7 sm:px-8">
                <section>
                  <h3 className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--faint)]">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--surface-2)] text-[10px] text-[var(--a1)]">
                      1
                    </span>
                    Identity and contact
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={LABEL} htmlFor="amb-name">
                        Full legal / professional name
                      </label>
                      <input
                        id="amb-name"
                        className={FIELD}
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        placeholder="e.g. Tariro Moyo"
                        autoComplete="name"
                        required
                      />
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="amb-email">
                        Email address
                      </label>
                      <input
                        id="amb-email"
                        type="email"
                        className={FIELD}
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@gmail.com"
                        autoComplete="email"
                        required
                      />
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="amb-phone">
                        Phone / WhatsApp
                      </label>
                      <input
                        id="amb-phone"
                        className={FIELD}
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="+263 77 000 0000"
                        autoComplete="tel"
                        required
                      />
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="amb-city">
                        City
                      </label>
                      <input
                        id="amb-city"
                        className={FIELD}
                        value={city}
                        onChange={(event) => setCity(event.target.value)}
                        placeholder="Harare"
                        required
                      />
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="amb-country">
                        Country
                      </label>
                      <input
                        id="amb-country"
                        className={FIELD}
                        value={country}
                        onChange={(event) => setCountry(event.target.value)}
                        placeholder="Zimbabwe"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={LABEL} htmlFor="amb-territory">
                        Territory you can cover (optional)
                      </label>
                      <input
                        id="amb-territory"
                        className={FIELD}
                        value={territory}
                        onChange={(event) => setTerritory(event.target.value)}
                        placeholder="e.g. Harare, Bulawayo, SADC"
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--faint)]">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--surface-2)] text-[10px] text-[var(--a1)]">
                      2
                    </span>
                    Commercial fit
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={LABEL} htmlFor="amb-languages">
                        Languages
                      </label>
                      <input
                        id="amb-languages"
                        className={FIELD}
                        value={languages}
                        onChange={(event) => setLanguages(event.target.value)}
                        placeholder="English, Shona"
                      />
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="amb-experience">
                        Relevant experience
                      </label>
                      <input
                        id="amb-experience"
                        className={FIELD}
                        value={experience}
                        onChange={(event) => setExperience(event.target.value)}
                        placeholder="e.g. 8 years in brand partnerships"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <span className={LABEL}>Business sectors (choose up to 6)</span>
                    <div className="flex flex-wrap gap-2">
                      {SECTORS.map((sector) => {
                        const active = selectedSectors.includes(sector);
                        return (
                          <button
                            key={sector}
                            type="button"
                            onClick={() => toggleSector(sector)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[11.5px] font-semibold transition-colors ${
                              active
                                ? 'border-[var(--a1)] bg-[var(--a1)]/12 text-[var(--text)]'
                                : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--faint)]'
                            }`}
                          >
                            {active && <Check size={12} className="text-[var(--a1)]" />}
                            {sector}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className={LABEL} htmlFor="amb-motivation">
                      Why do you want to represent MHOMHO?
                    </label>
                    <textarea
                      id="amb-motivation"
                      className={AREA}
                      rows={5}
                      value={motivation}
                      onChange={(event) => setMotivation(event.target.value)}
                      placeholder="Tell us about your network, the businesses you can introduce, and how you work."
                    />
                  </div>
                  <div className="mt-4">
                    <label className={LABEL} htmlFor="amb-personal-statement">
                      Personal statement
                    </label>
                    <textarea
                      id="amb-personal-statement"
                      className={AREA}
                      rows={5}
                      value={personalStatement}
                      onChange={(event) => setPersonalStatement(event.target.value)}
                      placeholder="In your own words, tell us about yourself and why this is the right fit for you."
                    />
                    <p className="mt-1 text-[10.5px] text-[var(--faint)]">
                      Something you want to say about yourself — who you are, what drives you, and what
                      you would bring to the MHOMHO Commercial Envoy programme.
                    </p>
                  </div>
                </section>

                <section>
                  <h3 className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--faint)]">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--surface-2)] text-[10px] text-[var(--a1)]">
                      3
                    </span>
                    Public links and supporting documents
                  </h3>
                  <p className="mb-4 text-[11.5px] leading-relaxed text-[var(--muted)]">
                    Add any social links you use — LinkedIn, Instagram, X, Facebook, TikTok, YouTube,
                    or another platform. Links are optional.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={LABEL} htmlFor="amb-linkedin">
                        LinkedIn URL
                      </label>
                      <input
                        id="amb-linkedin"
                        className={FIELD}
                        value={linkedin}
                        onChange={(event) => setLinkedin(event.target.value)}
                        placeholder="https://linkedin.com/in/..."
                      />
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="amb-instagram">
                        Instagram URL
                      </label>
                      <input
                        id="amb-instagram"
                        className={FIELD}
                        value={instagram}
                        onChange={(event) => setInstagram(event.target.value)}
                        placeholder="https://instagram.com/..."
                      />
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="amb-x">
                        X / Twitter URL
                      </label>
                      <input
                        id="amb-x"
                        className={FIELD}
                        value={xLink}
                        onChange={(event) => setXLink(event.target.value)}
                        placeholder="https://x.com/..."
                      />
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="amb-facebook">
                        Facebook URL
                      </label>
                      <input
                        id="amb-facebook"
                        className={FIELD}
                        value={facebook}
                        onChange={(event) => setFacebook(event.target.value)}
                        placeholder="https://facebook.com/..."
                      />
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="amb-tiktok">
                        TikTok URL
                      </label>
                      <input
                        id="amb-tiktok"
                        className={FIELD}
                        value={tiktok}
                        onChange={(event) => setTiktok(event.target.value)}
                        placeholder="https://tiktok.com/@..."
                      />
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="amb-youtube">
                        YouTube URL
                      </label>
                      <input
                        id="amb-youtube"
                        className={FIELD}
                        value={youtube}
                        onChange={(event) => setYoutube(event.target.value)}
                        placeholder="https://youtube.com/@..."
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={LABEL} htmlFor="amb-other-link">
                        Other social link
                      </label>
                      <input
                        id="amb-other-link"
                        className={FIELD}
                        value={otherLink}
                        onChange={(event) => setOtherLink(event.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={LABEL} htmlFor="amb-website">
                        Company or professional website (optional)
                      </label>
                      <input
                        id="amb-website"
                        className={FIELD}
                        value={website}
                        onChange={(event) => setWebsite(event.target.value)}
                        placeholder="https://..."
                      />
                      <p className="mt-1 text-[10.5px] text-[var(--faint)]">
                        Optional — include a company or professional website if you have one.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className={LABEL} htmlFor="amb-documents">
                      Supporting documents (optional, up to 5)
                    </label>
                    <label
                      htmlFor="amb-documents"
                      className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)]/40 px-4 py-6 text-center transition-colors hover:border-[var(--a1)]"
                    >
                      <Upload size={20} className="text-[var(--a1)]" />
                      <span className="mt-2 text-[12.5px] font-semibold">
                        Attach a CV, company profile or registration document
                      </span>
                      <span className="mt-1 text-[11px] text-[var(--muted)]">
                        PDF, PNG, JPEG or WebP · up to 5 MB each
                      </span>
                      <input
                        id="amb-documents"
                        type="file"
                        multiple
                        accept=".pdf,image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={handleFiles}
                      />
                    </label>
                    {files.length > 0 && (
                      <ul className="mt-2 space-y-1.5">
                        {files.map((file) => (
                          <li
                            key={`${file.name}-${file.size}`}
                            className="flex items-center gap-2 text-[11.5px] text-[var(--muted)]"
                          >
                            <FileText size={13} className="text-[var(--a1)]" />
                            {file.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>

                <section>
                  <h3 className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--faint)]">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--surface-2)] text-[10px] text-[var(--a1)]">
                      4
                    </span>
                    Secure your application
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={LABEL} htmlFor="amb-password">
                        Password
                      </label>
                      <input
                        id="amb-password"
                        type="password"
                        className={FIELD}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="At least 12 characters"
                        autoComplete="new-password"
                        required
                      />
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="amb-confirm">
                        Confirm password
                      </label>
                      <input
                        id="amb-confirm"
                        type="password"
                        className={FIELD}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Repeat your password"
                        autoComplete="new-password"
                        required
                      />
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <label className="flex cursor-pointer items-start gap-3 text-[12px] leading-relaxed text-[var(--muted)]">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-[var(--a1)]"
                        checked={consentTerms}
                        onChange={(event) => setConsentTerms(event.target.checked)}
                      />
                      I understand that submitting an application does not make me an authorised
                      MHOMHO Commercial Envoy. Authorisation only begins after written approval.
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 text-[12px] leading-relaxed text-[var(--muted)]">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-[var(--a1)]"
                        checked={consentPrivacy}
                        onChange={(event) => setConsentPrivacy(event.target.checked)}
                      />
                      I consent to MHOMHO reviewing the information and documents I submit for this
                      application.
                    </label>
                  </div>
                </section>

                {error && (
                  <p className="rounded-xl border border-[var(--err)]/40 bg-[var(--err)]/10 px-4 py-3 text-[12.5px] text-[var(--err)]">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="press inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-mhomho px-6 text-[14px] font-bold text-[var(--ink)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? 'Submitting application…' : 'Submit application'}
                  {!busy && <ArrowRight size={16} />}
                </button>
                <p className="text-center text-[10.5px] leading-relaxed text-[var(--faint)]">
                  Your application is saved before the PDF is generated. You will receive an
                  application reference immediately.
                </p>
              </div>
            </form>
          </>
        ) : (
          <section className="mx-auto max-w-3xl">
            <div className="overflow-hidden rounded-[26px] border border-[var(--line)] bg-[var(--bg)] shadow-[var(--shadow-soft)]">
              <div className="border-b border-[var(--line)] bg-gradient-to-br from-[var(--surface-2)] to-[var(--bg)] px-6 py-9 text-center sm:px-10">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-mhomho text-[var(--ink)]">
                  <BadgeCheck size={26} />
                </span>
                <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--a1)]">
                  Application received
                </p>
                <h1 className="font-display mt-2 text-[32px] font-bold tracking-[-0.03em] sm:text-[42px]">
                  Thank you, {application?.fullName.split(' ')[0] || 'Commercial Envoy'}.
                </h1>
                <p className="mx-auto mt-3 max-w-xl text-[13px] leading-relaxed text-[var(--muted)]">
                  Your application has been saved and the MHOMHO team has been notified. You are
                  not yet an authorised commercial envoy; the team reviews every application personally.
                </p>
                <div className="mx-auto mt-6 inline-flex flex-col items-center rounded-2xl border border-[var(--line)] bg-[var(--bg)]/80 px-6 py-4">
                  <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--faint)]">
                    Application reference
                  </span>
                  <span className="mt-1 font-mono text-[17px] font-bold tracking-[0.08em]">
                    {application?.reference}
                  </span>
                </div>
              </div>

              <div className="space-y-5 px-6 py-7 sm:px-10">
                {uploadWarning && (
                  <p className="rounded-xl border border-[var(--a1)]/40 bg-[var(--a1)]/10 px-4 py-3 text-[12px] text-[var(--text)]">
                    {uploadWarning}
                  </p>
                )}

                <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]/50 p-5">
                  <h2 className="font-display text-[18px] font-bold">Send your application PDF</h2>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--muted)]">
                    Download the PDF, then attach it to the email draft. The draft is addressed to{' '}
                    <strong className="text-[var(--text)]">partnerships@mhomho.work</strong>. Your
                    application is already saved, so you can also send the email later.
                  </p>
                  <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
                    <button
                      type="button"
                      onClick={downloadPdf}
                      disabled={pdfBusy}
                      className="press inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--line)] px-5 text-[12.5px] font-bold text-[var(--text)] transition-colors hover:border-[var(--a1)] disabled:opacity-50"
                    >
                      <Download size={15} />
                      {pdfBusy ? 'Preparing PDF…' : 'Download PDF'}
                    </button>
                    <button
                      type="button"
                      onClick={openEmail}
                      className="press inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-mhomho px-5 text-[12.5px] font-bold text-[var(--ink)] transition-transform hover:-translate-y-0.5"
                    >
                      <Mail size={15} />
                      Open email draft
                    </button>
                  </div>
                  {pdfError && (
                    <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--err)]">
                      {pdfError}
                    </p>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--line)] p-4">
                    <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--faint)]">
                      Status
                    </span>
                    <p className="mt-1.5 flex items-center gap-2 text-[13px] font-semibold capitalize">
                      <span className="h-2 w-2 rounded-full bg-[var(--a1)]" />
                      {application?.status.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--line)] p-4">
                    <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--faint)]">
                      Documents attached
                    </span>
                    <p className="mt-1.5 flex items-center gap-2 text-[13px] font-semibold">
                      <FileText size={14} className="text-[var(--a1)]" />
                      {result?.documents.length ?? 0} saved
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]/40 p-5">
                  <h3 className="text-[12px] font-bold">What happens next</h3>
                  <ol className="mt-3 space-y-2.5 text-[12px] leading-relaxed text-[var(--muted)]">
                    <li className="flex gap-2.5">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[9px] font-bold text-[var(--a1)]">
                        1
                      </span>
                      The MHOMHO team reviews your application and documents privately.
                    </li>
                    <li className="flex gap-2.5">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[9px] font-bold text-[var(--a1)]">
                        2
                      </span>
                      If more information is needed, the status in your portal will say so.
                    </li>
                    <li className="flex gap-2.5">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[9px] font-bold text-[var(--a1)]">
                        3
                      </span>
                      After approval you receive a Commercial Envoy ID and can publish your public
                      profile.
                    </li>
                  </ol>
                </div>

                <button
                  type="button"
                  onClick={onOpenPortal}
                  className="press inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--line)] px-5 text-[12.5px] font-bold text-[var(--text)] transition-colors hover:border-[var(--a1)]"
                >
                  Open Commercial Envoy portal
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
