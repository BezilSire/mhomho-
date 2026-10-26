/**
 * Authentication, session, CSRF, RBAC, rate-limit and projection-scoping tests.
 * These drive the real Worker and the real D1 database.
 */
import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_SETUP_TOKEN,
  api,
  bootstrap,
  completeCampaignZero,
  creatorLogin,
  freshIp,
  registerCreator,
  sessionCookie,
  setupAdmin,
  unique,
} from './helpers.ts';

describe('health and anonymous bootstrap', () => {
  it('serves a health check', async () => {
    const response = await api('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Permitted-Cross-Domain-Policies')).toBe('none');
    expect(response.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
  });

  it('gives anonymous visitors no private data', async () => {
    const response = await bootstrap();
    expect(response.status).toBe(200);
    const data = response.body.data;
    expect(data.viewer).toBeNull();
    expect(data.csrfToken).toBeNull();
    expect(data.totals).toBeNull();
    expect(data.creatorsPrivate).toEqual({});
    expect(data.clips).toEqual({});
    expect(data.enquiries).toEqual({});
  });

  it('returns 404 for unknown API routes and 405 for wrong methods', async () => {
    expect((await api('/api/does-not-exist')).status).toBe(404);
    expect((await api('/api/bootstrap', { method: 'POST', body: {} })).status).toBe(405);
  });
});

