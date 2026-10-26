/**
 * Shared helpers for the Worker integration tests.
 *
 * Every helper drives the real HTTP surface through `SELF.fetch`, so routing,
 * authentication, CSRF, validation and D1 triggers are all exercised. Nothing
 * is stubbed.
 */
import { SELF, env } from 'cloudflare:test';
import type { Env } from '../worker/src/env.ts';

export const APP_ORIGIN = 'http://localhost:3000';
export const ADMIN_SETUP_TOKEN = 'test-admin-setup-token-value-0001';
export const ADMIN_EMAIL = 'admin@mhomho.test';
export const ADMIN_PASSWORD = 'admin-password-12345';

export const testEnv = env as unknown as Env;

let ipSequence = 0;
/** A fresh client IP so per-IP rate limits never interfere between tests. */
export function freshIp(): string {
  ipSequence += 1;
  return `198.51.100.${(ipSequence % 200) + 1}`;
}

let uniqueSequence = 0;
export function unique(prefix: string): string {
  uniqueSequence += 1;
  return `${prefix}-${uniqueSequence}-${Math.floor(Math.random() * 1e6)}`;
}

export interface ApiResponse {
  status: number;
  body: any;
  headers: Headers;
}

export interface ApiOptions {
  method?: string;
  body?: unknown;
  cookie?: string | null;
  csrf?: string | null;
  origin?: string | null;
  ip?: string;
  headers?: Record<string, string>;
  rawBody?: BodyInit;
}

export async function api(path: string, options: ApiOptions = {}): Promise<ApiResponse> {
  const headers = new Headers(options.headers);
  headers.set('CF-Connecting-IP', options.ip ?? freshIp());
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.cookie) headers.set('Cookie', options.cookie);
  if (options.csrf) headers.set('X-CSRF-Token', options.csrf);
  if (options.origin !== null) headers.set('Origin', options.origin ?? APP_ORIGIN);

  const request = new Request(`${APP_ORIGIN}${path}`, {
    method: options.method ?? (options.body !== undefined || options.rawBody ? 'POST' : 'GET'),
    headers,
    body:
      options.rawBody !== undefined
        ? options.rawBody
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
  });

  const response = await SELF.fetch(request);
  const text = await response.text();
  let body: any = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: response.status, body, headers: response.headers };
}

export function sessionCookie(response: ApiResponse): string {
  const header = response.headers.get('Set-Cookie') ?? '';
  const match = header.match(/mhomho_session=[^;]+/);
  if (!match) throw new Error(`No session cookie in response: ${header || '<none>'}`);
  return match[0];
}

export interface Session {
  cookie: string;
  csrf: string;
  accountId: string;
  email: string;
  status: string;
}

function toSession(response: ApiResponse, email: string): Session {
  const data = response.body?.data;
  if (!data?.viewer) throw new Error(`Expected a session bootstrap: ${JSON.stringify(response.body)}`);
  return {
    cookie: sessionCookie(response),
    csrf: data.csrfToken,
    accountId: data.viewer.uid,
    email,
    status: data.viewer.status,
  };
}

export async function bootstrap(cookie?: string | null): Promise<ApiResponse> {
  return api('/api/bootstrap', { method: 'GET', cookie: cookie ?? null });
}

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */

