/**
 * Public surface: brand enquiries, revocable brand report links and the hourly
 * maintenance job. The brand report must never expose creator identities.
 */
import { describe, expect, it } from 'vitest';
import {
  api,
  approvedCreator,
  createCampaign,
  joinCampaign,
  setupAdmin,
  submitClip,
  testEnv,
  verifySubmission,
} from './helpers.ts';
import { runScheduled } from '../worker/src/cron.ts';

const ENQUIRY = {
  bizName: 'Harare Hair Studio',
  contactName: 'Tariro Moyo',
  phone: '+263771234567',
  niche: 'Beauty',
  promo: 'We want creators to show our new braiding range in a getting-ready routine.',
  goals: ['Awareness', 'Sales'],
  budget: '$250 – $500',
  start: 'Within two weeks',
  bestTimes: ['Weekday evenings'],
  notes: 'Please share a rate card.',
};

describe('brand enquiries', () => {
  it('accepts a valid enquiry and hides it from non-admins', async () => {
    const response = await api('/api/enquiries', { body: ENQUIRY });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ ok: true });

    const admin = await setupAdmin();
    const adminView = await api('/api/bootstrap', { cookie: admin.cookie });
    const enquiries = Object.values(adminView.body.data.enquiries) as Array<Record<string, unknown>>;
    expect(enquiries).toHaveLength(1);
    expect(enquiries[0].bizName).toBe(ENQUIRY.bizName);
    expect(enquiries[0].status).toBe('new');

    const creator = await approvedCreator(admin);
    const creatorView = await api('/api/bootstrap', { cookie: creator.cookie });
    expect(creatorView.body.data.enquiries).toEqual({});

    const anonymous = await api('/api/bootstrap');
    expect(anonymous.body.data.enquiries).toEqual({});
  });

  it('drops honeypot submissions and rejects unknown budgets', async () => {
    const honeypot = await api('/api/enquiries', {
      body: { ...ENQUIRY, company: 'Spam Co' },
    });
    expect(honeypot.status).toBe(200);

    const stored = await testEnv.DB.prepare(`SELECT COUNT(*) AS count FROM enquiries`).first<{
      count: number;
    }>();
    expect(Number(stored?.count)).toBe(0);

    const badBudget = await api('/api/enquiries', {
      body: { ...ENQUIRY, budget: '$5' },
    });
    expect(badBudget.status).toBe(400);
  });

  it('rate limits enquiries per address', async () => {
    const ip = '203.0.113.99';
    const statuses: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      const response = await api('/api/enquiries', { body: ENQUIRY, ip });
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 5).every((status) => status === 201)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it('lets only admins change enquiry status', async () => {
    await api('/api/enquiries', { body: ENQUIRY });
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);

    const view = await api('/api/bootstrap', { cookie: admin.cookie });
    const enquiryId = Object.keys(view.body.data.enquiries)[0];

    const forbidden = await api(`/api/admin/enquiries/${enquiryId}`, {
      method: 'PATCH',
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: { status: 'contacted' },
    });
    expect(forbidden.status).toBe(403);

    const updated = await api(`/api/admin/enquiries/${enquiryId}`, {
      method: 'PATCH',
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { status: 'contacted' },
    });
    expect(updated.status).toBe(200);

    const missing = await api('/api/admin/enquiries/enq_missing', {
      method: 'PATCH',
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { status: 'closed' },
    });
    expect(missing.status).toBe(404);
  });
});