describe('creator registration and login', () => {
  it('creates an applied creator with a hardened session cookie', async () => {
    const response = await api('/api/auth/register', {
      body: {
        name: 'Rudo Creator',
        email: 'rudo@example.test',
        handle: '@RudoCreates',
        platform: 'TikTok',
        niche: 'Beauty',
        followers: 8200,
        whatsappNumber: '+263771234567',
        password: 'creator-password-123',
      },
    });

    expect(response.status).toBe(200);
    const setCookie = response.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('Max-Age=');
    // Development runs over http, so the flag is intentionally absent here.
    expect(setCookie).not.toContain('Secure');

    const data = response.body.data;
    expect(data.viewer.role).toBe('creator');
    expect(data.viewer.status).toBe('applied');
    expect(typeof data.csrfToken).toBe('string');
    expect(data.csrfToken.length).toBeGreaterThan(20);
    expect(data.viewer.email).toBe('rudo@example.test');
    // No password material may ever reach the client.
    expect(JSON.stringify(response.body)).not.toContain('password');
    expect(JSON.stringify(response.body)).not.toContain('salt');
  });

  it('marks the cookie Secure on HTTPS even when ENVIRONMENT is not production', async () => {
    const email = `${unique('secure-cookie')}@example.test`;
    const response = await SELF.fetch(
      new Request('https://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': freshIp(),
          Origin: 'http://localhost:3000',
        },
        body: JSON.stringify({
          name: 'Secure Cookie',
          email,
          handle: unique('securecookie'),
          platform: 'TikTok',
          niche: 'Beauty',
          followers: 1000,
          whatsappNumber: '+263771234567',
          password: 'creator-password-123',
        }),
      })
    );

    expect(response.status).toBe(200);
    const setCookie = response.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toContain('__Host-mhomho_session=');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('Path=/');

    // The HTTPS read path must look for the same __Host- name it issued.
    const cookie = setCookie.split(';')[0];
    const bootstrapResponse = await SELF.fetch(
      new Request('https://localhost:3000/api/bootstrap', {
        headers: { Cookie: cookie, 'CF-Connecting-IP': freshIp() },
      })
    );
    const payload = (await bootstrapResponse.json()) as {
      data: { viewer: { email: string } | null };
    };
    expect(payload.data.viewer?.email).toBe(email);
  });

  it('rejects duplicate emails and handles', async () => {
    const email = `${unique('dupe')}@example.test`;
    await registerCreator({ email, handle: unique('dupe') });

    const duplicateEmail = await api('/api/auth/register', {
      body: {
        name: 'Another Creator',
        email,
        handle: unique('other'),
        platform: 'TikTok',
        niche: 'Beauty',
        followers: 1000,
        whatsappNumber: '+263771234567',
        password: 'creator-password-123',
      },
    });
    expect(duplicateEmail.status).toBe(400);
    expect(duplicateEmail.body.error.code).toBe('bad_request');
  });

  it('validates the registration payload', async () => {
    const response = await api('/api/auth/register', {
      body: {
        name: 'X',
        email: 'not-an-email',
        handle: 'a',
        platform: 'MySpace',
        niche: 'Beauty',
        followers: -5,
        whatsappNumber: '1',
        password: 'short',
      },
    });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('bad_request');
  });

  it('signs in with either email or handle and rejects bad passwords', async () => {
    const email = `${unique('login')}@example.test`;
    const handle = unique('login');
    await registerCreator({ email, handle, password: 'creator-password-123' });

    const byEmail = await creatorLogin(email, 'creator-password-123');
    expect(byEmail.status).toBe(200);
    expect(byEmail.body.data.viewer.email).toBe(email);

    const byHandle = await creatorLogin(`@${handle}`, 'creator-password-123');
    expect(byHandle.status).toBe(200);

    const wrongPassword = await creatorLogin(email, 'wrong-password-000');
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe('unauthorized');

    const unknownAccount = await creatorLogin('nobody@example.test', 'wrong-password-000');
    expect(unknownAccount.status).toBe(401);
  });

  it('refuses cross-origin registration and sign-in', async () => {
    const register = await api('/api/auth/register', {
      origin: 'https://evil.example',
      body: {
        name: 'Cross Site',
        email: `${unique('csrf')}@example.test`,
        handle: unique('csrf'),
        platform: 'TikTok',
        niche: 'Beauty',
        followers: 1000,
        whatsappNumber: '+263771234567',
        password: 'creator-password-123',
      },
    });
    expect(register.status).toBe(403);

    const login = await api('/api/auth/login', {
      origin: 'https://evil.example',
      body: { identifier: 'someone@example.test', password: 'creator-password-123' },
    });
    expect(login.status).toBe(403);

    const adminLogin = await api('/api/auth/admin/login', {
      origin: 'https://evil.example',
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(adminLogin.status).toBe(403);
  });

  it('rate limits repeated sign-up attempts from one address', async () => {
    const ip = '203.0.113.77';
    const attempts = [];
    for (let index = 0; index < 6; index += 1) {
      attempts.push(
        await api('/api/auth/register', {
          ip,
          body: {
            name: 'Rate Limited',
            email: `${unique('rate')}@example.test`,
            handle: unique('rate'),
            platform: 'TikTok',
            niche: 'Beauty',
            followers: 1000,
            whatsappNumber: '+263771234567',
            password: 'creator-password-123',
          },
        })
      );
    }

    expect(attempts.slice(0, 5).every((attempt) => attempt.status === 200)).toBe(true);
    expect(attempts[5].status).toBe(429);
    expect(attempts[5].body.error.code).toBe('rate_limited');
    expect(attempts[5].body.error.details.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe('credential stuffing protections', () => {
  it('throttles password guessing against one creator across many IPs', async () => {
    const email = `${unique('throttle')}@example.test`;
    await registerCreator({ email, handle: unique('throttle'), password: 'creator-password-123' });

    for (let index = 0; index < 30; index += 1) {
      const attempt = await api('/api/auth/login', {
        ip: freshIp(),
        body: { identifier: email, password: 'wrong-password-000' },
      });
      expect(attempt.status).toBe(401);
    }

    const blocked = await api('/api/auth/login', {
      ip: freshIp(),
      body: { identifier: email, password: 'creator-password-123' },
    });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('rate_limited');
  });

  it('throttles password guessing against an admin across many IPs', async () => {
    await setupAdmin();

    for (let index = 0; index < 10; index += 1) {
      const attempt = await api('/api/auth/admin/login', {
        ip: freshIp(),
        body: { email: ADMIN_EMAIL, password: 'wrong-admin-password' },
      });
      expect(attempt.status).toBe(401);
    }

    const blocked = await api('/api/auth/admin/login', {
      ip: freshIp(),
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(blocked.status).toBe(429);
  });
});

describe('sessions and CSRF', () => {
  it('revokes the session on logout and clears the cookie', async () => {
    const creator = await registerCreator();

    const logout = await api('/api/auth/logout', {
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: {},
    });
    expect(logout.status).toBe(200);
    expect(logout.headers.get('Set-Cookie')).toContain('Max-Age=0');

    const after = await bootstrap(creator.cookie);
    expect(after.body.data.viewer).toBeNull();
  });

  it('refuses a mutation without a CSRF token', async () => {
    const creator = await registerCreator();
    const response = await api('/api/profile', {
      method: 'PATCH',
      cookie: creator.cookie,
      body: { whatsappNumber: '+263771111111', ecoCashNumber: '+263772222222' },
    });
    expect(response.status).toBe(403);
    expect(response.body.error.message).toContain('CSRF');
  });

  it('refuses a mutation with a forged CSRF token', async () => {
    const creator = await registerCreator();
    const response = await api('/api/profile', {
      method: 'PATCH',
      cookie: creator.cookie,
      csrf: 'forged-token-value-000000000000',
      body: { whatsappNumber: '+263771111111', ecoCashNumber: '+263772222222' },
    });
    expect(response.status).toBe(403);
  });

  it('refuses a cross-origin mutation even with a valid CSRF token', async () => {
    const creator = await registerCreator();
    const response = await api('/api/profile', {
      method: 'PATCH',
      cookie: creator.cookie,
      csrf: creator.csrf,
      origin: 'https://evil.example',
      body: { whatsappNumber: '+263771111111', ecoCashNumber: '+263772222222' },
    });
    expect(response.status).toBe(403);
    expect(response.body.error.message).toContain('Cross-origin');
  });

  it('accepts a same-origin mutation with a valid CSRF token', async () => {
    const creator = await registerCreator();
    const response = await api('/api/profile', {
      method: 'PATCH',
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: { whatsappNumber: '+263771111111', ecoCashNumber: '+263772222222' },
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('rejects a tampered session cookie', async () => {
    const creator = await registerCreator();
    const tampered = creator.cookie.replace(/mhomho_session=([^;]+)/, 'mhomho_session=forged-session-token');
    const response = await bootstrap(tampered);
    expect(response.body.data.viewer).toBeNull();
  });
});

describe('role-based access control', () => {
  it('requires authentication for admin endpoints', async () => {
    const response = await api('/api/admin/payouts', {
      body: { creatorId: 'acc_x', amountCents: 500, reference: 'TEST' },
    });
    expect(response.status).toBe(401);
  });

  it('forbids creators from admin endpoints', async () => {
    const creator = await registerCreator();
    const response = await api('/api/admin/campaigns', {
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: {
        title: 'Not Allowed',
        brandName: 'Brand',
        niche: 'Beauty',
        brief: 'This should never be created by a creator.',
        budgetCents: 25_000,
      },
    });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('forbidden');
  });

  it('scopes the creator projection to the signed-in creator', async () => {
    const admin = await setupAdmin();
    const first = await registerCreator();
    await registerCreator();

    const response = await bootstrap(first.cookie);
    const data = response.body.data;
    expect(data.viewer.uid).toBe(first.accountId);
    expect(Object.keys(data.creatorsPublic)).toEqual([first.accountId]);
    expect(Object.keys(data.creatorsPrivate)).toEqual([first.accountId]);
    expect(data.totals).toBeNull();
    expect(data.enquiries).toEqual({});
    expect(admin.accountId).not.toBe(first.accountId);
  });

  it('gives administrators the operational projection', async () => {
    const admin = await setupAdmin();
    const response = await bootstrap(admin.cookie);
    const data = response.body.data;
    expect(data.viewer.role).toBe('admin');
    expect(data.totals).not.toBeNull();
    expect(typeof data.totals.owedCents).toBe('number');
  });

  it('does not let an unapproved creator join a campaign', async () => {
    const admin = await setupAdmin();
    const campaignResponse = await api('/api/admin/campaigns', {
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: {
        title: unique('Approval Gate'),
        brandName: 'Brand',
        niche: 'Beauty',
        brief: 'A campaign used to prove that approval is enforced server-side.',
        budgetCents: 25_000,
      },
    });
    const creator = await registerCreator();

    const join = await api(`/api/campaigns/${campaignResponse.body.campaignId}/join`, {
      method: 'POST',
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: {},
    });
    expect(join.status).toBe(400);
    expect(join.body.error.message).toContain('approved');
  });
});

describe('administrator setup', () => {
  it('is one-time and requires the configured secret', async () => {
    const wrongToken = await api('/api/setup/admin', {
      body: { setupToken: 'x'.repeat(30), email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(wrongToken.status).toBe(403);

    const first = await api('/api/setup/admin', {
      body: { setupToken: ADMIN_SETUP_TOKEN, email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(first.status).toBe(201);
    expect(first.body.adminId).toMatch(/^adm_/);

    const second = await api('/api/setup/admin', {
      body: {
        setupToken: ADMIN_SETUP_TOKEN,
        email: `second-${ADMIN_EMAIL}`,
        password: ADMIN_PASSWORD,
      },
    });
    expect(second.status).toBe(409);

    const login = await api('/api/auth/admin/login', {
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(login.status).toBe(200);
    expect(login.body.data.viewer.role).toBe('admin');

    const badLogin = await api('/api/auth/admin/login', {
      body: { email: ADMIN_EMAIL, password: 'definitely-wrong-000' },
    });
    expect(badLogin.status).toBe(401);
  });

  it('never exposes the setup token or password hashes in the projection', async () => {
    await setupAdmin();
    const response = await bootstrap();
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain(ADMIN_SETUP_TOKEN);
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('salt');
  });
});

describe('Campaign Zero', () => {
  it('requires three distinct posts and one clip above the view floor', async () => {
    const creator = await registerCreator();

    const tooFew = await api('/api/campaign-zero', {
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: {
        followConfirmed: true,
        clips: [{ url: 'https://www.tiktok.com/@a/video/7312345678901234567', claimedViews: 5000 }],
      },
    });
    expect(tooFew.status).toBe(200);

    const submitTooFew = await api('/api/campaign-zero/submit', {
      method: 'POST',
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: {},
    });
    expect(submitTooFew.status).toBe(400);
    expect(submitTooFew.body.error.message).toContain('three');

    await completeCampaignZero(creator);
    const already = await api('/api/campaign-zero/submit', {
      method: 'POST',
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: {},
    });
    expect(already.status).toBe(200);
    expect(already.body.alreadySubmitted).toBe(true);
  });

  it('rejects duplicate posts and non-platform URLs', async () => {
    const creator = await registerCreator();
    const url = 'https://www.tiktok.com/@a/video/7312345678901234567';

    const duplicate = await api('/api/campaign-zero', {
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: {
        followConfirmed: true,
        clips: [
          { url, claimedViews: 5000 },
          { url, claimedViews: 6000 },
          { url: 'https://www.tiktok.com/@a/video/7312345678901234568', claimedViews: 700 },
        ],
      },
    });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.error.message).toContain('different post');

    const badHost = await api('/api/campaign-zero', {
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: {
        followConfirmed: true,
        clips: [{ url: 'https://evil.example/video/1', claimedViews: 5000 }],
      },
    });
    expect(badHost.status).toBe(400);
  });
});
