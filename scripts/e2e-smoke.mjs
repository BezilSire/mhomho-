#!/usr/bin/env node
/**
 * End-to-end smoke test against a running build.
 *
 * It exercises the deployed bundle (Worker + static assets) over real HTTP,
 * including cookies, CSRF and the money flow. It is intentionally separate from
 * the Vitest suite, which runs in-process against the same Worker.
 *
 * Usage:
 *   npm run build
 *   npx wrangler dev --port 8787 --var APP_ORIGIN:http://127.0.0.1:8787
 *   node scripts/e2e-smoke.mjs
 *
 * The Worker must have ADMIN_SETUP_TOKEN set (see .dev.vars).
 */
const base = (process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const setupToken = process.env.E2E_ADMIN_SETUP_TOKEN ?? 'local-dev-admin-setup-token-0001';

const results = [];
let failed = 0;

function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
  if (!condition) failed += 1;
}

async function call(path, options = {}) {
  const headers = { Origin: base };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.cookie) headers.Cookie = options.cookie;
  if (options.csrf) headers['X-CSRF-Token'] = options.csrf;
  if (options.headers) Object.assign(headers, options.headers);

  const response = await fetch(`${base}${path}`, {
    method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: 'manual',
  });

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return {
    status: response.status,
    json,
    text,
    headers: response.headers,
    setCookies: response.headers.getSetCookie?.() ?? [],
  };
}

function sessionCookie(response) {
  const header = response.setCookies.find((value) => value.startsWith('mhomho_session='));
  return header ? header.split(';')[0] : null;
}

