import type { Ctx } from '../context.ts';
import type { AccountRow } from '../env.ts';
import { recordAudit } from '../audit.ts';
import { newId, requireAdmin, requireAccount } from '../auth.ts';
import {
  normalizeAvatarKey,
  isForumCategory,
  harareMonthRange,
  FORUM_CATEGORIES,
  type ForumCategory,
} from '../../../shared/community.ts';
import { badRequest, conflict, forbidden, json, notFound, tooMany } from '../http.ts';
import { consumeRateLimit } from '../rateLimit.ts';
import { body, guardMutation, hashIp } from './helpers.ts';

type Row = Record<string, unknown>;

const THREAD_STATUSES = ['active', 'locked', 'hidden'] as const;
const REPLY_STATUSES = ['active', 'hidden'] as const;
const THREAD_PAGE_SIZE = 20;
const REPLY_LIMIT = 250;

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isAdmin(account: AccountRow): boolean {
  return account.role === 'admin' && account.status === 'approved';
}

/**
 * The community is for approved creators. Administrators can read it for
 * moderation, but cannot post as a creator.
 */
function requireCommunityReader(ctx: Ctx): AccountRow {
  const { account } = requireAccount(ctx);
  if (isAdmin(account)) return account;
  if (account.role === 'creator' && account.status === 'approved') return account;
  if (account.role === 'creator' && account.status === 'applied') {
    throw forbidden('The community opens after your creator profile is approved.');
  }
  throw forbidden('The community is available to approved creators.');
}

function requireCommunityWriter(ctx: Ctx): AccountRow {
  const { account } = requireAccount(ctx, ['creator']);
  if (account.status !== 'approved') {
    throw forbidden('The community opens after your creator profile is approved.');
  }
  return account;
}

function excerpt(value: string, length = 180): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean;
}

interface LeaderboardRow {
  rank: number;
  uid: string;
  handle: string;
  avatarKey: string;
  platform: string;
  views: number;
}

async function loadLeaderboard(
  ctx: Ctx,
  month: ReturnType<typeof harareMonthRange>,
  viewerUid: string | null
): Promise<{ entries: LeaderboardRow[]; viewerRank: number | null; viewerViews: number }> {
  const rows = await ctx.env.DB.prepare(
    `SELECT s.creator_id AS uid, p.handle, p.avatar_key, p.platform,
            COALESCE(SUM(o.verified_views), 0) AS views
       FROM view_observations o
       JOIN submissions s ON s.id = o.submission_id
       JOIN creator_profiles p ON p.account_id = s.creator_id
       JOIN accounts a ON a.id = s.creator_id
      WHERE o.is_current = 1
        AND s.status = 'approved'
        AND o.observed_at >= ? AND o.observed_at < ?
        AND a.deleted_at IS NULL
        AND a.status = 'approved'
      GROUP BY s.creator_id
      HAVING COALESCE(SUM(o.verified_views), 0) > 0
      ORDER BY views DESC, p.handle COLLATE NOCASE ASC
      LIMIT 20`
  )
    .bind(month.start, month.end)
    .all<Row>();

  const entries: LeaderboardRow[] = (rows.results ?? []).map((row, index) => ({
    rank: index + 1,
    uid: str(row.uid),
    handle: str(row.handle),
    avatarKey: normalizeAvatarKey(row.avatar_key),
    platform: str(row.platform),
    views: num(row.views),
  }));

  const viewerInTop = viewerUid ? entries.find((entry) => entry.uid === viewerUid) : undefined;
  if (viewerInTop || !viewerUid) {
    return {
      entries,
      viewerRank: viewerInTop?.rank ?? null,
      viewerViews: viewerInTop?.views ?? 0,
    };
  }

  // A creator outside the top 20 still needs an exact rank. This query counts
  // the creators ahead of them without loading the whole table into the Worker.
  const viewerRow = await ctx.env.DB.prepare(
    `WITH monthly AS (
       SELECT s.creator_id AS uid, p.handle,
              COALESCE(SUM(o.verified_views), 0) AS views
         FROM view_observations o
         JOIN submissions s ON s.id = o.submission_id
         JOIN creator_profiles p ON p.account_id = s.creator_id
         JOIN accounts a ON a.id = s.creator_id
        WHERE o.is_current = 1
          AND s.status = 'approved'
          AND o.observed_at >= ? AND o.observed_at < ?
          AND a.deleted_at IS NULL
          AND a.status = 'approved'
        GROUP BY s.creator_id
        HAVING COALESCE(SUM(o.verified_views), 0) > 0
     )
     SELECT
       (SELECT COUNT(*) + 1
          FROM monthly m2
         WHERE m2.views > m.views
            OR (m2.views = m.views AND m2.handle COLLATE NOCASE < m.handle COLLATE NOCASE)
       ) AS rank,
       m.views AS views
       FROM monthly m
      WHERE m.uid = ?`
  )
    .bind(month.start, month.end, viewerUid)
    .first<Row>();

  return {
    entries,
    viewerRank: viewerRow ? num(viewerRow.rank) : null,
    viewerViews: viewerRow ? num(viewerRow.views) : 0,
  };
}

