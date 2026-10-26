/**
 * Cloudflare bindings and configuration for the MHOMHO Worker.
 *
 * Secrets are configured with `wrangler secret put` and are never present in
 * source control or in the client bundle:
 *   ADMIN_SETUP_TOKEN  one-time token used to create the first admin account
 *   IP_PEPPER          optional server-side pepper for hashing IPs
 *   ADMIN_PATH         secret suffix for the operations console (/console/<value>)
 */
export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS: Fetcher;

  ENVIRONMENT: string;
  APP_ORIGIN: string;
  SESSION_TTL_CREATOR_SECONDS: string;
  SESSION_TTL_ADMIN_SECONDS: string;
  MAX_UPLOAD_BYTES: string;
  /** "false" hides the public landing-page activity feed. Defaults to on. */
  PUBLIC_ACTIVITY?: string;

  ADMIN_SETUP_TOKEN?: string;
  IP_PEPPER?: string;
  /**
   * Secret suffix for the operations console. The shell is served only at
   * `/console/<ADMIN_PATH>`; every other `/console/*` request is a 404.
   */
  ADMIN_PATH?: string;
}

export type Role = 'creator' | 'admin' | 'business';

export interface AccountRow {
  id: string;
  email: string;
  email_normalized: string;
  role: Role;
  status: 'applied' | 'approved' | 'rejected' | 'suspended';
  session_version: number;
  created_at: number;
  updated_at: number;
}

export interface SessionRow {
  token_hash: string;
  account_id: string;
  role: Role;
  csrf_token: string;
  created_at: number;
  expires_at: number;
  last_seen_at: number;
  revoked_at: number | null;
}

export function isProduction(env: Env): boolean {
  return env.ENVIRONMENT === 'production';
}

export function creatorSessionTtl(env: Env): number {
  return clampInt(env.SESSION_TTL_CREATOR_SECONDS, 600, 86_400, 28_800);
}

export function adminSessionTtl(env: Env): number {
  return clampInt(env.SESSION_TTL_ADMIN_SECONDS, 300, 3_600, 1_800);
}

export function maxUploadBytes(env: Env): number {
  return clampInt(env.MAX_UPLOAD_BYTES, 1024, 10 * 1024 * 1024, 5 * 1024 * 1024);
}

export function clampInt(
  raw: string | number | undefined | null,
  min: number,
  max: number,
  fallback: number
): number {
  const value = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
