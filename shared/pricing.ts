/**
 * MHOMHO — public campaign pricing model.
 *
 * One source of truth for the package table and the website calculator, so the
 * numbers a customer sees always match the money engine in `shared/money.ts`.
 *
 * The advertised price already includes Mhomho's share. There is no platform
 * fee on top of the customer's budget:
 *
 *   every $1.50 per 1,000 verified views
 *     = $1.00 creator reward pool
 *     + $0.50 Mhomho gross share
 *
 * Public surfaces must only show the aggregate the customer pays (budget, view
 * target, planned creator count). The creator/Mhomho split is internal.
 */

/** What the business pays per 1,000 verified views, in integer cents. */
export const BRAND_PRICE_PER_THOUSAND_CENTS = 150;

/** What creators collectively earn per 1,000 verified views, in integer cents. */
export const CREATOR_RATE_PER_THOUSAND_CENTS = 100;

/** Mhomho's gross share per 1,000 verified views, in integer cents. */
export const MHOMHO_SHARE_PER_THOUSAND_CENTS = 50;

/** Views one successful creator contribution is planned to deliver. */
export const CREATOR_VIEWS_PER_CONTRIBUTION = 1_000;

/**
 * Planning buffer: how many recruited creators are assumed not to complete.
 * Kept conservative until real participation data replaces it.
 */
export const RECRUITMENT_SHORTFALL_RATE = 0.2;

/** The public, customer-facing shape of a campaign budget. */
export interface CampaignPlan {
  /** Total the customer pays, in integer cents. */
  budgetCents: number;
  /** Advertised verified-view target, rounded down to whole thousands. */
  viewTarget: number;
  /** Planned creator recruits, rounded up to whole people. */
  creatorsToRecruit: number;
}

export interface CampaignEconomics {
  budgetCents: number;
  /** Reserved for verified creator rewards, in integer cents. */
  creatorPoolCents: number;
  /** Mhomho gross revenue before operating costs, in integer cents. */
  mhomhoGrossCents: number;
}

function normalizeCents(budgetCents: number): number {
  if (!Number.isFinite(budgetCents) || budgetCents <= 0) return 0;
  return Math.floor(budgetCents);
}

/**
 * Internal split of a budget. Mhomho's share is the remainder, so the ledger
 * always balances exactly to the cent.
 */
export function campaignEconomics(budgetCents: number): CampaignEconomics {
  const budget = normalizeCents(budgetCents);
  const creatorPoolCents =
    budget === 0
      ? 0
      : Math.floor(
          (budget * CREATOR_RATE_PER_THOUSAND_CENTS) / BRAND_PRICE_PER_THOUSAND_CENTS
        );

  return {
    budgetCents: budget,
    creatorPoolCents,
    mhomhoGrossCents: budget - creatorPoolCents,
  };
}

/** Raw views a budget can pay for, before public rounding. */
export function rawViewTarget(budgetCents: number): number {
  const budget = normalizeCents(budgetCents);
  return Math.floor((budget * 1_000) / BRAND_PRICE_PER_THOUSAND_CENTS);
}

/**
 * Advertised view target. Rounded down rather than up, so the site never
 * promises more views than the budget supports.
 */
export function calculateViewTarget(budgetCents: number): number {
  return Math.floor(rawViewTarget(budgetCents) / 1_000) * 1_000;
}

/**
 * Planned creator recruits. Each successful contribution covers 1,000 views;
 * the 20% non-completion assumption is added on top and rounded up.
 */
export function calculateRecruitTarget(viewTarget: number): number {
  if (!Number.isFinite(viewTarget) || viewTarget <= 0) return 0;
  const contributions = Math.ceil(viewTarget / CREATOR_VIEWS_PER_CONTRIBUTION);
  return Math.ceil(contributions / (1 - RECRUITMENT_SHORTFALL_RATE));
}

/** Everything the public calculator needs, and nothing it shouldn't show. */
export function planCampaign(budgetCents: number): CampaignPlan {
  const budget = normalizeCents(budgetCents);
  const viewTarget = calculateViewTarget(budget);
  return {
    budgetCents: budget,
    viewTarget,
    creatorsToRecruit: calculateRecruitTarget(viewTarget),
  };
}

export interface CampaignPackage {
  id: string;
  name: string;
  tagline: string;
  budgetCents: number;
  featured?: boolean;
}

/** Public package table. Derived figures are computed, never hand-typed. */
export const CAMPAIGN_PACKAGES: readonly CampaignPackage[] = [
  {
    id: 'launch',
    name: 'Launch',
    tagline: 'A first push into the feed.',
    budgetCents: 5_000,
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Find your first crowd.',
    budgetCents: 10_000,
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: 'The full campaign.',
    budgetCents: 15_000,
    featured: true,
  },
  {
    id: 'scale',
    name: 'Scale',
    tagline: 'Keep the timeline busy.',
    budgetCents: 30_000,
  },
  {
    id: 'dominate',
    name: 'Dominate',
    tagline: 'Own the conversation.',
    budgetCents: 50_000,
  },
  {
    id: 'elite',
    name: 'Elite',
    tagline: 'Every feed, all month.',
    budgetCents: 100_000,
  },
] as const;

/** `$1,000` — whole dollars only; package budgets are whole-dollar amounts. */
export function formatWholeDollars(cents: number): string {
  const value = Math.max(0, Math.floor(Number(cents) || 0));
  return `$${Math.floor(value / 100).toLocaleString('en-US')}`;
}

/** `100,000` — grouped whole views. */
export function formatViewTarget(views: number): string {
  const value = Math.max(0, Math.floor(Number(views) || 0));
  return value.toLocaleString('en-US');
}
