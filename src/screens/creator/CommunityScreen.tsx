import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Flame,
  LoaderCircle,
  MessageCircle,
  Pin,
  Plus,
  Send,
  Trophy,
  Users,
} from 'lucide-react';
import { Card } from '../../components/Card.tsx';
import { Button } from '../../components/Button.tsx';
import { Tag } from '../../components/Tag.tsx';
import { Avatar } from '../../components/Avatar.tsx';
import {
  FORUM_CATEGORIES,
  FORUM_CATEGORY_LABELS,
  type CommunityOverview,
  type CommunityThreadDetail,
  type ForumCategory,
  type ForumThreadSummary,
} from '../../lib/community.ts';
import {
  createCommunityThread,
  fetchCommunityOverview,
  fetchCommunityThread,
  fetchCommunityThreads,
  replyToCommunityThread,
} from '../../lib/api.ts';
import { formatViews } from '../../lib/money.ts';
import { absoluteTime, relativeTime } from '../../lib/relativeTime.ts';

export interface CommunityScreenProps {
  currentUid: string;
}

type CommunitySection = 'creators' | 'leaderboard' | 'discussions';

const SECTION_LABELS: { id: CommunitySection; label: string; icon: React.ElementType }[] = [
  { id: 'creators', label: 'New creators', icon: Users },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'discussions', label: 'Discussions', icon: MessageCircle },
];

const PAGE_SIZE = 20;

function categoryLabel(value: string): string {
  return FORUM_CATEGORY_LABELS[value as ForumCategory] ?? value;
}

function rankClass(rank: number): string {
  if (rank === 1) return 'text-[var(--a1)]';
  if (rank === 2) return 'text-[var(--text)]';
  if (rank === 3) return 'text-[var(--warn)]';
  return 'text-[var(--faint)]';
}

