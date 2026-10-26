import type { Ctx } from '../context.ts';
import { recordAudit } from '../audit.ts';
import { requireAdmin, newId } from '../auth.ts';
import { maxUploadBytes } from '../env.ts';
import {
  calculateClipEarnings,
  calculateCreatorPool,
  calculatePerPostCap,
  DEFAULT_MONEY_CONFIG,
  percentToBasisPoints,
} from '../../../shared/money.ts';
import { assertTransition, settlementReady, type CampaignStatus } from '../campaigns.ts';
import {
  badRequest,
  conflict,
  json,
  notFound,
  tooMany,
} from '../http.ts';
import { consumeRateLimit } from '../rateLimit.ts';
import { getCampaignByIdOrThrow, planPayoutAllocations } from '../repo.ts';
import { sniffImage } from './assets.ts';
import { body, guardMutation, hashIp, maskDestination, slugify } from './helpers.ts';

type Row = Record<string, unknown>;

const CAMPAIGN_STATUSES: CampaignStatus[] = [
  'draft',
  'scheduled',
  'live',
  'paused',
  'closing',
  'completed',
  'cancelled',
];
const ENQUIRY_STATUSES = ['new', 'contacted', 'booked', 'closed'] as const;

const DAY = 86_400_000;
const MAX_BUDGET_CENTS = 5_000_000; // $50,000.00 hard ceiling per campaign.

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/* ------------------------------------------------------------------ */
/* Creator approval                                                    */
/* ------------------------------------------------------------------ */