async function loadRecentCreators(
  ctx: Ctx,
  includeAllStatuses: boolean,
  limit = 20
): Promise<unknown[]> {
  const rows = await ctx.env.DB.prepare(
    `SELECT a.id AS uid, a.status, a.created_at AS joined_at,
            p.handle, p.avatar_key, p.platform, p.niche, p.approved_at
       FROM accounts a
       JOIN creator_profiles p ON p.account_id = a.id
      WHERE a.role = 'creator'
        AND a.deleted_at IS NULL
        ${includeAllStatuses ? '' : `AND a.status = 'approved'`}
      ORDER BY a.created_at DESC
      LIMIT ?`
  )
    .bind(limit)
    .all<Row>();

  return (rows.results ?? []).map((row) => ({
    uid: str(row.uid),
    handle: str(row.handle),
    avatarKey: normalizeAvatarKey(row.avatar_key),
    platform: str(row.platform),
    niche: str(row.niche),
    status: str(row.status),
    joinedAtMs: num(row.joined_at),
    approvedAtMs: row.approved_at === null ? null : num(row.approved_at),
  }));
}

interface ThreadQueryOptions {
  admin: boolean;
  category?: ForumCategory | null;
  limit?: number;
  offset?: number;
}

async function loadThreads(ctx: Ctx, options: ThreadQueryOptions): Promise<unknown[]> {
  const where: string[] = [];
  const binds: unknown[] = [];
  if (!options.admin) {
    where.push(`t.status IN ('active','locked')`);
  }
  if (options.category) {
    where.push('t.category = ?');
    binds.push(options.category);
  }

  const rows = await ctx.env.DB.prepare(
    `SELECT t.id, t.author_id, t.category, t.title, t.body, t.status, t.pinned,
            t.reply_count, t.last_activity_at, t.created_at,
            p.handle, p.avatar_key, p.platform
       FROM forum_threads t
       JOIN creator_profiles p ON p.account_id = t.author_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY t.pinned DESC, t.last_activity_at DESC
      LIMIT ? OFFSET ?`
  )
    .bind(...binds, options.limit ?? THREAD_PAGE_SIZE, options.offset ?? 0)
    .all<Row>();

  return (rows.results ?? []).map((row) => ({
    id: str(row.id),
    authorUid: str(row.author_id),
    authorHandle: str(row.handle),
    authorAvatarKey: normalizeAvatarKey(row.avatar_key),
    authorPlatform: str(row.platform),
    category: str(row.category),
    title: str(row.title),
    excerpt: excerpt(str(row.body)),
    status: str(row.status),
    pinned: num(row.pinned) === 1,
    replyCount: num(row.reply_count),
    lastActivityAt: num(row.last_activity_at),
    createdAt: num(row.created_at),
  }));
}

