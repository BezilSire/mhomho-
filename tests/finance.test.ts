/**
 * Financial lifecycle: join → submit → verify → budget exhaustion → payout.
 *
 * These tests assert the database invariants directly (not just HTTP codes):
 * committed budget can never exceed the creator pool, creator balances can never
 * go negative, and the earnings ledger cannot be mutated.
 */
import { describe, expect, it } from 'vitest';
import {
  api,
  approvedCreator,
  campaignRow,
  counters,
  createCampaign,
  joinCampaign,
  ledgerSum,
  postUrl,
  recordPayout,
  setupAdmin,
  submitClip,
  testEnv,
  verifySubmission,
  type Session,
} from './helpers.ts';

async function liveCampaign(admin: Session, budgetCents = 25_000) {
  const campaign = await createCampaign(admin, { budgetCents });
  return campaign;
}

async function submissionId(response: Awaited<ReturnType<typeof submitClip>>): Promise<string> {
  if (response.status !== 201) {
    throw new Error(`Submit failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.submissionId;
}

describe('campaign creation', () => {
  it('derives every monetary field on the server', async () => {
    const admin = await setupAdmin();
    const { id } = await createCampaign(admin, { budgetCents: 25_000 });
    const campaign = await campaignRow(id);

    expect(campaign.budget_cents).toBe(25_000);
    expect(campaign.creator_pool_cents).toBe(16_666);
    expect(campaign.per_post_cap_cents).toBe(4_166);
    // 25% stored as basis points, not as 25 basis points.
    expect(campaign.per_post_cap_bp).toBe(2500);
    expect(campaign.joining_close_bp).toBe(8000);
    expect(campaign.currency).toBe('USD');
    expect(campaign.status).toBe('live');
    expect(campaign.qualifying_view_threshold).toBe(1000);
  });

  it('rejects client-supplied money fields and out-of-range budgets', async () => {
    const admin = await setupAdmin();
    const response = await api('/api/admin/campaigns', {
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: {
        title: 'Injected Money',
        brandName: 'Brand',
        niche: 'Beauty',
        brief: 'A brief long enough to pass validation for this test case.',
        budgetCents: 25_000,
        // These are not part of the schema and must be ignored.
        creatorPoolCents: 999_999_999,
        brandCpmCents: 1,
      },
    });
    expect(response.status).toBe(201);

    const campaign = await campaignRow(response.body.campaignId);
    expect(campaign.creator_pool_cents).toBe(16_666);
    expect(campaign.per_post_cap_cents).toBe(4_166);

    // An explicit per-post cap is now an admin field, but it is still bounded.
    const oversizedCap = await api('/api/admin/campaigns', {
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: {
        title: 'Oversized Cap',
        brandName: 'Brand',
        niche: 'Beauty',
        brief: 'A brief long enough to pass validation for this test case.',
        budgetCents: 25_000,
        perPostCapCents: 999_999_999,
      },
    });
    expect(oversizedCap.status).toBe(400);

    const tooSmall = await api('/api/admin/campaigns', {
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: {
        title: 'Too Small',
        brandName: 'Brand',
        niche: 'Beauty',
        brief: 'A brief long enough to pass validation for this test case.',
        budgetCents: 100,
      },
    });
    expect(tooSmall.status).toBe(400);
  });
});

describe('join and submit', () => {
  it('is idempotent on repeated joins and requires approval', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const { id } = await liveCampaign(admin);

    const first = await joinCampaign(creator, id);
    expect(first.status).toBe(200);
    expect(first.body.alreadyJoined).toBeUndefined();

    const second = await joinCampaign(creator, id);
    expect(second.status).toBe(200);
    expect(second.body.alreadyJoined).toBe(true);

    expect((await counters(id)).joined_count).toBe(1);
  });

  it('rejects a post URL that is not an allowlisted platform', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const { id } = await liveCampaign(admin);
    await joinCampaign(creator, id);

    const response = await submitClip(creator, id, { url: 'https://evil.example/post/123456' });
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('TikTok');

    const insecure = await submitClip(creator, id, {
      url: 'http://www.tiktok.com/@mhomho/video/7312345678901234567',
    });
    expect(insecure.status).toBe(400);
  });

  it('requires membership and prevents duplicate posts', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const { id } = await liveCampaign(admin);

    const notJoined = await submitClip(creator, id);
    expect(notJoined.status).toBe(403);

    await joinCampaign(creator, id);
    const url = postUrl('TikTok');
    const first = await submitClip(creator, id, { url });
    expect(first.status).toBe(201);

    const duplicate = await submitClip(creator, id, { url });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.message).toContain('already been submitted');
  });

  it('ignores claimed views when deciding money', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const { id } = await liveCampaign(admin);
    await joinCampaign(creator, id);

    const id1 = await submissionId(
      await submitClip(creator, id, { claimedViews: 10_000_000 })
    );
    // A claim alone must never create a ledger entry.
    expect(await ledgerSum(creator.accountId)).toBe(0);

    await verifySubmission(admin, id1, 1000);
    expect(await ledgerSum(creator.accountId)).toBe(100);
  });
});

describe('manual view verification', () => {
  it('rejects below-threshold posts without paying', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const { id } = await liveCampaign(admin);
    await joinCampaign(creator, id);
    const submission = await submissionId(await submitClip(creator, id));

    const response = await verifySubmission(admin, submission, 999);
    expect(response.status).toBe(200);
    expect(response.body.rejected).toBe(true);
    expect(response.body.earningsCents).toBe(0);
    expect(await ledgerSum(creator.accountId)).toBe(0);

    const again = await verifySubmission(admin, submission, 999);
    expect(again.status).toBe(409);
  });

  it('does not bill a brand for rejected views', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const { id } = await liveCampaign(admin);
    await joinCampaign(creator, id);

    const rejected = await submissionId(await submitClip(creator, id));
    await verifySubmission(admin, rejected, 999);

    const accepted = await submissionId(await submitClip(creator, id));
    await verifySubmission(admin, accepted, 2000);

    const state = await counters(id);
    expect(state.verified_views).toBe(2000);
    expect(state.eligible_views).toBe(2000);
    expect(state.approved_submissions).toBe(1);
  });

  it('lets only one of two simultaneous verifications pay a clip', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const { id } = await liveCampaign(admin);
    await joinCampaign(creator, id);
    const submission = await submissionId(await submitClip(creator, id));

    const [left, right] = await Promise.all([
      verifySubmission(admin, submission, 5000),
      verifySubmission(admin, submission, 5000),
    ]);

    const statuses = [left.status, right.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);
    expect(await ledgerSum(creator.accountId)).toBe(500);

    const observations = await testEnv.DB.prepare(
      `SELECT COUNT(*) AS count FROM view_observations WHERE submission_id = ?`
    )
      .bind(submission)
      .first<{ count: number }>();
    expect(Number(observations?.count)).toBe(1);
  });

  it('refuses verified views above observed views', async () => {    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const { id } = await liveCampaign(admin);
    await joinCampaign(creator, id);
    const submission = await submissionId(await submitClip(creator, id));

    const response = await api(`/api/admin/submissions/${submission}/verify`, {
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { observedViews: 1000, verifiedViews: 2000 },
    });
    expect(response.status).toBe(400);
  });

  it('pays the capped amount and updates counters atomically', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const { id } = await liveCampaign(admin);
    await joinCampaign(creator, id);
    const submission = await submissionId(await submitClip(creator, id));

    const response = await verifySubmission(admin, submission, 50_000);
    expect(response.status).toBe(200);
    expect(response.body.earningsCents).toBe(4_166);
    expect(response.body.eligibleViews).toBe(41_660);

    const state = await counters(id);
    expect(state.committed_cents).toBe(4_166);
    expect(state.verified_views).toBe(50_000);
    expect(state.eligible_views).toBe(41_660);
    expect(state.approved_submissions).toBe(1);
    expect(await ledgerSum(creator.accountId)).toBe(4_166);
  });

  it('records a shortfall instead of silently discarding earnings', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const { id } = await liveCampaign(admin);
    await joinCampaign(creator, id);

    // Four posts at the cap use 16,664 of the 16,666 cent pool.
    for (let index = 0; index < 4; index += 1) {
      const submission = await submissionId(await submitClip(creator, id));
      const response = await verifySubmission(admin, submission, 50_000);
      expect(response.status).toBe(200);
      expect(response.body.earningsCents).toBe(4_166);
    }

    const finalSubmission = await submissionId(await submitClip(creator, id));
    const finalVerify = await verifySubmission(admin, finalSubmission, 50_000);
    expect(finalVerify.status).toBe(200);
    expect(finalVerify.body.earningsCents).toBe(2);
    expect(finalVerify.body.shortfallCents).toBe(4_164);

    const state = await counters(id);
    expect(state.committed_cents).toBe(16_666);
    expect(state.shortfall_cents).toBe(4_164);
    // The campaign stays live so an administrator can top it up.
    expect((await campaignRow(id)).status).toBe('live');
  });

  it('keeps the budget cap under concurrent verifications', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const { id } = await liveCampaign(admin);
    await joinCampaign(creator, id);

    for (let index = 0; index < 3; index += 1) {
      const submission = await submissionId(await submitClip(creator, id));
      await verifySubmission(admin, submission, 50_000);
    }
    expect((await counters(id)).committed_cents).toBe(12_498);

    const first = await submissionId(await submitClip(creator, id));
    const second = await submissionId(await submitClip(creator, id));

    const [left, right] = await Promise.all([
      verifySubmission(admin, first, 50_000),
      verifySubmission(admin, second, 50_000),
    ]);

    expect([left.status, right.status]).toEqual([200, 200]);
    const earnings = [left.body.earningsCents, right.body.earningsCents].sort((a, b) => a - b);
    expect(earnings).toEqual([2, 4_166]);

    const state = await counters(id);
    expect(state.committed_cents).toBe(16_666);
    expect(state.shortfall_cents).toBe(4_164);
    expect(state.committed_cents).toBeLessThanOrEqual((await campaignRow(id)).creator_pool_cents);

    const totalEarned = await ledgerSum(creator.accountId);
    expect(totalEarned).toBe(state.committed_cents);
  });

  it('closes joining at 80% of the pool', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const lateCreator = await approvedCreator(admin);
    const { id } = await liveCampaign(admin);
    await joinCampaign(creator, id);

    // 4 x 4,166 = 16,664 committed, well past the 80% join ceiling.
    for (let index = 0; index < 4; index += 1) {
      const submission = await submissionId(await submitClip(creator, id));
      await verifySubmission(admin, submission, 50_000);
    }

    const blocked = await joinCampaign(lateCreator, id);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toContain('closed to new joins');
  });
});

describe('payouts', () => {
  it('enforces the minimum, the owed balance and single-use references', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const first = await liveCampaign(admin);
    await joinCampaign(creator, first.id);
    const submission = await submissionId(await submitClip(creator, first.id));
    await verifySubmission(admin, submission, 50_000);
    expect(await ledgerSum(creator.accountId)).toBe(4_166);

    const belowMinimum = await recordPayout(admin, creator.accountId, 499, 'PAY-MIN');
    expect(belowMinimum.status).toBe(400);

    const tooMuch = await recordPayout(admin, creator.accountId, 4_167, 'PAY-OVER');
    expect(tooMuch.status).toBe(409);

    const paid = await recordPayout(admin, creator.accountId, 4_166, 'PAY-ONE');
    expect(paid.status).toBe(201);
    expect(paid.body.payoutId).toMatch(/^pay_/);

    expect(await ledgerSum(creator.accountId)).toBe(0);

    const afterPayment = await recordPayout(admin, creator.accountId, 500, 'PAY-TWO');
    expect(afterPayment.status).toBe(409);

    // Give the creator a new balance, then replay the original reference.
    const second = await liveCampaign(admin, 10_000);
    await joinCampaign(creator, second.id);
    const secondSubmission = await submissionId(await submitClip(creator, second.id));
    await verifySubmission(admin, secondSubmission, 6000);
    expect(await ledgerSum(creator.accountId)).toBe(600);

    const replay = await recordPayout(admin, creator.accountId, 500, 'PAY-ONE');
    expect(replay.status).toBe(409);
    expect(replay.body.error.message).toContain('already been recorded');
    expect(await ledgerSum(creator.accountId)).toBe(600);
  });

  it('allocates each payout back to the campaigns that earned it', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);

    const first = await liveCampaign(admin, 10_000);
    const second = await liveCampaign(admin, 10_000);
    await joinCampaign(creator, first.id);
    await joinCampaign(creator, second.id);

    const firstSubmission = await submissionId(await submitClip(creator, first.id));
    await verifySubmission(admin, firstSubmission, 3000);
    const secondSubmission = await submissionId(await submitClip(creator, second.id));
    await verifySubmission(admin, secondSubmission, 2000);

    expect(await ledgerSum(creator.accountId)).toBe(500);

    const payout = await recordPayout(admin, creator.accountId, 500, 'PAY-ALLOC');
    expect(payout.status).toBe(201);

    const allocations = await testEnv.DB.prepare(
      `SELECT campaign_id, amount_cents FROM payout_allocations WHERE payout_id = ? ORDER BY amount_cents DESC`
    )
      .bind(payout.body.payoutId)
      .all<{ campaign_id: string; amount_cents: number }>();

    expect(allocations.results).toHaveLength(2);
    expect(allocations.results?.map((row) => row.amount_cents).sort((a, b) => a - b)).toEqual([
      200, 300,
    ]);

    expect((await counters(first.id)).paid_cents).toBe(300);
    expect((await counters(second.id)).paid_cents).toBe(200);
  });
});

describe('campaign state machine', () => {
  it('enforces transitions and settlement readiness', async () => {
    const admin = await setupAdmin();
    const { id } = await liveCampaign(admin);

    const paused = await api(`/api/admin/campaigns/${id}/status`, {
      method: 'PATCH',
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { status: 'paused' },
    });
    expect(paused.status).toBe(200);

    const creator = await approvedCreator(admin);
    const blockedJoin = await joinCampaign(creator, id);
    expect(blockedJoin.status).toBe(409);

    const resumed = await api(`/api/admin/campaigns/${id}/status`, {
      method: 'PATCH',
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { status: 'live' },
    });
    expect(resumed.status).toBe(200);

    const skip = await api(`/api/admin/campaigns/${id}/status`, {
      method: 'PATCH',
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { status: 'completed' },
    });
    expect(skip.status).toBe(400);

    const closing = await api(`/api/admin/campaigns/${id}/status`, {
      method: 'PATCH',
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { status: 'closing' },
    });
    expect(closing.status).toBe(200);

    const tooEarly = await api(`/api/admin/campaigns/${id}/status`, {
      method: 'PATCH',
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { status: 'completed' },
    });
    expect(tooEarly.status).toBe(409);

    // Move the view cutoff into the past, as the hourly cron would.
    await testEnv.DB.prepare(`UPDATE campaigns SET views_cutoff_at = ? WHERE id = ?`)
      .bind(Date.now() - 1000, id)
      .run();

    const completed = await api(`/api/admin/campaigns/${id}/status`, {
      method: 'PATCH',
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { status: 'completed' },
    });
    expect(completed.status).toBe(200);
    expect((await campaignRow(id)).status).toBe('completed');
  });

  it('rejects top-ups on a closed campaign', async () => {
    const admin = await setupAdmin();
    const { id } = await liveCampaign(admin);

    await api(`/api/admin/campaigns/${id}/status`, {
      method: 'PATCH',
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { status: 'cancelled' },
    });

    const topUp = await api(`/api/admin/campaigns/${id}/top-up`, {
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { amountCents: 5000 },
    });
    expect(topUp.status).toBe(409);
  });

  it('recalculates the pool and cap on a top-up', async () => {
    const admin = await setupAdmin();
    const { id } = await liveCampaign(admin, 25_000);

    const topUp = await api(`/api/admin/campaigns/${id}/top-up`, {
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { amountCents: 25_000, note: 'Budget extension' },
    });
    expect(topUp.status).toBe(200);
    expect(topUp.body.budgetCents).toBe(50_000);
    expect(topUp.body.poolCents).toBe(33_333);

    const campaign = await campaignRow(id);
    expect(campaign.creator_pool_cents).toBe(33_333);
    expect(campaign.per_post_cap_cents).toBe(8_333);
  });
});

describe('database invariants', () => {
  it('keeps the earnings ledger append-only', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const { id } = await liveCampaign(admin);
    await joinCampaign(creator, id);
    const submission = await submissionId(await submitClip(creator, id));
    await verifySubmission(admin, submission, 5000);

    await expect(
      testEnv.DB.prepare(`UPDATE earnings_ledger SET amount_cents = 1 WHERE creator_id = ?`)
        .bind(creator.accountId)
        .run()
    ).rejects.toThrow(/append-only/);

    await expect(
      testEnv.DB.prepare(`DELETE FROM earnings_ledger WHERE creator_id = ?`)
        .bind(creator.accountId)
        .run()
    ).rejects.toThrow(/append-only/);
  });

  it('rejects a ledger credit that would exceed the campaign pool', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const { id } = await liveCampaign(admin);

    await expect(
      testEnv.DB.prepare(
        `INSERT INTO earnings_ledger
           (id, creator_id, campaign_id, submission_id, entry_type, amount_cents, currency,
            description, actor_id, idempotency_key, created_at)
         VALUES ('led_direct_overflow', ?, ?, NULL, 'earning', 20000, 'USD', 'overflow',
                 NULL, 'direct:overflow', ?)`
      )
        .bind(creator.accountId, id, Date.now())
        .run()
    ).rejects.toThrow(/budget_exhausted/);

    expect((await counters(id)).committed_cents).toBe(0);
  });

  it('rejects a negative ledger row that would overdraw a creator', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);

    await expect(
      testEnv.DB.prepare(
        `INSERT INTO earnings_ledger
           (id, creator_id, campaign_id, submission_id, entry_type, amount_cents, currency,
            description, actor_id, idempotency_key, created_at)
         VALUES ('led_direct_overdraw', ?, NULL, NULL, 'payout', -500, 'USD', 'overdraw',
                 NULL, 'direct:overdraw', ?)`
      )
        .bind(creator.accountId, Date.now())
        .run()
    ).rejects.toThrow(/insufficient_balance/);
  });

  it('rejects a payout allocation above what a campaign owes that creator', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const { id } = await liveCampaign(admin);
    await joinCampaign(creator, id);
    const submission = await submissionId(await submitClip(creator, id));
    await verifySubmission(admin, submission, 5000);

    const now = Date.now();
    await testEnv.DB.prepare(
      `INSERT INTO payouts
         (id, creator_id, amount_cents, currency, status, method, destination_masked,
          requested_by, decided_by, requested_at, decided_at, paid_at, idempotency_key,
          created_at, updated_at)
       VALUES ('pay_direct', ?, 600, 'USD', 'paid', 'ecocash', '•••• 4567', ?, ?, ?, ?, ?, 'direct:pay', ?, ?)`
    )
      .bind(creator.accountId, admin.accountId, admin.accountId, now, now, now, now, now)
      .run();

    // The campaign only earned this creator 500 cents, so a 600 cent allocation
    // must be refused by the database itself.
    await expect(
      testEnv.DB.prepare(
        `INSERT INTO payout_allocations (payout_id, campaign_id, amount_cents) VALUES ('pay_direct', ?, 600)`
      )
        .bind(id)
        .run()
    ).rejects.toThrow(/allocation_exceeds_campaign_earnings/);

    const withinLimit = await testEnv.DB.prepare(
      `INSERT INTO payout_allocations (payout_id, campaign_id, amount_cents) VALUES ('pay_direct', ?, 500)`
    )
      .bind(id)
      .run();
    expect(withinLimit.success).toBe(true);
  });
});