export async function handleApproveCreator(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const admin = requireAdmin(ctx);

  const account = await ctx.env.DB.prepare(
    `SELECT id, role, status FROM accounts WHERE id = ?`
  )
    .bind(ctx.params.id)
    .first<Row>();
  if (!account || account.role !== 'creator') throw notFound('Creator not found.');
  if (account.status === 'approved') return json({ ok: true, alreadyApproved: true });
  if (account.status !== 'applied') throw conflict('This application is not awaiting approval.');

  const profile = await ctx.env.DB.prepare(
    `SELECT campaign_zero_follow_confirmed, campaign_zero_submitted_at
       FROM creator_profiles WHERE account_id = ?`
  )
    .bind(ctx.params.id)
    .first<Row>();
  if (!profile) throw notFound('Creator profile not found.');
  if (Number(profile.campaign_zero_follow_confirmed) !== 1) {
    throw badRequest('Campaign Zero is incomplete: the creator has not confirmed a follow.');
  }
  if (!profile.campaign_zero_submitted_at) {
    throw badRequest('The creator has not submitted Campaign Zero for review.');
  }

  const clips = await ctx.env.DB.prepare(
    `SELECT claimed_views FROM creator_campaign_zero_clips WHERE account_id = ?`
  )
    .bind(ctx.params.id)
    .all<Row>();
  const rows = clips.results ?? [];
  if (rows.length < 3) throw badRequest('Campaign Zero needs three clip links.');
  if (!rows.some((row) => num(row.claimed_views) >= 1000)) {
    throw badRequest('Campaign Zero needs one clip with at least 1,000 views.');
  }

  const now = Date.now();
  await ctx.env.DB.batch([
    ctx.env.DB.prepare(
      `UPDATE accounts SET status = 'approved', updated_at = ? WHERE id = ? AND status = 'applied'`
    ).bind(now, ctx.params.id),
    ctx.env.DB.prepare(
      `UPDATE creator_profiles SET approved_at = ?, updated_at = ? WHERE account_id = ?`
    ).bind(now, now, ctx.params.id),
  ]);

  await recordAudit(ctx.env, {
    actorId: admin.id,
    actorRole: 'admin',
    action: 'creator.approve',
    entityType: 'account',
    entityId: ctx.params.id,
    before: { status: 'applied' },
    after: { status: 'approved' },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json({ ok: true });
}

/* ------------------------------------------------------------------ */
/* Manual view verification                                            */
/* ------------------------------------------------------------------ */

interface SubmissionContext {
  submission: Row;
  campaignId: string;
  creatorId: string;
}

async function loadSubmission(ctx: Ctx): Promise<SubmissionContext | null> {
  const row = await ctx.env.DB.prepare(
    `SELECT id, campaign_id, creator_id, status, platform, claimed_views
       FROM submissions WHERE id = ?`
  )
    .bind(ctx.params.id)
    .first<Row>();
  if (!row) return null;
  return {
    submission: row,
    campaignId: String(row.campaign_id),
    creatorId: String(row.creator_id),
  };
}

export async function handleVerifySubmission(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const admin = requireAdmin(ctx);

  const input = await body<{
    observedViews: number;
    verifiedViews?: number | null;
    evidenceNote?: string | null;
  }>(ctx, {
    observedViews: { type: 'int', required: true, min: 0, max: 10_000_000_000 },
    verifiedViews: { type: 'int', min: 0, max: 10_000_000_000, nullable: true },
    evidenceNote: { type: 'string', min: 3, max: 500, nullable: true },
  });

  const verifiedViews = input.verifiedViews ?? input.observedViews;
  if (verifiedViews > input.observedViews) {
    throw badRequest('Verified views cannot exceed observed public views.');
  }

  // Retry once on a concurrent budget race: D1 serialises writes, and the
  // ledger trigger aborts an insert that would exceed the campaign pool.
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const loaded = await loadSubmission(ctx);
    if (!loaded) throw notFound('Submission not found.');
    if (String(loaded.submission.status) === 'approved') {
      throw conflict('This submission has already been verified.');
    }
    if (String(loaded.submission.status) !== 'submitted') {
      throw conflict('This submission is not awaiting verification.');
    }

    const { campaign, counters } = await getCampaignByIdOrThrow(ctx.env, loaded.campaignId);
    const now = Date.now();
    const observationId = newId('obs');
    const belowThreshold = verifiedViews < campaign.qualifying_view_threshold;

    const earnings = belowThreshold
      ? {
          earningsCents: 0,
          eligibleViews: 0,
          shortfallCents: 0,
          grossCents: 0,
        }
      : calculateClipEarnings(
          verifiedViews,
          campaign.creator_pool_cents,
          counters.committed_cents,
          campaign.per_post_cap_cents
        );

    if (!belowThreshold && earnings.earningsCents === 0 && counters.committed_cents >= campaign.creator_pool_cents) {
      throw conflict(
        'The creator pool is exhausted. Top up the campaign budget before verifying this clip.'
      );
    }

    const statements = [
      ctx.env.DB.prepare(
        `INSERT INTO view_observations
           (id, submission_id, observed_views, verified_views, eligible_views, gross_cents,
            committed_cents, shortfall_cents, source, evidence_note, observed_by, observed_at,
            idempotency_key, is_current)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, 1)`
      ).bind(
        observationId,
        ctx.params.id,
        input.observedViews,
        verifiedViews,
        earnings.eligibleViews,
        earnings.grossCents,
        earnings.earningsCents,
        earnings.shortfallCents,
        input.evidenceNote ?? null,
        admin.id,
        now,
        `obs:${ctx.params.id}:${now}:${attempt}`
      ),
      ctx.env.DB.prepare(
        `UPDATE submissions
            SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
          WHERE id = ? AND status = 'submitted'`
      ).bind(
        belowThreshold ? 'rejected' : 'approved',
        belowThreshold
          ? 'Rejected: verified views are below the 1,000-view qualifying threshold.'
          : input.evidenceNote ?? 'Verified against the public view count.',
        admin.id,
        now,
        now,
        ctx.params.id
      ),
      ctx.env.DB.prepare(
        `UPDATE campaign_counters
            SET verified_views = verified_views + ?,
                eligible_views = eligible_views + ?,
                shortfall_cents = shortfall_cents + ?,
                updated_at = ?
          WHERE campaign_id = ?`
      ).bind(
        // Only views that were accepted for payment count as "verified" for
        // brand reporting; a below-threshold rejection must not be billed.
        belowThreshold ? 0 : input.observedViews,
        earnings.eligibleViews,
        earnings.shortfallCents,
        now,
        campaign.id
      ),
    ];

    if (earnings.earningsCents > 0) {
      statements.push(
        ctx.env.DB.prepare(
          `INSERT INTO earnings_ledger
             (id, creator_id, campaign_id, submission_id, entry_type, amount_cents, currency,
              description, actor_id, idempotency_key, created_at)
           VALUES (?, ?, ?, ?, 'earning', ?, 'USD', ?, ?, ?, ?)`
        ).bind(
          newId('led'),
          loaded.creatorId,
          campaign.id,
          ctx.params.id,
          earnings.earningsCents,
          `${campaign.title} · ${String(loaded.submission.platform)} (${verifiedViews.toLocaleString('en-US')} verified views)`,
          admin.id,
          `earn:${ctx.params.id}:${observationId}`,
          now
        )
      );
    }

    try {
      await ctx.env.DB.batch(statements);
    } catch (error) {
      lastError = error;
      const message = errorMessage(error);
      if (message.includes('budget_exhausted')) continue;
      if (
        message.includes('uniq_current_observation') ||
        message.includes('UNIQUE constraint failed: view_observations')
      ) {
        // Two administrators verified the same clip at once. The partial unique
        // index guarantees only one observation (and one payment) can exist.
        throw conflict(
          'This clip was verified by another administrator. Refresh to see the result.'
        );
      }
      throw error;
    }

    await recordAudit(ctx.env, {
      actorId: admin.id,
      actorRole: 'admin',
      action: belowThreshold ? 'submission.reject.auto' : 'submission.verify',
      entityType: 'submission',
      entityId: ctx.params.id,
      after: {
        observedViews: input.observedViews,
        verifiedViews,
        eligibleViews: earnings.eligibleViews,
        earningsCents: earnings.earningsCents,
        shortfallCents: earnings.shortfallCents,
      },
      requestId: ctx.requestId,
      ipHash: await hashIp(ctx.env, ctx.request),
    });

    return json({
      ok: true,
      rejected: belowThreshold,
      earningsCents: earnings.earningsCents,
      eligibleViews: earnings.eligibleViews,
      shortfallCents: earnings.shortfallCents,
    });
  }

  throw conflict(
    'Another verification changed this campaign at the same time. Refresh and try again.',
    { cause: errorMessage(lastError) }
  );
}

export async function handleRejectSubmission(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const admin = requireAdmin(ctx);

  const input = await body<{ note: string }>(ctx, {
    note: { type: 'string', required: true, min: 3, max: 500 },
  });

  const loaded = await loadSubmission(ctx);
  if (!loaded) throw notFound('Submission not found.');
  if (String(loaded.submission.status) === 'rejected') {
    return json({ ok: true, alreadyRejected: true });
  }
  if (String(loaded.submission.status) !== 'submitted') {
    throw conflict('Only a submitted clip can be rejected.');
  }

  const now = Date.now();
  await ctx.env.DB.batch([
    ctx.env.DB.prepare(
      `UPDATE submissions
          SET status = 'rejected', review_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
        WHERE id = ? AND status = 'submitted'`
    ).bind(input.note, admin.id, now, now, ctx.params.id),
    ctx.env.DB.prepare(
      `INSERT INTO submission_reviews (id, submission_id, decision, note, actor_id, created_at)
       VALUES (?, ?, 'reject', ?, ?, ?)`
    ).bind(newId('rev'), ctx.params.id, input.note, admin.id, now),
  ]);

  await recordAudit(ctx.env, {
    actorId: admin.id,
    actorRole: 'admin',
    action: 'submission.reject',
    entityType: 'submission',
    entityId: ctx.params.id,
    after: { note: input.note },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json({ ok: true });
}

/* ------------------------------------------------------------------ */
/* Payouts                                                             */
/* ------------------------------------------------------------------ */

export async function handleRecordPayout(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const admin = requireAdmin(ctx);

  const input = await body<{
    creatorId: string;
    amountCents: number;
    reference: string;
    method?: 'ecocash' | 'bank_transfer' | 'manual';
  }>(ctx, {
    creatorId: { type: 'string', required: true, min: 3, max: 100 },
    amountCents: { type: 'int', required: true, min: 1, max: MAX_BUDGET_CENTS },
    reference: { type: 'string', required: true, min: 2, max: 64 },
    method: { type: 'string', values: ['ecocash', 'bank_transfer', 'manual'] },
  });

  if (input.amountCents < DEFAULT_MONEY_CONFIG.minPayoutCents) {
    throw badRequest(
      `The minimum payout is ${(DEFAULT_MONEY_CONFIG.minPayoutCents / 100).toFixed(2)} USD.`
    );
  }

  const creator = await ctx.env.DB.prepare(
    `SELECT a.id, a.status, p.ecocash_number, p.whatsapp_number
       FROM accounts a JOIN creator_profiles p ON p.account_id = a.id
      WHERE a.id = ? AND a.role = 'creator'`
  )
    .bind(input.creatorId)
    .first<Row>();
  if (!creator) throw notFound('Creator not found.');
  if (creator.status !== 'approved') throw conflict('This creator is not approved.');

  const open = await ctx.env.DB.prepare(
    `SELECT id FROM payouts
      WHERE creator_id = ? AND status IN ('requested','approved','processing')
      LIMIT 1`
  )
    .bind(input.creatorId)
    .first();
  if (open) {
    throw conflict('This creator has an open withdrawal request. Settle or cancel it first.');
  }

  const balance = await ctx.env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN entry_type IN ('earning','adjustment','reversal') THEN amount_cents ELSE 0 END), 0) AS earned,
            COALESCE(-SUM(CASE WHEN entry_type IN ('payout','payout_reversal') THEN amount_cents ELSE 0 END), 0) AS paid
       FROM earnings_ledger WHERE creator_id = ?`
  )
    .bind(input.creatorId)
    .first<Row>();

  const earned = num(balance?.earned);
  const paid = Math.max(0, num(balance?.paid));
  const owed = Math.max(0, earned - paid);
  if (input.amountCents > owed) {
    throw conflict(`That exceeds the creator's owed balance of ${(owed / 100).toFixed(2)} USD.`);
  }

  // Allocate the payout across campaigns so per-campaign reporting stays exact.
  const allocations = await planPayoutAllocations(ctx.env, input.creatorId, input.amountCents);

  const destination = String(creator.ecocash_number ?? creator.whatsapp_number ?? '');
  if (!destination) throw badRequest('This creator has no payout destination on file.');

  const now = Date.now();
  const payoutId = newId('pay');
  const method = input.method ?? 'ecocash';

  const statements = [
    ctx.env.DB.prepare(
      `INSERT INTO payouts
         (id, creator_id, amount_cents, currency, status, method, destination_masked,
          destination_hash, reference, requested_by, decided_by, requested_at, decided_at,
          paid_at, idempotency_key, created_at, updated_at)
       VALUES (?, ?, ?, 'USD', 'paid', ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      payoutId,
      input.creatorId,
      input.amountCents,
      method,
      maskDestination(destination),
      input.reference,
      admin.id,
      admin.id,
      now,
      now,
      now,
      `payout:${input.creatorId}:${input.reference}`,
      now,
      now
    ),
    ctx.env.DB.prepare(
      `INSERT INTO earnings_ledger
         (id, creator_id, campaign_id, submission_id, entry_type, amount_cents, currency,
          description, actor_id, idempotency_key, created_at)
       VALUES (?, ?, NULL, NULL, 'payout', ?, 'USD', ?, ?, ?, ?)`
    ).bind(
      newId('led'),
      input.creatorId,
      -input.amountCents,
      `EcoCash payout (Ref: ${input.reference})`,
      admin.id,
      `payout-ledger:${payoutId}`,
      now
    ),
  ];

  for (const allocation of allocations) {
    statements.push(
      ctx.env.DB.prepare(
        `INSERT INTO payout_allocations (payout_id, campaign_id, amount_cents) VALUES (?, ?, ?)`
      ).bind(payoutId, allocation.campaignId, allocation.amountCents),
      ctx.env.DB.prepare(
        `UPDATE campaign_counters
            SET paid_cents = paid_cents + ?, updated_at = ?
          WHERE campaign_id = ?`
      ).bind(allocation.amountCents, now, allocation.campaignId)
    );
  }

  try {
    await ctx.env.DB.batch(statements);
  } catch (error) {
    const message = errorMessage(error);
    if (message.includes('insufficient_balance')) {
      throw conflict('The creator balance changed. Refresh and try again.');
    }
    if (message.includes('allocation_exceeds_campaign_earnings')) {
      throw conflict('Payout allocation no longer matches campaign earnings. Refresh and try again.');
    }
    if (message.includes('payouts.idempotency_key') || message.includes('UNIQUE constraint failed: payouts')) {
      // Replaying the same reference is a client retry, not a second payment.
      throw conflict('A payout with that reference has already been recorded.');
    }
    throw error;
  }

  await recordAudit(ctx.env, {
    actorId: admin.id,
    actorRole: 'admin',
    action: 'payout.record',
    entityType: 'payout',
    entityId: payoutId,
    after: {
      creatorId: input.creatorId,
      amountCents: input.amountCents,
      reference: input.reference,
      allocations,
    },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json({ ok: true, payoutId }, 201);
}

/* ------------------------------------------------------------------ */
/* Settling a creator's withdrawal request                             */
/* ------------------------------------------------------------------ */

export async function handleSettlePayout(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const admin = requireAdmin(ctx);

  const input = await body<{
    status: 'paid' | 'cancelled' | 'failed';
    reference?: string | null;
    failureReason?: string | null;
  }>(ctx, {
    status: { type: 'string', required: true, values: ['paid', 'cancelled', 'failed'] },
    reference: { type: 'string', min: 2, max: 64, nullable: true },
    failureReason: { type: 'string', min: 2, max: 200, nullable: true },
  });

  const payout = await ctx.env.DB.prepare(
    `SELECT id, creator_id, amount_cents, status FROM payouts WHERE id = ?`
  )
    .bind(ctx.params.id)
    .first<Row>();
  if (!payout) throw notFound('Withdrawal request not found.');

  const current = String(payout.status);
  if (!['requested', 'approved', 'processing'].includes(current)) {
    throw conflict('This withdrawal has already been settled.');
  }

  const now = Date.now();
  const payoutId = String(payout.id);
  const creatorId = String(payout.creator_id);

  if (input.status === 'paid') {
    const reference = (input.reference ?? '').trim();
    if (!reference) throw badRequest('Enter the EcoCash transaction reference.');

    const duplicate = await ctx.env.DB.prepare(
      `SELECT 1 FROM payouts WHERE reference = ? AND id <> ?`
    )
      .bind(reference, payoutId)
      .first();
    if (duplicate) throw conflict('A payout with that reference has already been recorded.');

    const allocations = await ctx.env.DB.prepare(
      `SELECT campaign_id, amount_cents FROM payout_allocations WHERE payout_id = ?`
    )
      .bind(payoutId)
      .all<Row>();

    const statements = [
      ctx.env.DB.prepare(
        `UPDATE payouts
            SET status = 'paid', reference = ?, decided_by = ?, decided_at = ?, paid_at = ?,
                updated_at = ?
          WHERE id = ? AND status IN ('requested','approved','processing')`
      ).bind(reference, admin.id, now, now, now, payoutId),
      // The money leaves the creator balance only when the transfer is settled.
      ctx.env.DB.prepare(
        `INSERT INTO earnings_ledger
           (id, creator_id, campaign_id, submission_id, entry_type, amount_cents, currency,
            description, actor_id, idempotency_key, created_at)
         VALUES (?, ?, NULL, NULL, 'payout', ?, 'USD', ?, ?, ?, ?)`
      ).bind(
        newId('led'),
        creatorId,
        -num(payout.amount_cents),
        `EcoCash payout (Ref: ${reference})`,
        admin.id,
        `withdrawal-ledger:${payoutId}`,
        now
      ),
    ];

    for (const row of allocations.results ?? []) {
      statements.push(
        ctx.env.DB.prepare(
          `UPDATE campaign_counters
              SET paid_cents = paid_cents + ?, updated_at = ?
            WHERE campaign_id = ?`
        ).bind(num(row.amount_cents), now, String(row.campaign_id))
      );
    }

    try {
      await ctx.env.DB.batch(statements);
    } catch (error) {
      const message = errorMessage(error);
      if (message.includes('payouts.reference')) {
        throw conflict('A payout with that reference has already been recorded.');
      }
      throw error;
    }

    await recordAudit(ctx.env, {
      actorId: admin.id,
      actorRole: 'admin',
      action: 'payout.settle',
      entityType: 'payout',
      entityId: payoutId,
      before: { status: current },
      after: { status: 'paid', reference, amountCents: num(payout.amount_cents) },
      requestId: ctx.requestId,
      ipHash: await hashIp(ctx.env, ctx.request),
    });

    return json({ ok: true, status: 'paid' });
  }

  // Cancelled or failed: no ledger row was written at request time, so simply
  // releasing the reservation returns the full amount to the spendable balance.
  const reason = (input.failureReason ?? '').trim() || null;
  await ctx.env.DB.prepare(
    `UPDATE payouts
        SET status = ?, failure_reason = ?, decided_by = ?, decided_at = ?, updated_at = ?
      WHERE id = ? AND status IN ('requested','approved','processing')`
  )
    .bind(input.status, reason, admin.id, now, now, payoutId)
    .run();

  await recordAudit(ctx.env, {
    actorId: admin.id,
    actorRole: 'admin',
    action: `payout.${input.status}`,
    entityType: 'payout',
    entityId: payoutId,
    before: { status: current },
    after: { status: input.status, reason, amountCents: num(payout.amount_cents) },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json({ ok: true, status: input.status });
}

/* ------------------------------------------------------------------ */
/* Campaign administration                                             */
/* ------------------------------------------------------------------ */

export async function handleCreateCampaign(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const admin = requireAdmin(ctx);

  const input = await body<{
    title: string;
    brandName: string;
    niche: string;
    brief: string;
    budgetCents: number;
    requiredContent?: string | null;
    eligibility?: string | null;
    hookIdeas?: string[];
    doNots?: string[];
    startsAt?: number | null;
    endsAt?: number | null;
    perPostCapCents?: number | null;
    publishMode?: 'draft' | 'scheduled' | 'live';
  }>(ctx, {
    title: { type: 'string', required: true, min: 3, max: 200 },
    brandName: { type: 'string', required: true, min: 2, max: 120 },
    niche: { type: 'string', required: true, min: 2, max: 80 },
    brief: { type: 'string', required: true, min: 10, max: 4000 },
    budgetCents: { type: 'int', required: true, min: 5000, max: MAX_BUDGET_CENTS },
    requiredContent: { type: 'string', min: 3, max: 4000, nullable: true },
    eligibility: { type: 'string', min: 3, max: 4000, nullable: true },
    hookIdeas: { type: 'array', max: 10, items: { type: 'string', min: 2, max: 300 } },
    doNots: { type: 'array', max: 10, items: { type: 'string', min: 2, max: 300 } },
    startsAt: { type: 'int', min: 0, nullable: true },
    endsAt: { type: 'int', min: 0, nullable: true },
    perPostCapCents: { type: 'int', min: 1, max: MAX_BUDGET_CENTS, nullable: true },
    publishMode: { type: 'string', values: ['draft', 'scheduled', 'live'] },
  });

  const now = Date.now();
  const publishMode = input.publishMode ?? 'auto';
  const startsAt = publishMode === 'live' ? now : input.startsAt ?? now;
  const endsAt = input.endsAt ?? startsAt + 14 * DAY;
  if (endsAt <= startsAt) throw badRequest('The campaign must end after it starts.');
  if (publishMode !== 'draft' && endsAt <= now) {
    throw badRequest('The campaign end date must be in the future.');
  }
  if (endsAt - startsAt > 365 * DAY) throw badRequest('Campaigns cannot run longer than a year.');
  if (publishMode === 'scheduled' && startsAt <= now) {
    throw badRequest('A scheduled campaign needs a start date in the future.');
  }

  const duration = endsAt - startsAt;
  const joiningCutoffAt = startsAt + Math.floor(duration * 0.8);
  const submissionCutoffAt = Math.max(startsAt + 3_600_000, endsAt - 2 * DAY);
  const poolCents = calculateCreatorPool(input.budgetCents);
  if (poolCents <= 0) throw badRequest('That budget is too small to fund a creator pool.');

  const defaultCapCents = calculatePerPostCap(poolCents);
  const perPostCapCents = input.perPostCapCents ?? defaultCapCents;
  if (perPostCapCents <= 0) throw badRequest('The per-post cap must be greater than zero.');
  if (perPostCapCents > poolCents) {
    throw badRequest('The per-post cap cannot exceed the creator pool.');
  }
  if (perPostCapCents > DEFAULT_MONEY_CONFIG.absoluteCeilingCents) {
    throw badRequest(
      `The per-post cap cannot exceed $${DEFAULT_MONEY_CONFIG.absoluteCeilingCents / 100}.`
    );
  }

  const campaignId = newId('camp');
  const slug = `${slugify(input.title)}-${campaignId.slice(-6)}`;
  const status: CampaignStatus =
    publishMode === 'draft'
      ? 'draft'
      : publishMode === 'live'
        ? 'live'
        : publishMode === 'scheduled'
          ? 'scheduled'
          : startsAt > now
            ? 'scheduled'
            : 'live';

  await ctx.env.DB.batch([
    ctx.env.DB.prepare(
      `INSERT INTO campaigns
         (id, slug, title, brand_name, niche, brief, required_content, eligibility, hook_ideas,
          do_nots, status, currency, budget_cents, creator_pool_cents, brand_cpm_cents,
          creator_cpm_cents, per_post_cap_cents, per_post_cap_bp, qualifying_view_threshold,
          joining_close_bp, starts_at, joining_cutoff_at, submission_cutoff_at, views_cutoff_at,
          ends_at, terms_version, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?, ?, 8000,
               ?, ?, ?, ?, ?, 1, ?, ?, ?)`
    ).bind(
      campaignId,
      slug,
      input.title,
      input.brandName,
      input.niche,
      input.brief,
      input.requiredContent ?? null,
      input.eligibility ?? null,
      JSON.stringify(input.hookIdeas ?? []),
      JSON.stringify(input.doNots ?? []),
      status,
      input.budgetCents,
      poolCents,
      DEFAULT_MONEY_CONFIG.brandPricePerThousandCents,
      DEFAULT_MONEY_CONFIG.creatorRatePerThousandCents,
      perPostCapCents,
      percentToBasisPoints(DEFAULT_MONEY_CONFIG.perPostCapPercent),
      DEFAULT_MONEY_CONFIG.qualifyingViewThreshold,
      startsAt,
      joiningCutoffAt,
      submissionCutoffAt,
      endsAt,
      endsAt,
      admin.id,
      now,
      now
    ),
    ctx.env.DB.prepare(
      `INSERT INTO campaign_counters (campaign_id, updated_at) VALUES (?, ?)`
    ).bind(campaignId, now),
    ctx.env.DB.prepare(
      `INSERT INTO campaign_budget_ledger
         (id, campaign_id, entry_type, amount_cents, idempotency_key, actor_id, note, created_at)
       VALUES (?, ?, 'allocation', ?, ?, ?, 'Initial campaign budget', ?)`
    ).bind(newId('bud'), campaignId, input.budgetCents, `allocation:${campaignId}`, admin.id, now),
  ]);

  await recordAudit(ctx.env, {
    actorId: admin.id,
    actorRole: 'admin',
    action: 'campaign.create',
    entityType: 'campaign',
    entityId: campaignId,
    after: { title: input.title, budgetCents: input.budgetCents, poolCents, status },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json({ ok: true, campaignId, slug }, 201);
}

/**
 * Who joined this campaign, with the operational detail an administrator needs
 * (time joined, platform, niche, review state). Keyset-free paging is fine here:
 * the member table is small relative to the rest of the workload.
 */
export async function handleCampaignMembers(ctx: Ctx): Promise<Response> {
  requireAdmin(ctx);
  const { campaign } = await getCampaignByIdOrThrow(ctx.env, ctx.params.id);

  const limitRaw = Number(ctx.url.searchParams.get('limit') ?? '100');
  const offsetRaw = Number(ctx.url.searchParams.get('offset') ?? '0');
  const limit = Math.min(200, Math.max(1, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 100));
  const offset = Math.max(0, Number.isFinite(offsetRaw) ? Math.trunc(offsetRaw) : 0);
  const query = (ctx.url.searchParams.get('q') ?? '').trim().slice(0, 60);
  const like = `%${query.replace(/[%_]/g, '')}%`;

  const searchClause = query ? 'AND (p.handle LIKE ? OR p.display_name LIKE ?)' : '';
  const searchBinds = query ? [like, like] : [];

  const totalRow = await ctx.env.DB.prepare(
    `SELECT COUNT(*) AS total
       FROM campaign_members m
       JOIN creator_profiles p ON p.account_id = m.creator_id
      WHERE m.campaign_id = ? ${searchClause}`
  )
    .bind(campaign.id, ...searchBinds)
    .first<Row>();

  const rows = await ctx.env.DB.prepare(
    `SELECT m.creator_id, m.joined_at,
            p.handle, p.display_name, p.platform, p.niche, p.followers,
            a.status AS account_status,
            (SELECT COUNT(*) FROM submissions s
              WHERE s.campaign_id = m.campaign_id AND s.creator_id = m.creator_id) AS clips_submitted,
            (SELECT COALESCE(SUM(o.verified_views), 0)
               FROM view_observations o
               JOIN submissions s2 ON s2.id = o.submission_id
              WHERE s2.campaign_id = m.campaign_id
                AND s2.creator_id = m.creator_id
                AND o.is_current = 1) AS verified_views,
            (SELECT COALESCE(SUM(l.amount_cents), 0)
               FROM earnings_ledger l
              WHERE l.campaign_id = m.campaign_id
                AND l.creator_id = m.creator_id
                AND l.entry_type IN ('earning','adjustment','reversal')) AS earned_cents
       FROM campaign_members m
       JOIN accounts a ON a.id = m.creator_id
       JOIN creator_profiles p ON p.account_id = m.creator_id
      WHERE m.campaign_id = ? ${searchClause}
      ORDER BY m.joined_at DESC
      LIMIT ? OFFSET ?`
  )
    .bind(campaign.id, ...searchBinds, limit, offset)
    .all<Row>();

  return json({
    ok: true,
    data: {
      campaign: {
        id: campaign.id,
        title: campaign.title,
        status: campaign.status,
        startsAt: campaign.starts_at,
        endsAt: campaign.ends_at,
      },
      total: num(totalRow?.total),
      limit,
      offset,
      members: (rows.results ?? []).map((row) => ({
        uid: str(row.creator_id),
        handle: str(row.handle),
        displayName: str(row.display_name),
        platform: str(row.platform),
        niche: str(row.niche),
        followers: num(row.followers),
        accountStatus: str(row.account_status),
        joinedAtMs: num(row.joined_at),
        clipsSubmitted: num(row.clips_submitted),
        verifiedViews: num(row.verified_views),
        earnedCents: num(row.earned_cents),
      })),
    },
  });
}

/**
 * Upload or replace the campaign's public poster. Mirrors the proof-upload
 * path: the browser-supplied type is ignored and the real format is sniffed
 * from magic bytes.
 */
export async function handleCampaignPoster(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const admin = requireAdmin(ctx);
  const { campaign } = await getCampaignByIdOrThrow(ctx.env, ctx.params.id);

  const uploadLimit = await consumeRateLimit(ctx.env, `poster:${admin.id}`, 30, 60 * 60);
  if (!uploadLimit.allowed) {
    throw tooMany('Too many campaign uploads. Try again later.', uploadLimit.retryAfterSeconds);
  }

  const limit = maxUploadBytes(ctx.env);
  const declared = Number(ctx.request.headers.get('Content-Length') ?? '0');
  if (declared > limit) throw badRequest(`The campaign image must be under ${(limit / 1048576).toFixed(1)} MB.`);

  const buffer = await ctx.request.arrayBuffer();
  if (buffer.byteLength === 0) throw badRequest('The uploaded file is empty.');
  if (buffer.byteLength > limit) {
    throw badRequest(`The campaign image must be under ${(limit / 1048576).toFixed(1)} MB.`);
  }

  const sniffed = sniffImage(new Uint8Array(buffer));
  if (!sniffed) throw badRequest('The campaign image must be a PNG, JPEG or WebP.');

  const now = Date.now();
  const date = new Date(now).toISOString().slice(0, 7).replace('-', '/');
  const objectKey = `campaign/${date}/${campaign.id}-${newId('obj').slice(-8)}.${sniffed.extension}`;
  const assetId = newId('asset');

  await ctx.env.MEDIA.put(objectKey, buffer, {
    httpMetadata: {
      contentType: sniffed.contentType,
      cacheControl: 'public, max-age=3600',
      contentDisposition: 'inline',
    },
    customMetadata: {
      ownerId: admin.id,
      assetId,
      visibility: 'public',
    },
  });

  await ctx.env.DB.batch([
    ctx.env.DB.prepare(
      `UPDATE campaign_assets
          SET status = 'deleted', deleted_at = ?
        WHERE campaign_id = ? AND kind = 'poster' AND status = 'ready'`
    ).bind(now, campaign.id),
    ctx.env.DB.prepare(
      `INSERT INTO campaign_assets
         (id, campaign_id, owner_id, kind, object_key, original_name, content_type, size_bytes,
          checksum_sha256, visibility, status, created_at, ready_at)
       VALUES (?, ?, ?, 'poster', ?, ?, ?, ?, NULL, 'public', 'ready', ?, ?)`
    ).bind(
      assetId,
      campaign.id,
      admin.id,
      objectKey,
      'campaign-poster',
      sniffed.contentType,
      buffer.byteLength,
      now,
      now
    ),
    ctx.env.DB.prepare(
      `UPDATE campaigns SET poster_asset_id = ?, updated_at = ? WHERE id = ?`
    ).bind(assetId, now, campaign.id),
  ]);

  await recordAudit(ctx.env, {
    actorId: admin.id,
    actorRole: 'admin',
    action: 'campaign.poster',
    entityType: 'campaign',
    entityId: campaign.id,
    after: { assetId, contentType: sniffed.contentType, sizeBytes: buffer.byteLength },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json({ ok: true, assetId, url: `/api/assets/${assetId}` }, 201);
}

export async function handleTopUpCampaign(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const admin = requireAdmin(ctx);

  const input = await body<{ amountCents: number; note?: string | null }>(ctx, {
    amountCents: { type: 'int', required: true, min: 1000, max: MAX_BUDGET_CENTS },
    note: { type: 'string', min: 2, max: 300, nullable: true },
  });

  const { campaign } = await getCampaignByIdOrThrow(ctx.env, ctx.params.id);
  if (campaign.status === 'completed' || campaign.status === 'cancelled') {
    throw conflict('This campaign is closed and cannot be topped up.');
  }
  if (campaign.budget_cents + input.amountCents > MAX_BUDGET_CENTS) {
    throw badRequest('That top-up would exceed the maximum campaign budget.');
  }

  const newBudget = campaign.budget_cents + input.amountCents;
  const newPool = calculateCreatorPool(newBudget);
  const newCap = calculatePerPostCap(newPool);
  const now = Date.now();

  await ctx.env.DB.batch([
    ctx.env.DB.prepare(
      `UPDATE campaigns
          SET budget_cents = ?, creator_pool_cents = ?, per_post_cap_cents = ?, updated_at = ?
        WHERE id = ?`
    ).bind(newBudget, newPool, newCap, now, campaign.id),
    ctx.env.DB.prepare(
      `INSERT INTO campaign_budget_ledger
         (id, campaign_id, entry_type, amount_cents, idempotency_key, actor_id, note, created_at)
       VALUES (?, ?, 'top_up', ?, ?, ?, ?, ?)`
    ).bind(
      newId('bud'),
      campaign.id,
      input.amountCents,
      `topup:${campaign.id}:${now}`,
      admin.id,
      input.note ?? 'Administrative top-up',
      now
    ),
  ]);

  await recordAudit(ctx.env, {
    actorId: admin.id,
    actorRole: 'admin',
    action: 'campaign.top_up',
    entityType: 'campaign',
    entityId: campaign.id,
    before: { budgetCents: campaign.budget_cents, poolCents: campaign.creator_pool_cents },
    after: { budgetCents: newBudget, poolCents: newPool },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json({ ok: true, budgetCents: newBudget, poolCents: newPool });
}

export async function handleCampaignStatus(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const admin = requireAdmin(ctx);

  const input = await body<{ status: CampaignStatus; note?: string | null }>(ctx, {
    status: { type: 'string', required: true, values: CAMPAIGN_STATUSES },
    note: { type: 'string', min: 2, max: 300, nullable: true },
  });

  const { campaign } = await getCampaignByIdOrThrow(ctx.env, ctx.params.id);
  assertTransition(campaign.status, input.status);

  if (input.status === 'completed' && !settlementReady(campaign)) {
    throw conflict('Views are still being verified. Complete the campaign after its view cutoff.');
  }
  if (
    (input.status === 'live' || input.status === 'scheduled') &&
    campaign.ends_at !== null &&
    campaign.ends_at <= Date.now()
  ) {
    throw conflict('This campaign’s end date has passed. Create a new campaign with fresh dates.');
  }

  const now = Date.now();
  await ctx.env.DB.prepare(
    `UPDATE campaigns
        SET status = ?,
            updated_at = ?,
            settled_at = CASE WHEN ? = 'completed' THEN ? ELSE settled_at END,
            cancelled_at = CASE WHEN ? = 'cancelled' THEN ? ELSE cancelled_at END
      WHERE id = ?`
  )
    .bind(input.status, now, input.status, now, input.status, now, campaign.id)
    .run();

  await recordAudit(ctx.env, {
    actorId: admin.id,
    actorRole: 'admin',
    action: 'campaign.status',
    entityType: 'campaign',
    entityId: campaign.id,
    before: { status: campaign.status },
    after: { status: input.status, note: input.note ?? null },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json({ ok: true, status: input.status });
}

/* ------------------------------------------------------------------ */
/* Enquiries                                                           */
/* ------------------------------------------------------------------ */

export async function handleEnquiryStatus(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const admin = requireAdmin(ctx);

  const input = await body<{ status: (typeof ENQUIRY_STATUSES)[number] }>(ctx, {
    status: { type: 'string', required: true, values: ENQUIRY_STATUSES },
  });

  const result = await ctx.env.DB.prepare(
    `UPDATE enquiries SET status = ?, updated_at = ? WHERE id = ?`
  )
    .bind(input.status, Date.now(), ctx.params.id)
    .run();

  if ((result.meta?.changes ?? 0) === 0) throw notFound('Enquiry not found.');

  await recordAudit(ctx.env, {
    actorId: admin.id,
    actorRole: 'admin',
    action: 'enquiry.status',
    entityType: 'enquiry',
    entityId: ctx.params.id,
    after: { status: input.status },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json({ ok: true });
}
