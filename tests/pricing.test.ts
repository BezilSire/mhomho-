/**
 * Public pricing model: the package table and calculator must always match the
 * business model the campaign ledger uses.
 */
import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_PACKAGES,
  calculateRecruitTarget,
  calculateViewTarget,
  campaignEconomics,
  formatDuration,
  planCampaign,
  rawViewTarget,
} from '../shared/pricing.ts';

describe('campaign pricing model', () => {
  it('splits every budget into a two-thirds creator pool and a one-third gross share', () => {
    const economics = campaignEconomics(15_000);
    expect(economics.creatorPoolCents).toBe(10_000);
    expect(economics.mhomhoGrossCents).toBe(5_000);
    expect(economics.creatorPoolCents + economics.mhomhoGrossCents).toBe(economics.budgetCents);
  });

  it('rounds advertised view targets down to whole thousands', () => {
    expect(rawViewTarget(5_000)).toBe(33_333);
    expect(calculateViewTarget(5_000)).toBe(33_000);
    expect(calculateViewTarget(15_000)).toBe(100_000);
  });

  it('adds the 20% recruitment buffer and rounds up', () => {
    expect(calculateRecruitTarget(33_000)).toBe(42);
    expect(calculateRecruitTarget(100_000)).toBe(125);
    expect(calculateRecruitTarget(666_000)).toBe(833);
  });

  it('matches the published package table exactly', () => {
    const rows = CAMPAIGN_PACKAGES.map((pkg) => {
      const plan = planCampaign(pkg.budgetCents);
      return [pkg.name, plan.budgetCents / 100, plan.viewTarget, plan.creatorsToRecruit];
    });

    expect(rows).toEqual([
      ['Village', 150, 100_000, 125],
      ['Town', 250, 166_000, 208],
      ['City', 500, 333_000, 417],
      ['Nation', 1000, 666_000, 833],
    ]);
  });

  it('publishes the agreed campaign durations', () => {
    expect(CAMPAIGN_PACKAGES.map((pkg) => [pkg.name, pkg.durationDays])).toEqual([
      ['Village', 14],
      ['Town', 30],
      ['City', 45],
      ['Nation', 60],
    ]);
    expect(formatDuration(14)).toBe('2 weeks');
    expect(formatDuration(45)).toBe('45 days');
  });

  it('never promises views it cannot pay for', () => {
    for (const pkg of CAMPAIGN_PACKAGES) {
      const plan = planCampaign(pkg.budgetCents);
      expect(plan.viewTarget * 150).toBeLessThanOrEqual(plan.budgetCents * 1_000);
    }
  });
});
