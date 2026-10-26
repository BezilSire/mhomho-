/**
 * MHOMHO — shared money & campaign maths.
 *
 * This module is the single source of truth for every monetary rule. It is
 * imported by both the Cloudflare Worker (authoritative) and the React client
 * (display only). The client must never be trusted to produce a payable number;
 * the Worker recomputes every figure from the database.
 *
 * Conventions
 * -----------
 * - All money is integer **US cents** (`USD`). No floating point is ever used
 *   for a balance, commitment or payout.
 * - All rounding is **down** (`Math.floor`) in favour of the campaign budget.
 *   A creator can never be credited a fractional cent.
 * - Views are integer counts.
 *
 * Pricing model (current standard):
 *   business pays   150 cents per 1,000 verified views  ($1.50 CPM)
 *   creator earns   100 cents per 1,000 verified views  ($1.00 CPM)
 *   Mhomho retains   50 cents per 1,000 verified views  ($0.50 CPM)
 *
 * A $100.00 campaign therefore has a creator pool of $66.67 (integer cents:
 * 6666) and a view target of 66,667. These are targets, never guarantees.
 */

export const CURRENCY = 'USD' as const;
export type Currency = typeof CURRENCY;

/** Money config for a campaign. Every field is integer cents / views / percent. */
export interface MoneyConfig {
  /** What the business pays per 1,000 verified views. */
  brandPricePerThousandCents: number;
  /** What the creator earns per 1,000 verified views. */
  creatorRatePerThousandCents: number;
  /** Minimum verified views before a post can earn anything. */
  qualifyingViewThreshold: number;
  /** Default per-post cap as a fraction of the creator pool (0.25 = 25%). */
  perPostCapPercent: number;
  /** Joining closes once this fraction of the pool is committed (0.80 = 80%). */
  joiningClosePercent: number;
  /** Absolute per-post ceiling in cents, regardless of campaign cap. */
  absoluteCeilingCents: number;
  /** Minimum balance before a creator may request a payout. */
  minPayoutCents: number;
  /** Hours after campaign close before earnings become payable. */
  payoutDelayHours: number;
  /** Days a post must stay live, used by the manual review checklist. */
  requiredDaysLive: number;
  /** Basis-point denominator for percent fields. */
  percentScale: number;
}

export const DEFAULT_MONEY_CONFIG: MoneyConfig = {
  brandPricePerThousandCents: 150,
  creatorRatePerThousandCents: 100,
  qualifyingViewThreshold: 1000,
  perPostCapPercent: 0.25,
  joiningClosePercent: 0.8,
  absoluteCeilingCents: 50000,
  minPayoutCents: 500,
  payoutDelayHours: 72,
  requiredDaysLive: 30,
  percentScale: 10000,
};

/** creatorPool = floor(budget × creatorCPM ÷ brandCPM) */
export function calculateCreatorPool(
  budgetCents: number,
  config: MoneyConfig = DEFAULT_MONEY_CONFIG
): number {
  if (!Number.isFinite(budgetCents) || budgetCents <= 0) return 0;
  return Math.floor(
    (budgetCents * config.creatorRatePerThousandCents) / config.brandPricePerThousandCents
  );
}

/** Views the budget can pay for at the brand rate. */
export function calculateGuaranteedViews(
  budgetCents: number,
  config: MoneyConfig = DEFAULT_MONEY_CONFIG
): number {
  if (!Number.isFinite(budgetCents) || budgetCents <= 0) return 0;
  return Math.floor((budgetCents / config.brandPricePerThousandCents) * 1000);
}

/** Default per-post cap = floor(creatorPool × perPostCapPercent). */
export function calculatePerPostCap(
  creatorPoolCents: number,
  config: MoneyConfig = DEFAULT_MONEY_CONFIG
): number {
  if (!Number.isFinite(creatorPoolCents) || creatorPoolCents <= 0) return 0;
  return Math.floor(creatorPoolCents * config.perPostCapPercent);
}

/** True when new joins should stop. */
export function isJoiningClosed(
  committedCents: number,
  poolTotalCents: number,
  config: MoneyConfig = DEFAULT_MONEY_CONFIG
): boolean {
  if (!Number.isFinite(poolTotalCents) || poolTotalCents <= 0) return true;
  return committedCents >= Math.floor(poolTotalCents * config.joiningClosePercent);
}

