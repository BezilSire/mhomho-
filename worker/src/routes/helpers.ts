import type { Ctx } from '../context.ts';
import type { AccountRow, Env, Role } from '../env.ts';
import { assertCsrf, requireAccount } from '../auth.ts';
import { sha256Hex } from '../crypto.ts';
import { assertSameOrigin, badRequest, clientIp, readJson } from '../http.ts';
import type { Schema } from '../validation.ts';
import { validate } from '../validation.ts';

/** Privacy-preserving IP fingerprint. The raw address is never stored. */
export async function hashIp(env: Env, request: Request): Promise<string> {
  const peppered = `${env.IP_PEPPER ?? 'mhomho-no-pepper'}:${clientIp(request)}`;
  return (await sha256Hex(peppered)).slice(0, 32);
}

export async function hashUserAgent(request: Request): Promise<string> {
  return (await sha256Hex(request.headers.get('User-Agent') ?? 'unknown')).slice(0, 32);
}

/** Origin + CSRF checks for every state-changing authenticated request. */
export function guardMutation(ctx: Ctx): void {
  assertSameOrigin(ctx.request, ctx.env.APP_ORIGIN);
  assertCsrf(ctx);
}

export function requireCreator(ctx: Ctx): AccountRow {
  const { account } = requireAccount(ctx, ['creator']);
  if (account.status === 'suspended') {
    throw badRequest('This account is suspended.');
  }
  return account;
}

export function requireApprovedCreator(ctx: Ctx): AccountRow {
  const account = requireCreator(ctx);
  if (account.status !== 'approved') {
    throw badRequest('Your account must be approved before you can do this.');
  }
  return account;
}

export function requireAnyRole(ctx: Ctx, roles: Role[]): AccountRow {
  const { account } = requireAccount(ctx, roles);
  return account;
}

export async function body<T = Record<string, unknown>>(
  ctx: Ctx,
  schema: Schema,
  maxBytes = 64 * 1024
): Promise<T> {
  const raw = await readJson(ctx.request, maxBytes);
  return validate<T>(raw, schema);
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Mask a payout destination so the full number never reaches the client. */
export function maskDestination(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `•••• ${digits.slice(-4)}`;
}

export function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'campaign';
}
