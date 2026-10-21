/**
 * Mhomho Media - Money Maths Tests
 * Verifies the worked examples in Section 9 of the Build Guide:
 * "Worked check for a $250 campaign (25,000 cents):
 * pool 16,666 cents, per-post cap 4,166 cents, guaranteed 166,666 views.
 * Round down everywhere and write a test for these numbers."
 */

import {
  calculateCreatorPool,
  calculatePerPostCap,
  calculateGuaranteedViews,
  calculateClipEarnings,
  isJoiningClosed,
  formatCents,
  DEFAULT_MONEY_CONFIG,
} from '../src/lib/money.ts';

export function runMoneyTests(): { name: string; passed: boolean; error?: string }[] {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  function assertEqual(actual: unknown, expected: unknown, testName: string) {
    if (actual === expected) {
      results.push({ name: testName, passed: true });
    } else {
      results.push({
        name: testName,
        passed: false,
        error: `Expected ${expected}, but got ${actual}`,
      });
    }
  }

  // 1. Worked check for $250 campaign (25,000 cents)
  const budgetCents = 25000;
  const pool = calculateCreatorPool(budgetCents);
  assertEqual(pool, 16666, 'Worked Check: $250 budget produces 16,666 cents pool');

  const cap = calculatePerPostCap(pool);
  assertEqual(cap, 4166, 'Worked Check: 16,666 cents pool produces 4,166 cents per-post cap');

  const guaranteed = calculateGuaranteedViews(budgetCents);
  assertEqual(guaranteed, 166666, 'Worked Check: $250 budget produces 166,666 guaranteed views');

  // 2. Qualifying threshold: Under 1,000 views earns 0
  const underThreshold = calculateClipEarnings(999, pool, 0, cap);
  assertEqual(underThreshold.earningsCents, 0, 'Threshold: 999 views earns 0 cents');
  assertEqual(underThreshold.qualifies, false, 'Threshold: 999 views does not qualify');

  // 3. Exactly 1,000 views -> floor(1000 * 100 / 1000) = 100 cents ($1.00)
  const exactThreshold = calculateClipEarnings(1000, pool, 0, cap);
  assertEqual(exactThreshold.earningsCents, 100, 'Threshold: 1,000 views earns exactly 100 cents ($1.00)');

  // 4. Glow Skincare example from HTML screens: 8,200 verified views -> 820 cents ($8.20)
  const glowExample = calculateClipEarnings(8200, pool, 0, cap);
  assertEqual(glowExample.earningsCents, 820, 'Screen Check: 8,200 views earns 820 cents ($8.20)');
  assertEqual(formatCents(glowExample.earningsCents), '$8.20', 'Screen Check: 820 cents formats as $8.20');

  // 5. Fit Week example from HTML screens: 14,500 verified views -> 1450 cents ($14.50)
  const fitExample = calculateClipEarnings(14500, pool, 0, cap);
  assertEqual(fitExample.earningsCents, 1450, 'Screen Check: 14,500 views earns 1,450 cents ($14.50)');
  assertEqual(formatCents(fitExample.earningsCents), '$14.50', 'Screen Check: 1450 cents formats as $14.50');

  // 6. Viral post hitting per-post cap (4,166 cents)
  // 50,000 views would be 5,000 cents, but cap is 4,166 cents
  const viralClip = calculateClipEarnings(50000, pool, 0, cap);
  assertEqual(viralClip.earningsCents, 4166, 'Cap: Clip hitting post cap is capped at 4,166 cents');
  assertEqual(viralClip.hitCap, true, 'Cap: Clip flagged as hitting cap');

  // 7. Joining closure at 80% pool used
  // 80% of 16,666 = 13,332 cents
  const notClosed = isJoiningClosed(13330, pool);
  assertEqual(notClosed, false, 'Joining: 13,330 cents used out of 16,666 is NOT closed');
  const isClosed = isJoiningClosed(13333, pool);
  assertEqual(isClosed, true, 'Joining: 13,333 cents used out of 16,666 IS closed (>=80%)');

  // 8. Absolute ceiling: 50,000 cents ($500) per post
  const ceilingClip = calculateClipEarnings(1000000, 10000000, 0, 10000000);
  assertEqual(
    ceilingClip.earningsCents,
    DEFAULT_MONEY_CONFIG.absoluteCeilingCents,
    'Ceiling: Capped at absolute 50,000 cents'
  );

  return results;
}