export interface ClipEarningsResult {
  /** Payable amount after every cap and the remaining pool. */
  earningsCents: number;
  /** True when the post met the qualifying view threshold. */
  qualifies: boolean;
  hitCap: boolean;
  hitCeiling: boolean;
  hitPoolLimit: boolean;
  /** Uncapped amount implied by the views and creator CPM. */
  grossCents: number;
  /** Amount the creator would have earned but the budget cannot commit. */
  shortfallCents: number;
  /** Views that qualify for payment given all caps. */
  eligibleViews: number;
}

/**
 * Compute what a post can be paid.
 *
 * `poolUsedCents` is the authoritative committed amount *before* this post.
 * The function never returns more than `poolTotalCents - poolUsedCents`.
 */
export function calculateClipEarnings(
  verifiedViews: number,
  poolTotalCents: number,
  poolUsedCents: number,
  customPerPostCapCents?: number | null,
  config: MoneyConfig = DEFAULT_MONEY_CONFIG
): ClipEarningsResult {
  const views = Math.max(0, Math.floor(Number(verifiedViews) || 0));
  const empty: ClipEarningsResult = {
    earningsCents: 0,
    qualifies: false,
    hitCap: false,
    hitCeiling: false,
    hitPoolLimit: false,
    grossCents: 0,
    shortfallCents: 0,
    eligibleViews: 0,
  };

  if (views < config.qualifyingViewThreshold) return empty;

  const grossCents = Math.floor((views * config.creatorRatePerThousandCents) / 1000);
  const postCap =
    customPerPostCapCents === null || customPerPostCapCents === undefined
      ? calculatePerPostCap(poolTotalCents, config)
      : Math.max(0, Math.floor(customPerPostCapCents));
  const poolRemaining = Math.max(0, Math.floor(poolTotalCents) - Math.floor(poolUsedCents));

  let payable = grossCents;
  let hitCap = false;
  let hitCeiling = false;

  if (postCap > 0 && payable > postCap) {
    payable = postCap;
    hitCap = true;
  }
  if (payable > config.absoluteCeilingCents) {
    payable = config.absoluteCeilingCents;
    hitCeiling = true;
  }

  let hitPoolLimit = false;
  let shortfallCents = 0;
  if (payable > poolRemaining) {
    shortfallCents = payable - poolRemaining;
    payable = poolRemaining;
    hitPoolLimit = true;
  }

  // Views that are actually paid for after **every** limit, including a pool
  // that ran out. Computing this before the pool check would overstate payable
  // views and corrupt brand reporting.
  const eligibleViews = Math.min(
    views,
    Math.floor((payable * 1000) / config.creatorRatePerThousandCents)
  );

  return {
    earningsCents: Math.max(0, payable),
    qualifies: true,
    hitCap,
    hitCeiling,
    hitPoolLimit,
    grossCents,
    shortfallCents: Math.max(0, shortfallCents),
    eligibleViews: Math.max(0, Math.min(eligibleViews, views)),
  };
}

/**
 * Fraction as basis points: 0.25 (25%) → 2500. Used for D1 storage, where every
 * `*_bp` column holds ten-thousandths of the whole.
 */
export function percentToBasisPoints(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0;
  return Math.round(fraction * 10000);
}

/** Inverse of `percentToBasisPoints`: 2500 → 0.25 (25%). */
export function basisPointsToPercent(basisPoints: number): number {
  if (!Number.isFinite(basisPoints)) return 0;
  return basisPoints / 10000;
}

/** Format integer cents as `$1,234.56`. */
export function formatCents(cents: number, includeCentsIfZero = true): string {
  const value = Number.isFinite(cents) ? Math.trunc(cents) : 0;
  const isNegative = value < 0;
  const abs = Math.abs(value);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;

  if (!includeCentsIfZero && remainder === 0) {
    return `${isNegative ? '-' : ''}$${dollars.toLocaleString('en-US')}`;
  }

  return `${isNegative ? '-' : ''}$${dollars.toLocaleString('en-US')}.${remainder
    .toString()
    .padStart(2, '0')}`;
}

export function formatViews(views: number): string {
  const value = Number.isFinite(views) ? Math.floor(views) : 0;
  return Math.max(0, value).toLocaleString('en-US');
}

export function formatPercent(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((numerator / denominator) * 100)));
}

/** Parse a whole-dollar user input into cents, rejecting fractional input. */
export function dollarsToCents(input: string | number): number | null {
  const value = typeof input === 'number' ? input : Number(String(input).trim());
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}
