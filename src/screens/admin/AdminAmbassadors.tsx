import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Check,
  ChevronRight,
  ExternalLink,
  FileText,
  Inbox,
  Loader2,
  Mail,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { Tag } from '../../components/Tag.tsx';
import {
  decideAdminAmbassador,
  getAdminAmbassadorApplication,
  listAdminAmbassadorApplications,
  type AdminAmbassadorApplication,
  type AdminAmbassadorList,
  type AmbassadorDocument,
  type AmbassadorProfile,
} from '../../lib/api.ts';

type Detail = {
  application: AdminAmbassadorApplication;
  documents: AmbassadorDocument[];
  reviews: Array<{
    id: string;
    action: string;
    note: string | null;
    actorEmail: string | null;
    createdAt: number;
  }>;
  profile: AmbassadorProfile | null;
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'submitted', label: 'New' },
  { id: 'under_review', label: 'Reviewing' },
  { id: 'needs_info', label: 'Needs info' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
] as const;

function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function statusTag(status: string): React.ReactNode {
  if (status === 'approved') return <Tag variant="ok">Approved</Tag>;
  if (status === 'needs_info') return <Tag variant="warn">Needs info</Tag>;
  if (status === 'under_review') return <Tag variant="warn">Reviewing</Tag>;
  if (status === 'rejected' || status === 'suspended') return <Tag variant="err">{status}</Tag>;
  return <Tag variant="warn">New</Tag>;
}