export async function setupAdmin(): Promise<Session> {
  const setup = await api('/api/setup/admin', {
    body: { setupToken: ADMIN_SETUP_TOKEN, email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (setup.status !== 201) {
    throw new Error(`Admin setup failed: ${setup.status} ${JSON.stringify(setup.body)}`);
  }
  return adminLogin();
}

export async function adminLogin(): Promise<Session> {
  const response = await api('/api/auth/admin/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (response.status !== 200) {
    throw new Error(`Admin login failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return toSession(response, ADMIN_EMAIL);
}

export interface CreatorOptions {
  email?: string;
  handle?: string;
  password?: string;
  followers?: number;
  platform?: 'TikTok' | 'Instagram' | 'YouTube' | 'Facebook';
}

export async function registerCreator(options: CreatorOptions = {}): Promise<Session> {
  const email = options.email ?? `${unique('creator')}@example.test`;
  const handle = options.handle ?? unique('creator');
  const response = await api('/api/auth/register', {
    body: {
      name: 'Test Creator',
      email,
      handle,
      platform: options.platform ?? 'TikTok',
      niche: 'Beauty',
      followers: options.followers ?? 4000,
      whatsappNumber: '+263771234567',
      password: options.password ?? 'creator-password-123',
    },
  });
  if (response.status !== 200) {
    throw new Error(`Register failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return toSession(response, email);
}

export async function creatorLogin(email: string, password: string): Promise<ApiResponse> {
  return api('/api/auth/login', { body: { identifier: email, password } });
}

let postSequence = 0;
export function postUrl(platform: 'TikTok' | 'Instagram' | 'YouTube' | 'Facebook' = 'TikTok'): string {
  postSequence += 1;
  const id = `${Date.now()}${String(postSequence).padStart(6, '0')}`;
  switch (platform) {
    case 'Instagram':
      return `https://www.instagram.com/reel/C${id}/`;
    case 'YouTube':
      return `https://www.youtube.com/shorts/${id}`;
    case 'Facebook':
      return `https://www.facebook.com/reel/${id}`;
    default:
      return `https://www.tiktok.com/@mhomho/video/${id}`;
  }
}

/** Completes Campaign Zero so an administrator can approve the creator. */
export async function completeCampaignZero(creator: Session): Promise<void> {
  const save = await api('/api/campaign-zero', {
    cookie: creator.cookie,
    csrf: creator.csrf,
    body: {
      followConfirmed: true,
      clips: [
        { url: postUrl('TikTok'), claimedViews: 5000 },
        { url: postUrl('Instagram'), claimedViews: 1200 },
        { url: postUrl('YouTube'), claimedViews: 800 },
      ],
    },
  });
  if (save.status !== 200) {
    throw new Error(`Campaign Zero save failed: ${save.status} ${JSON.stringify(save.body)}`);
  }
  const submit = await api('/api/campaign-zero/submit', {
    method: 'POST',
    cookie: creator.cookie,
    csrf: creator.csrf,
    body: {},
  });
  if (submit.status !== 200) {
    throw new Error(`Campaign Zero submit failed: ${submit.status} ${JSON.stringify(submit.body)}`);
  }
}

export async function approveCreator(admin: Session, creatorId: string): Promise<void> {
  const response = await api(`/api/admin/creators/${creatorId}/approve`, {
    method: 'POST',
    cookie: admin.cookie,
    csrf: admin.csrf,
    body: {},
  });
  if (response.status !== 200) {
    throw new Error(`Approve failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
}

/** Registers, completes Campaign Zero and approves a creator. */
export async function approvedCreator(
  admin: Session,
  options: CreatorOptions = {}
): Promise<Session> {
  const creator = await registerCreator(options);
  await completeCampaignZero(creator);
  await approveCreator(admin, creator.accountId);
  return { ...creator, status: 'approved' };
}

export async function createCampaign(
  admin: Session,
  options: { budgetCents?: number; title?: string } = {}
): Promise<{ id: string; slug: string }> {
  const response = await api('/api/admin/campaigns', {
    cookie: admin.cookie,
    csrf: admin.csrf,
    body: {
      title: options.title ?? unique('Campaign'),
      brandName: 'Test Brand',
      niche: 'Beauty',
      brief: 'Post a short clip showing the product in daily use and tag the brand.',
      budgetCents: options.budgetCents ?? 25_000,
      hookIdeas: ['Morning routine'],
      doNots: ['No competitor mentions'],
    },
  });
  if (response.status !== 201) {
    throw new Error(`Create campaign failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return { id: response.body.campaignId, slug: response.body.slug };
}

export async function joinCampaign(creator: Session, campaignId: string): Promise<ApiResponse> {
  return api(`/api/campaigns/${campaignId}/join`, {
    method: 'POST',
    cookie: creator.cookie,
    csrf: creator.csrf,
    body: {},
  });
}

export async function submitClip(
  creator: Session,
  campaignId: string,
  options: { url?: string; claimedViews?: number; proofAssetId?: string | null } = {}
): Promise<ApiResponse> {
  return api('/api/submissions', {
    cookie: creator.cookie,
    csrf: creator.csrf,
    body: {
      campaignId,
      platform: 'TikTok',
      postUrl: options.url ?? postUrl('TikTok'),
      claimedViews: options.claimedViews ?? 5000,
      proofAssetId: options.proofAssetId ?? null,
    },
  });
}

export async function verifySubmission(
  admin: Session,
  submissionId: string,
  observedViews: number
): Promise<ApiResponse> {
  return api(`/api/admin/submissions/${submissionId}/verify`, {
    cookie: admin.cookie,
    csrf: admin.csrf,
    body: { observedViews, evidenceNote: 'Checked the public counter manually.' },
  });
}

export async function recordPayout(
  admin: Session,
  creatorId: string,
  amountCents: number,
  reference: string
): Promise<ApiResponse> {
  return api('/api/admin/payouts', {
    cookie: admin.cookie,
    csrf: admin.csrf,
    body: { creatorId, amountCents, reference },
  });
}

/* ------------------------------------------------------------------ */
/* Direct D1 reads for assertions                                      */
/* ------------------------------------------------------------------ */

export async function counters(campaignId: string): Promise<{
  committed_cents: number;
  shortfall_cents: number;
  verified_views: number;
  eligible_views: number;
  joined_count: number;
  approved_submissions: number;
  paid_cents: number;
}> {
  const row = await testEnv.DB.prepare(`SELECT * FROM campaign_counters WHERE campaign_id = ?`)
    .bind(campaignId)
    .first<Record<string, number>>();
  if (!row) throw new Error(`No counters for campaign ${campaignId}`);
  return row as any;
}

export async function ledgerSum(creatorId: string): Promise<number> {
  const row = await testEnv.DB.prepare(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM earnings_ledger WHERE creator_id = ?`
  )
    .bind(creatorId)
    .first<{ total: number }>();
  return Number(row?.total ?? 0);
}

export async function campaignRow(campaignId: string): Promise<Record<string, any>> {
  const row = await testEnv.DB.prepare(`SELECT * FROM campaigns WHERE id = ?`)
    .bind(campaignId)
    .first<Record<string, any>>();
  if (!row) throw new Error(`No campaign ${campaignId}`);
  return row;
}

/** A 1x1 PNG, sufficient for magic-byte detection. */
export const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);
