import { adminSessionTtl, creatorSessionTtl, isProduction } from './env.ts';
import type { AccountRow, Env, Role, SessionRow } from './env.ts';
import { timingSafeEqual } from './crypto.ts';
import { forbidden, parseCookies, unauthorized } from './http.ts';
import type { Ctx } from './context.ts';
import { randomId, randomToken, sha256Hex } from './crypto.ts';

export const SESSION_COOKIE = 'mhomho_session';

/**
 * On HTTPS the session uses the `__Host-` prefix, which browsers only accept
 * with Secure, Path=/ and no Domain. That stops a compromised sibling
 * subdomain from planting or overwriting the cookie.
 */
export function sessionCookieName(request?: Request): string {
  return request?.url.startsWith('https://') ? '__Host-mhomho_session' : SESSION_COOKIE;
}

export interface IssuedSession {
  token: string;
  csrfToken: string;
  expiresAt: number;
  ttlSeconds: number;
}

export function sessionTtlFor(env: Env, role: Role): number {
  return role === 'admin' ? adminSessionTtl(env) : creatorSessionTtl(env);
}

/**
 * Issues an opaque session token. Only the SHA-256 of the token is stored, so a
 * database leak cannot be replayed as a live session.
 */
export async function issueSession(
  env: Env,
  account: AccountRow,
  meta: { ipHash: string | null; userAgentHash: string | null }
): Promise<IssuedSession> {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const csrfToken = randomToken(24);
  const now = Date.now();
  const ttlSeconds = sessionTtlFor(env, account.role);
  const expiresAt = now + ttlSeconds * 1000;

  await env.DB.prepare(
    `INSERT INTO sessions (token_hash, account_id, role, csrf_token, created_at, expires_at, last_seen_at, ip_hash, user_agent_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      tokenHash,
      account.id,
      account.role,
      csrfToken,
      now,
      expiresAt,
      now,
      meta.ipHash,
      meta.userAgentHash
    )
    .run();

  // Opportunistic cleanup of this account's expired sessions.
  await env.DB.prepare(
    `DELETE FROM sessions WHERE account_id = ? AND (expires_at < ? OR revoked_at IS NOT NULL)`
  )
    .bind(account.id, now)
    .run();

  return { token, csrfToken, expiresAt, ttlSeconds };
}

export interface Authenticated {
  account: AccountRow;
  session: SessionRow;
}

export async function readSession(env: Env, request: Request): Promise<Authenticated | null> {
  const token = parseCookies(request)[sessionCookieName(request)];
  if (!token || token.length < 20 || token.length > 200) return null;

  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT s.token_hash, s.account_id, s.role, s.csrf_token, s.created_at, s.expires_at,
            s.last_seen_at, s.revoked_at,
            a.id AS a_id, a.email, a.email_normalized, a.role AS a_role, a.status,
            a.session_version, a.created_at AS a_created_at, a.updated_at AS a_updated_at
       FROM sessions s
       JOIN accounts a ON a.id = s.account_id
      WHERE s.token_hash = ?`
  )
    .bind(tokenHash)
    .first<Record<string, unknown>>();

  if (!row) return null;

  const now = Date.now();
  const expiresAt = Number(row.expires_at);
  const revokedAt = row.revoked_at === null ? null : Number(row.revoked_at);
  if (revokedAt !== null || expiresAt <= now) return null;
  if (row.role !== row.a_role) return null;
  if (row.status === 'suspended') return null;

  const account: AccountRow = {
    id: String(row.a_id),
    email: String(row.email),
    email_normalized: String(row.email_normalized),
    role: row.a_role as Role,
    status: row.status as AccountRow['status'],
    session_version: Number(row.session_version),
    created_at: Number(row.a_created_at),
    updated_at: Number(row.a_updated_at),
  };

  const session: SessionRow = {
    token_hash: String(row.token_hash),
    account_id: String(row.account_id),
    role: row.role as Role,
    csrf_token: String(row.csrf_token),
    created_at: Number(row.created_at),
    expires_at: expiresAt,
    last_seen_at: Number(row.last_seen_at),
    revoked_at: revokedAt,
  };

  // Touch at most once per minute to avoid a write on every request.
  if (now - session.last_seen_at > 60_000) {
    await env.DB.prepare(`UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?`)
      .bind(now, tokenHash)
      .run();
  }

  return { account, session };
}

export function requireAccount(ctx: Ctx, roles?: Role[]): { account: AccountRow; session: SessionRow } {
  if (!ctx.account || !ctx.session) throw unauthorized();
  if (roles && !roles.includes(ctx.account.role)) throw forbidden();
  return { account: ctx.account, session: ctx.session };
}

export function requireAdmin(ctx: Ctx): AccountRow {
  const { account } = requireAccount(ctx, ['admin']);
  if (account.status !== 'approved') throw forbidden('Administrator account is not active.');
  return account;
}

/**
 * CSRF double-submit: the token lives in the session row (server) and is sent
 * back by the SPA in a header. Combined with SameSite=Lax and the Origin check
 * this blocks cross-site form/fetch submissions.
 */
export function assertCsrf(ctx: Ctx): void {
  if (!ctx.session) throw unauthorized();
  const header = ctx.request.headers.get('X-CSRF-Token') ?? '';
  if (!header || !timingSafeEqual(header, ctx.session.csrf_token)) {
    throw forbidden('Invalid or missing CSRF token. Refresh and try again.');
  }
}

export async function revokeSession(env: Env, tokenHash: string): Promise<void> {
  await env.DB.prepare(`UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL`)
    .bind(Date.now(), tokenHash)
    .run();
}

export async function revokeAllSessions(env: Env, accountId: string): Promise<void> {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(`UPDATE accounts SET session_version = session_version + 1, updated_at = ? WHERE id = ?`).bind(
      now,
      accountId
    ),
    env.DB.prepare(
      `UPDATE sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL`
    ).bind(now, accountId),
  ]);
}

export function cookieSecurity(env: Env, request?: Request): { secure: boolean } {
  // Fail safe: an HTTPS request always gets a Secure cookie, even if
  // ENVIRONMENT is accidentally left as "development" on a deployment.
  const https = request ? request.url.startsWith('https://') : false;
  return { secure: isProduction(env) || https };
}

export function newId(prefix: string): string {
  return randomId(prefix);
}

