import type { Ctx } from '../context.ts';
import { recordAudit } from '../audit.ts';
import { sha256Hex, timingSafeEqual, hashPassword } from '../crypto.ts';
import { newId, requireAdmin } from '../auth.ts';
import { conflict, forbidden, json, notFound, assertSameOrigin, tooMany } from '../http.ts';
import { consumeRateLimit } from '../rateLimit.ts';
import { calculateGuaranteedViews } from '../../../shared/money.ts';
import { getCampaignByIdOrThrow } from '../repo.ts';
import { body, guardMutation, hashIp } from './helpers.ts';

const ENQUIRY_BUDGETS = [
  '$100 – $250',
  '$250 – $500',
  '$500 – $1,000',
  '$1,000+',
  'Not sure yet',
];

const PLATFORMS = ['TikTok', 'Instagram', 'YouTube', 'Facebook'] as const;

/** Public brand enquiry. No account is created and no PII is echoed back. */
export async function handleCreateEnquiry(ctx: Ctx): Promise<Response> {
  assertSameOrigin(ctx.request, ctx.env.APP_ORIGIN);

  const ipHash = await hashIp(ctx.env, ctx.request);
  const limit = await consumeRateLimit(ctx.env, `enquiry:${ipHash}`, 5, 60 * 60);
  if (!limit.allowed) {
    throw tooMany('Too many enquiries from this connection. Try again later.', limit.retryAfterSeconds);
  }

  const input = await body<{
    bizName: string;
    contactName: string;
    phone: string;
    niche: string;
    promo: string;
    goals: string[];
    budget: string;
    start: string;
    bestTimes?: string[];
    notes?: string | null;
    company?: string;
  }>(ctx, {
    bizName: { type: 'string', required: true, min: 2, max: 120 },
    contactName: { type: 'string', required: true, min: 2, max: 120 },
    phone: { type: 'string', required: true, min: 7, max: 32 },
    niche: { type: 'string', required: true, min: 2, max: 80 },
    promo: { type: 'string', required: true, min: 5, max: 1000 },
    goals: { type: 'array', required: true, max: 6, items: { type: 'string', min: 2, max: 120 } },
    budget: { type: 'string', required: true, values: ENQUIRY_BUDGETS },
    start: { type: 'string', required: true, min: 2, max: 80 },
    bestTimes: { type: 'array', max: 6, items: { type: 'string', min: 2, max: 40 } },
    notes: { type: 'string', min: 2, max: 2000, nullable: true },
    company: { type: 'string', max: 200, nullable: true },
  });

  // Honeypot: bots fill hidden fields. Respond as success without storing.
  if (input.company) return json({ ok: true });

  const now = Date.now();
  await ctx.env.DB.prepare(
    `INSERT INTO enquiries
       (id, biz_name, contact_name, phone, niche, promo, goals, budget, start_window,
        best_times, notes, status, ip_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`
  )
    .bind(
      newId('enq'),
      input.bizName,
      input.contactName,
      input.phone,
      input.niche,
      input.promo,
      JSON.stringify(input.goals),
      input.budget,
      input.start,
      JSON.stringify(input.bestTimes ?? []),
      input.notes ?? null,
      ipHash,
      now,
      now
    )
    .run();

  return json({ ok: true }, 201);
}

/**
 * Brand report access is token-based. Only a SHA-256 of the token is stored, and
 * the report exposes aggregates only: never creator identities, contact data or
 * individual earnings.
 */
