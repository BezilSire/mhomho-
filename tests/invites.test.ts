/**
 * Creator invite gate: public sign-up config, admin code issuance, single-use
 * enforcement, the automatic threshold and revocation/expiry.
 */
import { describe, expect, it } from 'vitest';
import {
  api,
  registerCreator,
  setupAdmin,
  testEnv,
  unique,
} from './helpers.ts';

function registrationBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Invite Creator',
    email: `${unique('invite')}@example.test`,
    handle: unique('invite'),
    platform: 'TikTok',
    niche: 'Beauty',
    followers: 1200,
    whatsappNumber: '+263771234567',
    password: 'creator-password-123',
    ...overrides,
  };
}

async function setConfig(key: string, value: string): Promise<void> {
  await testEnv.DB.prepare(
    `INSERT INTO app_config (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  )
    .bind(key, value, Date.now())
    .run();
}

async function createInvite(
  admin: Awaited<ReturnType<typeof setupAdmin>>,
  label?: string
) {
  const response = await api('/api/admin/invites', {
    cookie: admin.cookie,
    csrf: admin.csrf,
    body: label ? { label } : {},
  });
  expect(response.status).toBe(201);
  return response.body.data as {
    id: string;
    code: string;
    hint: string;
    label: string | null;
    expiresAt: number;
  };
}

describe('creator invite gate', () => {
  it('is open by default and reports the 3,000 threshold', async () => {
    const response = await api('/api/auth/signup-config');
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      mode: 'auto',
      threshold: 3000,
      creatorCount: 0,
      remaining: 3000,
      inviteRequired: false,
      inviteCodeTtlDays: 30,
    });
  });

  it('issues single-use codes and blocks sign-up once invite-only is on', async () => {
    const admin = await setupAdmin();
    const invite = await createInvite(admin, 'First cohort');
    expect(invite.code).toMatch(/^MHOM-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    const mode = await api('/api/admin/invite-settings', {
      method: 'PATCH',
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { mode: 'on' },
    });
    expect(mode.status).toBe(200);
    expect(mode.body.data.inviteRequired).toBe(true);

    const blocked = await api('/api/auth/register', { body: registrationBody() });
    expect(blocked.status).toBe(400);
    expect(blocked.body.error.message).toContain('invite');

    const allowed = await api('/api/auth/register', {
      body: registrationBody({ inviteCode: invite.code }),
    });
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.viewer.role).toBe('creator');

    const reuse = await api('/api/auth/register', {
      body: registrationBody({ inviteCode: invite.code }),
    });
    expect(reuse.status).toBe(400);
    expect(reuse.body.error.message).toContain('invite');

    const list = await api('/api/admin/invites', { cookie: admin.cookie });
    expect(list.status).toBe(200);
    const row = (list.body.data.codes as Array<{ id: string; status: string }>).find(
      (item) => item.id === invite.id
    );
    expect(row?.status).toBe('used');
    // The raw code is shown once at creation and never echoed by the list.
    expect(JSON.stringify(list.body)).not.toContain(invite.code);
  });

  it('closes automatically at the configured threshold', async () => {
    await setConfig('creator_invite_threshold', '1');

    await registerCreator();

    const blocked = await api('/api/auth/register', { body: registrationBody() });
    expect(blocked.status).toBe(400);
    expect(blocked.body.error.message).toContain('invite');

    const admin = await setupAdmin();
    const invite = await createInvite(admin);
    const allowed = await api('/api/auth/register', {
      body: registrationBody({ inviteCode: invite.code }),
    });
    expect(allowed.status).toBe(200);
  });

  it('rejects revoked and expired codes', async () => {
    const admin = await setupAdmin();
    await setConfig('creator_invite_mode', 'on');

    const revoked = await createInvite(admin, 'Revoked');
    const revoke = await api(`/api/admin/invites/${revoked.id}/revoke`, {
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: {},
    });
    expect(revoke.status).toBe(200);

    const blockedRevoked = await api('/api/auth/register', {
      body: registrationBody({ inviteCode: revoked.code }),
    });
    expect(blockedRevoked.status).toBe(400);

    const expired = await createInvite(admin, 'Expired');
    await testEnv.DB.prepare(`UPDATE invite_codes SET expires_at = ? WHERE id = ?`)
      .bind(Date.now() - 1000, expired.id)
      .run();

    const blockedExpired = await api('/api/auth/register', {
      body: registrationBody({ inviteCode: expired.code }),
    });
    expect(blockedExpired.status).toBe(400);
    expect(blockedExpired.body.error.message).toContain('invite');
  });

  it('accepts a code pasted with different casing and spacing', async () => {
    const admin = await setupAdmin();
    await setConfig('creator_invite_mode', 'on');
    const invite = await createInvite(admin);

    const messy = ` ${invite.code.toLowerCase().replace(/-/g, '  ')} `;
    const response = await api('/api/auth/register', {
      body: registrationBody({ inviteCode: messy }),
    });
    expect(response.status).toBe(200);
  });

  it('does not reveal whether an account exists to a visitor without a code', async () => {
    const existing = await registerCreator();
    await setConfig('creator_invite_mode', 'on');

    const response = await api('/api/auth/register', {
      body: registrationBody({ email: existing.email }),
    });
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('invite');
    expect(response.body.error.message).not.toContain('already exists');
  });

  it('keeps the invite console admin-only', async () => {
    const creator = await registerCreator();
    const response = await api('/api/admin/invites', { cookie: creator.cookie });
    expect(response.status).toBe(403);
  });
});
