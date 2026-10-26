import type { Ctx } from '../context.ts';
import type { AccountRow, Env, Role } from '../env.ts';
import { buildBootstrap } from '../projection.ts';
import {
  cookieSecurity,
  issueSession,
  newId,
  requireAccount,
  revokeSession,
  sessionCookieName,
  sessionTtlFor,
} from '../auth.ts';
import { dummyPasswordCheck, hashPassword, sha256Hex, verifyPassword } from '../crypto.ts';
import { clearRateLimit, consumeRateLimit } from '../rateLimit.ts';
import { recordAudit } from '../audit.ts';
import {
  badRequest,
  clearSessionCookie,
  forbidden,
  json,
  assertSameOrigin,
  serializeSessionCookie,
  tooMany,
  unauthorized,
} from '../http.ts';
import { normalizeHandle } from '../validation.ts';
import { body, guardMutation, hashIp, hashUserAgent } from './helpers.ts';

const PLATFORMS = ['TikTok', 'Instagram', 'YouTube', 'Facebook'] as const;
const MIN_PASSWORD = 12;
const MAX_PASSWORD = 200;

type Row = Record<string, unknown>;

function accountFromRow(row: Row): AccountRow {
  return {
    id: String(row.id),
    email: String(row.email),
    email_normalized: String(row.email_normalized),
    role: row.role as Role,
    status: row.status as AccountRow['status'],
    session_version: Number(row.session_version),
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  };
}

export async function findAccountByLogin(env: Env, identifier: string): Promise<AccountRow | null> {
  const value = identifier.trim();
  if (!value) return null;
  // A leading "@" means a handle, not an email address. Treating "@handle" as
  // an email made the most natural way to type a handle impossible to sign in.
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  const row = isEmail
    ? await env.DB.prepare(
        `SELECT * FROM accounts WHERE email_normalized = ? AND role <> 'business'`
      )
        .bind(value.toLowerCase())
        .first<Row>()
    : await env.DB.prepare(
        `SELECT a.* FROM accounts a
           JOIN creator_profiles p ON p.account_id = a.id
          WHERE p.handle_normalized = ? AND a.role = 'creator'`
      )
        .bind(normalizeHandle(value))
        .first<Row>();
  return row ? accountFromRow(row) : null;
}

async function startSession(
  ctx: Ctx,
  account: AccountRow
): Promise<{ response: Response; token: string }> {
  const session = await issueSession(ctx.env, account, {
    ipHash: await hashIp(ctx.env, ctx.request),
    userAgentHash: await hashUserAgent(ctx.request),
  });
  const bootstrap = await buildBootstrap(ctx.env, account, {
    csrfToken: session.csrfToken,
    sessionExpiresAt: session.expiresAt,
  });
  const secure = cookieSecurity(ctx.env, ctx.request).secure;
  const response = json(
    { ok: true, data: bootstrap },
    200,
    {
      'Set-Cookie': serializeSessionCookie(
        session.token,
        { maxAgeSeconds: session.ttlSeconds, secure },
        sessionCookieName(ctx.request)
      ),
    }
  );
  return { response, token: session.token };
}

/**
 * `handleApi` has already resolved the session for this request, so the
 * bootstrap handler reuses it instead of issuing a second session lookup.
 */
export async function handleBootstrap(ctx: Ctx): Promise<Response> {
  const bootstrap = await buildBootstrap(ctx.env, ctx.account, {
    csrfToken: ctx.session?.csrf_token ?? null,
    sessionExpiresAt: ctx.session?.expires_at ?? null,
  });
  return json({ ok: true, data: bootstrap });
}

