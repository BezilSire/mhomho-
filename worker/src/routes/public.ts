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

  const observations = await ctx.env.DB.prepare(
    `SELECT observed_at, eligible_views FROM view_observations
      WHERE submission_id IN (SELECT id FROM submissions WHERE campaign_id = ?)
        AND is_current = 1
      ORDER BY observed_at ASC
      LIMIT 200`
  )
    .bind(campaign.id)
    .all<Record<string, unknown>>();

  const series: Array<{ label: string; value: number }> = [];
  let running = 0;
  const seenDays = new Set<string>();
  for (const observation of observations.results ?? []) {
    const date = new Date(Number(observation.observed_at));
    const day = date.toISOString().slice(0, 10);
    running += Number(observation.eligible_views) || 0;
    if (!seenDays.has(day)) {
      seenDays.add(day);
      series.push({
        label: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        value: running,
      });
    } else {
      series[series.length - 1] = { label: series[series.length - 1].label, value: running };
    }
  }
  series.push({ label: 'Now', value: counters.eligible_views || running });

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
      verifiedViews: counters.verified_views,
      eligibleViews: counters.eligible_views,
      guaranteedViews: calculateGuaranteedViews(campaign.budget_cents),
      budgetUsedCents: Math.floor(
        (counters.verified_views * campaign.brand_cpm_cents) / 1000
      ),
      budgetCents: campaign.budget_cents,
      creatorsJoined: counters.joined_count,
      clipsLive: counters.approved_submissions,
      viewsSeries: series.slice(-14),
      reportSummary:
        'Verified views are confirmed manually from public platform counters. Figures update as clips are reviewed.',
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

  return json({ ok: true, token: raw, path: `/api/brand/${raw}` }, 201);
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
