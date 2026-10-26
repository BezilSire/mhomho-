import type { Ctx } from '../context.ts';
import { recordAudit } from '../audit.ts';
import { badRequest, clearSessionCookie, conflict, forbidden, json, notFound, tooMany } from '../http.ts';
import { consumeRateLimit } from '../rateLimit.ts';
import { acceptingParticipants, acceptingSubmissions } from '../campaigns.ts';
import { parseSocialUrl, UrlValidationError } from '../urls.ts';
import { cookieSecurity, newId, sessionCookieName } from '../auth.ts';
import { sha256Hex, verifyPassword } from '../crypto.ts';
import { DEFAULT_MONEY_CONFIG } from '../../../shared/money.ts';
import { AVATAR_KEYS, normalizeAvatarKey, type AvatarKey } from '../../../shared/community.ts';
import { getCampaignByIdOrThrow, planPayoutAllocations } from '../repo.ts';
import { validate } from '../validation.ts';
import {
  body,
  guardMutation,
  hashIp,
  maskDestination,
  requireApprovedCreator,
  requireCreator,
} from './helpers.ts';

type Row = Record<string, unknown>;

const PLATFORMS = ['TikTok', 'Instagram', 'YouTube', 'Facebook'] as const;

function urlError(error: unknown): never {
  if (error instanceof UrlValidationError) throw badRequest(error.message);
  throw badRequest('Enter a valid post link.');
}