export async function handleRegister(ctx: Ctx): Promise<Response> {
  // Defence in depth against cross-site registration/login CSRF. Browsers send
  // Origin on every POST; non-browser clients may omit it.
  assertSameOrigin(ctx.request, ctx.env.APP_ORIGIN);

  const limit = await consumeRateLimit(
    ctx.env,
    `register:${await hashIp(ctx.env, ctx.request)}`,
    5,
    60 * 60
  );
  if (!limit.allowed) throw tooMany('Too many sign-up attempts. Try again later.', limit.retryAfterSeconds);

  const input = await body<{
    name: string;
    email: string;
    handle: string;
    platform: (typeof PLATFORMS)[number];
    niche: string;
    followers: number;
    whatsappNumber: string;
    password: string;
  }>(ctx, {
    name: { type: 'string', required: true, min: 2, max: 120 },
    email: { type: 'email', required: true },
    handle: { type: 'string', required: true, min: 2, max: 60 },
    platform: { type: 'string', required: true, values: PLATFORMS },
    niche: { type: 'string', required: true, min: 2, max: 80 },
    followers: { type: 'int', required: true, min: 0, max: 100_000_000 },
    whatsappNumber: { type: 'string', required: true, min: 6, max: 32 },
    password: { type: 'string', required: true, min: MIN_PASSWORD, max: MAX_PASSWORD },
  });

  const handleBase = normalizeHandle(input.handle);
  if (!/^[a-z0-9._-]{2,40}$/.test(handleBase)) {
    throw badRequest('Handles may only contain letters, numbers, dots, dashes and underscores.');
  }

  const existingEmail = await ctx.env.DB.prepare(
    `SELECT id FROM accounts WHERE email_normalized = ?`
  )
    .bind(input.email)
    .first();
  if (existingEmail) throw badRequest('An account already exists for that email.');

  const existingHandle = await ctx.env.DB.prepare(
    `SELECT account_id FROM creator_profiles WHERE handle_normalized = ? AND platform = ?`
  )
    .bind(handleBase, input.platform)
    .first();
  if (existingHandle) throw badRequest('That handle is already in review for this platform.');

  const password = await hashPassword(input.password);
  const now = Date.now();
  const accountId = newId('acc');
  const displayHandle = `@${handleBase}`;

  try {
    await ctx.env.DB.batch([
      ctx.env.DB.prepare(
        `INSERT INTO accounts
           (id, email, email_normalized, password_hash, password_salt, password_iterations,
            role, status, session_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'creator', 'applied', 1, ?, ?)`
      ).bind(
        accountId,
        input.email.trim(),
        input.email,
        password.hash,
        password.salt,
        password.iterations,
        now,
        now
      ),
      ctx.env.DB.prepare(
        `INSERT INTO creator_profiles
           (account_id, display_name, handle, handle_normalized, platform, niche, followers,
            whatsapp_number, ecocash_number, campaign_zero_follow_confirmed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?)`
      ).bind(
        accountId,
        input.name,
        displayHandle,
        handleBase,
        input.platform,
        input.niche,
        input.followers,
        input.whatsappNumber,
        now,
        now
      ),
    ]);
  } catch (error) {
    console.warn('register conflict', error);
    throw badRequest('That email or handle is already registered.');
  }

  await recordAudit(ctx.env, {
    actorId: accountId,
    actorRole: 'creator',
    action: 'creator.register',
    entityType: 'account',
    entityId: accountId,
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  const account: AccountRow = {
    id: accountId,
    email: input.email.trim(),
    email_normalized: input.email,
    role: 'creator',
    status: 'applied',
    session_version: 1,
    created_at: now,
    updated_at: now,
  };
  const { response } = await startSession(ctx, account);
  return response;
}

export async function handleCreatorLogin(ctx: Ctx): Promise<Response> {
  assertSameOrigin(ctx.request, ctx.env.APP_ORIGIN);

  const ip = await hashIp(ctx.env, ctx.request);
  const ipLimit = await consumeRateLimit(ctx.env, `login:${ip}`, 20, 15 * 60);
  if (!ipLimit.allowed) {
    throw tooMany('Too many sign-in attempts. Try again shortly.', ipLimit.retryAfterSeconds);
  }

  const input = await body<{ identifier: string; password: string }>(ctx, {
    identifier: { type: 'string', required: true, min: 2, max: 254 },
    password: { type: 'string', required: true, min: 1, max: MAX_PASSWORD },
  });

  // Per-account throttle: the IP limit alone can be bypassed by a distributed
  // attacker. This caps guesses against one login across any number of IPs.
  const accountBucket = `login-account:${await sha256Hex(input.identifier.trim().toLowerCase())}`;
  const accountLimit = await consumeRateLimit(ctx.env, accountBucket, 30, 15 * 60);
  if (!accountLimit.allowed) {
    throw tooMany(
      'Too many sign-in attempts for this account. Try again shortly.',
      accountLimit.retryAfterSeconds
    );
  }

  const account = await findAccountByLogin(ctx.env, input.identifier);
  if (!account || account.role !== 'creator') {
    await dummyPasswordCheck(input.password);
    throw unauthorized('Email/handle or password is incorrect.');
  }

  const credential = await ctx.env.DB.prepare(
    `SELECT password_hash, password_salt, password_iterations FROM accounts WHERE id = ?`
  )
    .bind(account.id)
    .first<Row>();

  const valid = await verifyPassword(input.password, {
    hash: credential ? String(credential.password_hash ?? '') : null,
    salt: credential ? String(credential.password_salt ?? '') : null,
    iterations: credential?.password_iterations ? Number(credential.password_iterations) : null,
  });

  if (!valid) throw unauthorized('Email/handle or password is incorrect.');

  // A correct password clears the account throttle immediately.
  await clearRateLimit(ctx.env, accountBucket);
  if (account.status === 'suspended') throw forbidden('This account is suspended.');

  await ctx.env.DB.prepare(`UPDATE accounts SET last_login_at = ?, updated_at = ? WHERE id = ?`)
    .bind(Date.now(), Date.now(), account.id)
    .run();

  const { response } = await startSession(ctx, account);
  return response;
}

export async function handleAdminLogin(ctx: Ctx): Promise<Response> {
  assertSameOrigin(ctx.request, ctx.env.APP_ORIGIN);

  const ip = await hashIp(ctx.env, ctx.request);
  const limit = await consumeRateLimit(ctx.env, `admin-login:${ip}`, 5, 15 * 60);
  if (!limit.allowed) {
    throw tooMany('Too many attempts. Try again shortly.', limit.retryAfterSeconds);
  }

  const input = await body<{ email: string; password: string }>(ctx, {
    email: { type: 'email', required: true },
    password: { type: 'string', required: true, min: 1, max: MAX_PASSWORD },
  });

  const accountBucket = `admin-login-account:${await sha256Hex(input.email.trim().toLowerCase())}`;
  const accountLimit = await consumeRateLimit(ctx.env, accountBucket, 10, 15 * 60);
  if (!accountLimit.allowed) {
    throw tooMany(
      'Too many attempts for this account. Try again shortly.',
      accountLimit.retryAfterSeconds
    );
  }

  const row = await ctx.env.DB.prepare(
    `SELECT * FROM accounts WHERE email_normalized = ? AND role = 'admin'`
  )
    .bind(input.email)
    .first<Row>();

  if (!row) {
    await dummyPasswordCheck(input.password);
    throw unauthorized('Access denied. Check your credentials and try again.');
  }

  const account = accountFromRow(row);
  const valid = await verifyPassword(input.password, {
    hash: row.password_hash ? String(row.password_hash) : null,
    salt: row.password_salt ? String(row.password_salt) : null,
    iterations: row.password_iterations ? Number(row.password_iterations) : null,
  });

  if (!valid) throw unauthorized('Access denied. Check your credentials and try again.');

  await clearRateLimit(ctx.env, accountBucket);
  if (account.status !== 'approved') throw forbidden('This administrator account is not active.');

  await ctx.env.DB.prepare(`UPDATE accounts SET last_login_at = ?, updated_at = ? WHERE id = ?`)
    .bind(Date.now(), Date.now(), account.id)
    .run();

  await recordAudit(ctx.env, {
    actorId: account.id,
    actorRole: 'admin',
    action: 'admin.login',
    entityType: 'account',
    entityId: account.id,
    requestId: ctx.requestId,
    ipHash: ip,
  });

  const { response } = await startSession(ctx, account);
  return response;
}

export async function handleLogout(ctx: Ctx): Promise<Response> {
  // Always reject cross-site logout attempts, even when there is no session.
  assertSameOrigin(ctx.request, ctx.env.APP_ORIGIN);
  const secure = cookieSecurity(ctx.env, ctx.request).secure;

  if (!ctx.session) {
    return json({ ok: true }, 200, {
      'Set-Cookie': clearSessionCookie(secure, sessionCookieName(ctx.request)),
    });
  }
  guardMutation(ctx);
  await revokeSession(ctx.env, ctx.session.token_hash);
  return json({ ok: true }, 200, {
    'Set-Cookie': clearSessionCookie(secure),
  });
}

export async function handleChangePassword(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const { account, session } = requireAccount(ctx);

  // A stolen session must not be able to brute-force the current password.
  const limit = await consumeRateLimit(ctx.env, `password-change:${account.id}`, 5, 15 * 60);
  if (!limit.allowed) {
    throw tooMany('Too many password attempts. Try again shortly.', limit.retryAfterSeconds);
  }

  const input = await body<{ currentPassword: string; newPassword: string }>(ctx, {
    currentPassword: { type: 'string', required: true, min: 1, max: MAX_PASSWORD },
    newPassword: { type: 'string', required: true, min: MIN_PASSWORD, max: MAX_PASSWORD },
  });

  if (input.currentPassword === input.newPassword) {
    throw badRequest('Choose a password you have not used before.');
  }

  const credential = await ctx.env.DB.prepare(
    `SELECT password_hash, password_salt, password_iterations FROM accounts WHERE id = ?`
  )
    .bind(account.id)
    .first<Row>();

  const valid = await verifyPassword(input.currentPassword, {
    hash: credential ? String(credential.password_hash ?? '') : null,
    salt: credential ? String(credential.password_salt ?? '') : null,
    iterations: credential?.password_iterations ? Number(credential.password_iterations) : null,
  });
  if (!valid) throw forbidden('Your current password is incorrect.');

  const password = await hashPassword(input.newPassword);
  const now = Date.now();

  await ctx.env.DB.batch([
    ctx.env.DB.prepare(
      `UPDATE accounts
          SET password_hash = ?, password_salt = ?, password_iterations = ?,
              session_version = session_version + 1, updated_at = ?
        WHERE id = ?`
    ).bind(password.hash, password.salt, password.iterations, now, account.id),
    // Keep the current device signed in; every other session is revoked.
    ctx.env.DB.prepare(
      `UPDATE sessions SET revoked_at = ?
        WHERE account_id = ? AND token_hash <> ? AND revoked_at IS NULL`
    ).bind(now, account.id, session.token_hash),
  ]);

  await recordAudit(ctx.env, {
    actorId: account.id,
    actorRole: account.role,
    action: 'account.password.change',
    entityType: 'account',
    entityId: account.id,
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json({ ok: true });
}

export { sessionTtlFor };