describe('brand report links', () => {
  it('returns aggregate figures without creator identities', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const { id } = await createCampaign(admin, { budgetCents: 25_000 });
    await joinCampaign(creator, id);
    const submission = (await submitClip(creator, id)).body.submissionId;
    await verifySubmission(admin, submission, 8200);

    const created = await api(`/api/admin/campaigns/${id}/brand-token`, {
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { label: 'Client report', expiresInDays: 30 },
    });
    expect(created.status).toBe(201);
    const token: string = created.body.token;
    expect(token.length).toBeGreaterThan(30);

    const stored = await testEnv.DB.prepare(
      `SELECT token_hash, label FROM brand_report_tokens`
    ).first<{ token_hash: string; label: string }>();
    // Only the hash is persisted, never the raw token.
    expect(stored?.token_hash).not.toBe(token);
    expect(stored?.token_hash).toMatch(/^[0-9a-f]{64}$/);

    const report = await api(`/api/brand/${token}`);
    expect(report.status).toBe(200);
    const data = report.body.data;
    expect(data.title).toBeTruthy();
    expect(data.verifiedViews).toBe(8200);
    expect(data.eligibleViews).toBe(8200);
    expect(data.guaranteedViews).toBe(166_666);
    expect(data.budgetCents).toBe(25_000);
    expect(data.creatorsJoined).toBe(1);
    expect(data.clipsLive).toBe(1);

    const serialized = JSON.stringify(report.body);
    expect(serialized).not.toContain(creator.email);
    expect(serialized).not.toContain(creator.accountId);
    expect(serialized).not.toContain('whatsapp');
  });

  it('does not resolve unknown, expired or revoked tokens', async () => {
    const admin = await setupAdmin();
    const { id } = await createCampaign(admin);

    expect((await api('/api/brand/not-a-real-token-value-000000')).status).toBe(404);

    const created = await api(`/api/admin/campaigns/${id}/brand-token`, {
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { expiresInDays: 1 },
    });
    const token: string = created.body.token;
    expect((await api(`/api/brand/${token}`)).status).toBe(200);

    await testEnv.DB.prepare(`UPDATE brand_report_tokens SET expires_at = ?`)
      .bind(Date.now() - 1000)
      .run();
    expect((await api(`/api/brand/${token}`)).status).toBe(404);

    await testEnv.DB.prepare(`UPDATE brand_report_tokens SET expires_at = NULL, revoked_at = ?`)
      .bind(Date.now())
      .run();
    expect((await api(`/api/brand/${token}`)).status).toBe(404);
  });

  it('requires an admin to mint a report link', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const { id } = await createCampaign(admin);

    const response = await api(`/api/admin/campaigns/${id}/brand-token`, {
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: {},
    });
    expect(response.status).toBe(403);
  });
});

describe('hourly maintenance', () => {
  it('moves campaigns through their scheduled lifecycle and audits each step', async () => {
    const admin = await setupAdmin();
    const now = Date.now();
    const startsAt = now + 3_600_000;
    const endsAt = now + 10 * 86_400_000;

    const created = await api('/api/admin/campaigns', {
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: {
        title: 'Scheduled Campaign',
        brandName: 'Brand',
        niche: 'Beauty',
        brief: 'A campaign created in the future to exercise the maintenance job.',
        budgetCents: 25_000,
        startsAt,
        endsAt,
      },
    });
    expect(created.status).toBe(201);
    const id: string = created.body.campaignId;

    const initial = await testEnv.DB.prepare(`SELECT status FROM campaigns WHERE id = ?`)
      .bind(id)
      .first<{ status: string }>();
    expect(initial?.status).toBe('scheduled');

    await runScheduled(testEnv, startsAt + 1);
    let row: Record<string, any> | null = await testEnv.DB.prepare(
      `SELECT status, submission_cutoff_at FROM campaigns WHERE id = ?`
    )
      .bind(id)
      .first<Record<string, any>>();
    expect(row?.status).toBe('live');

    await runScheduled(testEnv, Number(row!.submission_cutoff_at) + 1);
    row = await testEnv.DB.prepare(`SELECT status, views_cutoff_at FROM campaigns WHERE id = ?`)
      .bind(id)
      .first<Record<string, any>>();
    expect(row?.status).toBe('closing');

    await runScheduled(testEnv, Number(row!.views_cutoff_at) + 1);
    row = await testEnv.DB.prepare(`SELECT status FROM campaigns WHERE id = ?`)
      .bind(id)
      .first<Record<string, any>>();
    expect(row?.status).toBe('completed');

    const audit = await testEnv.DB.prepare(
      `SELECT action, before_json, after_json FROM audit_events
        WHERE entity_id = ? ORDER BY created_at`
    )
      .bind(id)
      .all<{ action: string; before_json: string; after_json: string }>();
    const actions = (audit.results ?? []).map((event) => event.action);
    expect(actions).toContain('campaign.auto_transition');
    expect(actions).toContain('campaign.auto_complete');
  });

  it('never auto-completes while a submission still awaits review', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const { id } = await createCampaign(admin);
    await joinCampaign(creator, id);
    await submitClip(creator, id);

    const row = await testEnv.DB.prepare(
      `SELECT submission_cutoff_at, views_cutoff_at FROM campaigns WHERE id = ?`
    )
      .bind(id)
      .first<{ submission_cutoff_at: number; views_cutoff_at: number }>();

    await runScheduled(testEnv, Number(row!.submission_cutoff_at) + 1);
    await runScheduled(testEnv, Number(row!.views_cutoff_at) + 1);

    const status = await testEnv.DB.prepare(`SELECT status FROM campaigns WHERE id = ?`)
      .bind(id)
      .first<{ status: string }>();
    expect(status?.status).toBe('closing');
  });
});
