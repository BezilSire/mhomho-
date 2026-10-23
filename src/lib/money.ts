/**
 * Mhomho Media - Money & View Maths
 * Section 9 of Build Guide: Store everything as whole cents and whole views.
 * Keep every rule in config/money constants, so price changes never require code changes.
 */

export interface MoneyConfig {
  brandPricePerThousandCents: number; // Internal brand rate per 1,000 verified views; never shown to users
  creatorRatePerThousandCents: number; // 100 cents ($1.00) per 1,000 verified views
  qualifyingViewThreshold: number; // 1,000 views minimum per post
  perPostCapPercent: number; // 25% (0.25) of creator pool
  joiningClosePercent: number; // 80% (0.80) of pool used
  absoluteCeilingCents: number; // 50,000 cents ($500.00) per post max without admin approval
  minPayoutCents: number; // 500 cents ($5.00) minimum balance for EcoCash payout
  payoutDelayHours: number; // 72 hours after campaign closes
  requiredDaysLive: number; // 30 days live or clawback
}

export const DEFAULT_MONEY_CONFIG: MoneyConfig = {
  brandPricePerThousandCents: 150,
  creatorRatePerThousandCents: 100,
  qualifyingViewThreshold: 1000,
  perPostCapPercent: 0.25,
  joiningClosePercent: 0.80,
  absoluteCeilingCents: 50000,
  minPayoutCents: 500,
  payoutDelayHours: 72,
  requiredDaysLive: 30,
};

/**
 * Creator pool: floor(budget × creator rate ÷ brand price)
 * For $250 (25,000 cents) -> floor(25000 * 100 / 150) = 16,666 cents ($166.66)
 */
export function calculateCreatorPool(
  budgetCents: number,
  config: MoneyConfig = DEFAULT_MONEY_CONFIG
): number {
  if (budgetCents <= 0) return 0;
  return Math.floor((budgetCents * config.creatorRatePerThousandCents) / config.brandPricePerThousandCents);
}

/**
 * Per-post cap: 25% of the creator pool.
 * For 16,666 cents pool -> floor(16666 * 0.25) = 4,166 cents ($41.66)
 */
export function calculatePerPostCap(
  creatorPoolCents: number,
  config: MoneyConfig = DEFAULT_MONEY_CONFIG
): number {
  if (creatorPoolCents <= 0) return 0;
  return Math.floor(creatorPoolCents * config.perPostCapPercent);
}

/**
 * Guaranteed views: floor(budget ÷ brand price × 1,000)
 * For $250 (25,000 cents) -> floor(25000 / 150 * 1000) = 166,666 views
 */
export function calculateGuaranteedViews(
  budgetCents: number,
  config: MoneyConfig = DEFAULT_MONEY_CONFIG
): number {
  if (budgetCents <= 0) return 0;
  return Math.floor((budgetCents / config.brandPricePerThousandCents) * 1000);
}

/**
 * Joining closes at 80% of the pool used
 */
export function isJoiningClosed(
  poolUsedCents: number,
  poolTotalCents: number,
  config: MoneyConfig = DEFAULT_MONEY_CONFIG
): boolean {
  if (poolTotalCents <= 0) return true;
  return poolUsedCents >= Math.floor(poolTotalCents * config.joiningClosePercent);
}

export interface ClipEarningsResult {
  earningsCents: number;
  qualifies: boolean;
  hitCap: boolean;
  hitCeiling: boolean;
  hitPoolLimit: boolean;
  grossCents: number;
}

/**
 * Clip earnings: 0 if views are under 1,000.
 * Otherwise floor(verified views × creator rate ÷ 1,000),
 * limited by the per-post cap, the ceiling and what's left in the pool.
 */
export function calculateClipEarnings(
  verifiedViews: number,
  poolTotalCents: number,
  poolUsedCents: number,
  customPerPostCapCents?: number,
  config: MoneyConfig = DEFAULT_MONEY_CONFIG
): ClipEarningsResult {
  if (verifiedViews < config.qualifyingViewThreshold) {
    return {
      earningsCents: 0,
      qualifies: false,
      hitCap: false,
      hitCeiling: false,
      hitPoolLimit: false,
      grossCents: 0,
    };
  }

  // Gross earnings before caps
  const grossCents = Math.floor(
    (verifiedViews * config.creatorRatePerThousandCents) / 1000
  );

  const postCap = customPerPostCapCents ?? calculatePerPostCap(poolTotalCents, config);
  const poolRemaining = Math.max(0, poolTotalCents - poolUsedCents);

  let earnings = grossCents;
  let hitCap = false;
  let hitCeiling = false;
  let hitPoolLimit = false;

  if (earnings > postCap) {
    earnings = postCap;
    hitCap = true;
  }

  if (earnings > config.absoluteCeilingCents) {
    earnings = config.absoluteCeilingCents;
    hitCeiling = true;
  }

  if (earnings > poolRemaining) {
    earnings = poolRemaining;
    hitPoolLimit = true;
  }

  return {
    earningsCents: Math.max(0, earnings),
    qualifies: true,
    hitCap,
    hitCeiling,
    hitPoolLimit,
    grossCents,
  };
}

/**
 * Format integer cents to currency string, e.g. 4250 -> "$42.50"
 */
export function formatCents(cents: number, includeCentsIfZero = true): string {
  const isNegative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;

  if (!includeCentsIfZero && remainder === 0) {
    return `${isNegative ? '-' : ''}$${dollars.toLocaleString('en-US')}`;
  }

  return `${isNegative ? '-' : ''}$${dollars.toLocaleString('en-US')}.${remainder.toString().padStart(2, '0')}`;
}

/**
 * Format view numbers with commas e.g. 112400 -> "112,400"
 */
export function formatViews(views: number): string {
  return Math.max(0, Math.floor(views)).toLocaleString('en-US');
}

/**
 * Format percentage
 */
export function formatPercent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((numerator / denominator) * 100)));
}
