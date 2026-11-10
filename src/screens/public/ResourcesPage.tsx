import React from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Download, FileText, ShieldCheck, Sparkles } from 'lucide-react';
import { MhomhoLogo } from '../../components/MhomhoLogo.tsx';

export interface ResourcesPageProps {
  onBack: () => void;
  onApply: () => void;
}

const FIELD_LABEL =
  'mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--faint)]';

export const ResourcesPage: React.FC<ResourcesPageProps> = ({
  onBack,
  onApply,
}) => {
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
          <MhomhoLogo height={30} />
          <button
            type="button"
            onClick={onApply}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-mhomho px-3.5 text-[11.5px] font-bold text-[var(--ink)] transition-transform hover:-translate-y-0.5"
          >
            Apply now
            <ArrowRight size={13} />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-12 sm:px-8 sm:pt-20">
        <section className="mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.18em] text-[var(--a1)]">
            <Sparkles size={12} />
            Resources
          </div>
          <h1 className="font-display mt-5 text-[40px] font-bold leading-[1.02] tracking-[-0.04em] sm:text-[56px]">
            MHOMHO Commercial Envoy programme
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-[14px] leading-relaxed text-[var(--muted)] sm:text-[15px]">
            The MHOMHO Commercial Envoy programme is a selective commercial appointment for credible
            business connectors who can open doors for brands and creators. Read this page before you
            apply so you know exactly what you are getting into, what you get from MHOMHO, and how the
            appointment works.
          </p>
        </section>

        <section className="mx-auto mt-14 max-w-3xl">
          <h2 className="font-display text-[22px] font-bold tracking-[-0.02em]">What this is</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">
            A Commercial Envoy is a formally appointed commercial representative of MHOMHO. You introduce
            credible businesses to MHOMHO so they can run creator campaigns, and you earn from the
            relationships you bring. It is an appointment — not a job, not employment, and not a guarantee
            of income.
          </p>
        </section>

        <section className="mx-auto mt-10 max-w-3xl">
          <h2 className="font-display text-[22px] font-bold tracking-[-0.02em]">What you get from MHOMHO</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: 'Commercial Envoy ID',
                body: 'A unique public ID (MH-AMB-000001 format) that identifies your appointment.',
              },
              {
                title: 'Public verified profile',
                body: 'A published profile page showing your photo, bio, location, sectors and contact details.',
              },
              {
                title: 'International network',
                body: 'Access to MHOMHO’s brand network and creator community across markets.',
              },
            ].map((item) => (
              <article
                key={item.title}
                className="rounded-[22px] border border-[var(--line)] bg-[var(--bg)]/60 p-5 sm:p-6"
              >
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--a1)]">
                  {item.title}
                </span>
                <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--muted)]">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-12 max-w-3xl">
          <h2 className="font-display text-[22px] font-bold tracking-[-0.02em]">How it works</h2>
          <ol className="mt-6 space-y-4 text-[13px] leading-relaxed text-[var(--muted)] sm:text-[14px]">
            <li className="flex gap-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--a1)] text-[10px] font-bold text-[var(--ink)]">
                1
              </span>
              <div>
                <span className="font-semibold text-[var(--text)]">Apply.</span>{' '}
                Fill in the application form and attach supporting documents. You receive an application
                reference immediately.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--a1)] text-[10px] font-bold text-[var(--ink)]">
                2
              </span>
              <div>
                <span className="font-semibold text-[var(--text)]">Review.</span>{' '}
                The MHOMHO team reviews your application privately. Nothing is public unless you are
                approved and publish a profile.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--a1)] text-[10px] font-bold text-[var(--ink)]">
                3
              </span>
              <div>
                <span className="font-semibold text-[var(--text)]">Appoint.</span>{' '}
                On approval you receive your Commercial Envoy ID and can publish your public profile.
              </div>
            </li>
          </ol>
        </section>

        <section className="mx-auto mt-12 max-w-3xl rounded-[26px] border border-[var(--line)] bg-[var(--bg)]/50 p-6 sm:p-9">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-[20px] font-bold tracking-[-0.02em]">Read the full programme</h2>
              <p className="mt-1 text-[12.5px] text-[var(--muted)]">
                Everything you need to know before you apply, including appointment terms and what MHOMHO
                expects from envoys.
              </p>
            </div>
            <a
              href="/download/commercial-envoy-programme.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-mhomho px-5 text-[12.5px] font-bold text-[var(--ink)] transition-transform hover:-translate-y-0.5"
            >
              <Download size={15} />
              Download programme PDF
            </a>
          </div>
        </section>

        <section className="mx-auto mt-12 max-w-3xl">
          <div className="rounded-[26px] border border-[var(--line)] bg-gradient-mhomho p-6 sm:p-9 text-[var(--ink)]">
            <div className="inline-flex items-center gap-2 mb-3">
              <ShieldCheck size={14} />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em]">Admin-approved appointment</span>
            </div>
            <h2 className="font-display text-[24px] font-bold tracking-[-0.02em] mb-3">
              Ready to apply?
            </h2>
            <p className="text-[13px] leading-relaxed mb-6 max-w-[45ch]">
              Applications are reviewed individually. Authorisation begins only after MHOMHO approves your
              application.
            </p>
            <button
              type="button"
              onClick={onApply}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-5 text-[12.5px] font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              Start application
              <ArrowRight size={13} />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};
