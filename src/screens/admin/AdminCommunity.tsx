import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  MessageCircle,
  Pin,
  ShieldCheck,
  Trophy,
  Unlock,
  Users,
} from 'lucide-react';
import { Card } from '../../components/Card.tsx';
import { Tag } from '../../components/Tag.tsx';
import { Avatar } from '../../components/Avatar.tsx';
import {
  FORUM_CATEGORY_LABELS,
  type AdminCommunityOverview,
  type CommunityThreadDetail,
  type ForumCategory,
  type ForumThreadSummary,
} from '../../lib/community.ts';
import {
  fetchAdminCommunity,
  fetchCommunityThread,
  moderateCommunityReply,
  moderateCommunityThread,
} from '../../lib/api.ts';
import { formatViews } from '../../lib/money.ts';
import { absoluteTime, relativeTime } from '../../lib/relativeTime.ts';

type AdminCommunitySection = 'moderation' | 'creators' | 'leaderboard';

function categoryLabel(value: string): string {
  return FORUM_CATEGORY_LABELS[value as ForumCategory] ?? value;
}

function statusTag(status: string): React.ReactNode {
  if (status === 'approved') return <Tag variant="ok">Approved</Tag>;
  if (status === 'applied') return <Tag variant="warn">Applied</Tag>;
  return <Tag variant="err">{status === 'suspended' ? 'Suspended' : 'Rejected'}</Tag>;
}