async function loadThread(ctx: Ctx, threadId: string, admin: boolean) {
  const row = await ctx.env.DB.prepare(
    `SELECT t.id, t.author_id, t.category, t.title, t.body, t.status, t.pinned,
            t.reply_count, t.last_activity_at, t.created_at,
            p.handle, p.avatar_key, p.platform
       FROM forum_threads t
       JOIN creator_profiles p ON p.account_id = t.author_id
      WHERE t.id = ? ${admin ? '' : `AND t.status IN ('active','locked')`}`
  )
    .bind(threadId)
    .first<Row>();
  if (!row) return null;

  const replies = await ctx.env.DB.prepare(
    `SELECT r.id, r.author_id, r.body, r.status, r.created_at,
            p.handle, p.avatar_key, p.platform
       FROM forum_replies r
       JOIN creator_profiles p ON p.account_id = r.author_id
      WHERE r.thread_id = ? ${admin ? '' : `AND r.status = 'active'`}
      ORDER BY r.created_at ASC
      LIMIT ${REPLY_LIMIT}`
  )
    .bind(threadId)
    .all<Row>();

  return {
    thread: {
      id: str(row.id),
      authorUid: str(row.author_id),
      authorHandle: str(row.handle),
      authorAvatarKey: normalizeAvatarKey(row.avatar_key),
      authorPlatform: str(row.platform),
      category: str(row.category),
      title: str(row.title),
      body: str(row.body),
      excerpt: excerpt(str(row.body)),
      status: str(row.status),
      pinned: num(row.pinned) === 1,
      replyCount: num(row.reply_count),
      lastActivityAt: num(row.last_activity_at),
      createdAt: num(row.created_at),
    },
    replies: (replies.results ?? []).map((reply) => ({
      id: str(reply.id),
      authorUid: str(reply.author_id),
      authorHandle: str(reply.handle),
      authorAvatarKey: normalizeAvatarKey(reply.avatar_key),
      authorPlatform: str(reply.platform),
      body: str(reply.body),
      status: str(reply.status),
      createdAt: num(reply.created_at),
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Creator community                                                   */
/* ------------------------------------------------------------------ */

export async function handleCommunityOverview(ctx: Ctx): Promise<Response> {
  const account = requireCommunityReader(ctx);
  const month = harareMonthRange();
  const viewerUid = account.role === 'creator' ? account.id : null;

  const [recentCreators, leaderboard, latestThreads, threadCount, replyCount] = await Promise.all([
    loadRecentCreators(ctx, false, 16),
    loadLeaderboard(ctx, month, viewerUid),
    loadThreads(ctx, { admin: false, limit: 8 }),
    ctx.env.DB.prepare(
      `SELECT COUNT(*) AS total FROM forum_threads WHERE status IN ('active','locked')`
    ).first<Row>(),
    ctx.env.DB.prepare(
      `SELECT COUNT(*) AS total
         FROM forum_replies r
         JOIN forum_threads t ON t.id = r.thread_id
        WHERE r.status = 'active' AND t.status IN ('active','locked')`
    ).first<Row>(),
  ]);

  return json({
    ok: true,
    data: {
      month: { key: month.key, label: month.label },
      recentCreators,
      leaderboard: leaderboard.entries,
      viewerRank: leaderboard.viewerRank,
      viewerViews: leaderboard.viewerViews,
      latestThreads,
      totals: {
        threads: num(threadCount?.total),
        replies: num(replyCount?.total),
      },
    },
  });
}

export async function handleListCommunityThreads(ctx: Ctx): Promise<Response> {
  const account = requireCommunityReader(ctx);
  const categoryRaw = ctx.url.searchParams.get('category') ?? '';
  const category = isForumCategory(categoryRaw) ? categoryRaw : null;
  const offsetRaw = Number(ctx.url.searchParams.get('offset') ?? '0');
  const offset = Math.max(0, Number.isFinite(offsetRaw) ? Math.trunc(offsetRaw) : 0);
  const threads = await loadThreads(ctx, {
    admin: isAdmin(account),
    category,
    limit: THREAD_PAGE_SIZE,
    offset,
  });
  return json({
    ok: true,
    data: { threads, nextOffset: offset + threads.length, category: category ?? '' },
  });
}

export async function handleGetCommunityThread(ctx: Ctx): Promise<Response> {
  const account = requireCommunityReader(ctx);
  const detail = await loadThread(ctx, ctx.params.id, isAdmin(account));
  if (!detail) throw notFound('Discussion not found.');
  return json({ ok: true, data: detail });
}

export async function handleCreateCommunityThread(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const account = requireCommunityWriter(ctx);

  const limit = await consumeRateLimit(ctx.env, `forum:thread:${account.id}`, 5, 60 * 60);
  if (!limit.allowed) {
    throw tooMany('You have started several discussions recently. Try again later.', limit.retryAfterSeconds);
  }

  const input = await body<{ category: ForumCategory; title: string; body: string }>(ctx, {
    category: { type: 'string', required: true, values: FORUM_CATEGORIES },
    title: { type: 'string', required: true, min: 5, max: 100 },
    body: { type: 'string', required: true, min: 10, max: 4000 },
  });

  const title = input.title.trim();
  const threadBody = input.body.trim();
  if (title.length < 5 || threadBody.length < 10) {
    throw badRequest('Give the discussion a title and a little more detail.');
  }

  const now = Date.now();
  const threadId = newId('thread');
  await ctx.env.DB.prepare(
    `INSERT INTO forum_threads
       (id, author_id, category, title, body, status, pinned, reply_count,
        last_activity_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', 0, 0, ?, ?, ?)`
  )
    .bind(threadId, account.id, input.category, title, threadBody, now, now, now)
    .run();

  await recordAudit(ctx.env, {
    actorId: account.id,
    actorRole: 'creator',
    action: 'forum.thread.create',
    entityType: 'forum_thread',
    entityId: threadId,
    after: { category: input.category, title },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json({ ok: true, data: { threadId } }, 201);
}

export async function handleReplyToCommunityThread(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const account = requireCommunityWriter(ctx);

  const thread = await ctx.env.DB.prepare(
    `SELECT id, status FROM forum_threads WHERE id = ?`
  )
    .bind(ctx.params.id)
    .first<Row>();
  if (!thread || String(thread.status) === 'hidden') throw notFound('Discussion not found.');
  if (String(thread.status) === 'locked') {
    throw conflict('This discussion is locked. Start a new thread instead.');
  }

  const limit = await consumeRateLimit(ctx.env, `forum:reply:${account.id}`, 20, 60 * 60);
  if (!limit.allowed) {
    throw tooMany('You have posted several replies recently. Try again later.', limit.retryAfterSeconds);
  }

  const input = await body<{ body: string }>(ctx, {
    body: { type: 'string', required: true, min: 1, max: 2000 },
  });
  const replyText = input.body.trim();
  if (!replyText) throw badRequest('Write a reply before posting.');

  const now = Date.now();
  const replyId = newId('reply');
  const results = await ctx.env.DB.batch([
    // The INSERT re-checks the thread status so a lock applied between the
    // read above and this write cannot accept one last reply.
    ctx.env.DB.prepare(
      `INSERT INTO forum_replies (id, thread_id, author_id, body, status, created_at, updated_at)
       SELECT ?, ?, ?, ?, 'active', ?, ?
        WHERE EXISTS (
          SELECT 1 FROM forum_threads WHERE id = ? AND status = 'active'
        )`
    ).bind(replyId, ctx.params.id, account.id, replyText, now, now, ctx.params.id),
    ctx.env.DB.prepare(
      `UPDATE forum_threads
          SET reply_count = reply_count + 1, last_activity_at = ?, updated_at = ?
        WHERE id = ? AND status = 'active'`
    ).bind(now, now, ctx.params.id),
  ]);
  if ((results[0]?.meta?.changes ?? 0) === 0) {
    throw conflict('This discussion is no longer open.');
  }

  await recordAudit(ctx.env, {
    actorId: account.id,
    actorRole: 'creator',
    action: 'forum.reply.create',
    entityType: 'forum_thread',
    entityId: ctx.params.id,
    after: { replyId },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json({ ok: true, data: { replyId } }, 201);
}

/* ------------------------------------------------------------------ */
/* Admin moderation                                                     */
/* ------------------------------------------------------------------ */

export async function handleAdminCommunity(ctx: Ctx): Promise<Response> {
  requireAdmin(ctx);
  const month = harareMonthRange();

  const [recentCreators, leaderboard, threads, counts] = await Promise.all([
    loadRecentCreators(ctx, true, 40),
    loadLeaderboard(ctx, month, null),
    loadThreads(ctx, { admin: true, limit: 60 }),
    ctx.env.DB.prepare(
      `SELECT
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
         SUM(CASE WHEN status = 'locked' THEN 1 ELSE 0 END) AS locked,
         SUM(CASE WHEN status = 'hidden' THEN 1 ELSE 0 END) AS hidden
       FROM forum_threads`
    ).first<Row>(),
  ]);

  return json({
    ok: true,
    data: {
      month: { key: month.key, label: month.label },
      recentCreators,
      leaderboard: leaderboard.entries,
      threads,
      totals: {
        activeThreads: num(counts?.active),
        lockedThreads: num(counts?.locked),
        hiddenThreads: num(counts?.hidden),
      },
    },
  });
}

export async function handleModerateCommunityThread(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const admin = requireAdmin(ctx);

  const input = await body<{ status?: string; pinned?: boolean }>(ctx, {
    status: { type: 'string', values: THREAD_STATUSES },
    pinned: { type: 'boolean' },
  });
  if (input.status === undefined && input.pinned === undefined) {
    throw badRequest('Choose a moderation action.');
  }

  const current = await ctx.env.DB.prepare(
    `SELECT id, status, pinned FROM forum_threads WHERE id = ?`
  )
    .bind(ctx.params.id)
    .first<Row>();
  if (!current) throw notFound('Discussion not found.');

  const nextStatus = input.status ?? str(current.status);
  const nextPinned = input.pinned ?? num(current.pinned) === 1;
  await ctx.env.DB.prepare(
    `UPDATE forum_threads SET status = ?, pinned = ?, updated_at = ? WHERE id = ?`
  )
    .bind(nextStatus, nextPinned ? 1 : 0, Date.now(), ctx.params.id)
    .run();

  await recordAudit(ctx.env, {
    actorId: admin.id,
    actorRole: 'admin',
    action: 'forum.thread.moderate',
    entityType: 'forum_thread',
    entityId: ctx.params.id,
    before: { status: str(current.status), pinned: num(current.pinned) === 1 },
    after: { status: nextStatus, pinned: nextPinned },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json({ ok: true });
}

export async function handleModerateCommunityReply(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const admin = requireAdmin(ctx);

  const input = await body<{ status: string }>(ctx, {
    status: { type: 'string', required: true, values: REPLY_STATUSES },
  });

  const current = await ctx.env.DB.prepare(
    `SELECT id, thread_id, status FROM forum_replies WHERE id = ?`
  )
    .bind(ctx.params.id)
    .first<Row>();
  if (!current) throw notFound('Reply not found.');

  const previous = str(current.status);
  if (previous !== input.status) {
    const delta = input.status === 'active' ? 1 : -1;
    await ctx.env.DB.batch([
      ctx.env.DB.prepare(`UPDATE forum_replies SET status = ?, updated_at = ? WHERE id = ?`).bind(
        input.status,
        Date.now(),
        ctx.params.id
      ),
      ctx.env.DB.prepare(
        `UPDATE forum_threads
            SET reply_count = MAX(0, reply_count + ?), updated_at = ?
          WHERE id = ?`
      ).bind(delta, Date.now(), str(current.thread_id)),
    ]);
  }

  await recordAudit(ctx.env, {
    actorId: admin.id,
    actorRole: 'admin',
    action: 'forum.reply.moderate',
    entityType: 'forum_reply',
    entityId: ctx.params.id,
    before: { status: previous },
    after: { status: input.status },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json({ ok: true });
}
