import type { Ctx } from '../context.ts';
import { recordAudit } from '../audit.ts';
import { newId, requireAccount, requireAdmin } from '../auth.ts';
import { badRequest, json, notFound, tooMany } from '../http.ts';
import { consumeRateLimit } from '../rateLimit.ts';
import { body, guardMutation, hashIp } from './helpers.ts';

/**
 * In-app notifications.
 *
 * A broadcast is stored once and filtered at read time by audience, so a new
 * sign-up sees earlier announcements without a fan-out job. Read state is a
 * per-account row in notification_reads.
 *
 * Recipients are always creators. Admin broadcasts are never delivered back to
 * admins; the admin console shows the sent history instead.
 */

type Row = Record<string, unknown>;

const AUDIENCES = ['creators', 'approved_creators', 'applicants', 'account'] as const;
const MAX_ITEMS = 50;

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Visibility predicate for one creator account. Returns SQL fragments that
 * reference `n.` (notifications) and pushes the bound values in order.
 */
function visibility(accountId: string, status: string): { sql: string; binds: unknown[] } {
  return {
    sql: `(
      n.audience = 'creators'
      OR (n.audience = 'approved_creators' AND ? = 'approved')
      OR (n.audience = 'applicants' AND ? = 'applied')
      OR (n.audience = 'account' AND n.audience_account_id = ?)
    )`,
    binds: [status, status, accountId],
  };
}

export async function handleListNotifications(ctx: Ctx): Promise<Response> {
  const { account } = requireAccount(ctx);
  const isAdmin = account.role === 'admin';
  if (!isAdmin && account.role !== 'creator') throw notFound('Not found.');

  const filter = isAdmin ? null : visibility(account.id, account.status);

  const rows = await ctx.env.DB.prepare(
    `SELECT n.id, n.title, n.body, n.audience, n.created_at, r.read_at
       FROM notifications n
       LEFT JOIN notification_reads r
         ON r.notification_id = n.id AND r.account_id = ?
      ${filter ? `WHERE ${filter.sql}` : ''}
      ORDER BY n.created_at DESC
      LIMIT ${MAX_ITEMS}`
  )
    .bind(isAdmin ? account.id : account.id, ...(filter ? filter.binds : []))
    .all<Row>();

  let unread = 0;
  if (!isAdmin && filter) {
    const count = await ctx.env.DB.prepare(
      `SELECT COUNT(*) AS total
         FROM notifications n
         LEFT JOIN notification_reads r
           ON r.notification_id = n.id AND r.account_id = ?
        WHERE ${filter.sql} AND r.read_at IS NULL`
    )
      .bind(account.id, ...filter.binds)
      .first<Row>();
    unread = num(count?.total);
  }

  return json({
    ok: true,
    data: {
      items: (rows.results ?? []).map((row) => ({
        id: str(row.id),
        title: str(row.title),
        body: str(row.body),
        audience: str(row.audience),
        createdAt: num(row.created_at),
        readAt: row.read_at === null ? null : num(row.read_at),
      })),
      unread,
    },
  });
}

export async function handleMarkNotificationRead(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const { account } = requireAccount(ctx);
  const isAdmin = account.role === 'admin';
  if (!isAdmin && account.role !== 'creator') throw notFound('Not found.');

  const notification = await ctx.env.DB.prepare(
    `SELECT id, audience, audience_account_id FROM notifications WHERE id = ?`
  )
    .bind(ctx.params.id)
    .first<Row>();
  if (!notification) throw notFound('Notification not found.');

  if (!isAdmin) {
    const audience = str(notification.audience);
    const visible =
      audience === 'creators' ||
      (audience === 'approved_creators' && account.status === 'approved') ||
      (audience === 'applicants' && account.status === 'applied') ||
      (audience === 'account' && str(notification.audience_account_id) === account.id);
    if (!visible) throw notFound('Notification not found.');
  }

  await ctx.env.DB.prepare(
    `INSERT OR IGNORE INTO notification_reads (account_id, notification_id, read_at)
     VALUES (?, ?, ?)`
  )
    .bind(account.id, ctx.params.id, Date.now())
    .run();

  return json({ ok: true });
}

export async function handleMarkAllNotificationsRead(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const { account } = requireAccount(ctx);
  if (account.role === 'admin') return json({ ok: true });
  if (account.role !== 'creator') throw notFound('Not found.');

  const filter = visibility(account.id, account.status);
  await ctx.env.DB.prepare(
    `INSERT OR IGNORE INTO notification_reads (account_id, notification_id, read_at)
     SELECT ?, n.id, ?
       FROM notifications n
      WHERE ${filter.sql}`
  )
    .bind(account.id, Date.now(), ...filter.binds)
    .run();

  return json({ ok: true });
}

export async function handleCreateNotification(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const admin = requireAdmin(ctx);

  const limit = await consumeRateLimit(ctx.env, `notifications:send:${admin.id}`, 60, 60 * 60);
  if (!limit.allowed) {
    throw tooMany('Too many broadcasts. Try again shortly.', limit.retryAfterSeconds);
  }

  const input = await body<{
    title: string;
    message: string;
    audience: string;
    accountId?: string;
  }>(ctx, {
    title: { type: 'string', required: true, min: 1, max: 120 },
    message: { type: 'string', required: true, min: 1, max: 2000 },
    audience: { type: 'string', required: true, values: AUDIENCES },
    accountId: { type: 'string', max: 80 },
  });

  let accountId: string | null = null;
  if (input.audience === 'account') {
    if (!input.accountId) throw badRequest('Choose the creator to notify.');
    const target = await ctx.env.DB.prepare(
      `SELECT id FROM accounts
        WHERE id = ? AND role = 'creator' AND deleted_at IS NULL`
    )
      .bind(input.accountId)
      .first<Row>();
    if (!target) throw badRequest('That creator does not exist.');
    accountId = input.accountId;
  }

  const id = newId('note');
  const now = Date.now();
  await ctx.env.DB.prepare(
    `INSERT INTO notifications (id, title, body, audience, audience_account_id, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(id, input.title, input.message, input.audience, accountId, admin.id, now)
    .run();

  await recordAudit(ctx.env, {
    actorId: admin.id,
    actorRole: 'admin',
    action: 'notification.broadcast',
    entityType: 'notification',
    entityId: id,
    after: { audience: input.audience, accountId, title: input.title },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json(
    {
      ok: true,
      data: {
        notification: {
          id,
          title: input.title,
          body: input.message,
          audience: input.audience,
          createdAt: now,
          readAt: null,
        },
      },
    },
    201
  );
}