export async function handleBrandReport(ctx: Ctx): Promise<Response> {
  const token = ctx.params.token;
  if (!token || token.length < 20 || token.length > 200) throw notFound('Report not found.');
  const tokenHash = await sha256Hex(token);
  const now = Date.now();

  const row = await ctx.env.DB.prepare(
    `SELECT token_hash, campaign_id, label, expires_at, revoked_at
       FROM brand_report_tokens WHERE token_hash = ?`
  )
    .bind(tokenHash)
    .first<Record<string, unknown>>();

  if (!row || row.revoked_at) throw notFound('Report not found.');
  if (row.expires_at && Number(row.expires_at) <= now) throw notFound('Report not found.');

  const { campaign, counters } = await getCampaignByIdOrThrow(ctx.env, String(row.campaign_id));

  // Platform reporting is derived from the same observations that make up the
  // headline total. This keeps the total, chart and platform mix reconcilable
  // instead of mixing the denormalised counter with eligible views.
  const platformRows = await ctx.env.DB.prepare(
    `SELECT s.platform,
            COUNT(DISTINCT s.id) AS clips,
            COALESCE(SUM(o.verified_views), 0) AS verified_views,
            MAX(o.observed_at) AS last_verified_at
       FROM submissions s
       JOIN view_observations o ON o.submission_id = s.id AND o.is_current = 1
      WHERE s.campaign_id = ? AND s.status = 'approved'
      GROUP BY s.platform`
  )
    .bind(campaign.id)
    .all<Record<string, unknown>>();

  const platformMap = new Map<
    string,
    { views: number; clips: number; lastVerifiedAt: number }
  >();
  for (const platformRow of platformRows.results ?? []) {
    platformMap.set(String(platformRow.platform), {
      views: Number(platformRow.verified_views) || 0,
      clips: Number(platformRow.clips) || 0,
      lastVerifiedAt: Number(platformRow.last_verified_at) || 0,
    });
  }

  const platformMix = PLATFORMS.map((platform) => {
    const row = platformMap.get(platform);
    return {
      platform,
      verifiedViews: row?.views ?? 0,
      clips: row?.clips ?? 0,
      lastVerifiedAt: row?.lastVerifiedAt ?? 0,
    };
  }).sort((left, right) => {
    if (right.verifiedViews !== left.verifiedViews) {
      return right.verifiedViews - left.verifiedViews;
    }
    return PLATFORMS.indexOf(left.platform) - PLATFORMS.indexOf(right.platform);
  });

  const verifiedViews = platformMix.reduce((total, platform) => total + platform.verifiedViews, 0);
  const clipsLive = platformMix.reduce((total, platform) => total + platform.clips, 0);
  const lastVerifiedAt = platformMix.reduce(
    (latest, platform) => Math.max(latest, platform.lastVerifiedAt),
    0
  );

  const observations = await ctx.env.DB.prepare(
    `SELECT CAST(strftime('%Y-%m-%d', o.observed_at / 1000, 'unixepoch') AS TEXT) AS day,
            COALESCE(SUM(o.verified_views), 0) AS views
       FROM submissions s
       JOIN view_observations o ON o.submission_id = s.id AND o.is_current = 1
      WHERE s.campaign_id = ? AND s.status = 'approved'
      GROUP BY day
      ORDER BY day ASC`
  )
    .bind(campaign.id)
    .all<Record<string, unknown>>();

  const series: Array<{ label: string; value: number }> = [];
  let running = 0;
  for (const observation of observations.results ?? []) {
    const day = String(observation.day ?? '');
    running += Number(observation.views) || 0;
    const date = day ? new Date(`${day}T00:00:00Z`) : null;
    series.push({
      label:
        date && !Number.isNaN(date.getTime())
          ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          : 'Earlier',
      value: running,
    });
  }
  series.push({ label: 'Now', value: verifiedViews });

  await ctx.env.DB.prepare(`UPDATE brand_report_tokens SET last_viewed_at = ? WHERE token_hash = ?`)
    .bind(now, tokenHash)
    .run();

  return json({
    ok: true,
    data: {
      token,
      campaignId: campaign.id,
      title: campaign.title,
      brandName: campaign.brand_name,
      status: campaign.status,
      verifiedViews,
      eligibleViews: counters.eligible_views,
      guaranteedViews: calculateGuaranteedViews(campaign.budget_cents),
      budgetUsedCents: Math.floor((verifiedViews * campaign.brand_cpm_cents) / 1000),
      budgetCents: campaign.budget_cents,
      creatorsJoined: counters.joined_count,
      clipsLive,
      platformMix: platformMix.map((platform) => ({
        platform: platform.platform,
        verifiedViews: platform.verifiedViews,
        clips: platform.clips,
        sharePct: verifiedViews > 0 ? Math.round((platform.verifiedViews / verifiedViews) * 1000) / 10 : 0,
      })),
      lastUpdatedAt: lastVerifiedAt || null,
      viewsSeries: series.slice(-30),
      reportSummary:
        'Verified views are accepted public views on approved clips, counted once at review. Platform shows where each clip was posted.',
    },
  });
}

