import type { Env } from './env.ts';
import type { CampaignStatus, CampaignTiming } from './campaigns.ts';
import { conflict, notFound } from './http.ts';

export interface CampaignRow extends CampaignTiming {
  id: string;
  slug: string;
  title: string;
  brand_name: string;
  niche: string;
  brief: string;
  currency: string;
  budget_cents: number;
  creator_pool_cents: number;
  brand_cpm_cents: number;
  creator_cpm_cents: number;
  per_post_cap_cents: number | null;
  per_post_cap_bp: number | null;
  qualifying_view_threshold: number;
  joining_close_bp: number;
  terms_version: number;
  created_at: number;
  updated_at: number;
}

export interface CountersRow {
  campaign_id: string;
  committed_cents: number;
  shortfall_cents: number;
  verified_views: number;
  eligible_views: number;
  joined_count: number;
  approved_submissions: number;
  paid_cents: number;
  updated_at: number;
}

type Row = Record<string, unknown>;

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullable(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toCampaign(row: Row): CampaignRow {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    brand_name: String(row.brand_name),
    niche: String(row.niche),
    brief: String(row.brief),
    status: row.status as CampaignStatus,
    currency: String(row.currency ?? 'USD'),
    budget_cents: num(row.budget_cents),
    creator_pool_cents: num(row.creator_pool_cents),
    brand_cpm_cents: num(row.brand_cpm_cents),
    creator_cpm_cents: num(row.creator_cpm_cents),
    per_post_cap_cents: nullable(row.per_post_cap_cents),
    per_post_cap_bp: nullable(row.per_post_cap_bp),
    qualifying_view_threshold: num(row.qualifying_view_threshold, 1000),
    joining_close_bp: num(row.joining_close_bp, 8000),
    starts_at: nullable(row.starts_at),
    joining_cutoff_at: nullable(row.joining_cutoff_at),
    submission_cutoff_at: nullable(row.submission_cutoff_at),
    views_cutoff_at: nullable(row.views_cutoff_at),
    ends_at: nullable(row.ends_at),
    terms_version: num(row.terms_version, 1),
    created_at: num(row.created_at),
    updated_at: num(row.updated_at),
  };
}

export function toCounters(row: Row | null): CountersRow {
  return {
    campaign_id: String(row?.campaign_id ?? ''),
    committed_cents: num(row?.committed_cents),
    shortfall_cents: num(row?.shortfall_cents),
    verified_views: num(row?.verified_views),
    eligible_views: num(row?.eligible_views),
    joined_count: num(row?.joined_count),
    approved_submissions: num(row?.approved_submissions),
    paid_cents: num(row?.paid_cents),
    updated_at: num(row?.updated_at),
  };
}

export async function getCampaign(
  env: Env,
  id: string
): Promise<{ campaign: CampaignRow; counters: CountersRow } | null> {
  const row = await env.DB.prepare(`SELECT * FROM campaigns WHERE id = ? OR slug = ?`)
    .bind(id, id)
    .first<Row>();
  if (!row) return null;
  const campaign = toCampaign(row);
  const counter = await env.DB.prepare(`SELECT * FROM campaign_counters WHERE campaign_id = ?`)
    .bind(campaign.id)
    .first<Row>();
  return { campaign, counters: toCounters(counter) };
}

export async function getCampaignByIdOrThrow(
  env: Env,
  id: string
): Promise<{ campaign: CampaignRow; counters: CountersRow }> {
  const found = await getCampaign(env, id);
  if (!found) throw notFound('Campaign not found.');
  return found;
}

export interface PayoutAllocation {
  campaignId: string;
  amountCents: number;
}

/**
 * Splits a payout across the campaigns that actually credited the creator, so
 * per-campaign reporting and the allocation trigger stay exact. Used by both
 * the administrator's manual payout and the creator's withdrawal request.
 */
export async function planPayoutAllocations(
  env: Env,
  creatorId: string,
  amountCents: number
): Promise<PayoutAllocation[]> {
  const perCampaign = await env.DB.prepare(
    `SELECT l.campaign_id AS campaign_id,
            COALESCE(SUM(l.amount_cents), 0) AS earned,
            COALESCE((
              SELECT SUM(pa.amount_cents)
                FROM payout_allocations pa
                JOIN payouts p ON p.id = pa.payout_id
               WHERE pa.campaign_id = l.campaign_id
                 AND p.creator_id = l.creator_id
                 AND p.status IN ('requested','approved','processing','paid')
            ), 0) AS allocated
       FROM earnings_ledger l
      WHERE l.creator_id = ?
        AND l.campaign_id IS NOT NULL
        AND l.entry_type IN ('earning','adjustment','reversal')
      GROUP BY l.campaign_id`
  )
    .bind(creatorId)
    .all<Row>();

  let remaining = amountCents;
  const allocations: PayoutAllocation[] = [];
  for (const row of perCampaign.results ?? []) {
    if (remaining <= 0) break;
    const available = Math.max(0, num(row.earned) - num(row.allocated));
    if (available <= 0) continue;
    const amount = Math.min(available, remaining);
    allocations.push({ campaignId: String(row.campaign_id), amountCents: amount });
    remaining -= amount;
  }
  if (remaining > 0) {
    throw conflict('Payout allocation does not match recorded campaign earnings.');
  }
  return allocations;
}
