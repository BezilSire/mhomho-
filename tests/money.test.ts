/**
 * Pure unit tests for the money model, campaign state machine, URL allowlist
 * and upload sniffing. No database or HTTP involved.
 *
 * Worked check from the build guide for a $250 campaign (25,000 cents):
 * pool 16,666 cents, per-post cap 4,166 cents, guaranteed 166,666 views.
 */
import { describe, expect, it } from 'vitest';
import {
  calculateClipEarnings,
  calculateCreatorPool,
  calculateGuaranteedViews,
  calculatePerPostCap,
  DEFAULT_MONEY_CONFIG,
  dollarsToCents,
  formatCents,
  isJoiningClosed,
  percentToBasisPoints,
} from '../shared/money.ts';
import { canTransition, describeLifecycle } from '../worker/src/campaigns.ts';
import { parseSocialUrl, UrlValidationError } from '../worker/src/urls.ts';
import { sniffImage } from '../worker/src/routes/assets.ts';

describe('money maths', () => {
  it('derives the documented $250 campaign figures', () => {
    const budgetCents = 25_000;
    const pool = calculateCreatorPool(budgetCents);

    expect(pool).toBe(16_666);
    expect(calculatePerPostCap(pool)).toBe(4_166);
    expect(calculateGuaranteedViews(budgetCents)).toBe(166_666);
  });

  it('pays nothing below the 1,000 view threshold', () => {
    const result = calculateClipEarnings(999, 16_666, 0, 4_166);
    expect(result.qualifies).toBe(false);
    expect(result.earningsCents).toBe(0);
  });

  it('pays exactly $1.00 at 1,000 views', () => {
    expect(calculateClipEarnings(1000, 16_666, 0, 4_166).earningsCents).toBe(100);
  });

  it('matches the documented screen examples', () => {
    expect(calculateClipEarnings(8200, 16_666, 0, 4_166).earningsCents).toBe(820);
    expect(calculateClipEarnings(14_500, 16_666, 0, 4_166).earningsCents).toBe(1450);
    expect(formatCents(1450)).toBe('$14.50');
  });

  it('caps a viral post at the per-post cap', () => {
    const result = calculateClipEarnings(50_000, 16_666, 0, 4_166);
    expect(result.earningsCents).toBe(4_166);
    expect(result.hitCap).toBe(true);
    expect(result.grossCents).toBe(5_000);
  });

  it('never exceeds the absolute $500 per-post ceiling', () => {
    const result = calculateClipEarnings(1_000_000, 10_000_000, 0, 10_000_000);
    expect(result.earningsCents).toBe(DEFAULT_MONEY_CONFIG.absoluteCeilingCents);
    expect(result.hitCeiling).toBe(true);
  });

  it('commits only the remaining pool and reports the shortfall', () => {
    // Only 1,000 cents left of the pool, but the post earned 4,166.
    const result = calculateClipEarnings(50_000, 16_666, 15_666, 4_166);
    expect(result.earningsCents).toBe(1000);
    expect(result.shortfallCents).toBe(3166);
    expect(result.hitPoolLimit).toBe(true);
    // Eligible views are derived from what is actually payable.
    expect(result.eligibleViews).toBe(10_000);
  });

  it('closes joining at 80% of the pool', () => {
    expect(isJoiningClosed(13_330, 16_666)).toBe(false);
    expect(isJoiningClosed(13_333, 16_666)).toBe(true);
  });

  it('converts percentages to basis points without floats', () => {
    expect(percentToBasisPoints(0.25)).toBe(2500);
    expect(percentToBasisPoints(0.8)).toBe(8000);
  });

  it('parses whole-dollar input into integer cents', () => {
    expect(dollarsToCents('250')).toBe(25_000);
    expect(dollarsToCents('250.50')).toBe(25_050);
    expect(dollarsToCents('-1')).toBeNull();
    expect(dollarsToCents('abc')).toBeNull();
  });
});

