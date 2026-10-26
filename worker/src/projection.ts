import type { AccountRow, Env } from './env.ts';
import { DEFAULT_MONEY_CONFIG, formatCents } from '../../shared/money.ts';
import { countryFromPhone } from '../../shared/country.ts';
import { describeLifecycle, type CampaignStatus } from './campaigns.ts';

/**
 * Builds the read-only projection the SPA renders.
 *
 * The projection is role-scoped:
 *   - anonymous: published campaigns only, no people, no money history
 *   - creator:   own profile, own submissions, own ledger, joined campaigns
 *   - admin:     operational data needed for review and payouts
 *
 * The client never receives password material, session tokens, other creators'
 * private data, or unpublished campaigns.
 */

type Row = Record<string, unknown>;

const SUBMISSION_LIMIT = 400;
const LEDGER_LIMIT = 600;
const PAYOUT_LIMIT = 250;
const ENQUIRY_LIMIT = 200;

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseJsonArray(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function isoDay(timestamp: number | null): string | null {
  if (!timestamp) return null;
  return new Date(timestamp).toISOString().slice(0, 10);
}

function daysUntil(timestamp: number | null, now: number): number | null {
  if (!timestamp) return null;
  return Math.max(0, Math.ceil((timestamp - now) / 86_400_000));
}

const SUBMISSION_STATUS_MAP: Record<string, string> = {
  submitted: 'submitted',
  approved: 'approved',
  rejected: 'rejected',
  withdrawn: 'withdrawn',
};

export interface ViewerSummary {
  uid: string;
  role: AccountRow['role'];
  status: AccountRow['status'];
  handle: string | null;
  displayName: string | null;
  email: string;
  balances: { earnedCents: number; paidCents: number; owedCents: number; reservedCents: number };
}

export async function buildBootstrap(
  env: Env,
  account: AccountRow | null,
  options: { csrfToken: string | null; sessionExpiresAt: number | null }
) {
  const now = Date.now();
  const isAdmin = account?.role === 'admin' && account.status === 'approved';
  const isCreator = account?.role === 'creator';
  const creatorId = isCreator ? account!.id : null;

  const campaignWhere: string[] = [];
  const campaignBinds: unknown[] = [];
  if (!isAdmin) {
    if (creatorId) {
      campaignWhere.push(
        `(c.status IN ('live','scheduled','closing') OR c.id IN (SELECT campaign_id FROM campaign_members WHERE creator_id = ?))`
      );
      campaignBinds.push(creatorId);
    } else {
      campaignWhere.push(`c.status IN ('live','scheduled','closing')`);
    }
  }

  const campaignRows = await env.DB.prepare(
    `SELECT c.*,
            cc.committed_cents, cc.shortfall_cents, cc.verified_views, cc.eligible_views,
            cc.joined_count, cc.approved_submissions, cc.paid_cents, cc.updated_at AS counter_updated_at
       FROM campaigns c
       LEFT JOIN campaign_counters cc ON cc.campaign_id = c.id
      ${campaignWhere.length ? `WHERE ${campaignWhere.join(' AND ')}` : ''}
      ORDER BY CASE c.status
                 WHEN 'live' THEN 0 WHEN 'closing' THEN 1 WHEN 'scheduled' THEN 2
                 WHEN 'paused' THEN 3 WHEN 'draft' THEN 4 WHEN 'completed' THEN 5 ELSE 6 END,
               c.created_at DESC
      LIMIT 200`
  )
    .bind(...campaignBinds)
    .all<Row>();

  const campaignIds = (campaignRows.results ?? []).map((row) => str(row.id));

  const posterRows = campaignIds.length
    ? await env.DB.prepare(
        `SELECT id, campaign_id FROM campaign_assets
          WHERE kind = 'poster' AND status = 'ready'
            AND campaign_id IN (${campaignIds.map(() => '?').join(',')})`
      )
        .bind(...campaignIds)
        .all<Row>()
    : { results: [] as Row[] };

  const posterByCampaign = new Map<string, string>();
  for (const row of posterRows.results ?? []) {
    posterByCampaign.set(str(row.campaign_id), `/api/assets/${str(row.id)}`);
  }

  const campaigns: Record<string, unknown> = {};
  const campaignFinance: Record<string, unknown> = {};
  const campaignStats: Record<string, unknown> = {};

  // Membership rows are needed by the creator portal only.
  const memberRows = creatorId
    ? await env.DB.prepare(
        `SELECT campaign_id, creator_id, joined_at, terms_version
           FROM campaign_members WHERE creator_id = ?`
      )
        .bind(creatorId)
        .all<Row>()
    : isAdmin
      ? await env.DB.prepare(
          `SELECT campaign_id, creator_id, joined_at, terms_version FROM campaign_members LIMIT 2000`
        ).all<Row>()
      : { results: [] as Row[] };

  const campaignMembers: Record<string, unknown> = {};
  for (const row of memberRows.results ?? []) {
    const campaignId = str(row.campaign_id);
    const uid = str(row.creator_id);
    campaignMembers[`${campaignId}_${uid}`] = {
      id: `${campaignId}_${uid}`,
      campaignId,
      creatorUid: uid,
      joinedAt: new Date(num(row.joined_at)).toISOString().slice(0, 10),
      joinedAtMs: num(row.joined_at),
    };
  }

  for (const row of campaignRows.results ?? []) {
    const id = str(row.id);
    const budgetCents = num(row.budget_cents);
    const poolTotal = num(row.creator_pool_cents);
    const committed = num(row.committed_cents);
    const status = str(row.status) as CampaignStatus;
    const lifecycle = describeLifecycle(
      {
        status,
        starts_at: row.starts_at === null ? null : num(row.starts_at),
        joining_cutoff_at: row.joining_cutoff_at === null ? null : num(row.joining_cutoff_at),
        submission_cutoff_at:
          row.submission_cutoff_at === null ? null : num(row.submission_cutoff_at),
        views_cutoff_at: row.views_cutoff_at === null ? null : num(row.views_cutoff_at),
        ends_at: row.ends_at === null ? null : num(row.ends_at),
      },
      {
        joiningClosedByBudget:
          poolTotal > 0 && committed >= Math.floor((poolTotal * num(row.joining_close_bp, 8000)) / 10000),
        now,
      }
    );

    const deadline =
      row.submission_cutoff_at !== null
        ? num(row.submission_cutoff_at)
        : row.ends_at !== null
          ? num(row.ends_at)
          : null;

    campaigns[id] = {
      id,
      slug: str(row.slug),
      title: str(row.title),
      brandName: str(row.brand_name),
      niche: str(row.niche),
      brief: str(row.brief),
      requiredContent: row.required_content ? str(row.required_content) : null,
      eligibility: row.eligibility ? str(row.eligibility) : null,
      hookIdeas: parseJsonArray(row.hook_ideas),
      doNots: parseJsonArray(row.do_nots),
      brandAssetUrl: row.brand_asset_url ? str(row.brand_asset_url) : null,
      posterUrl: posterByCampaign.get(id) ?? null,
      status,
      lifecycle,
      currency: str(row.currency, 'USD'),
      budgetCents,
      creatorPoolCents: poolTotal,
      brandCpmCents: num(row.brand_cpm_cents),
      creatorCpmCents: num(row.creator_cpm_cents),
      perPostCapCents: row.per_post_cap_cents === null ? null : num(row.per_post_cap_cents),
      qualifyingViewThreshold: num(row.qualifying_view_threshold, 1000),
      startsAt: row.starts_at === null ? null : num(row.starts_at),
      joiningCutoffAt: row.joining_cutoff_at === null ? null : num(row.joining_cutoff_at),
      submissionCutoffAt: row.submission_cutoff_at === null ? null : num(row.submission_cutoff_at),
      viewsCutoffAt: row.views_cutoff_at === null ? null : num(row.views_cutoff_at),
      endDate: isoDay(deadline),
      endsAt: row.ends_at === null ? null : num(row.ends_at),
      daysLeft: daysUntil(deadline, now) ?? 0,
      termsVersion: num(row.terms_version, 1),
      settledAt: row.settled_at === null ? null : num(row.settled_at),
    };

    campaignFinance[id] = {
      id,
      budgetCents,
      brandPricePerThousandCents: num(row.brand_cpm_cents),
      creatorRatePerThousandCents: num(row.creator_cpm_cents),
      perPostCapCents: row.per_post_cap_cents === null ? null : num(row.per_post_cap_cents),
      currency: str(row.currency, 'USD'),
    };

    campaignStats[id] = {
      id,
      budgetCents,
      poolTotalCents: poolTotal,
      poolUsedCents: committed,
      poolRemainingCents: Math.max(0, poolTotal - committed),
      paidCents: num(row.paid_cents),
      shortfallCents: num(row.shortfall_cents),
      joinedCount: num(row.joined_count),
      clipsLive: num(row.approved_submissions),
      verifiedViews: num(row.verified_views),
      eligibleViews: num(row.eligible_views),
      joiningOpen: lifecycle.acceptingJoins,
      acceptingSubmissions: lifecycle.acceptingSubmissions,
      acceptingViews: lifecycle.accumulatingViews,
      poolUsePercent: poolTotal > 0 ? Math.min(100, Math.round((committed / poolTotal) * 100)) : 100,
      updatedAt: row.counter_updated_at === null ? null : num(row.counter_updated_at),
    };
  }

  // Submissions
  const submissionWhere: string[] = [];
  const submissionBinds: unknown[] = [];
  if (creatorId) {
    submissionWhere.push('s.creator_id = ?');
    submissionBinds.push(creatorId);
  } else if (!isAdmin) {
    submissionWhere.push('1 = 0');
  }

  const submissionRows = await env.DB.prepare(
    `SELECT s.id, s.campaign_id, s.creator_id, s.platform, s.post_url, s.claimed_views,
            s.proof_asset_id, s.status, s.review_note, s.created_at, s.updated_at,
            p.handle, p.followers,
            o.observed_views, o.verified_views, o.eligible_views, o.shortfall_cents, o.observed_at,
            (SELECT COALESCE(SUM(l.amount_cents), 0)
               FROM earnings_ledger l
              WHERE l.submission_id = s.id AND l.entry_type IN ('earning', 'adjustment', 'reversal')) AS earned_cents
       FROM submissions s
       LEFT JOIN creator_profiles p ON p.account_id = s.creator_id
       LEFT JOIN view_observations o ON o.submission_id = s.id AND o.is_current = 1
      ${submissionWhere.length ? `WHERE ${submissionWhere.join(' AND ')}` : ''}
      ORDER BY s.created_at DESC
      LIMIT ${SUBMISSION_LIMIT}`
  )
    .bind(...submissionBinds)
    .all<Row>();

  const clips: Record<string, unknown> = {};
  for (const row of submissionRows.results ?? []) {
    const id = str(row.id);
    const status = str(row.status);
    const hasObservation = row.observed_views !== null && row.observed_views !== undefined;
    const followers = num(row.followers);
    const averageViews = Math.max(1, Math.round(followers * 0.25));
    const verifiedViews = num(row.verified_views);
    const displayStatus =
      status === 'approved' ? (hasObservation ? 'verified' : 'approved') : SUBMISSION_STATUS_MAP[status] ?? status;

    clips[id] = {
      id,
      campaignId: str(row.campaign_id),
      creatorUid: str(row.creator_id),
      creatorHandle: str(row.handle, '@creator'),
      platform: str(row.platform),
      link: str(row.post_url),
      screenshotUrl: row.proof_asset_id ? `/api/assets/${str(row.proof_asset_id)}` : '',
      proofAssetId: row.proof_asset_id ? str(row.proof_asset_id) : null,
      claimedViews: num(row.claimed_views),
      publicViews: hasObservation ? num(row.observed_views) : num(row.claimed_views),
      verifiedViews,
      eligibleViews: num(row.eligible_views),
      averageViews,
      status: displayStatus,
      flagged: num(row.claimed_views) >= averageViews * 5,
      spikeReason:
        num(row.claimed_views) >= averageViews * 5 && followers > 0
          ? `Claimed ${num(row.claimed_views).toLocaleString()} views vs creator average of ${averageViews.toLocaleString()}`
          : null,
      earningsCents: Math.max(0, num(row.earned_cents)),
      shortfallCents: num(row.shortfall_cents),
      reviewNote: row.review_note ? str(row.review_note) : null,
      createdAt: new Date(num(row.created_at)).toISOString().slice(0, 10),
      verifiedAt: hasObservation ? new Date(num(row.observed_at)).toISOString().slice(0, 10) : null,
      updatedAt: num(row.updated_at),
    };
  }

  // Ledger projection
  const ledgerWhere = creatorId ? 'WHERE creator_id = ?' : '';
  const ledgerRows = isAdmin || creatorId
    ? await env.DB.prepare(
        `SELECT id, creator_id, campaign_id, submission_id, entry_type, amount_cents, description, created_at
           FROM earnings_ledger ${ledgerWhere}
          ORDER BY created_at DESC, id DESC LIMIT ${LEDGER_LIMIT}`
      )
        .bind(...(creatorId ? [creatorId] : []))
        .all<Row>()
    : { results: [] as Row[] };

  const ledger: Record<string, unknown> = {};
  for (const row of ledgerRows.results ?? []) {
    const id = str(row.id);
    const entryType = str(row.entry_type);
    const amount = num(row.amount_cents);
    const isPaid = entryType === 'payout';
    const isReversal = entryType === 'payout_reversal';
    ledger[id] = {
      id,
      creatorUid: str(row.creator_id),
      clipId: row.submission_id ? str(row.submission_id) : undefined,
      campaignId: row.campaign_id ? str(row.campaign_id) : undefined,
      amountCents: isPaid ? Math.abs(amount) : amount,
      type: isPaid ? 'paid' : entryType === 'earning' ? 'earned' : 'adjustment',
      entryType,
      description: isReversal ? `${str(row.description)} (reversed)` : str(row.description),
      createdAt: new Date(num(row.created_at)).toISOString().slice(0, 10),
      createdAtMs: num(row.created_at),
    };
  }

  // Payouts
  const payoutWhere = creatorId ? 'WHERE p.creator_id = ?' : '';
  const payoutRows = isAdmin || creatorId
    ? await env.DB.prepare(
        `SELECT p.id, p.creator_id, p.amount_cents, p.status, p.method, p.destination_masked,
                p.reference, p.failure_reason, p.requested_at, p.decided_at, p.paid_at,
                pr.display_name, pr.handle
           FROM payouts p
           LEFT JOIN creator_profiles pr ON pr.account_id = p.creator_id
          ${payoutWhere}
          ORDER BY p.requested_at DESC LIMIT ${PAYOUT_LIMIT}`
      )
        .bind(...(creatorId ? [creatorId] : []))
        .all<Row>()
    : { results: [] as Row[] };

  const payouts: Record<string, unknown> = {};
  for (const row of payoutRows.results ?? []) {
    const id = str(row.id);
    payouts[id] = {
      id,
      creatorUid: str(row.creator_id),
      creatorName: str(row.display_name, str(row.handle, 'Creator')),
      ecoCashNumber: str(row.destination_masked),
      amountCents: num(row.amount_cents),
      status: str(row.status),
      method: str(row.method),
      paidDate: row.paid_at ? new Date(num(row.paid_at)).toISOString().slice(0, 10) : undefined,
      reference: row.reference ? str(row.reference) : undefined,
      failureReason: row.failure_reason ? str(row.failure_reason) : undefined,
      createdAt: new Date(num(row.requested_at)).toISOString().slice(0, 10),
    };
  }

  // People
  const creatorWhere: string[] = [];
  const creatorBinds: unknown[] = [];
  if (creatorId) {
    creatorWhere.push('a.id = ?');
    creatorBinds.push(creatorId);
  } else if (!isAdmin) {
    creatorWhere.push('1 = 0');
  }

  const creatorRows = await env.DB.prepare(
    `SELECT a.id, a.email, a.status AS account_status, a.role, a.created_at AS account_created_at,
            p.display_name, p.handle, p.platform, p.niche, p.followers, p.avatar_key,
            p.campaign_zero_follow_confirmed, p.campaign_zero_submitted_at, p.approved_at,
            p.whatsapp_number, p.ecocash_number
       FROM accounts a
       JOIN creator_profiles p ON p.account_id = a.id
      ${creatorWhere.length ? `WHERE ${creatorWhere.join(' AND ')}` : ''}
      ORDER BY a.created_at DESC
      LIMIT 2000`
  )
    .bind(...creatorBinds)
    .all<Row>();

  const creatorsPublic: Record<string, unknown> = {};
  const creatorsPrivate: Record<string, unknown> = {};
  for (const row of creatorRows.results ?? []) {
    const uid = str(row.id);
    creatorsPublic[uid] = {
      uid,
      handle: str(row.handle),
      platform: str(row.platform),
      niche: str(row.niche),
      followers: num(row.followers),
      avatarKey: str(row.avatar_key, 'sun'),
      status: str(row.account_status),
      createdAt: new Date(num(row.account_created_at)).toISOString().slice(0, 10),
      campaignZero: {
        followConfirmed: num(row.campaign_zero_follow_confirmed) === 1,
        clips: [] as unknown[],
        submittedAt: row.campaign_zero_submitted_at
          ? new Date(num(row.campaign_zero_submitted_at)).toISOString()
          : undefined,
        verifiedAt: row.approved_at ? new Date(num(row.approved_at)).toISOString() : undefined,
      },
    };
    const whatsappNumber = str(row.whatsapp_number);
    const country = countryFromPhone(whatsappNumber);
    creatorsPrivate[uid] = {
      uid,
      name: str(row.display_name),
      email: str(row.email),
      whatsappNumber,
      ecoCashNumber: str(row.ecocash_number),
      country: country.name,
      countryCode: country.code,
    };
  }

  // Campaign Zero clips (own for creators, all for admins)
  const zeroWhere = creatorId ? 'WHERE account_id = ?' : '';
  const zeroRows =
    creatorId || isAdmin
      ? await env.DB.prepare(
          `SELECT id, account_id, position, url, claimed_views, added_at
             FROM creator_campaign_zero_clips ${zeroWhere}
            ORDER BY account_id, position`
        )
          .bind(...(creatorId ? [creatorId] : []))
          .all<Row>()
      : { results: [] as Row[] };

  for (const row of zeroRows.results ?? []) {
    const uid = str(row.account_id);
    const creator = creatorsPublic[uid] as { campaignZero?: { clips: unknown[] } } | undefined;
    if (!creator?.campaignZero) continue;
    creator.campaignZero.clips.push({
      url: str(row.url),
      claimedViews: num(row.claimed_views),
      addedAt: new Date(num(row.added_at)).toISOString().slice(0, 10),
    });
  }

  // Enquiries (admin only)
  const enquiries: Record<string, unknown> = {};
  if (isAdmin) {
    const rows = await env.DB.prepare(
      `SELECT * FROM enquiries ORDER BY created_at DESC LIMIT ${ENQUIRY_LIMIT}`
    ).all<Row>();
    for (const row of rows.results ?? []) {
      enquiries[str(row.id)] = {
        id: str(row.id),
        bizName: str(row.biz_name),
        contactName: str(row.contact_name),
        phone: str(row.phone),
        niche: str(row.niche),
        promo: str(row.promo),
        goals: parseJsonArray(row.goals),
        budget: str(row.budget),
        start: str(row.start_window),
        bestTimes: parseJsonArray(row.best_times),
        notes: row.notes ? str(row.notes) : undefined,
        status: str(row.status),
        createdAt: new Date(num(row.created_at)).toISOString().slice(0, 10),
      };
    }
  }

  // Balances
  const balanceRow = account
    ? await env.DB.prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN entry_type IN ('earning','adjustment','reversal') THEN amount_cents ELSE 0 END), 0) AS earned,
           COALESCE(-SUM(CASE WHEN entry_type IN ('payout','payout_reversal') THEN amount_cents ELSE 0 END), 0) AS paid
         FROM earnings_ledger
        WHERE creator_id = ?`
      )
        .bind(account.id)
        .first<Row>()
    : null;

  const reservedRow = account
    ? await env.DB.prepare(
        `SELECT COALESCE(SUM(amount_cents), 0) AS reserved FROM payouts
          WHERE creator_id = ? AND status IN ('requested','approved','processing')`
      )
        .bind(account.id)
        .first<Row>()
    : null;

  const earnedCents = num(balanceRow?.earned);
  const paidCents = Math.max(0, num(balanceRow?.paid));
  // Money reserved by an open withdrawal is not spendable yet.
  const reservedCents = Math.max(0, num(reservedRow?.reserved));

  const profileRow = account
    ? await env.DB.prepare(`SELECT handle, display_name FROM creator_profiles WHERE account_id = ?`)
        .bind(account.id)
        .first<Row>()
    : null;

  const viewer: ViewerSummary | null = account
    ? {
        uid: account.id,
        role: account.role,
        status: account.status,
        handle: profileRow ? str(profileRow.handle) : null,
        displayName: profileRow ? str(profileRow.display_name) : null,
        email: account.email,
        balances: {
          earnedCents: Math.max(0, earnedCents),
          paidCents,
          owedCents: Math.max(0, earnedCents - paidCents - reservedCents),
          reservedCents,
        },
      }
    : null;

  return {
    generatedAt: now,
    currency: 'USD',
    moneyConfig: DEFAULT_MONEY_CONFIG,
    viewer,
    csrfToken: options.csrfToken,
    sessionExpiresAt: options.sessionExpiresAt,
    campaigns,
    campaignFinance,
    campaignStats,
    campaignMembers,
    clips,
    ledger,
    payouts,
    creatorsPublic,
    creatorsPrivate,
    brandViews: {},
    enquiries,
    totals: isAdmin
      ? {
          owedCents: Math.max(0, earnedCents - paidCents - reservedCents),
          earnedCents: Math.max(0, earnedCents),
          paidCents,
          formattedOwed: formatCents(Math.max(0, earnedCents - paidCents - reservedCents)),
        }
      : null,
  };
}
