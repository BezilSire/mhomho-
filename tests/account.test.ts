/**
 * Creator withdrawals, account lifecycle and self-service profile changes.
 *
 * These tests drive the real HTTP surface, so CSRF, validation, D1 triggers and
 * the balance projection are all exercised together.
 */
import { describe, expect, it } from 'vitest';
import {
  api,
  approvedCreator,
  bootstrap,
  createCampaign,
  joinCampaign,
  ledgerSum,
  registerCreator,
  sessionCookie,
  setupAdmin,
  submitClip,
  testEnv,
  verifySubmission,
} from './helpers.ts';

async function fundedCreator() {
  const admin = await setupAdmin();
  const creator = await approvedCreator(admin);
  const campaign = await createCampaign(admin, { budgetCents: 25_000 });
  await joinCampaign(creator, campaign.id);
  const submission = await submitClip(creator, campaign.id, { claimedViews: 9000 });
  expect(submission.status).toBe(201);
  const verify = await verifySubmission(admin, submission.body.submissionId, 8200);
  expect(verify.status).toBe(200);
  expect(verify.body.earningsCents).toBe(820);
  return { admin, creator, campaign, submissionId: submission.body.submissionId as string };
}

function requestWithdrawal(
  creator: { cookie: string; csrf: string },
  amountCents: number,
  ecoCashNumber = '+263771234567'
) {
  return api('/api/payouts', {
    cookie: creator.cookie,
    csrf: creator.csrf,
    body: { amountCents, ecoCashNumber },
  });
}