describe('campaign state machine', () => {
  it('allows only the documented transitions', () => {
    expect(canTransition('draft', 'live')).toBe(true);
    expect(canTransition('live', 'paused')).toBe(true);
    expect(canTransition('paused', 'live')).toBe(true);
    expect(canTransition('live', 'closing')).toBe(true);
    expect(canTransition('closing', 'completed')).toBe(true);
    expect(canTransition('completed', 'live')).toBe(false);
    expect(canTransition('cancelled', 'draft')).toBe(false);
    expect(canTransition('draft', 'completed')).toBe(false);
  });

  it('reports joining/submission/view gates from timings', () => {
    const now = 1_000_000;
    const lifecycle = describeLifecycle(
      {
        status: 'live',
        starts_at: now - 1000,
        joining_cutoff_at: now + 1000,
        submission_cutoff_at: now + 2000,
        views_cutoff_at: now + 3000,
        ends_at: now + 4000,
      },
      { joiningClosedByBudget: false, now }
    );

    expect(lifecycle.acceptingJoins).toBe(true);
    expect(lifecycle.acceptingSubmissions).toBe(true);
    expect(lifecycle.accumulatingViews).toBe(true);

    const closedByBudget = describeLifecycle(
      {
        status: 'live',
        starts_at: now - 1000,
        joining_cutoff_at: now + 1000,
        submission_cutoff_at: now + 2000,
        views_cutoff_at: now + 3000,
        ends_at: now + 4000,
      },
      { joiningClosedByBudget: true, now }
    );
    expect(closedByBudget.acceptingJoins).toBe(false);
    expect(closedByBudget.acceptingSubmissions).toBe(true);
  });
});

describe('social URL allowlist', () => {
  it('accepts canonical posts on allowed platforms', () => {
    expect(parseSocialUrl('https://www.tiktok.com/@brand/video/7312345678901234567').platform).toBe(
      'TikTok'
    );
    expect(parseSocialUrl('https://www.instagram.com/reel/Cx1y2z3/').platform).toBe('Instagram');
    expect(parseSocialUrl('https://youtu.be/dQw4w9WgXcQ').platform).toBe('YouTube');
    expect(parseSocialUrl('https://www.facebook.com/reel/1234567890').platform).toBe('Facebook');
  });

  it('rejects insecure, credentialed and unknown hosts', () => {
    expect(() => parseSocialUrl('http://www.tiktok.com/@brand/video/7312345678901234567')).toThrow(
      UrlValidationError
    );
    expect(() =>
      parseSocialUrl('https://user:pass@www.tiktok.com/@brand/video/7312345678901234567')
    ).toThrow(UrlValidationError);
    expect(() => parseSocialUrl('https://tiktok.com.evil.example/video/123456789')).toThrow(
      UrlValidationError
    );
    expect(() => parseSocialUrl('https://127.0.0.1/video/123456789')).toThrow(UrlValidationError);
    expect(() => parseSocialUrl('javascript:alert(1)')).toThrow(UrlValidationError);
  });

  it('derives a stable identity while dropping tracking parameters', () => {
    const plain = parseSocialUrl('https://www.tiktok.com/@brand/video/7312345678901234567');
    const tracked = parseSocialUrl(
      'https://www.tiktok.com/@brand/video/7312345678901234567?utm_source=copy&is_from_webapp=1'
    );
    expect(tracked.identity).toBe(plain.identity);
    expect(tracked.canonicalUrl).not.toContain('utm_source');
  });
});

describe('upload magic-byte sniffing', () => {
  it('accepts PNG, JPEG and WebP signatures', () => {
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toEqual({
      contentType: 'image/png',
      extension: 'png',
    });
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toEqual({
      contentType: 'image/jpeg',
      extension: 'jpg',
    });
    expect(
      sniffImage(
        new Uint8Array([
          0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
        ])
      )
    ).toEqual({ contentType: 'image/webp', extension: 'webp' });
  });

  it('rejects HTML, SVG and truncated headers', () => {
    expect(sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(sniffImage(new TextEncoder().encode('<!doctype html><html></html>'))).toBeNull();
    expect(sniffImage(new Uint8Array([0x89, 0x50]))).toBeNull();
    expect(sniffImage(new Uint8Array([]))).toBeNull();
  });
});