export const AdminCommunity: React.FC = () => {
  const [section, setSection] = useState<AdminCommunitySection>('moderation');
  const [data, setData] = useState<AdminCommunityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CommunityThreadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    const result = await fetchAdminCommunity();
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'The community could not be loaded.');
      return;
    }
    setData(result.data ?? null);
  };

  const loadDetail = async (threadId: string) => {
    setDetailLoading(true);
    setDetailError('');
    const result = await fetchCommunityThread(threadId);
    setDetailLoading(false);
    if (!result.success || !result.data) {
      setDetailError(result.success ? 'That discussion could not be loaded.' : result.error);
      return;
    }
    setDetail(result.data);
  };

  useEffect(() => {
    void load();
  }, []);

  const openThread = (threadId: string) => {
    setSelectedId(threadId);
    setDetail(null);
    setNotice('');
    void loadDetail(threadId);
  };

  const closeThread = () => {
    setSelectedId(null);
    setDetail(null);
    setDetailError('');
  };

  const moderateThread = async (
    thread: ForumThreadSummary,
    input: { status?: 'active' | 'locked' | 'hidden'; pinned?: boolean },
    message: string
  ) => {
    setBusyId(thread.id);
    setNotice('');
    const result = await moderateCommunityThread(thread.id, input);
    setBusyId(null);
    if (!result.success) {
      setNotice(result.error || 'The discussion could not be updated.');
      return;
    }
    setNotice(message);
    await load();
    if (selectedId === thread.id) await loadDetail(thread.id);
  };

  const moderateReply = async (replyId: string, status: 'active' | 'hidden') => {
    setBusyId(replyId);
    setNotice('');
    const result = await moderateCommunityReply(replyId, status);
    setBusyId(null);
    if (!result.success) {
      setNotice(result.error || 'The reply could not be updated.');
      return;
    }
    setNotice(status === 'hidden' ? 'Reply hidden.' : 'Reply restored.');
    if (selectedId) await loadDetail(selectedId);
    await load();
  };

  if (selectedId) {
    return (
      <div className="pb-10">
        <button
          type="button"
          onClick={closeThread}
          className="mb-4 inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--line)] px-3.5 text-[12px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)] cursor-pointer"
        >
          <ArrowLeft size={13} />
          Back to moderation
        </button>

        {detailLoading ? (
          <Card>
            <p className="py-8 text-center text-[12px] text-[var(--muted)]">Loading discussion…</p>
          </Card>
        ) : detailError ? (
          <Card className="border-[var(--err)]/30 bg-[var(--err)]/10">
            <p className="text-[12px] font-semibold text-[var(--err)]">{detailError}</p>
            <button
              type="button"
              onClick={() => loadDetail(selectedId)}
              className="mt-2 text-[11px] font-bold underline underline-offset-2 cursor-pointer"
            >
              Try again
            </button>
          </Card>
        ) : detail ? (
          <>
            <Card>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                  {categoryLabel(detail.thread.category)}
                </span>
                {detail.thread.pinned ? <Tag variant="ok">Pinned</Tag> : null}
                {detail.thread.status === 'locked' ? <Tag variant="warn">Locked</Tag> : null}
                {detail.thread.status === 'hidden' ? <Tag variant="err">Hidden</Tag> : null}
              </div>
              <h2 className="font-display mt-2 text-[22px] font-bold leading-tight">
                {detail.thread.title}
              </h2>
              <div className="mt-3 flex items-center gap-2">
                <Avatar
                  avatarKey={detail.thread.authorAvatarKey}
                  handle={detail.thread.authorHandle}
                  size={32}
                />
                <div>
                  <p className="text-[12px] font-bold">{detail.thread.authorHandle}</p>
                  <p className="text-[10px] text-[var(--muted)]">
                    {detail.thread.authorPlatform} · {relativeTime(detail.thread.createdAt)}
                  </p>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[var(--muted)]">
                {detail.thread.body}
              </p>
            </Card>

            <Card>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === detail.thread.id}
                  onClick={() =>
                    moderateThread(
                      detail.thread,
                      { pinned: !detail.thread.pinned },
                      detail.thread.pinned ? 'Discussion unpinned.' : 'Discussion pinned.'
                    )
                  }
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--line)] px-3 text-[11px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)] disabled:opacity-50 cursor-pointer"
                >
                  <Pin size={12} />
                  {detail.thread.pinned ? 'Unpin' : 'Pin'}
                </button>
                <button
                  type="button"
                  disabled={busyId === detail.thread.id}
                  onClick={() =>
                    moderateThread(
                      detail.thread,
                      { status: detail.thread.status === 'locked' ? 'active' : 'locked' },
                      detail.thread.status === 'locked'
                        ? 'Discussion unlocked.'
                        : 'Discussion locked.'
                    )
                  }
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--line)] px-3 text-[11px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)] disabled:opacity-50 cursor-pointer"
                >
                  {detail.thread.status === 'locked' ? <Unlock size={12} /> : <Lock size={12} />}
                  {detail.thread.status === 'locked' ? 'Unlock' : 'Lock'}
                </button>
                <button
                  type="button"
                  disabled={busyId === detail.thread.id}
                  onClick={() =>
                    moderateThread(
                      detail.thread,
                      { status: detail.thread.status === 'hidden' ? 'active' : 'hidden' },
                      detail.thread.status === 'hidden'
                        ? 'Discussion restored.'
                        : 'Discussion hidden from creators.'
                    )
                  }
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--err)]/40 px-3 text-[11px] font-semibold text-[var(--err)] transition-colors hover:bg-[var(--err)]/10 disabled:opacity-50 cursor-pointer"
                >
                  {detail.thread.status === 'hidden' ? <Eye size={12} /> : <EyeOff size={12} />}
                  {detail.thread.status === 'hidden' ? 'Restore' : 'Hide'}
                </button>
              </div>
            </Card>

            <div className="mb-2 mt-5 flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-bold">Replies</h3>
              <span className="text-[11px] text-[var(--faint)]">{detail.replies.length}</span>
            </div>

            <Card style={{ padding: 0 }}>
              {detail.replies.length === 0 ? (
                <p className="px-4 py-8 text-center text-[12px] text-[var(--muted)]">
                  No replies yet.
                </p>
              ) : (
                <div className="divide-y divide-[var(--line)]">
                  {detail.replies.map((reply) => (
                    <div key={reply.id} className="flex gap-2.5 px-4 py-3.5">
                      <Avatar
                        avatarKey={reply.authorAvatarKey}
                        handle={reply.authorHandle}
                        size={30}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-[11.5px] font-bold">{reply.authorHandle}</span>
                          {reply.status === 'hidden' ? <Tag variant="err">Hidden</Tag> : null}
                          <span className="text-[9.5px] text-[var(--faint)]">
                            {relativeTime(reply.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-[var(--muted)]">
                          {reply.body}
                        </p>
                        <button
                          type="button"
                          disabled={busyId === reply.id}
                          onClick={() =>
                            moderateReply(
                              reply.id,
                              reply.status === 'hidden' ? 'active' : 'hidden'
                            )
                          }
                          className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--faint)] transition-colors hover:text-[var(--text)] disabled:opacity-50 cursor-pointer"
                        >
                          {reply.status === 'hidden' ? <Eye size={10} /> : <EyeOff size={10} />}
                          {reply.status === 'hidden' ? 'Restore reply' : 'Hide reply'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {notice ? (
              <p className="mt-2 text-[11.5px] font-semibold text-[var(--muted)]">{notice}</p>
            ) : null}
          </>
        ) : null}
      </div>
    );
  }

  const totals = data?.totals;

  return (
    <div className="pb-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
            Creator community
          </p>
          <h2 className="font-display mt-1 text-[24px] font-bold leading-tight">Community</h2>
        </div>
        <div className="flex items-center gap-2">
          <Tag variant="ok">{totals?.activeThreads ?? 0} active</Tag>
          {totals?.hiddenThreads ? <Tag variant="err">{totals.hiddenThreads} hidden</Tag> : null}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 sm:w-fit">
        {SECTION_LABELS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-[11.5px] font-bold transition-colors cursor-pointer ${
              section === item.id
                ? 'bg-[var(--surface-2)] text-[var(--text)]'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            <item.icon size={13} />
            {item.label}
          </button>
        ))}
      </div>

      {notice ? (
        <p className="mb-3 text-[11.5px] font-semibold text-[var(--muted)]">{notice}</p>
      ) : null}

      {loading && !data ? (
        <Card>
          <p className="py-8 text-center text-[12px] text-[var(--muted)]">Loading community…</p>
        </Card>
      ) : error ? (
        <Card className="border-[var(--err)]/30 bg-[var(--err)]/10">
          <p className="text-[12px] font-semibold text-[var(--err)]">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-2 text-[11px] font-bold underline underline-offset-2 cursor-pointer"
          >
            Try again
          </button>
        </Card>
      ) : data ? (
        <>
          {section === 'moderation' ? (
            <Card style={{ padding: 0 }}>
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div>
                  <h3 className="text-[14px] font-bold">Forum moderation</h3>
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                    {totals?.activeThreads ?? 0} active · {totals?.lockedThreads ?? 0} locked ·{' '}
                    {totals?.hiddenThreads ?? 0} hidden
                  </p>
                </div>
                <MessageCircle size={16} className="text-[var(--faint)]" />
              </div>
              {data.threads.length === 0 ? (
                <p className="border-t border-[var(--line)] px-4 py-8 text-center text-[12px] text-[var(--muted)]">
                  No discussions yet.
                </p>
              ) : (
                <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
                  {data.threads.map((thread) => (
                    <div key={thread.id} className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => openThread(thread.id)}
                        className="w-full text-left cursor-pointer"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                            {categoryLabel(thread.category)}
                          </span>
                          {thread.pinned ? <Tag variant="ok">Pinned</Tag> : null}
                          {thread.status === 'locked' ? <Tag variant="warn">Locked</Tag> : null}
                          {thread.status === 'hidden' ? <Tag variant="err">Hidden</Tag> : null}
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold text-[var(--text)]">
                          {thread.title}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[10.5px] text-[var(--faint)]">
                          <span>{thread.authorHandle}</span>
                          <span>·</span>
                          <span>{thread.replyCount} replies</span>
                          <span>·</span>
                          <span title={absoluteTime(thread.lastActivityAt)}>
                            {relativeTime(thread.lastActivityAt)}
                          </span>
                        </p>
                      </button>

                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <ModButton
                          onClick={() =>
                            moderateThread(
                              thread,
                              { pinned: !thread.pinned },
                              thread.pinned ? 'Discussion unpinned.' : 'Discussion pinned.'
                            )
                          }
                          disabled={busyId === thread.id}
                          icon={<Pin size={10} />}
                        >
                          {thread.pinned ? 'Unpin' : 'Pin'}
                        </ModButton>
                        <ModButton
                          onClick={() =>
                            moderateThread(
                              thread,
                              { status: thread.status === 'locked' ? 'active' : 'locked' },
                              thread.status === 'locked'
                                ? 'Discussion unlocked.'
                                : 'Discussion locked.'
                            )
                          }
                          disabled={busyId === thread.id}
                          icon={thread.status === 'locked' ? <Unlock size={10} /> : <Lock size={10} />}
                        >
                          {thread.status === 'locked' ? 'Unlock' : 'Lock'}
                        </ModButton>
                        <ModButton
                          onClick={() =>
                            moderateThread(
                              thread,
                              { status: thread.status === 'hidden' ? 'active' : 'hidden' },
                              thread.status === 'hidden'
                                ? 'Discussion restored.'
                                : 'Discussion hidden from creators.'
                            )
                          }
                          disabled={busyId === thread.id}
                          icon={thread.status === 'hidden' ? <Eye size={10} /> : <EyeOff size={10} />}
                          danger={thread.status !== 'hidden'}
                        >
                          {thread.status === 'hidden' ? 'Restore' : 'Hide'}
                        </ModButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : null}

          {section === 'creators' ? (
            <Card style={{ padding: 0 }}>
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div>
                  <h3 className="text-[14px] font-bold">Recent creators</h3>
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                    Every sign-up, newest first
                  </p>
                </div>
                <Users size={16} className="text-[var(--faint)]" />
              </div>
              {data.recentCreators.length === 0 ? (
                <p className="border-t border-[var(--line)] px-4 py-8 text-center text-[12px] text-[var(--muted)]">
                  No creator accounts yet.
                </p>
              ) : (
                <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
                  {data.recentCreators.map((creator) => (
                    <div key={creator.uid} className="flex items-center gap-3 px-4 py-3">
                      <Avatar
                        avatarKey={creator.avatarKey}
                        handle={creator.handle}
                        size={36}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-bold">{creator.handle}</p>
                        <p className="mt-0.5 truncate text-[10.5px] text-[var(--muted)]">
                          {creator.platform} · {creator.niche}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {statusTag(creator.status)}
                        <p
                          className="mt-1 text-[9.5px] text-[var(--faint)]"
                          title={absoluteTime(creator.joinedAtMs)}
                        >
                          {relativeTime(creator.joinedAtMs)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : null}

          {section === 'leaderboard' ? (
            <Card style={{ padding: 0 }}>
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div>
                  <h3 className="text-[14px] font-bold">{data.month.label} leaderboard</h3>
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                    Verified views from approved clips
                  </p>
                </div>
                <Trophy size={16} className="text-[var(--a1)]" />
              </div>
              {data.leaderboard.length === 0 ? (
                <p className="border-t border-[var(--line)] px-4 py-8 text-center text-[12px] text-[var(--muted)]">
                  No verified views this month yet.
                </p>
              ) : (
                <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
                  {data.leaderboard.map((entry) => (
                    <div key={entry.uid} className="flex items-center gap-3 px-4 py-3">
                      <span className="w-5 text-center text-[11px] font-extrabold tabular-nums text-[var(--faint)]">
                        {entry.rank}
                      </span>
                      <Avatar
                        avatarKey={entry.avatarKey}
                        handle={entry.handle}
                        size={32}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-bold">{entry.handle}</p>
                        <p className="text-[10.5px] text-[var(--muted)]">{entry.platform}</p>
                      </div>
                      <p className="text-[12.5px] font-extrabold tabular-nums">
                        {formatViews(entry.views)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

const SECTION_LABELS: {
  id: AdminCommunitySection;
  label: string;
  icon: React.ElementType;
}[] = [
  { id: 'moderation', label: 'Moderation', icon: ShieldCheck },
  { id: 'creators', label: 'Creators', icon: Users },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
];

const ModButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  danger?: boolean;
  children: React.ReactNode;
}> = ({ onClick, disabled, icon, danger, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[10px] font-semibold transition-colors disabled:opacity-50 cursor-pointer ${
      danger
        ? 'border-[var(--err)]/35 text-[var(--err)] hover:bg-[var(--err)]/10'
        : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]'
    }`}
  >
    {icon}
    {children}
  </button>
);
