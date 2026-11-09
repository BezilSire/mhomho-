import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  Copy,
  ExternalLink,
  Globe2,
  Languages,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import { MhomhoLogo } from '../../components/MhomhoLogo.tsx';
import { fetchPublicAmbassador, type AmbassadorProfile } from '../../lib/api.ts';

export interface AmbassadorProfilePageProps {
  username: string;
  onBack: () => void;
  onApply: () => void;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function whatsappHref(value: string): string {
  const digits = value.replace(/[^\d+]/g, '');
  return `https://wa.me/${digits.replace(/^\+/, '')}`;
}

export const AmbassadorProfilePage: React.FC<AmbassadorProfilePageProps> = ({
  username,
  onBack,
  onApply,
}) => {
  const [profile, setProfile] = useState<AmbassadorProfile | null>(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [inactive, setInactive] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setInactive(false);
    fetchPublicAmbassador(username)
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.data) {
          setProfile(result.data.profile);
          setDescription(result.data.officialDescription);
        } else {
          setInactive(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: profile ? `${profile.publicName} — ${profile.title}` : 'MHOMHO Ambassador',
          text: profile
            ? `${profile.publicName} is a verified MHOMHO Ambassador.`
            : 'MHOMHO Ambassador',
          url,
        });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be unavailable */
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--page)] text-[var(--text)]">
      <header className="safe-top sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--page)]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1000px] items-center justify-between px-4 sm:px-8">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)]"
          >
            <ArrowLeft size={16} />
            Mhomho
          </button>
          <MhomhoLogo height={30} />
          <button
            type="button"
            onClick={onApply}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--line)] px-3.5 text-[11.5px] font-bold text-[var(--text)] transition-colors hover:border-[var(--a1)]"
          >
            Apply
            <ArrowRight size={13} />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1000px] px-4 pb-20 pt-8 sm:px-8 sm:pt-12">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-[var(--muted)]">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : inactive || !profile ? (
          <div className="mx-auto max-w-xl rounded-3xl border border-[var(--line)] bg-[var(--bg)] p-8 text-center shadow-[var(--shadow-soft)]">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-[var(--faint)]">
              <ShieldCheck size={24} />
            </span>
            <h1 className="font-display mt-5 text-[28px] font-bold tracking-[-0.03em]">
              This appointment is not active
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">
              This MHOMHO Ambassador profile is not available. Only formally approved ambassadors
              with an active appointment are shown publicly.
            </p>
            <button
              type="button"
              onClick={onBack}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-gradient-mhomho px-5 text-[12.5px] font-bold text-[var(--ink)]"
            >
              Return to Mhomho
              <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-5">
            <article className="overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--bg)] shadow-[var(--shadow-soft)]">
              <div className="relative h-32 overflow-hidden bg-gradient-to-br from-[#3b1708] via-[#7a2b08] to-[#b31217] sm:h-40">
                <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_20%_30%,#ffb02e_0,transparent_32%),radial-gradient(circle_at_80%_20%,#ff5a36_0,transparent_30%),radial-gradient(circle_at_60%_90%,#ffd23d_0,transparent_28%)]" />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--bg)] to-transparent" />
              </div>

              <div className="relative px-6 pb-7 sm:px-9">
                <div className="-mt-14 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:items-end">
                  <div className="h-28 w-28 shrink-0 overflow-hidden rounded-[22px] border-4 border-[var(--bg)] bg-[var(--surface)] shadow-lg sm:h-32 sm:w-32">
                    {profile.photoUrl ? (
                      <img
                        src={profile.photoUrl}
                        alt={profile.publicName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-gradient-mhomho text-[28px] font-bold text-[var(--ink)]">
                        {initials(profile.publicName)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--a1)]/40 bg-[var(--a1)]/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--a1)]">
                        <BadgeCheck size={11} />
                        Verified appointment
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ok)]/40 bg-[var(--ok)]/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--ok)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        Active
                      </span>
                    </div>
                    <h1 className="font-display mt-3 text-[32px] font-bold leading-[1.05] tracking-[-0.04em] sm:text-[42px]">
                      {profile.publicName}
                    </h1>
                    <p className="mt-1.5 text-[12.5px] font-semibold text-[var(--muted)]">
                      {profile.title}
                    </p>
                    <p className="mt-1 font-mono text-[10.5px] tracking-[0.08em] text-[var(--faint)]">
                      {profile.ambassadorId}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] font-semibold text-[var(--muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={13} className="text-[var(--a1)]" />
                    {profile.city}, {profile.country}
                  </span>
                  {profile.languages.length > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <Languages size={13} className="text-[var(--a1)]" />
                      {profile.languages.join(' · ')}
                    </span>
                  )}
                </div>

                {profile.bio && (
                  <p className="mt-6 whitespace-pre-line text-[13.5px] leading-relaxed text-[var(--text)]">
                    {profile.bio}
                  </p>
                )}

                {profile.sectors.length > 0 && (
                  <div className="mt-6">
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--faint)]">
                      Business sectors
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {profile.sectors.map((sector) => (
                        <span
                          key={sector}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[10.5px] font-semibold text-[var(--muted)]"
                        >
                          <Check size={10} className="text-[var(--a1)]" />
                          {sector}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
                  {profile.contactEmail && (
                    <a
                      href={`mailto:${profile.contactEmail}?subject=${encodeURIComponent(
                        `MHOMHO Ambassador enquiry — ${profile.publicName}`
                      )}`}
                      className="press inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-mhomho px-5 text-[12.5px] font-bold text-[var(--ink)] no-underline transition-transform hover:-translate-y-0.5"
                    >
                      <Mail size={15} />
                      Email ambassador
                    </a>
                  )}
                  {profile.contactWhatsapp && (
                    <a
                      href={whatsappHref(profile.contactWhatsapp)}
                      target="_blank"
                      rel="noreferrer"
                      className="press inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--line)] px-5 text-[12.5px] font-bold text-[var(--text)] no-underline transition-colors hover:border-[var(--a1)]"
                    >
                      <MessageCircle size={15} />
                      WhatsApp
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => void share()}
                    className="press inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--line)] px-5 text-[12.5px] font-bold text-[var(--text)] transition-colors hover:border-[var(--a1)]"
                  >
                    {copied ? <Check size={15} /> : <Share2 size={15} />}
                    {copied ? 'Link copied' : 'Share profile'}
                  </button>
                </div>

                {Object.keys(profile.socialLinks).length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {Object.entries(profile.socialLinks).map(([key, value]) => (
                      <a
                        key={key}
                        href={value}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-[10.5px] font-semibold capitalize text-[var(--muted)] no-underline transition-colors hover:border-[var(--a1)] hover:text-[var(--text)]"
                      >
                        <ExternalLink size={11} />
                        {key === 'x' ? 'X / Twitter' : key}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </article>

            <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)]/40 p-6 sm:p-7">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[var(--a1)]">
                  <Globe2 size={17} />
                </span>
                <div>
                  <h2 className="font-display text-[18px] font-bold">About MHOMHO</h2>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--muted)]">
                    {description}
                  </p>
                </div>
              </div>
            </section>

            <div className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3 text-[10.5px] text-[var(--faint)]">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-[var(--a1)]" />
                Appointment verified by MHOMHO
              </span>
              <button
                type="button"
                onClick={() => void share()}
                className="inline-flex items-center gap-1.5 font-semibold text-[var(--muted)] hover:text-[var(--text)]"
              >
                <Copy size={12} />
                Share
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