export const CommunityScreen: React.FC<CommunityScreenProps> = ({ currentUid }) => {
  const [section, setSection] = useState<CommunitySection>('creators');
  const [overview, setOverview] = useState<CommunityOverview | null>(null);
  const [overviewError, setOverviewError] = useState('');
  const [loadingOverview, setLoadingOverview] = useState(true);

  const [threads, setThreads] = useState<ForumThreadSummary[]>([]);
  const [category, setCategory] = useState<ForumCategory | ''>('');
  const [nextOffset, setNextOffset] = useState(0);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [threadError, setThreadError] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CommunityThreadDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [composerOpen, setComposerOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<ForumCategory>('general');
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [composerBusy, setComposerBusy] = useState(false);
  const [composerError, setComposerError] = useState('');

  const [replyBody, setReplyBody] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [notice, setNotice] = useState('');

  const loadOverview = async () => {
    setLoadingOverview(true);
    setOverviewError('');
    const result = await fetchCommunityOverview();
    setLoadingOverview(false);
    if (!result.success) {
      setOverviewError(result.error || 'The community could not be loaded.');
      return;
    }
    setOverview(result.data ?? null);
  };

  const loadThreads = async (reset: boolean, categoryOverride?: ForumCategory | '') => {
    const activeCategory = categoryOverride === undefined ? category : categoryOverride;
    setLoadingThreads(true);
    setThreadError('');
    const result = await fetchCommunityThreads({
      category: activeCategory,
      offset: reset ? 0 : nextOffset,
    });
    setLoadingThreads(false);
    if (!result.success || !result.data) {
      setThreadError(result.success ? 'The discussions could not be loaded.' : result.error);
      return;
    }
    setThreads((current) =>
      reset ? result.data!.threads : [...current, ...result.data!.threads]
    );
    setNextOffset(result.data.nextOffset);
  };

  const loadDetail = async (threadId: string) => {
    setLoadingDetail(true);
    setDetailError('');
    const result = await fetchCommunityThread(threadId);
    setLoadingDetail(false);
    if (!result.success || !result.data) {
      setDetailError(result.success ? 'That discussion could not be loaded.' : result.error);
      setDetail(null);
      return;
    }
    setDetail(result.data);
  };

  useEffect(() => {
    void loadOverview();
    // The overview is the page's first read. Subsequent mutations refresh it
    // explicitly so a stale interval cannot overwrite a fresh thread list.
  }, []);

  useEffect(() => {
    if (section !== 'discussions' || selectedId) return;
    void loadThreads(true);
    // Category changes intentionally start a fresh page.
  }, [section, category]);

  const openThread = (threadId: string) => {
    setSelectedId(threadId);
    setDetail(null);
    setReplyBody('');
    setReplyError('');
    setNotice('');
    void loadDetail(threadId);
  };

  const closeThread = () => {
    setSelectedId(null);
    setDetail(null);
    setDetailError('');
    setReplyError('');
    setNotice('');
  };

  const handleCreateThread = async (event: React.FormEvent) => {
    event.preventDefault();
    if (composerBusy) return;
    setComposerBusy(true);
    setComposerError('');
    const result = await createCommunityThread({
      category: newCategory,
      title: newTitle.trim(),
      body: newBody.trim(),
    });
    setComposerBusy(false);
    if (!result.success) {
      setComposerError(result.error || 'Your discussion could not be posted.');
      return;
    }

    setComposerOpen(false);
    setNewTitle('');
    setNewBody('');
    setCategory('');
    await loadOverview();
    await loadThreads(true, '');
    if (result.data?.threadId) openThread(result.data.threadId);
    setNotice('Discussion published.');
  };

  const handleReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedId || replyBusy) return;
    const body = replyBody.trim();
    if (!body) return;
    setReplyBusy(true);
    setReplyError('');
    const result = await replyToCommunityThread(selectedId, body);
    setReplyBusy(false);
    if (!result.success) {
      setReplyError(result.error || 'Your reply could not be posted.');
      return;
    }
    setReplyBody('');
    setNotice('Reply posted.');
    await loadDetail(selectedId);
    await loadOverview();
    await loadThreads(true);
  };

  const monthLabel = overview?.month.label ?? '';
  const viewerInTop = useMemo(
    () => Boolean(overview?.leaderboard.some((entry) => entry.uid === currentUid)),
    [overview?.leaderboard, currentUid]
  );

  const renderCreators = () => {
    if (loadingOverview && !overview) return <LoadingBlock label="Loading creators…" />;
    if (overviewError) return <ErrorBlock message={overviewError} onRetry={loadOverview} />;
    const creators = overview?.recentCreators ?? [];
    return (
      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
              The roster
            </p>
            <h3 className="font-display mt-1 text-[21px] font-bold leading-tight">New creators</h3>
          </div>
          <span className="text-[11px] font-medium text-[var(--faint)]">Latest first</span>
        </div>

        <Card style={{ padding: 0 }}>
          {creators.length === 0 ? (
            <EmptyBlock
              icon={<Users size={18} />}
              title="No creators yet"
              body="Approved creators will appear here as they join the roster."
            />
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {creators.map((creator) => (
                <div key={creator.uid} className="flex items-center gap-3 px-4 py-3.5">
                  <Avatar
                    avatarKey={creator.avatarKey}
                    handle={creator.handle}
                    size={42}
                    title={`${creator.handle} avatar`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold text-[var(--text)]">
                      {creator.handle}
                    </p>
                    <p className="mt-0.5 truncate text-[11.5px] text-[var(--muted)]">
                      {creator.platform} · {creator.niche}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className="text-[11px] font-semibold text-[var(--muted)]"
                      title={absoluteTime(creator.joinedAtMs)}
                    >
                      {relativeTime(creator.joinedAtMs)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[var(--faint)]">joined</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  };

  const renderLeaderboard = () => {
    if (loadingOverview && !overview) return <LoadingBlock label="Loading leaderboard…" />;
    if (overviewError) return <ErrorBlock message={overviewError} onRetry={loadOverview} />;
    const entries = overview?.leaderboard ?? [];

    return (
      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
              {monthLabel || 'This month'}
            </p>
            <h3 className="font-display mt-1 text-[21px] font-bold leading-tight">
              Verified views
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
              Approved clips only. Counted in Africa/Harare time.
            </p>
          </div>
          <Trophy size={18} className="text-[var(--a1)]" />
        </div>

        <Card style={{ padding: 0 }}>
          {entries.length === 0 ? (
            <EmptyBlock
              icon={<Flame size={18} />}
              title="No views verified yet"
              body="The leaderboard fills up as this month's clips are verified."
            />
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {entries.map((entry) => {
                const isViewer = entry.uid === currentUid;
                return (
                  <div
                    key={entry.uid}
                    className={`flex items-center gap-3 px-4 py-3 ${
                      isViewer ? 'bg-[var(--a1)]/[0.06]' : ''
                    }`}
                  >
                    <span
                      className={`w-5 shrink-0 text-center text-[12px] font-extrabold tabular-nums ${rankClass(
                        entry.rank
                      )}`}
                    >
                      {entry.rank}
                    </span>
                    <Avatar
                      avatarKey={entry.avatarKey}
                      handle={entry.handle}
                      size={36}
                      title={`${entry.handle} avatar`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold">
                        {entry.handle}
                        {isViewer ? (
                          <span className="ml-1.5 text-[10px] font-semibold text-[var(--a1)]">
                            you
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-[var(--muted)]">
                        {entry.platform}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[13px] font-extrabold tabular-nums text-[var(--text)]">
                        {formatViews(entry.views)}
                      </p>
                      <p className="text-[9.5px] uppercase tracking-[0.12em] text-[var(--faint)]">
                        views
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {!viewerInTop && overview && overview.viewerViews > 0 ? (
          <Card className="mt-3 border-[var(--a1)]/25 bg-[var(--a1)]/[0.04]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--a1)]">
                  Your rank
                </p>
                <p className="mt-1 text-[13px] text-[var(--muted)]">
                  #{overview.viewerRank ?? '—'} · {formatViews(overview.viewerViews)} verified views
                </p>
              </div>
              <Trophy size={20} className="text-[var(--a1)]" />
            </div>
          </Card>
        ) : null}
      </div>
    );
  };

  const renderThreadList = () => (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
            Creator community
          </p>
          <h3 className="font-display mt-1 text-[21px] font-bold leading-tight">Discussions</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
            {overview?.totals.threads ?? 0} threads · {overview?.totals.replies ?? 0} replies
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setComposerOpen((open) => !open);
            setComposerError('');
          }}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-gradient-mhomho px-3.5 text-[11.5px] font-bold text-[var(--ink)] cursor-pointer"
        >
          <Plus size={13} />
          New
        </button>
      </div>

      {composerOpen ? (
        <Card className="border-[var(--a1)]/30">
          <form onSubmit={handleCreateThread} className="space-y-3">
            <div>
              <label className="mb-1 block text-[11.5px] font-semibold text-[var(--muted)]">
                Category
              </label>
              <select
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value as ForumCategory)}
                className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-[13px] font-semibold text-[var(--text)]"
              >
                {FORUM_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {FORUM_CATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11.5px] font-semibold text-[var(--muted)]">
                Title
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                maxLength={100}
                placeholder="What do you want to discuss?"
                className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-[13px] font-semibold text-[var(--text)]"
              />
              <p className="mt-1 text-[10px] text-[var(--faint)]">{newTitle.length}/100</p>
            </div>
            <div>
              <label className="mb-1 block text-[11.5px] font-semibold text-[var(--muted)]">
                Message
              </label>
              <textarea
                value={newBody}
                onChange={(event) => setNewBody(event.target.value)}
                maxLength={4000}
                rows={5}
                placeholder="Share context, a question, or what worked for you. Plain text only."
                className="w-full resize-y rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-[13px] leading-relaxed text-[var(--text)]"
              />
              <p className="mt-1 text-[10px] text-[var(--faint)]">{newBody.length}/4000</p>
            </div>
            {composerError ? (
              <p className="text-[11.5px] font-semibold text-[var(--err)]">{composerError}</p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={composerBusy} fullWidth={false}>
                {composerBusy ? 'Posting…' : 'Post discussion'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                fullWidth={false}
                onClick={() => setComposerOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-0.5">
        <FilterButton active={category === ''} onClick={() => setCategory('')}>
          All
        </FilterButton>
        {FORUM_CATEGORIES.map((value) => (
          <FilterButton
            key={value}
            active={category === value}
            onClick={() => setCategory(value)}
          >
            {FORUM_CATEGORY_LABELS[value]}
          </FilterButton>
        ))}
      </div>

      {threadError ? <ErrorBlock message={threadError} onRetry={() => loadThreads(true)} /> : null}

      {!threadError && loadingThreads && threads.length === 0 ? (
        <LoadingBlock label="Loading discussions…" />
      ) : null}

      {!threadError && !loadingThreads && threads.length === 0 ? (
        <Card style={{ padding: 0 }}>
          <EmptyBlock
            icon={<MessageCircle size={18} />}
            title="No discussions yet"
            body="Start the first conversation for the creator community."
          />
        </Card>
      ) : null}

      <div className="space-y-2">
        {threads.map((thread) => (
          <button
            key={thread.id}
            type="button"
            onClick={() => openThread(thread.id)}
            className="w-full rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-4 text-left transition-colors hover:border-[var(--line-strong)] cursor-pointer"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                    {categoryLabel(thread.category)}
                  </span>
                  {thread.pinned ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--a1)]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--a1)]">
                      <Pin size={8} /> Pinned
                    </span>
                  ) : null}
                  {thread.status === 'locked' ? <Tag variant="warn">Locked</Tag> : null}
                  {thread.status === 'hidden' ? <Tag variant="err">Hidden</Tag> : null}
                </div>
                <p className="line-clamp-2 text-[13.5px] font-bold leading-snug text-[var(--text)]">
                  {thread.title}
                </p>
                <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-[var(--muted)]">
                  {thread.excerpt}
                </p>
              </div>
              <ChevronRight size={15} className="mt-1 shrink-0 text-[var(--faint)]" />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[var(--faint)]">
              <Avatar
                avatarKey={thread.authorAvatarKey}
                handle={thread.authorHandle}
                size={18}
                title={`${thread.authorHandle} avatar`}
              />
              <span className="font-semibold text-[var(--muted)]">{thread.authorHandle}</span>
              <span>·</span>
              <span title={absoluteTime(thread.lastActivityAt)}>
                {relativeTime(thread.lastActivityAt)}
              </span>
              <span>·</span>
              <span>
                {thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}
              </span>
            </div>
          </button>
        ))}
      </div>

      {threads.length > 0 && threads.length % PAGE_SIZE === 0 ? (
        <div className="mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void loadThreads(false)}
            disabled={loadingThreads}
          >
            {loadingThreads ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  );

  const renderThreadDetail = () => {
    if (loadingDetail) return <LoadingBlock label="Loading discussion…" />;
    if (detailError) {
      return (
        <div>
          <BackButton onClick={closeThread} />
          <ErrorBlock message={detailError} onRetry={() => selectedId && loadDetail(selectedId)} />
        </div>
      );
    }
    if (!detail) return <LoadingBlock label="Loading discussion…" />;

    const { thread, replies } = detail;
    return (
      <div>
        <BackButton onClick={closeThread} />

        <Card style={{ padding: 0 }}>
          <div className="p-4">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                {categoryLabel(thread.category)}
              </span>
              {thread.pinned ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--a1)]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--a1)]">
                  <Pin size={8} /> Pinned
                </span>
              ) : null}
              {thread.status === 'locked' ? <Tag variant="warn">Locked</Tag> : null}
              {thread.status === 'hidden' ? <Tag variant="err">Hidden</Tag> : null}
            </div>
            <h3 className="font-display text-[20px] font-bold leading-tight">{thread.title}</h3>
            <div className="mt-3 flex items-center gap-2">
              <Avatar
                avatarKey={thread.authorAvatarKey}
                handle={thread.authorHandle}
                size={30}
                title={`${thread.authorHandle} avatar`}
              />
              <div>
                <p className="text-[11.5px] font-bold text-[var(--text)]">
                  {thread.authorHandle}
                  {thread.authorUid === currentUid ? (
                    <span className="ml-1.5 text-[9.5px] font-semibold text-[var(--a1)]">you</span>
                  ) : null}
                </p>
                <p className="text-[9.5px] text-[var(--faint)]" title={absoluteTime(thread.createdAt)}>
                  {relativeTime(thread.createdAt)} · {thread.authorPlatform}
                </p>
              </div>
            </div>
            <p className="mt-3.5 whitespace-pre-wrap break-words text-[13px] leading-[1.65] text-[var(--muted)]">
              {thread.body}
            </p>
          </div>

          <div className="border-t border-[var(--line)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
              {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
            </p>
          </div>

          {replies.length === 0 ? (
            <div className="px-4 pb-4 text-[12px] text-[var(--muted)]">
              No replies yet. Add the first one.
            </div>
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {replies.map((reply) => (
                <div key={reply.id} className="flex gap-2.5 px-4 py-3.5">
                  <Avatar
                    avatarKey={reply.authorAvatarKey}
                    handle={reply.authorHandle}
                    size={30}
                    title={`${reply.authorHandle} avatar`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[11.5px] font-bold text-[var(--text)]">
                        {reply.authorHandle}
                      </span>
                      {reply.authorUid === currentUid ? (
                        <span className="text-[9.5px] font-semibold text-[var(--a1)]">you</span>
                      ) : null}
                      {reply.status === 'hidden' ? <Tag variant="err">Hidden</Tag> : null}
                      <span
                        className="text-[9.5px] text-[var(--faint)]"
                        title={absoluteTime(reply.createdAt)}
                      >
                        {relativeTime(reply.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-[var(--muted)]">
                      {reply.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {notice ? (
          <p className="mb-2 mt-2 text-[11.5px] font-semibold text-[var(--ok)]">{notice}</p>
        ) : null}

        {thread.status === 'locked' ? (
          <Card className="mt-3">
            <p className="text-[12px] leading-relaxed text-[var(--muted)]">
              This discussion is locked. You can still read it, but new replies are closed.
            </p>
          </Card>
        ) : (
          <Card className="mt-3">
            <form onSubmit={handleReply}>
              <label className="mb-1 block text-[11.5px] font-semibold text-[var(--muted)]">
                Add a reply
              </label>
              <textarea
                value={replyBody}
                onChange={(event) => setReplyBody(event.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Keep it useful and kind. Plain text only."
                className="w-full resize-y rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 text-[13px] leading-relaxed text-[var(--text)]"
              />
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-[10px] text-[var(--faint)]">{replyBody.length}/2000</span>
                <Button
                  type="submit"
                  size="sm"
                  fullWidth={false}
                  disabled={replyBusy || !replyBody.trim()}
                >
                  {replyBusy ? 'Posting…' : 'Post reply'}
                  {!replyBusy ? <Send size={12} className="ml-1.5" /> : null}
                </Button>
              </div>
              {replyError ? (
                <p className="mt-1 text-[11.5px] font-semibold text-[var(--err)]">{replyError}</p>
              ) : null}
            </form>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto px-[18px] pt-[22px] pb-[18px]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
            Approved creators
          </p>
          <h2 className="font-display mt-1 text-[23px] font-bold leading-tight">Community</h2>
        </div>
        {notice && !selectedId ? (
          <span className="text-[10.5px] font-semibold text-[var(--ok)]">{notice}</span>
        ) : null}
      </div>

      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1">
        {SECTION_LABELS.map((item) => {
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSection(item.id);
                setNotice('');
              }}
              className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-bold transition-colors cursor-pointer ${
                active
                  ? 'bg-[var(--surface-2)] text-[var(--text)]'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              <item.icon size={13} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {section === 'creators' ? renderCreators() : null}
      {section === 'leaderboard' ? renderLeaderboard() : null}
      {section === 'discussions'
        ? selectedId
          ? renderThreadDetail()
          : renderThreadList()
        : null}
    </div>
  );
};

const FilterButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`h-7 shrink-0 rounded-full px-2.5 text-[10.5px] font-semibold transition-colors cursor-pointer ${
      active
        ? 'bg-[var(--text)] text-[var(--page)]'
        : 'border border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]'
    }`}
  >
    {children}
  </button>
);

const BackButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="mb-3 inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--line)] px-3 text-[11px] font-semibold text-[var(--muted)] transition-colors hover:text-[var(--text)] cursor-pointer"
  >
    <ArrowLeft size={12} />
    All discussions
  </button>
);

const LoadingBlock: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-10 text-[12px] text-[var(--muted)]">
    <LoaderCircle size={15} className="animate-spin" />
    {label}
  </div>
);

const ErrorBlock: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="rounded-2xl border border-[var(--err)]/30 bg-[var(--err)]/10 px-4 py-4">
    <p className="text-[12px] font-semibold text-[var(--err)]">{message}</p>
    <button
      type="button"
      onClick={onRetry}
      className="mt-2 text-[11px] font-bold text-[var(--text)] underline underline-offset-2 cursor-pointer"
    >
      Try again
    </button>
  </div>
);

const EmptyBlock: React.FC<{ icon: React.ReactNode; title: string; body: string }> = ({
  icon,
  title,
  body,
}) => (
  <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
    <span className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-[var(--faint)]">
      {icon}
    </span>
    <p className="mt-3 text-[13px] font-semibold text-[var(--text)]">{title}</p>
    <p className="mt-1 max-w-[30ch] text-[11.5px] leading-relaxed text-[var(--muted)]">{body}</p>
  </div>
);