const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function main() {
  // 1. Static app shell + SPA fallback
  const shell = await call('/');
  check('GET / serves the app shell', shell.status === 200 && shell.text.includes('Mhomho'));
  check(
    'Static shell is HTML',
    (shell.headers.get('Content-Type') ?? '').includes('text/html'),
    shell.headers.get('Content-Type') ?? ''
  );
  check('Static shell sends X-Frame-Options', shell.headers.get('X-Frame-Options') === 'DENY');
  check(
    'Static shell sends a CSP',
    (shell.headers.get('Content-Security-Policy') ?? '').includes("default-src 'self'")
  );

  const deepLink = await call('/creator/earnings');
  check('SPA fallback serves deep links', deepLink.status === 200 && deepLink.text.includes('<div id="root">'));

  // 2. API health and anonymous projection
  const health = await call('/api/health');
  check('API health', health.status === 200 && health.json?.ok === true);

  const anonymous = await call('/api/bootstrap');
  check('Anonymous bootstrap has no viewer', anonymous.json?.data?.viewer === null);
  check(
    'Anonymous bootstrap exposes no creator PII',
    JSON.stringify(anonymous.json?.data?.creatorsPrivate ?? {}) === '{}'
  );

  // 3. First administrator
  const setup = await call('/api/setup/admin', {
    body: { setupToken: setupToken, email: 'e2e-admin@mhomho.test', password: 'e2e-admin-password-123' },
  });
  // 409 means an administrator already exists (repeat run against the same
  // local database). The login below still has to succeed, so this stays safe.
  check(
    'One-time admin setup (or already configured)',
    setup.status === 201 || setup.status === 409,
    `status ${setup.status}`
  );

  const adminLogin = await call('/api/auth/admin/login', {
    body: { email: 'e2e-admin@mhomho.test', password: 'e2e-admin-password-123' },
  });
  const adminCookie = sessionCookie(adminLogin);
  const adminCsrf = adminLogin.json?.data?.csrfToken;
  check('Admin login issues a session', adminLogin.status === 200 && Boolean(adminCookie && adminCsrf));

  // 4. Campaign
  const campaign = await call('/api/admin/campaigns', {
    cookie: adminCookie,
    csrf: adminCsrf,
    body: {
      title: `E2E Campaign ${unique}`,
      brandName: 'E2E Brand',
      niche: 'Beauty',
      brief: 'End-to-end verification campaign created by the smoke script.',
      budgetCents: 25000,
    },
  });
  const campaignId = campaign.json?.campaignId;
  check('Admin creates a campaign', campaign.status === 201 && Boolean(campaignId), `status ${campaign.status}`);

  // 5. Creator onboarding
  const email = `e2e-${unique}@example.test`;
  const handle = `e2e${unique}`;
  const register = await call('/api/auth/register', {
    body: {
      name: 'E2E Creator',
      email,
      handle,
      platform: 'TikTok',
      niche: 'Beauty',
      followers: 5000,
      whatsappNumber: '+263771234567',
      password: 'e2e-creator-password-123',
    },
  });
  const creatorCookie = sessionCookie(register);
  const creatorCsrf = register.json?.data?.csrfToken;
  const creatorId = register.json?.data?.viewer?.uid;
  check('Creator registers', register.status === 200 && Boolean(creatorCookie && creatorCsrf));

  const stamp = Date.now();
  const zero = await call('/api/campaign-zero', {
    cookie: creatorCookie,
    csrf: creatorCsrf,
    body: {
      followConfirmed: true,
      clips: [
        { url: `https://www.tiktok.com/@e2e/video/${stamp}1`, claimedViews: 5000 },
        { url: `https://www.instagram.com/reel/Ce2e${stamp}/`, claimedViews: 1500 },
        { url: `https://youtu.be/e2e${stamp}`, claimedViews: 900 },
      ],
    },
  });
  check('Campaign Zero saves three clips', zero.status === 200);

  const zeroSubmit = await call('/api/campaign-zero/submit', {
    cookie: creatorCookie,
    csrf: creatorCsrf,
    body: {},
  });
  check('Campaign Zero submits for review', zeroSubmit.status === 200);

  const approve = await call(`/api/admin/creators/${creatorId}/approve`, {
    cookie: adminCookie,
    csrf: adminCsrf,
    body: {},
  });
  check('Admin approves the creator', approve.status === 200);

  // 6. CSRF enforcement on the live bundle
  const noCsrf = await call(`/api/campaigns/${campaignId}/join`, {
    cookie: creatorCookie,
    body: {},
  });
  check('Join without CSRF is refused', noCsrf.status === 403);

  const join = await call(`/api/campaigns/${campaignId}/join`, {
    cookie: creatorCookie,
    csrf: creatorCsrf,
    body: {},
  });
  check('Creator joins the campaign', join.status === 200);

  const submit = await call('/api/submissions', {
    cookie: creatorCookie,
    csrf: creatorCsrf,
    body: {
      campaignId,
      platform: 'TikTok',
      postUrl: `https://www.tiktok.com/@e2e/video/${stamp}99`,
      claimedViews: 8200,
    },
  });
  check('Creator submits a clip', submit.status === 201, `status ${submit.status}`);

  const verify = await call(`/api/admin/submissions/${submit.json?.submissionId}/verify`, {
    cookie: adminCookie,
    csrf: adminCsrf,
    body: { observedViews: 8200, evidenceNote: 'Manual check of the public counter.' },
  });
  check(
    'Admin verifies views and earnings are computed server-side',
    verify.status === 200 && verify.json?.earningsCents === 820,
    `status ${verify.status} earnings ${verify.json?.earningsCents}`
  );

  // 7. Creator sees the balance
  const creatorView = await call('/api/bootstrap', { cookie: creatorCookie });
  check('Creator balance reflects verified earnings', creatorView.json?.data?.viewer?.balances?.owedCents === 820);

  // 8. Brand report
  const token = await call(`/api/admin/campaigns/${campaignId}/brand-token`, {
    cookie: adminCookie,
    csrf: adminCsrf,
    body: { label: 'E2E report', expiresInDays: 7 },
  });
  const brand = await call(`/api/brand/${token.json?.token}`);
  check('Brand report resolves', brand.status === 200);
  check('Brand report shows verified views', brand.json?.data?.verifiedViews === 8200);
  check('Brand report omits creator email', !brand.text.includes(email));

  // 9. Payout
  const payout = await call('/api/admin/payouts', {
    cookie: adminCookie,
    csrf: adminCsrf,
    body: { creatorId, amountCents: 820, reference: `E2E-${unique}` },
  });
  check('Admin records a payout', payout.status === 201, `status ${payout.status}`);

  const afterPayout = await call('/api/bootstrap', { cookie: creatorCookie });
  check('Balance is zero after payout', afterPayout.json?.data?.viewer?.balances?.owedCents === 0);

  const replay = await call('/api/admin/payouts', {
    cookie: adminCookie,
    csrf: adminCsrf,
    body: { creatorId, amountCents: 500, reference: `E2E-${unique}` },
  });
  check('Replaying a payout reference is refused', replay.status === 409, `status ${replay.status}`);

  // 10. Logout revokes the session
  const logout = await call('/api/auth/logout', {
    cookie: creatorCookie,
    csrf: creatorCsrf,
    body: {},
  });
  check('Logout succeeds', logout.status === 200);
  const afterLogout = await call('/api/bootstrap', { cookie: creatorCookie });
  check('Session is revoked after logout', afterLogout.json?.data?.viewer === null);
}

try {
  await main();
} catch (error) {
  failed += 1;
  results.push({ name: 'Unexpected error', ok: false, detail: String(error) });
}

const width = Math.max(...results.map((result) => result.name.length));
for (const result of results) {
  const label = result.ok ? 'PASS' : 'FAIL';
  console.log(`${label}  ${result.name.padEnd(width)}  ${result.detail}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed === 0 ? 0 : 1);