/** Creates a revocable brand report link. The raw token is returned once. */
export async function handleCreateBrandToken(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const admin = requireAdmin(ctx);

  const input = await body<{ label?: string | null; expiresInDays?: number | null }>(ctx, {
    label: { type: 'string', min: 2, max: 120, nullable: true },
    expiresInDays: { type: 'int', min: 1, max: 365, nullable: true },
  });

  const { campaign } = await getCampaignByIdOrThrow(ctx.env, ctx.params.id);
  const raw = `${newId('bt')}.${crypto.randomUUID().replace(/-/g, '')}`;
  const tokenHash = await sha256Hex(raw);
  const now = Date.now();
  const expiresAt = input.expiresInDays ? now + input.expiresInDays * 86_400_000 : null;

  await ctx.env.DB.prepare(
    `INSERT INTO brand_report_tokens
       (token_hash, campaign_id, label, created_by, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(tokenHash, campaign.id, input.label ?? null, admin.id, now, expiresAt)
    .run();

  await recordAudit(ctx.env, {
    actorId: admin.id,
    actorRole: 'admin',
    action: 'brand_report.create',
    entityType: 'campaign',
    entityId: campaign.id,
    after: { expiresAt },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  const path = `/?report=${encodeURIComponent(raw)}`;
  const origin = ctx.env.APP_ORIGIN.replace(/\/$/, '');
  return json({ ok: true, data: { token: raw, path, url: `${origin}${path}` } }, 201);
}

/** Admin-only metadata for every report link on a campaign. Raw tokens never return. */
export async function handleListBrandTokens(ctx: Ctx): Promise<Response> {
  requireAdmin(ctx);

  const { campaign } = await getCampaignByIdOrThrow(ctx.env, ctx.params.id);
  const rows = await ctx.env.DB.prepare(
    `SELECT token_hash, label, created_at, expires_at, revoked_at, last_viewed_at
       FROM brand_report_tokens
      WHERE campaign_id = ?
      ORDER BY created_at DESC
      LIMIT 50`
  )
    .bind(campaign.id)
    .all<Record<string, unknown>>();

  const now = Date.now();
  return json({
    ok: true,
    data: {
      tokens: (rows.results ?? []).map((row) => {
        const expiresAt = row.expires_at === null ? null : Number(row.expires_at);
        const revokedAt = row.revoked_at === null ? null : Number(row.revoked_at);
        return {
          id: String(row.token_hash),
          label: row.label === null ? null : String(row.label),
          createdAt: Number(row.created_at),
          expiresAt,
          revokedAt,
          lastViewedAt: row.last_viewed_at === null ? null : Number(row.last_viewed_at),
          active: !revokedAt && (!expiresAt || expiresAt > now),
        };
      }),
    },
  });
}

/** Revokes one report link without deleting its audit history. */
export async function handleRevokeBrandToken(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const admin = requireAdmin(ctx);

  const tokenId = ctx.params.tokenId;
  if (!tokenId || !/^[0-9a-f]{64}$/.test(tokenId)) throw notFound('Report link not found.');

  const { campaign } = await getCampaignByIdOrThrow(ctx.env, ctx.params.id);
  const row = await ctx.env.DB.prepare(
    `SELECT token_hash, revoked_at FROM brand_report_tokens
      WHERE token_hash = ? AND campaign_id = ?`
  )
    .bind(tokenId, campaign.id)
    .first<Record<string, unknown>>();
  if (!row) throw notFound('Report link not found.');

  const now = Date.now();
  if (row.revoked_at === null) {
    await ctx.env.DB.prepare(
      `UPDATE brand_report_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL`
    )
      .bind(now, tokenId)
      .run();

    await recordAudit(ctx.env, {
      actorId: admin.id,
      actorRole: 'admin',
      action: 'brand_report.revoke',
      entityType: 'campaign',
      entityId: campaign.id,
      after: { tokenId, revokedAt: now },
      requestId: ctx.requestId,
      ipHash: await hashIp(ctx.env, ctx.request),
    });
  }

  return json({ ok: true });
}

/**
 * One-time first-administrator bootstrap.
 *
 * Works only while the database has no admin accounts and only when the
 * ADMIN_SETUP_TOKEN secret is configured. After the first success the endpoint
 * is permanently unusable, so the token cannot be replayed.
 */
export async function handleAdminSetup(ctx: Ctx): Promise<Response> {
  assertSameOrigin(ctx.request, ctx.env.APP_ORIGIN);

  const ipHash = await hashIp(ctx.env, ctx.request);
  const limit = await consumeRateLimit(ctx.env, `setup:${ipHash}`, 5, 60 * 60);
  if (!limit.allowed) throw tooMany('Too many attempts.', limit.retryAfterSeconds);

  const configured = ctx.env.ADMIN_SETUP_TOKEN;
  if (!configured) throw forbidden('Administrator setup is not enabled on this deployment.');

  const input = await body<{ setupToken: string; email: string; password: string }>(ctx, {
    setupToken: { type: 'string', required: true, min: 20, max: 200 },
    email: { type: 'email', required: true },
    password: { type: 'string', required: true, min: 12, max: 200 },
  });

  // Hash both sides so the comparison does not leak the configured token length.
  const [providedTokenHash, configuredTokenHash] = await Promise.all([
    sha256Hex(input.setupToken),
    sha256Hex(configured),
  ]);
  if (!timingSafeEqual(providedTokenHash, configuredTokenHash)) {
    throw forbidden('Invalid setup token.');
  }

  const existing = await ctx.env.DB.prepare(
    `SELECT id FROM accounts WHERE role = 'admin' LIMIT 1`
  ).first();
  if (existing) throw conflict('An administrator already exists. Setup is closed.');

  const password = await hashPassword(input.password);
  const now = Date.now();
  const adminId = newId('adm');

  await ctx.env.DB.prepare(
    `INSERT INTO accounts
       (id, email, email_normalized, password_hash, password_salt, password_iterations,
        role, status, session_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'admin', 'approved', 1, ?, ?)`
  )
    .bind(
      adminId,
      input.email.trim(),
      input.email,
      password.hash,
      password.salt,
      password.iterations,
      now,
      now
    )
    .run();

  await recordAudit(ctx.env, {
    actorId: adminId,
    actorRole: 'admin',
    action: 'admin.bootstrap',
    entityType: 'account',
    entityId: adminId,
    requestId: ctx.requestId,
    ipHash,
  });

  return json({ ok: true, adminId }, 201);
}