export async function handleJoinCampaign(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const account = requireApprovedCreator(ctx);
  const { campaign, counters } = await getCampaignByIdOrThrow(ctx.env, ctx.params.id);

  const existing = await ctx.env.DB.prepare(
    `SELECT 1 FROM campaign_members WHERE campaign_id = ? AND creator_id = ?`
  )
    .bind(campaign.id, account.id)
    .first();
  if (existing) return json({ ok: true, alreadyJoined: true });

  if (!acceptingParticipants(campaign)) {
    throw conflict('This campaign is not accepting new creators.');
  }
  if (campaign.creator_pool_cents <= 0) {
    throw conflict('This campaign has no creator budget available.');
  }
  const joinCeiling = Math.floor(
    (campaign.creator_pool_cents * campaign.joining_close_bp) / 10000
  );
  if (counters.committed_cents >= joinCeiling) {
    throw conflict('This campaign is fully committed and closed to new joins.');
  }

  const now = Date.now();
  const result = await ctx.env.DB.prepare(
    `INSERT OR IGNORE INTO campaign_members (campaign_id, creator_id, joined_at, terms_version)
     VALUES (?, ?, ?, ?)`
  )
    .bind(campaign.id, account.id, now, campaign.terms_version)
    .run();

  if ((result.meta?.changes ?? 0) === 0) {
    return json({ ok: true, alreadyJoined: true });
  }

  await recordAudit(ctx.env, {
    actorId: account.id,
    actorRole: 'creator',
    action: 'campaign.join',
    entityType: 'campaign',
    entityId: campaign.id,
    after: { termsVersion: campaign.terms_version },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json({ ok: true });
}

interface ClipSubmission {
  platform: (typeof PLATFORMS)[number];
  postUrl: string;
  claimedViews: number;
  proofAssetId?: string | null;
}

const CLIP_SCHEMA = {
  platform: { type: 'string', required: true, values: PLATFORMS },
  postUrl: { type: 'string', required: true, min: 10, max: 2048 },
  claimedViews: { type: 'int', required: true, min: 0, max: 10_000_000_000 },
  proofAssetId: { type: 'string', min: 3, max: 120, nullable: true },
} as const;

export async function handleSubmitClip(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const account = requireApprovedCreator(ctx);
  if (account.status !== 'approved') throw forbidden('Only approved creators can submit clips.');

  const input = await body<{
    campaignId: string;
    platform?: string;
    postUrl?: string;
    claimedViews?: number;
    proofAssetId?: string | null;
    clips?: unknown[];
  }>(ctx, {
    campaignId: { type: 'string', required: true, min: 1, max: 100 },
    clips: { type: 'array', max: 2, items: { type: 'object' } },
    platform: { type: 'string', values: PLATFORMS },
    postUrl: { type: 'string', min: 10, max: 2048 },
    claimedViews: { type: 'int', min: 0, max: 10_000_000_000 },
    proofAssetId: { type: 'string', min: 3, max: 120, nullable: true },
  });

  // Accept the new batch shape and the original single-clip shape, so older
  // clients and existing tests keep working.
  let rawClips: unknown[];
  if (input.clips) {
    rawClips = input.clips;
  } else {
    if (!input.platform || !input.postUrl || input.claimedViews === undefined) {
      throw badRequest('Add at least one clip.');
    }
    rawClips = [
      {
        platform: input.platform,
        postUrl: input.postUrl,
        claimedViews: input.claimedViews,
        proofAssetId: input.proofAssetId,
      },
    ];
  }

  if (rawClips.length < 1) throw badRequest('Add at least one clip.');
  if (rawClips.length > 2) throw badRequest('Submit at most two clips at a time.');

  const clips = rawClips.map((raw) => validate<ClipSubmission>(raw, CLIP_SCHEMA));
  const seenPlatforms = new Set<string>();
  for (const clip of clips) {
    if (seenPlatforms.has(clip.platform)) {
      throw badRequest('Each clip must be on a different platform.');
    }
    seenPlatforms.add(clip.platform);
  }

  const { campaign } = await getCampaignByIdOrThrow(ctx.env, input.campaignId);
  if (!acceptingSubmissions(campaign)) {
    throw conflict('This campaign is no longer accepting submissions.');
  }

  const member = await ctx.env.DB.prepare(
    `SELECT 1 FROM campaign_members WHERE campaign_id = ? AND creator_id = ?`
  )
    .bind(campaign.id, account.id)
    .first();
  if (!member) throw forbidden('Join this campaign before submitting a clip.');

  const prepared: Array<{
    submissionId: string;
    platform: (typeof PLATFORMS)[number];
    canonicalUrl: string;
    identity: string;
    claimedViews: number;
    proofAssetId: string | null;
  }> = [];

  for (const clip of clips) {
    let parsed: ReturnType<typeof parseSocialUrl>;
    try {
      parsed = parseSocialUrl(clip.postUrl);
    } catch (error) {
      urlError(error);
    }

    if (parsed.platform !== clip.platform) {
      throw badRequest(
        `That link is a ${parsed.platform} post. Select ${parsed.platform} as the platform.`
      );
    }

    let proofAssetId: string | null = null;
    if (clip.proofAssetId) {
      const asset = await ctx.env.DB.prepare(
        `SELECT id, owner_id, kind, visibility, status FROM campaign_assets WHERE id = ?`
      )
        .bind(clip.proofAssetId)
        .first<Row>();
      if (!asset || String(asset.owner_id) !== account.id) {
        throw badRequest('The proof upload could not be found.');
      }
      if (asset.kind !== 'proof_screenshot' || asset.status !== 'ready') {
        throw badRequest('The proof upload is not ready.');
      }
      proofAssetId = String(asset.id);
    }

    prepared.push({
      submissionId: newId('sub'),
      platform: parsed.platform,
      canonicalUrl: parsed.canonicalUrl,
      identity: parsed.identity,
      claimedViews: clip.claimedViews,
      proofAssetId,
    });
  }

  const now = Date.now();
  try {
    await ctx.env.DB.batch(
      prepared.map((clip) =>
        ctx.env.DB.prepare(
          `INSERT INTO submissions
             (id, campaign_id, creator_id, platform, post_url, post_url_normalized, claimed_views,
              proof_asset_id, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)`
        ).bind(
          clip.submissionId,
          campaign.id,
          account.id,
          clip.platform,
          clip.canonicalUrl,
          clip.identity,
          clip.claimedViews,
          clip.proofAssetId,
          now,
          now
        )
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('UNIQUE')) {
      throw conflict(
        'One of those posts has already been submitted. Each post can only be submitted once.'
      );
    }
    throw error;
  }

  await recordAudit(ctx.env, {
    actorId: account.id,
    actorRole: 'creator',
    action: 'submission.create',
    entityType: 'submission',
    entityId: prepared[0].submissionId,
    after: {
      campaignId: campaign.id,
      submissions: prepared.map((clip) => ({
        submissionId: clip.submissionId,
        platform: clip.platform,
        claimedViews: clip.claimedViews,
        postIdentity: clip.identity,
      })),
    },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json(
    {
      ok: true,
      submissionId: prepared[0].submissionId,
      submissionIds: prepared.map((clip) => clip.submissionId),
    },
    201
  );
}

interface CampaignZeroInput {
  followConfirmed: boolean;
  clips: Array<{ url: string; claimedViews: number }>;
}

function validateCampaignZeroClips(clips: CampaignZeroInput['clips']) {
  const normalized: Array<{ url: string; identity: string; claimedViews: number }> = [];
  const seen = new Set<string>();

  for (const clip of clips) {
    const url = String(clip.url ?? '').trim();
    if (!url) continue;
    let parsed: ReturnType<typeof parseSocialUrl>;
    try {
      parsed = parseSocialUrl(url);
    } catch (error) {
      urlError(error);
    }
    if (seen.has(parsed.identity)) {
      throw badRequest('Each Campaign Zero clip must be a different post.');
    }
    seen.add(parsed.identity);
    normalized.push({
      url: parsed.canonicalUrl,
      identity: parsed.identity,
      claimedViews: Math.max(0, Math.floor(Number(clip.claimedViews) || 0)),
    });
  }

  return normalized;
}

export async function handleSaveCampaignZero(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const account = requireCreator(ctx);
  if (account.status !== 'applied') {
    throw badRequest('This application has already been reviewed.');
  }

  const input = await body<CampaignZeroInput>(ctx, {
    followConfirmed: { type: 'boolean', required: true },
    clips: {
      type: 'array',
      required: true,
      max: 3,
      items: { type: 'object' },
    },
  });

  const profile = await ctx.env.DB.prepare(
    `SELECT campaign_zero_submitted_at FROM creator_profiles WHERE account_id = ?`
  )
    .bind(account.id)
    .first<Row>();
  if (!profile) throw notFound('Creator profile not found.');
  if (profile.campaign_zero_submitted_at) {
    throw badRequest('Your Campaign Zero proof is already under review.');
  }

  const clips = validateCampaignZeroClips(input.clips);
  const now = Date.now();

  const statements = [
    ctx.env.DB.prepare(
      `UPDATE creator_profiles
          SET campaign_zero_follow_confirmed = ?, updated_at = ?
        WHERE account_id = ?`
    ).bind(input.followConfirmed ? 1 : 0, now, account.id),
    ctx.env.DB.prepare(`DELETE FROM creator_campaign_zero_clips WHERE account_id = ?`).bind(account.id),
  ];

  clips.forEach((clip, index) => {
    statements.push(
      ctx.env.DB.prepare(
        `INSERT INTO creator_campaign_zero_clips
           (id, account_id, position, url, url_normalized, claimed_views, added_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(newId('cz'), account.id, index, clip.url, clip.identity, clip.claimedViews, now)
    );
  });

  try {
    await ctx.env.DB.batch(statements);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('UNIQUE')) {
      throw conflict('One of these posts is already attached to another account.');
    }
    throw error;
  }

  return json({ ok: true });
}

export async function handleSubmitCampaignZero(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const account = requireCreator(ctx);
  if (account.status !== 'applied') {
    throw badRequest('This application has already been reviewed.');
  }

  const profile = await ctx.env.DB.prepare(
    `SELECT campaign_zero_follow_confirmed, campaign_zero_submitted_at
       FROM creator_profiles WHERE account_id = ?`
  )
    .bind(account.id)
    .first<Row>();
  if (!profile) throw notFound('Creator profile not found.');
  if (profile.campaign_zero_submitted_at) return json({ ok: true, alreadySubmitted: true });
  if (Number(profile.campaign_zero_follow_confirmed) !== 1) {
    throw badRequest('Confirm that you follow a Mhomho social page.');
  }

  const clips = await ctx.env.DB.prepare(
    `SELECT claimed_views FROM creator_campaign_zero_clips WHERE account_id = ? ORDER BY position`
  )
    .bind(account.id)
    .all<Row>();
  const rows = clips.results ?? [];

  if (rows.length < 3) {
    throw badRequest('Add three clip links before submitting for review.');
  }
  if (!rows.some((row) => Number(row.claimed_views) >= 1000)) {
    throw badRequest('One clip needs at least 1,000 views before you can submit.');
  }

  const now = Date.now();
  await ctx.env.DB.prepare(
    `UPDATE creator_profiles SET campaign_zero_submitted_at = ?, updated_at = ? WHERE account_id = ?`
  )
    .bind(now, now, account.id)
    .run();

  await recordAudit(ctx.env, {
    actorId: account.id,
    actorRole: 'creator',
    action: 'campaign_zero.submit',
    entityType: 'account',
    entityId: account.id,
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json({ ok: true });
}

export async function handleUpdateProfile(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const account = requireCreator(ctx);

  const input = await body<{
    whatsappNumber: string;
    ecoCashNumber: string;
    displayName?: string;
    niche?: string;
    followers?: number;
    platform?: (typeof PLATFORMS)[number];
    avatarKey?: AvatarKey;
  }>(ctx, {
    whatsappNumber: { type: 'string', required: true, min: 6, max: 32 },
    ecoCashNumber: { type: 'string', required: true, min: 6, max: 32 },
    displayName: { type: 'string', min: 2, max: 120 },
    niche: { type: 'string', min: 2, max: 80 },
    followers: { type: 'int', min: 0, max: 100_000_000 },
    platform: { type: 'string', values: PLATFORMS },
    avatarKey: { type: 'string', values: AVATAR_KEYS },
  });

  requirePhone(input.whatsappNumber, 'WhatsApp number');
  requirePhone(input.ecoCashNumber, 'EcoCash number');

  const current = await ctx.env.DB.prepare(
    `SELECT display_name, niche, followers, platform, avatar_key
       FROM creator_profiles WHERE account_id = ?`
  )
    .bind(account.id)
    .first<Row>();
  if (!current) throw notFound('Creator profile not found.');

  const displayName = (input.displayName ?? String(current.display_name)).trim();
  const niche = (input.niche ?? String(current.niche)).trim();
  const followers = input.followers ?? Number(current.followers);
  const platform = input.platform ?? String(current.platform);
  const avatarKey = input.avatarKey ?? normalizeAvatarKey(current.avatar_key);

  if (!displayName) throw badRequest('Enter your name.');

  try {
    await ctx.env.DB.prepare(
      `UPDATE creator_profiles
          SET display_name = ?, niche = ?, followers = ?, platform = ?, avatar_key = ?,
              whatsapp_number = ?, ecocash_number = ?, updated_at = ?
        WHERE account_id = ?`
    )
      .bind(
        displayName,
        niche,
        followers,
        platform,
        avatarKey,
        input.whatsappNumber.trim(),
        input.ecoCashNumber.trim(),
        Date.now(),
        account.id
      )
      .run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('UNIQUE')) {
      throw conflict('That handle is already used on this platform.');
    }
    throw error;
  }

  await recordAudit(ctx.env, {
    actorId: account.id,
    actorRole: 'creator',
    action: 'profile.update',
    entityType: 'creator_profile',
    entityId: account.id,
    after: { displayName, niche, followers, platform, avatarKey },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json({ ok: true });
}

/* ------------------------------------------------------------------ */
/* Withdrawals                                                         */
/* ------------------------------------------------------------------ */

export async function handleRequestPayout(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const account = requireApprovedCreator(ctx);

  const input = await body<{ amountCents: number; ecoCashNumber: string }>(ctx, {
    amountCents: { type: 'int', required: true, min: 1, max: 5_000_000 },
    ecoCashNumber: { type: 'string', required: true, min: 6, max: 32 },
  });

  requirePhone(input.ecoCashNumber, 'EcoCash number');

  if (input.amountCents < DEFAULT_MONEY_CONFIG.minPayoutCents) {
    throw badRequest(
      `The minimum withdrawal is $${(DEFAULT_MONEY_CONFIG.minPayoutCents / 100).toFixed(2)}.`
    );
  }

  const open = await ctx.env.DB.prepare(
    `SELECT id FROM payouts
      WHERE creator_id = ? AND status IN ('requested','approved','processing')
      LIMIT 1`
  )
    .bind(account.id)
    .first();
  if (open) {
    throw conflict('You already have a withdrawal in progress. Wait for it to be settled.');
  }

  const balance = await ctx.env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN entry_type IN ('earning','adjustment','reversal') THEN amount_cents ELSE 0 END), 0) AS earned,
            COALESCE(-SUM(CASE WHEN entry_type IN ('payout','payout_reversal') THEN amount_cents ELSE 0 END), 0) AS paid
       FROM earnings_ledger WHERE creator_id = ?`
  )
    .bind(account.id)
    .first<Row>();

  const earned = Number(balance?.earned ?? 0);
  const paid = Math.max(0, Number(balance?.paid ?? 0));
  const owed = Math.max(0, earned - paid);

  // Open withdrawals are reserved but not yet paid; they are excluded from the
  // spendable balance. The unique open-payout index is the real guard.
  const reservedRow = await ctx.env.DB.prepare(
    `SELECT COALESCE(SUM(amount_cents), 0) AS reserved FROM payouts
      WHERE creator_id = ? AND status IN ('requested','approved','processing')`
  )
    .bind(account.id)
    .first<Row>();
  const reserved = Math.max(0, Number(reservedRow?.reserved ?? 0));
  const available = Math.max(0, owed - reserved);

  if (input.amountCents > available) {
    throw conflict(`That exceeds your available balance of $${(available / 100).toFixed(2)}.`);
  }

  const allocations = await planPayoutAllocations(ctx.env, account.id, input.amountCents);
  const destination = input.ecoCashNumber.trim();
  const digits = destination.replace(/\D/g, '');
  const now = Date.now();
  const payoutId = newId('pay');

  const statements = [
    ctx.env.DB.prepare(
      `INSERT INTO payouts
         (id, creator_id, amount_cents, currency, status, method, destination_masked,
          destination_hash, reference, failure_reason, requested_by, decided_by, requested_at,
          decided_at, paid_at, idempotency_key, created_at, updated_at)
       VALUES (?, ?, ?, 'USD', 'requested', 'ecocash', ?, ?, NULL, NULL, ?, NULL, ?, NULL, NULL, ?, ?, ?)`
    ).bind(
      payoutId,
      account.id,
      input.amountCents,
      maskDestination(destination),
      await sha256Hex(digits),
      account.id,
      now,
      `withdrawal:${payoutId}`,
      now,
      now
    ),
    ctx.env.DB.prepare(
      `UPDATE creator_profiles SET ecocash_number = ?, updated_at = ? WHERE account_id = ?`
    ).bind(destination, now, account.id),
  ];

  for (const allocation of allocations) {
    statements.push(
      ctx.env.DB.prepare(
        `INSERT INTO payout_allocations (payout_id, campaign_id, amount_cents) VALUES (?, ?, ?)`
      ).bind(payoutId, allocation.campaignId, allocation.amountCents)
    );
  }

  try {
    await ctx.env.DB.batch(statements);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('uniq_open_payout')) {
      throw conflict('You already have a withdrawal in progress. Wait for it to be settled.');
    }
    if (message.includes('allocation_exceeds_campaign_earnings')) {
      throw conflict('Your earnings changed. Refresh and try again.');
    }
    throw error;
  }

  await recordAudit(ctx.env, {
    actorId: account.id,
    actorRole: 'creator',
    action: 'payout.request',
    entityType: 'payout',
    entityId: payoutId,
    after: {
      amountCents: input.amountCents,
      destination: maskDestination(destination),
      allocations,
    },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json(
    {
      ok: true,
      payoutId,
      status: 'requested',
      amountCents: input.amountCents,
      estimatedPaymentHours: DEFAULT_MONEY_CONFIG.payoutDelayHours,
    },
    201
  );
}

/* ------------------------------------------------------------------ */
/* Account deletion                                                    */
/* ------------------------------------------------------------------ */

export async function handleDeleteAccount(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const account = requireCreator(ctx);

  const limit = await consumeRateLimit(ctx.env, `account-delete:${account.id}`, 5, 15 * 60);
  if (!limit.allowed) {
    throw tooMany('Too many deletion attempts. Try again shortly.', limit.retryAfterSeconds);
  }

  const input = await body<{ password: string; confirm: string }>(ctx, {
    password: { type: 'string', required: true, min: 1, max: 200 },
    confirm: { type: 'string', required: true, min: 4, max: 12 },
  });

  if (input.confirm.trim().toUpperCase() !== 'DELETE') {
    throw badRequest('Type DELETE to confirm account deletion.');
  }

  const credential = await ctx.env.DB.prepare(
    `SELECT password_hash, password_salt, password_iterations FROM accounts WHERE id = ?`
  )
    .bind(account.id)
    .first<Row>();

  const valid = await verifyPassword(input.password, {
    hash: credential ? String(credential.password_hash ?? '') : null,
    salt: credential ? String(credential.password_salt ?? '') : null,
    iterations: credential?.password_iterations ? Number(credential.password_iterations) : null,
  });
  if (!valid) throw forbidden('Password is incorrect.');

  const open = await ctx.env.DB.prepare(
    `SELECT id FROM payouts
      WHERE creator_id = ? AND status IN ('requested','approved','processing')
      LIMIT 1`
  )
    .bind(account.id)
    .first();
  if (open) {
    throw conflict('You have a withdrawal in progress. Wait for it to be settled before deleting.');
  }

  const balance = await ctx.env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN entry_type IN ('earning','adjustment','reversal') THEN amount_cents ELSE 0 END), 0) AS earned,
            COALESCE(-SUM(CASE WHEN entry_type IN ('payout','payout_reversal') THEN amount_cents ELSE 0 END), 0) AS paid
       FROM earnings_ledger WHERE creator_id = ?`
  )
    .bind(account.id)
    .first<Row>();

  const owed = Math.max(0, Number(balance?.earned ?? 0) - Math.max(0, Number(balance?.paid ?? 0)));
  const now = Date.now();
  const suffix = account.id.replace(/[^a-zA-Z0-9]/g, '').slice(-12) || 'account';
  const anonymizedEmail = `deleted+${suffix}@deleted.invalid`;
  const anonymizedHandle = `deleted_${suffix}`;

  const statements = [];

  // Earned money is never silently discarded: any remaining balance is written
  // off with an explicit ledger row that administrators can audit.
  if (owed > 0) {
    statements.push(
      ctx.env.DB.prepare(
        `INSERT INTO earnings_ledger
           (id, creator_id, campaign_id, submission_id, entry_type, amount_cents, currency,
            description, actor_id, idempotency_key, created_at)
         VALUES (?, ?, NULL, NULL, 'write_off', ?, 'USD', ?, ?, ?, ?)`
      ).bind(
        newId('led'),
        account.id,
        -owed,
        'Account deleted — remaining balance written off at creator request',
        account.id,
        `writeoff:${account.id}:${now}`,
        now
      )
    );
  }

  statements.push(
    ctx.env.DB.prepare(
      `UPDATE accounts
          SET email = ?, email_normalized = ?, password_hash = NULL, password_salt = NULL,
              status = 'suspended', deleted_at = ?, updated_at = ?
        WHERE id = ?`
    ).bind(anonymizedEmail, anonymizedEmail, now, now, account.id),
    ctx.env.DB.prepare(
      `UPDATE creator_profiles
          SET display_name = 'Deleted creator', handle = ?, handle_normalized = ?,
              whatsapp_number = '', ecocash_number = NULL, updated_at = ?
        WHERE account_id = ?`
    ).bind(anonymizedHandle, anonymizedHandle, now, account.id),
    ctx.env.DB.prepare(
      `UPDATE sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL`
    ).bind(now, account.id)
  );

  await ctx.env.DB.batch(statements);

  await recordAudit(ctx.env, {
    actorId: account.id,
    actorRole: 'creator',
    action: 'account.delete',
    entityType: 'account',
    entityId: account.id,
    before: { status: account.status },
    after: { status: 'suspended', writtenOffCents: owed },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json(
    { ok: true, writtenOffCents: owed },
    200,
    {
      'Set-Cookie': clearSessionCookie(
        cookieSecurity(ctx.env, ctx.request).secure,
        sessionCookieName(ctx.request)
      ),
    }
  );
}

function requirePhone(value: string, field: string): void {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    throw badRequest(`${field} must be a valid phone number.`);
  }
}