describe('creator withdrawals', () => {
  it('requires an approved creator', async () => {
    await setupAdmin();
    const applied = await registerCreator();

    const response = await requestWithdrawal(applied, 500);
    expect(response.status).toBe(400);
  });

  it('rejects amounts below the $5 minimum and above the balance', async () => {
    const { creator } = await fundedCreator();

    const tooSmall = await requestWithdrawal(creator, 499);
    expect(tooSmall.status).toBe(400);

    const tooLarge = await requestWithdrawal(creator, 821);
    expect(tooLarge.status).toBe(409);
  });

  it('reserves the balance without writing a payout ledger row', async () => {
    const { creator } = await fundedCreator();

    const response = await requestWithdrawal(creator, 820, '+263 77 123 4567');
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('requested');
    expect(response.body.estimatedPaymentHours).toBe(72);
    const payoutId = response.body.payoutId as string;

    const view = await bootstrap(creator.cookie);
    expect(view.body.data.viewer.balances.owedCents).toBe(0);
    expect(view.body.data.viewer.balances.reservedCents).toBe(820);

    const payout = await testEnv.DB.prepare(`SELECT * FROM payouts WHERE id = ?`)
      .bind(payoutId)
      .first<Record<string, unknown>>();
    expect(payout?.status).toBe('requested');
    expect(payout?.destination_masked).toBe('•••• 4567');
    expect(await ledgerSum(creator.accountId)).toBe(820);

    const stored = await testEnv.DB.prepare(
      `SELECT ecocash_number FROM creator_profiles WHERE account_id = ?`
    )
      .bind(creator.accountId)
      .first<{ ecocash_number: string }>();
    expect(stored?.ecocash_number).toBe('+263 77 123 4567');
  });

  it('allows only one open withdrawal at a time', async () => {
    const { creator } = await fundedCreator();
    expect((await requestWithdrawal(creator, 500)).status).toBe(201);

    const second = await requestWithdrawal(creator, 500);
    expect(second.status).toBe(409);
    expect(second.body.error.message).toMatch(/withdrawal in progress/i);
  });

  it('settles a request once, deducting the balance and recording the payout', async () => {
    const { admin, creator, campaign } = await fundedCreator();
    const request = await requestWithdrawal(creator, 820);
    const payoutId = request.body.payoutId as string;

    const settle = await api(`/api/admin/payouts/${payoutId}`, {
      method: 'PATCH',
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { status: 'paid', reference: 'EC-SETTLE-0001' },
    });
    expect(settle.status).toBe(200);
    expect(settle.body.status).toBe('paid');

    const view = await bootstrap(creator.cookie);
    expect(view.body.data.viewer.balances.owedCents).toBe(0);
    expect(view.body.data.viewer.balances.paidCents).toBe(820);
    expect(view.body.data.viewer.balances.reservedCents).toBe(0);
    expect(await ledgerSum(creator.accountId)).toBe(0);

    const payout = await testEnv.DB.prepare(`SELECT status, reference, paid_at FROM payouts WHERE id = ?`)
      .bind(payoutId)
      .first<Record<string, unknown>>();
    expect(payout?.status).toBe('paid');
    expect(payout?.reference).toBe('EC-SETTLE-0001');
    expect(payout?.paid_at).not.toBeNull();

    const counters = await testEnv.DB.prepare(
      `SELECT paid_cents FROM campaign_counters WHERE campaign_id = ?`
    )
      .bind(campaign.id)
      .first<{ paid_cents: number }>();
    expect(counters?.paid_cents).toBe(820);

    const replay = await api(`/api/admin/payouts/${payoutId}`, {
      method: 'PATCH',
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { status: 'paid', reference: 'EC-SETTLE-0002' },
    });
    expect(replay.status).toBe(409);
    expect(await ledgerSum(creator.accountId)).toBe(0);
  });

  it('rejects a reused EcoCash reference', async () => {
    const { admin, creator } = await fundedCreator();
    const request = await requestWithdrawal(creator, 820);

    const first = await api(`/api/admin/payouts/${request.body.payoutId}`, {
      method: 'PATCH',
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { status: 'paid', reference: 'EC-DUPLICATE-01' },
    });
    expect(first.status).toBe(200);

    // A second creator's manual payout must not reuse the reference.
    const second = await approvedCreator(admin);
    const campaign = await createCampaign(admin, { budgetCents: 25_000 });
    await joinCampaign(second, campaign.id);
    const submission = await submitClip(second, campaign.id);
    await verifySubmission(admin, submission.body.submissionId, 8200);

    const manual = await api('/api/admin/payouts', {
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { creatorId: second.accountId, amountCents: 820, reference: 'EC-DUPLICATE-01' },
    });
    expect(manual.status).toBe(409);
  });

  it('cancelling a request releases the reserved funds', async () => {
    const { admin, creator } = await fundedCreator();
    const request = await requestWithdrawal(creator, 500);

    const cancel = await api(`/api/admin/payouts/${request.body.payoutId}`, {
      method: 'PATCH',
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { status: 'cancelled', failureReason: 'Test cancellation' },
    });
    expect(cancel.status).toBe(200);

    const view = await bootstrap(creator.cookie);
    expect(view.body.data.viewer.balances.owedCents).toBe(820);
    expect(view.body.data.viewer.balances.reservedCents).toBe(0);

    // The creator can request again after a cancellation.
    expect((await requestWithdrawal(creator, 820)).status).toBe(201);
  });

  it('refuses a manual payout while a withdrawal is open', async () => {
    const { admin, creator } = await fundedCreator();
    await requestWithdrawal(creator, 500);

    const manual = await api('/api/admin/payouts', {
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { creatorId: creator.accountId, amountCents: 500, reference: 'EC-MANUAL-0001' },
    });
    expect(manual.status).toBe(409);
    expect(manual.body.error.message).toMatch(/open withdrawal/i);
  });
});