export const AdminAmbassadors: React.FC = () => {
  const [data, setData] = useState<AdminAmbassadorList | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async (keepSelection = true) => {
    setLoading(true);
    setError('');
    const result = await listAdminAmbassadorApplications();
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Ambassador applications could not be loaded.');
      return;
    }
    setData(result.data ?? null);
    const items = result.data?.items ?? [];
    const nextId =
      keepSelection && selectedId && items.some((item) => item.id === selectedId)
        ? selectedId
        : items[0]?.id ?? null;
    setSelectedId(nextId);
  };

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    setError('');
    const result = await getAdminAmbassadorApplication(id);
    setDetailLoading(false);
    if (!result.success) {
      setError(result.error || 'Application could not be loaded.');
      return;
    }
    setDetail(result.data ?? null);
    setNote(result.data?.application.adminNotes ?? '');
  };

  useEffect(() => {
    void load(false);
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId]);

  const items = useMemo(() => {
    const all = data?.items ?? [];
    if (filter === 'all') return all;
    return all.filter((item) => item.status === filter);
  }, [data, filter]);

  const act = async (
    action: 'note' | 'request_info' | 'approve' | 'reject' | 'suspend' | 'reinstate'
  ) => {
    if (!selectedId || busy) return;
    if (['request_info', 'reject', 'suspend'].includes(action) && !note.trim()) {
      setError('Add a private note before using this action.');
      return;
    }
    setBusy(action);
    setError('');
    setNotice('');
    const result = await decideAdminAmbassador(selectedId, action, note.trim() || undefined);
    setBusy('');
    if (!result.success) {
      setError(result.error || 'The action could not be completed.');
      return;
    }
    setNotice(
      action === 'approve'
        ? 'Application approved. Ambassador ID and draft profile created.'
        : action === 'request_info'
          ? 'Additional information requested.'
          : action === 'reject'
            ? 'Application rejected.'
            : action === 'suspend'
              ? 'Appointment suspended. Public profile is no longer active.'
              : action === 'reinstate'
                ? 'Appointment reinstated.'
                : 'Private note saved.'
    );
    await load();
    await loadDetail(selectedId);
  };

  return (
    <div className="pb-10">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
            Commercial appointments
          </span>
          <h2 className="font-display mt-1 text-[24px] font-bold leading-tight text-[var(--text)]">
            MHOMHO Ambassadors
          </h2>
          <p className="mt-1 max-w-[65ch] text-[12px] leading-relaxed text-[var(--muted)]">
            Review applications, inspect documents and approve the people who can officially
            represent MHOMHO. Applicants are never public before approval.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex h-9 shrink-0 items-center gap-2 self-start rounded-full border border-[var(--line)] px-3.5 text-[11px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)] disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-[var(--err)]/30 bg-[var(--err)]/10 px-3.5 py-2.5 text-[12px] font-semibold text-[var(--err)]">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-4 rounded-xl border border-[var(--ok)]/30 bg-[var(--ok)]/10 px-3.5 py-2.5 text-[12px] font-semibold text-[var(--ok)]">
          {notice}
        </p>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ['Total', data?.counts.total ?? 0],
          ['New', data?.counts.submitted ?? 0],
          ['Reviewing', data?.counts.underReview ?? 0],
          ['Needs info', data?.counts.needsInfo ?? 0],
          ['Approved', data?.counts.approved ?? 0],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-[var(--line)] bg-[var(--surface)]/40 px-3 py-2.5"
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--faint)]">
              {label}
            </p>
            <p className="mt-1 font-display text-[20px] font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]">
          <div className="flex flex-wrap gap-1 border-b border-[var(--line)] p-2">
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                className={`rounded-lg px-2.5 py-1.5 text-[10.5px] font-semibold transition-colors ${
                  filter === option.id
                    ? 'bg-[var(--surface-2)] text-[var(--text)]'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="app-scroll max-h-[640px] overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-[var(--muted)]">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Inbox size={22} className="text-[var(--faint)]" />
                <p className="mt-2 text-[12px] text-[var(--muted)]">No applications here.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                      selectedId === item.id
                        ? 'border-[var(--a1)]/50 bg-[var(--surface-2)]'
                        : 'border-transparent hover:bg-[var(--surface)]'
                    }`}
                  >
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--a1)]">
                      <UserRound size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[12.5px] font-bold">{item.fullName}</span>
                        {statusTag(item.status)}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 truncate text-[10.5px] text-[var(--muted)]">
                        <MapPin size={11} />
                        {item.city}, {item.country}
                        <span className="text-[var(--faint)]">·</span>
                        {formatDate(item.createdAt)}
                      </span>
                      <span className="mt-0.5 block font-mono text-[9.5px] text-[var(--faint)]">
                        {item.reference}
                      </span>
                    </span>
                    <ChevronRight size={14} className="mt-1 shrink-0 text-[var(--faint)]" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)]">
          {!selectedId ? (
            <div className="flex flex-col items-center py-16 text-center">
              <ShieldCheck size={24} className="text-[var(--faint)]" />
              <p className="mt-2 text-[12px] text-[var(--muted)]">
                Select an application to review it.
              </p>
            </div>
          ) : detailLoading || !detail ? (
            <div className="flex items-center justify-center py-16 text-[var(--muted)]">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : (
            <div>
              <div className="border-b border-[var(--line)] p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {statusTag(detail.application.status)}
                      <span className="font-mono text-[9.5px] text-[var(--faint)]">
                        {detail.application.reference}
                      </span>
                    </div>
                    <h3 className="font-display mt-2 text-[22px] font-bold leading-tight">
                      {detail.application.fullName}
                    </h3>
                    <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-[var(--muted)]">
                      <MapPin size={12} />
                      {detail.application.city}, {detail.application.country}
                      {detail.application.territory
                        ? ` · ${detail.application.territory}`
                        : ''}
                    </p>
                  </div>
                  {detail.application.profileStatus === 'published' &&
                    detail.application.username && (
                      <a
                        href={`/ambassadors/${detail.application.username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-[var(--line)] px-3 text-[10px] font-bold text-[var(--text)] no-underline hover:border-[var(--a1)]"
                      >
                        <ExternalLink size={11} />
                        Profile
                      </a>
                    )}
                </div>

                <div className="mt-4 grid gap-2 text-[11.5px] sm:grid-cols-2">
                  <a
                    href={`mailto:${detail.application.email}`}
                    className="flex items-center gap-2 text-[var(--muted)] no-underline hover:text-[var(--text)]"
                  >
                    <Mail size={12} className="text-[var(--a1)]" />
                    <span className="truncate">{detail.application.email}</span>
                  </a>
                  <span className="flex items-center gap-2 text-[var(--muted)]">
                    <UserRound size={12} className="text-[var(--a1)]" />
                    {detail.application.phone}
                  </span>
                </div>
              </div>

              <div className="space-y-5 p-4 sm:p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Info label="Sectors" value={detail.application.sectors.join(', ') || '—'} />
                  <Info label="Languages" value={detail.application.languages.join(', ') || '—'} />
                  <Info label="Experience" value={detail.application.experience || '—'} />
                  <Info
                    label="Ambassador ID"
                    value={detail.application.ambassadorId || 'Not issued'}
                  />
                </div>

                <Info label="Why MHOMHO" value={detail.application.motivation || '—'} />
                {detail.application.requestedInfo && (
                  <Info label="Information requested" value={detail.application.requestedInfo} />
                )}
                {detail.application.applicantResponse && (
                  <Info label="Applicant response" value={detail.application.applicantResponse} />
                )}

                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--faint)]">
                    Documents
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {detail.documents.length === 0 ? (
                      <p className="text-[11.5px] text-[var(--faint)]">No documents uploaded.</p>
                    ) : (
                      detail.documents.map((document) => (
                        <a
                          key={document.id}
                          href={document.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-2.5 py-2 text-[11px] font-semibold text-[var(--text)] no-underline hover:border-[var(--a1)]"
                        >
                          <FileText size={13} className="shrink-0 text-[var(--a1)]" />
                          <span className="min-w-0 flex-1 truncate">
                            {document.originalName || 'Document'}
                          </span>
                          <span className="text-[9px] text-[var(--faint)]">
                            {(document.sizeBytes / 1024 / 1024).toFixed(1)} MB
                          </span>
                        </a>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--faint)]">
                    Private note
                  </p>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                    placeholder="Visible only to administrators. Required for requests, rejections and suspensions."
                    className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-[12px] leading-relaxed text-[var(--text)] outline-none focus:border-[var(--a1)]"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    label="Save note"
                    icon={<Check size={12} />}
                    busy={busy === 'note'}
                    onClick={() => void act('note')}
                  />
                  <ActionButton
                    label="Request info"
                    icon={<Mail size={12} />}
                    busy={busy === 'request_info'}
                    onClick={() => void act('request_info')}
                  />
                  {['submitted', 'under_review', 'needs_info'].includes(
                    detail.application.status
                  ) && (
                    <ActionButton
                      label="Approve"
                      icon={<BadgeCheck size={12} />}
                      tone="ok"
                      busy={busy === 'approve'}
                      onClick={() => void act('approve')}
                    />
                  )}
                  {detail.application.status === 'approved' && (
                    <ActionButton
                      label="Suspend"
                      icon={<X size={12} />}
                      tone="danger"
                      busy={busy === 'suspend'}
                      onClick={() => void act('suspend')}
                    />
                  )}
                  {['rejected', 'suspended'].includes(detail.application.status) && (
                    <ActionButton
                      label="Reinstate"
                      icon={<RefreshCw size={12} />}
                      tone="ok"
                      busy={busy === 'reinstate'}
                      onClick={() => void act('reinstate')}
                    />
                  )}
                  {!['approved', 'rejected'].includes(detail.application.status) && (
                    <ActionButton
                      label="Reject"
                      icon={<X size={12} />}
                      tone="danger"
                      busy={busy === 'reject'}
                      onClick={() => void act('reject')}
                    />
                  )}
                </div>

                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--faint)]">
                    Review history
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {detail.reviews.length === 0 ? (
                      <p className="text-[11.5px] text-[var(--faint)]">No actions yet.</p>
                    ) : (
                      detail.reviews.map((review) => (
                        <div
                          key={review.id}
                          className="rounded-lg border border-[var(--line)] px-2.5 py-2"
                        >
                          <p className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                            <span>{review.action.replace(/_/g, ' ')}</span>
                            <span className="font-normal normal-case tracking-normal text-[var(--faint)]">
                              {formatDate(review.createdAt)}
                            </span>
                          </p>
                          {review.note && (
                            <p className="mt-1 text-[11px] leading-relaxed text-[var(--text)]">
                              {review.note}
                            </p>
                          )}
                          {review.actorEmail && (
                            <p className="mt-1 text-[9px] text-[var(--faint)]">
                              {review.actorEmail}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)]/30 px-3 py-2.5">
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--faint)]">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-line text-[11.5px] leading-relaxed text-[var(--text)]">
        {value}
      </p>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  busy,
  tone = 'neutral',
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  tone?: 'neutral' | 'ok' | 'danger';
}) {
  const className =
    tone === 'ok'
      ? 'border-[var(--ok)]/40 bg-[var(--ok)]/10 text-[var(--ok)]'
      : tone === 'danger'
        ? 'border-[var(--err)]/40 bg-[var(--err)]/10 text-[var(--err)]'
        : 'border-[var(--line)] text-[var(--text)]';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[10.5px] font-bold transition-colors hover:border-[var(--a1)] disabled:opacity-50 ${className}`}
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}
