import type { Ctx } from '../context.ts';
import { clientIp, json, tooMany } from '../http.ts';
import { consumeRateLimit } from '../rateLimit.ts';

/**
 * Recent activity feed.
 *
 * Two event types are derived from rows that already exist:
 *   - `signup`  accounts.created_at            (new creator joined Mhomho)
 *   - `join`    campaign_members.joined_at     (creator joined a campaign)
 *
 * Disclosure is deliberately minimal and role-scoped:
 *   - anonymous visitor : first name, platform, campaign title only
 *   - creator           : + handle
 *   - admin             : + account id
 *
 * Never exposed here: email, phone, followers, niche, balances, or any account
 * that is rejected, suspended, deleted or anonymised.
 */

type Row = Record<string, unknown>;

const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_ITEMS = 50;
const MAX_FIRST_NAME = 40;

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function firstName(displayName: string, handle: string): string {
  const name = displayName.trim().split(/\s+/)[0] ?? '';
  const fallback = handle.trim().replace(/^@/, '');
  const value = name || fallback || 'A creator';
  return value.slice(0, MAX_FIRST_NAME);
}

export function publicActivityEnabled(env: Ctx['env']): boolean {
  return String(env.PUBLIC_ACTIVITY ?? 'true').toLowerCase() !== 'false';
}

interface ActivityContext {
  showIdentity: boolean;
  showUid: boolean;
  excludeUid: string | null;
}

async function loadActivity(
  ctx: Ctx,
  since: number,
  now: number,
  options: ActivityContext
): Promise<unknown[]> {
  const signupRows = await ctx.env.DB.prepare(
    `SELECT a.id AS uid, a.created_at AS at, p.display_name, p.handle, p.platform
       FROM accounts a
       JOIN creator_profiles p ON p.account_id = a.id
      WHERE a.role = 'creator'
        AND a.status IN ('applied','approved')
        AND a.deleted_at IS NULL
        AND a.created_at > ? AND a.created_at <= ?
      ORDER BY a.created_at DESC
      LIMIT ${MAX_ITEMS}`
  )
    .bind(since, now)
    .all<Row>();

  const joinRows = await ctx.env.DB.prepare(
    `SELECT m.campaign_id, m.creator_id AS uid, m.joined_at AS at,
            p.display_name, p.handle, p.platform, c.title AS campaign_title
       FROM campaign_members m
       JOIN accounts a ON a.id = m.creator_id
       JOIN creator_profiles p ON p.account_id = m.creator_id
       JOIN campaigns c ON c.id = m.campaign_id
      WHERE a.status IN ('applied','approved')
        AND a.deleted_at IS NULL
        AND m.joined_at > ? AND m.joined_at <= ?
      ORDER BY m.joined_at DESC
      LIMIT ${MAX_ITEMS}`
  )
    .bind(since, now)
    .all<Row>();

  const items: Array<Record<string, unknown>> = [];

  for (const row of signupRows.results ?? []) {
    const uid = str(row.uid);
    if (options.excludeUid && uid === options.excludeUid) continue;
    const handle = str(row.handle);
    items.push({
      id: `signup:${uid}`,
      type: 'signup',
      at: num(row.at),
      firstName: firstName(str(row.display_name), handle),
      handle: options.showIdentity ? handle : null,
      platform: str(row.platform),
      campaignId: null,
      campaignTitle: null,
      uid: options.showUid ? uid : null,
    });
  }

  for (const row of joinRows.results ?? []) {
    const uid = str(row.uid);
    if (options.excludeUid && uid === options.excludeUid) continue;
    const handle = str(row.handle);
    const campaignId = str(row.campaign_id);
    items.push({
      id: `join:${campaignId}:${uid}`,
      type: 'join',
      at: num(row.at),
      firstName: firstName(str(row.display_name), handle),
      handle: options.showIdentity ? handle : null,
      platform: str(row.platform),
      campaignId,
      campaignTitle: str(row.campaign_title),
      uid: options.showUid ? uid : null,
    });
  }

  items.sort((left, right) => num(right.at) - num(left.at));
  return items.slice(0, MAX_ITEMS);
}

export async function handleActivity(ctx: Ctx): Promise<Response> {
  const now = Date.now();
  const anonymous = !ctx.account;
  const isAdmin = ctx.account?.role === 'admin' && ctx.account.status === 'approved';
  const isCreator =
    ctx.account?.role === 'creator' &&
    (ctx.account.status === 'approved' || ctx.account.status === 'applied');

  // The public landing-page feed can be switched off without a code deploy.
  if (anonymous && !publicActivityEnabled(ctx.env)) {
    return json({ ok: true, data: { serverNow: now, nextSince: now, items: [] } });
  }

  const bucket = anonymous
    ? `activity:ip:${clientIp(ctx.request)}`
    : `activity:acc:${ctx.account?.id ?? 'unknown'}`;
  const limit = await consumeRateLimit(ctx.env, bucket, anonymous ? 90 : 180, 60);
  if (!limit.allowed) {
    throw tooMany('Too many activity requests. Try again shortly.', limit.retryAfterSeconds);
  }

  const floor = now - WINDOW_MS;
  const requested = Number(ctx.url.searchParams.get('since') ?? '');
  const since =
    Number.isFinite(requested) && requested > 0
      ? Math.max(floor, Math.min(requested, now))
      : floor;

  const items = await loadActivity(ctx, since, now, {
    showIdentity: Boolean(isAdmin || isCreator),
    showUid: Boolean(isAdmin),
    // Never announce the viewer's own arrival back to them.
    excludeUid: ctx.account?.id ?? null,
  });

  // `nextSince` rewinds one second on purpose: if a row lands in the same
  // millisecond the response was built, the client's id-based de-duplication
  // absorbs the repeat instead of silently missing the event.
  return json(
    { ok: true, data: { serverNow: now, nextSince: Math.max(since, now - 1000), items } },
    200,
    anonymous ? { 'Cache-Control': 'public, max-age=15' } : {}
  );
}