describe('profile self-service', () => {
  it('updates name, niche, followers, platform and contact details', async () => {
    const { creator } = await fundedCreator();

    const update = await api('/api/profile', {
      method: 'PATCH',
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: {
        displayName: 'Tariro Moyo',
        niche: 'Fitness',
        followers: 12500,
        platform: 'Instagram',
        whatsappNumber: '+263 78 111 2222',
        ecoCashNumber: '+263 77 333 4444',
      },
    });
    expect(update.status).toBe(200);

    const view = await bootstrap(creator.cookie);
    expect(view.body.data.creatorsPrivate[creator.accountId].name).toBe('Tariro Moyo');
    expect(view.body.data.creatorsPublic[creator.accountId].niche).toBe('Fitness');
    expect(view.body.data.creatorsPublic[creator.accountId].followers).toBe(12500);
    expect(view.body.data.creatorsPublic[creator.accountId].platform).toBe('Instagram');
    expect(view.body.data.creatorsPrivate[creator.accountId].ecoCashNumber).toBe('+263 77 333 4444');
  });

  it('changes the password, keeps this session and revokes the others', async () => {
    const { creator } = await fundedCreator();

    const other = await api('/api/auth/login', {
      body: { identifier: creator.email, password: 'creator-password-123' },
    });
    expect(other.status).toBe(200);
    const otherCookie = sessionCookie(other);

    const wrong = await api('/api/auth/password', {
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: { currentPassword: 'not-the-password', newPassword: 'brand-new-password-456' },
    });
    expect(wrong.status).toBe(403);

    const changed = await api('/api/auth/password', {
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: { currentPassword: 'creator-password-123', newPassword: 'brand-new-password-456' },
    });
    expect(changed.status).toBe(200);

    const currentDevice = await bootstrap(creator.cookie);
    expect(currentDevice.body.data.viewer.uid).toBe(creator.accountId);

    const revoked = await bootstrap(otherCookie);
    expect(revoked.body.data.viewer).toBeNull();

    const oldLogin = await api('/api/auth/login', {
      body: { identifier: creator.email, password: 'creator-password-123' },
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await api('/api/auth/login', {
      body: { identifier: creator.email, password: 'brand-new-password-456' },
    });
    expect(newLogin.status).toBe(200);
  });
});

describe('account deletion', () => {
  it('requires the password and an explicit confirmation', async () => {
    const { creator } = await fundedCreator();

    const wrongPassword = await api('/api/account/delete', {
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: { password: 'nope', confirm: 'DELETE' },
    });
    expect(wrongPassword.status).toBe(403);

    const wrongConfirm = await api('/api/account/delete', {
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: { password: 'creator-password-123', confirm: 'yes' },
    });
    expect(wrongConfirm.status).toBe(400);
  });

  it('blocks deletion while a withdrawal is open', async () => {
    const { creator } = await fundedCreator();
    await requestWithdrawal(creator, 500);

    const response = await api('/api/account/delete', {
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: { password: 'creator-password-123', confirm: 'DELETE' },
    });
    expect(response.status).toBe(409);
  });

  it('anonymises the account, writes off the balance and revokes the session', async () => {
    const { creator } = await fundedCreator();

    const response = await api('/api/account/delete', {
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: { password: 'creator-password-123', confirm: 'DELETE' },
    });
    expect(response.status).toBe(200);
    expect(response.body.writtenOffCents).toBe(820);

    const account = await testEnv.DB.prepare(
      `SELECT email, status, password_hash, deleted_at FROM accounts WHERE id = ?`
    )
      .bind(creator.accountId)
      .first<Record<string, unknown>>();
    expect(account?.status).toBe('suspended');
    expect(account?.password_hash).toBeNull();
    expect(account?.deleted_at).not.toBeNull();
    expect(String(account?.email)).toMatch(/^deleted\+.*@deleted\.invalid$/);

    const profile = await testEnv.DB.prepare(
      `SELECT display_name, handle, whatsapp_number, ecocash_number
         FROM creator_profiles WHERE account_id = ?`
    )
      .bind(creator.accountId)
      .first<Record<string, unknown>>();
    expect(profile?.display_name).toBe('Deleted creator');
    expect(profile?.whatsapp_number).toBe('');
    expect(profile?.ecocash_number).toBeNull();

    expect(await ledgerSum(creator.accountId)).toBe(0);

    const session = await bootstrap(creator.cookie);
    expect(session.body.data.viewer).toBeNull();

    const login = await api('/api/auth/login', {
      body: { identifier: creator.email, password: 'creator-password-123' },
    });
    expect(login.status).toBe(401);
  });
});
