/**
 * MHOMHO API client.
 *
 * Every mutation goes through the Worker. The client never edits the read
 * model directly: after a successful mutation it refreshes the projection
 * from `GET /api/bootstrap`, so the numbers on screen are always the server's
 * numbers.
 *
 * Security notes:
 *   - the session cookie is HttpOnly and never visible here;
 *   - the CSRF token comes from the bootstrap payload and is sent as a header;
 *   - credentials are only posted to the same origin over the page's protocol;
 *   - uploads are validated again on the server (size, magic bytes, ownership).
 */

import {
  applyProjection,
  emptyDatabaseState,
  getDatabaseState,
  setDatabaseState,
  type ActivityItem,
  type BrandViewDoc,
  type CampaignMemberDetail,
  type DatabaseState,
  type Viewer,
} from './firebase.ts';
import type {
  AdminCommunityOverview,
  CommunityOverview,
  CommunityThreadDetail,
  CommunityThreadList,
  ForumCategory,
  ForumThreadStatus,
} from './community.ts';
import { clearSessionState, getCsrfToken, setSessionFromBootstrap } from './sessionStore.ts';

export interface ApiFailure {
  success: false;
  error: string;
  code?: string;
  status?: number;
  retryAfterSeconds?: number;
}

export type ApiResult<T = undefined> = { success: true; data?: T } | ApiFailure;

interface BootstrapPayload extends Partial<DatabaseState> {
  viewer: Viewer | null;
  csrfToken: string | null;
  sessionExpiresAt: number | null;
}

interface ApiEnvelope<T> {
  ok?: boolean;
  data?: T;
  token?: string;
  path?: string;
  assetId?: string;
  campaignId?: string;
  slug?: string;
  submissionId?: string;
  payoutId?: string;
  adminId?: string;
  error?: { code?: string; message?: string; details?: Record<string, unknown> };
}

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;

function errorMessage(payload: ApiEnvelope<unknown>, status: number): string {
  const message = payload?.error?.message;
  if (message) return message;
  if (status === 401) return 'Your session has expired. Sign in again.';
  if (status === 403) return 'You do not have access to this action.';
  if (status === 429) return 'Too many requests. Try again shortly.';
  return 'Something went wrong. Please try again.';
}

async function parseEnvelope(response: Response): Promise<ApiEnvelope<unknown>> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as ApiEnvelope<unknown>;
  } catch {
    return {};
  }
}

async function request<T = undefined>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) Object.assign(headers, JSON_HEADERS);

  const csrf = getCsrfToken();
  if (csrf && method !== 'GET') headers['X-CSRF-Token'] = csrf;

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { success: false, error: 'You appear to be offline. Check your connection and try again.' };
  }

  const payload = (await parseEnvelope(response)) as ApiEnvelope<T>;

  if (!response.ok) {
    if (response.status === 401) clearSessionState();
    const details = payload.error?.details ?? {};
    return {
      success: false,
      error: errorMessage(payload, response.status),
      code: payload.error?.code,
      status: response.status,
      retryAfterSeconds:
        typeof details.retryAfterSeconds === 'number' ? details.retryAfterSeconds : undefined,
    };
  }

  return { success: true, ...(payload.data !== undefined ? { data: payload.data } : {}) } as ApiResult<T>;
}

/* ------------------------------------------------------------------ */
/* Projection                                                          */
/* ------------------------------------------------------------------ */

function normaliseBootstrap(payload: Partial<DatabaseState>): DatabaseState {
  return {
    ...emptyDatabaseState(),
    ...payload,
    generatedAt: payload.generatedAt ?? Date.now(),
  } as DatabaseState;
}

export function applyBootstrap(payload: BootstrapPayload): DatabaseState {
  const state = normaliseBootstrap(payload);
  setDatabaseState(state);
  setSessionFromBootstrap(payload.viewer, payload.csrfToken, payload.sessionExpiresAt);
  return state;
}

/** Pull a fresh, role-scoped projection. Returns false when offline. */
export async function refreshData(): Promise<boolean> {
  const result = await request<BootstrapPayload>('GET', '/api/bootstrap');
  if (!result.success) return false;
  if (result.data) applyBootstrap(result.data);
  return true;
}

/** Initial load: anonymous callers still receive the published campaign feed. */
export async function initSession(): Promise<boolean> {
  return refreshData();
}

export async function apiHealth(): Promise<boolean> {
  const result = await request<unknown>('GET', '/api/health');
  return result.success;
}

/* ------------------------------------------------------------------ */
/* Authentication                                                      */
/* ------------------------------------------------------------------ */

export interface RegisterInput {
  name: string;
  email: string;
  handle: string;
  platform: 'TikTok' | 'Instagram' | 'YouTube' | 'Facebook';
  niche: string;
  followers: number;
  whatsappNumber: string;
  password: string;
}

export async function registerCreator(input: RegisterInput): Promise<ApiResult<{ uid: string }>> {
  const result = await request<BootstrapPayload>('POST', '/api/auth/register', input);
  if (!result.success) return result;
  if (result.data) {
    applyBootstrap(result.data);
    return { success: true, data: { uid: result.data.viewer?.uid ?? '' } };
  }
  return { success: true, data: { uid: '' } };
}

export async function loginCreator(
  identifier: string,
  password: string
): Promise<ApiResult<Viewer>> {
  const result = await request<BootstrapPayload>('POST', '/api/auth/login', {
    identifier,
    password,
  });
  if (!result.success) return result;
  if (!result.data) return { success: false, error: 'The server did not return a session.' };
  applyBootstrap(result.data);
  if (!result.data.viewer) return { success: false, error: 'Sign-in did not create a session.' };
  return { success: true, data: result.data.viewer };
}

export async function loginAdmin(email: string, password: string): Promise<ApiResult<Viewer>> {
  const result = await request<BootstrapPayload>('POST', '/api/auth/admin/login', {
    email,
    password,
  });
  if (!result.success) return result;
  if (!result.data) return { success: false, error: 'The server did not return a session.' };
  applyBootstrap(result.data);
  if (!result.data.viewer) return { success: false, error: 'Sign-in did not create a session.' };
  return { success: true, data: result.data.viewer };
}

export async function logout(): Promise<void> {
  try {
    await request('POST', '/api/auth/logout');
  } finally {
    clearSessionState();
    setDatabaseState(emptyDatabaseState());
  }
}

/* ------------------------------------------------------------------ */
/* Creator actions                                                     */
/* ------------------------------------------------------------------ */

export async function joinCampaign(campaignId: string): Promise<ApiResult> {
  const result = await request('POST', `/api/campaigns/${encodeURIComponent(campaignId)}/join`);
  if (result.success) await refreshData();
  return result;
}

export interface ClipSubmissionInput {
  platform: 'TikTok' | 'Instagram' | 'YouTube' | 'Facebook';
  postUrl: string;
  claimedViews: number;
  proofAssetId?: string | null;
}

export interface SubmitClipInput {
  campaignId: string;
  /** Legacy single-clip shape. Prefer `clips`. */
  platform?: 'TikTok' | 'Instagram' | 'YouTube' | 'Facebook';
  postUrl?: string;
  claimedViews?: number;
  proofAssetId?: string | null;
  /** Up to two clips, each on a different platform. */
  clips?: ClipSubmissionInput[];
}

export async function submitClip(input: SubmitClipInput): Promise<ApiResult<{ submissionId: string }>> {
  const result = await request<{ submissionId: string }>('POST', '/api/submissions', input);
  if (result.success) await refreshData();
  return result;
}

export interface CampaignZeroInput {
  followConfirmed: boolean;
  clips: Array<{ url: string; claimedViews: number }>;
}

export async function saveCampaignZero(input: CampaignZeroInput): Promise<ApiResult> {
  const result = await request('POST', '/api/campaign-zero', input);
  if (result.success) await refreshData();
  return result;
}

export async function submitCampaignZero(): Promise<ApiResult> {
  const result = await request('POST', '/api/campaign-zero/submit');
  if (result.success) await refreshData();
  return result;
}

export async function updateProfile(input: {
  whatsappNumber: string;
  ecoCashNumber: string;
  displayName?: string;
  niche?: string;
  followers?: number;
  platform?: 'TikTok' | 'Instagram' | 'YouTube' | 'Facebook';
  avatarKey?: string;
}): Promise<ApiResult> {
  const result = await request('PATCH', '/api/profile', input);
  if (result.success) await refreshData();
  return result;
}

export async function requestPayout(input: {
  amountCents: number;
  ecoCashNumber: string;
}): Promise<ApiResult> {
  const result = await request('POST', '/api/payouts', input);
  if (result.success) await refreshData();
  return result;
}

export async function settlePayout(
  payoutId: string,
  input: { status: 'paid' | 'cancelled' | 'failed'; reference?: string; failureReason?: string }
): Promise<ApiResult> {
  const result = await request(
    'PATCH',
    `/api/admin/payouts/${encodeURIComponent(payoutId)}`,
    input
  );
  if (result.success) await refreshData();
  return result;
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<ApiResult> {
  return request('POST', '/api/auth/password', input);
}

export async function deleteAccount(input: {
  password: string;
  confirm: string;
}): Promise<ApiResult> {
  const result = await request('POST', '/api/account/delete', input);
  if (result.success) {
    clearSessionState();
    await refreshData();
  }
  return result;
}

const PROOF_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

/**
 * Upload a proof screenshot. The server sniffs magic bytes and derives the
 * extension; the browser-supplied filename and MIME type are advisory only.
 */
export async function uploadProof(file: File): Promise<ApiResult<{ assetId: string }>> {
  if (file.size === 0) return { success: false, error: 'The selected file is empty.' };
  if (file.size > MAX_PROOF_BYTES) {
    return { success: false, error: 'Proof images must be under 5 MB.' };
  }
  if (!PROOF_TYPES.includes(file.type as (typeof PROOF_TYPES)[number])) {
    return { success: false, error: 'Proof must be a PNG, JPEG or WebP image.' };
  }

  const headers: Record<string, string> = {
    'Content-Type': file.type,
    Accept: 'application/json',
  };
  const csrf = getCsrfToken();
  if (!csrf) return { success: false, error: 'Sign in again before uploading.' };
  headers['X-CSRF-Token'] = csrf;

  let response: Response;
  try {
    response = await fetch('/api/uploads/proof', {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      body: file,
    });
  } catch {
    return { success: false, error: 'Upload failed. Check your connection and try again.' };
  }

  const payload = (await parseEnvelope(response)) as ApiEnvelope<unknown> & { assetId?: string };
  if (!response.ok) {
    return { success: false, error: errorMessage(payload, response.status), status: response.status };
  }
  if (!payload.assetId) return { success: false, error: 'The upload was not accepted.' };
  return { success: true, data: { assetId: payload.assetId } };
}

/* ------------------------------------------------------------------ */
/* Admin actions                                                       */
/* ------------------------------------------------------------------ */

export async function approveCreator(creatorId: string): Promise<ApiResult> {
  const result = await request(
    'POST',
    `/api/admin/creators/${encodeURIComponent(creatorId)}/approve`
  );
  if (result.success) await refreshData();
  return result;
}

export async function verifyClip(
  submissionId: string,
  observedViews: number,
  evidenceNote?: string
): Promise<ApiResult<{ earningsCents: number; shortfallCents: number }>> {
  const result = await request<{ earningsCents: number; shortfallCents: number }>(
    'POST',
    `/api/admin/submissions/${encodeURIComponent(submissionId)}/verify`,
    {
      observedViews,
      verifiedViews: observedViews,
      evidenceNote: evidenceNote?.trim() ? evidenceNote.trim() : undefined,
    }
  );
  if (result.success) await refreshData();
  return result;
}

export async function rejectClip(submissionId: string, note: string): Promise<ApiResult> {
  const result = await request(
    'POST',
    `/api/admin/submissions/${encodeURIComponent(submissionId)}/reject`,
    { note }
  );
  if (result.success) await refreshData();
  return result;
}

export async function recordPayout(input: {
  creatorId: string;
  amountCents: number;
  reference: string;
  method?: 'ecocash' | 'bank_transfer' | 'manual';
}): Promise<ApiResult<{ payoutId: string }>> {
  const result = await request<{ payoutId: string }>('POST', '/api/admin/payouts', {
    ...input,
    method: input.method ?? 'ecocash',
  });
  if (result.success) await refreshData();
  return result;
}

export interface CreateCampaignInput {
  title: string;
  brandName: string;
  niche: string;
  brief: string;
  budgetCents: number;
  requiredContent?: string | null;
  eligibility?: string | null;
  hookIdeas?: string[];
  doNots?: string[];
  startsAt?: number | null;
  endsAt?: number | null;
  perPostCapCents?: number | null;
  publishMode?: 'draft' | 'scheduled' | 'live';
}

export async function createCampaign(
  input: CreateCampaignInput
): Promise<ApiResult<{ campaignId: string; slug: string }>> {
  const result = await request<{ campaignId: string; slug: string }>(
    'POST',
    '/api/admin/campaigns',
    input
  );
  if (result.success) await refreshData();
  return result;
}

/**
 * Upload or replace a campaign poster. The server sniffs magic bytes and
 * derives the real type, exactly like the proof upload.
 */
export async function uploadCampaignPoster(
  campaignId: string,
  file: File
): Promise<ApiResult<{ assetId: string; url: string }>> {
  if (file.size === 0) return { success: false, error: 'The selected image is empty.' };
  if (file.size > MAX_PROOF_BYTES) {
    return { success: false, error: 'Campaign images must be under 5 MB.' };
  }
  if (!PROOF_TYPES.includes(file.type as (typeof PROOF_TYPES)[number])) {
    return { success: false, error: 'The campaign image must be a PNG, JPEG or WebP.' };
  }

  const csrf = getCsrfToken();
  if (!csrf) return { success: false, error: 'Sign in again before uploading.' };

  let response: Response;
  try {
    response = await fetch(
      `/api/admin/campaigns/${encodeURIComponent(campaignId)}/poster`,
      {
        method: 'POST',
        headers: {
          'Content-Type': file.type,
          Accept: 'application/json',
          'X-CSRF-Token': csrf,
        },
        credentials: 'same-origin',
        cache: 'no-store',
        body: file,
      }
    );
  } catch {
    return { success: false, error: 'Upload failed. Check your connection and try again.' };
  }

  const payload = (await parseEnvelope(response)) as ApiEnvelope<unknown> & {
    assetId?: string;
    url?: string;
  };
  if (!response.ok) {
    return { success: false, error: errorMessage(payload, response.status), status: response.status };
  }
  if (!payload.assetId) return { success: false, error: 'The upload was not accepted.' };
  await refreshData();
  return { success: true, data: { assetId: payload.assetId, url: payload.url ?? '' } };
}

export interface CampaignMembersResult {
  campaign: { id: string; title: string; status: string; startsAt: number | null; endsAt: number | null };
  total: number;
  limit: number;
  offset: number;
  members: CampaignMemberDetail[];
}

export async function fetchCampaignMembers(
  campaignId: string,
  options: { limit?: number; offset?: number; q?: string } = {}
): Promise<ApiResult<CampaignMembersResult>> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.offset) params.set('offset', String(options.offset));
  if (options.q?.trim()) params.set('q', options.q.trim());
  const query = params.toString();
  return request<CampaignMembersResult>(
    'GET',
    `/api/admin/campaigns/${encodeURIComponent(campaignId)}/members${query ? `?${query}` : ''}`
  );
}

export interface ActivityFeed {
  serverNow: number;
  nextSince: number;
  items: ActivityItem[];
}

/**
 * Recent sign-ups and campaign joins. `since` uses the server cursor returned
 * by the previous call; omit it on first load to replay the last 24 hours.
 */
export async function fetchActivity(since?: number | null): Promise<ApiResult<ActivityFeed>> {
  const query = since && since > 0 ? `?since=${Math.trunc(since)}` : '';
  return request<ActivityFeed>('GET', `/api/activity${query}`);
}

/* ------------------------------------------------------------------ */
/* Creator community                                                   */
/* ------------------------------------------------------------------ */

export async function fetchCommunityOverview(): Promise<ApiResult<CommunityOverview>> {
  return request<CommunityOverview>('GET', '/api/community');
}

export async function fetchCommunityThreads(
  options: { category?: ForumCategory | ''; offset?: number } = {}
): Promise<ApiResult<CommunityThreadList>> {
  const params = new URLSearchParams();
  if (options.category) params.set('category', options.category);
  if (options.offset) params.set('offset', String(options.offset));
  const query = params.toString();
  return request<CommunityThreadList>(
    'GET',
    `/api/community/threads${query ? `?${query}` : ''}`
  );
}

export async function fetchCommunityThread(
  threadId: string
): Promise<ApiResult<CommunityThreadDetail>> {
  return request<CommunityThreadDetail>(
    'GET',
    `/api/community/threads/${encodeURIComponent(threadId)}`
  );
}

export async function createCommunityThread(input: {
  category: ForumCategory;
  title: string;
  body: string;
}): Promise<ApiResult<{ threadId: string }>> {
  return request<{ threadId: string }>('POST', '/api/community/threads', input);
}

export async function replyToCommunityThread(
  threadId: string,
  body: string
): Promise<ApiResult<{ replyId: string }>> {
  return request<{ replyId: string }>(
    'POST',
    `/api/community/threads/${encodeURIComponent(threadId)}/replies`,
    { body }
  );
}

export async function fetchAdminCommunity(): Promise<ApiResult<AdminCommunityOverview>> {
  return request<AdminCommunityOverview>('GET', '/api/admin/community');
}

export async function moderateCommunityThread(
  threadId: string,
  input: { status?: ForumThreadStatus; pinned?: boolean }
): Promise<ApiResult> {
  return request('PATCH', `/api/admin/community/threads/${encodeURIComponent(threadId)}`, input);
}

export async function moderateCommunityReply(
  replyId: string,
  status: 'active' | 'hidden'
): Promise<ApiResult> {
  return request('PATCH', `/api/admin/community/replies/${encodeURIComponent(replyId)}`, { status });
}

export async function topUpCampaign(
  campaignId: string,
  amountCents: number,
  note?: string
): Promise<ApiResult<{ budgetCents: number; poolCents: number }>> {
  const result = await request<{ budgetCents: number; poolCents: number }>(
    'POST',
    `/api/admin/campaigns/${encodeURIComponent(campaignId)}/top-up`,
    { amountCents, note: note?.trim() ? note.trim() : undefined }
  );
  if (result.success) await refreshData();
  return result;
}

export async function setCampaignStatus(
  campaignId: string,
  status: string,
  note?: string
): Promise<ApiResult> {
  const result = await request(
    'PATCH',
    `/api/admin/campaigns/${encodeURIComponent(campaignId)}/status`,
    { status, note: note?.trim() ? note.trim() : undefined }
  );
  if (result.success) await refreshData();
  return result;
}

export async function createBrandToken(
  campaignId: string,
  label?: string,
  expiresInDays?: number
): Promise<ApiResult<{ token: string; path: string }>> {
  return request<{ token: string; path: string }>(
    'POST',
    `/api/admin/campaigns/${encodeURIComponent(campaignId)}/brand-token`,
    { label: label?.trim() ? label.trim() : undefined, expiresInDays }
  );
}

export async function updateEnquiryStatus(
  enquiryId: string,
  status: 'new' | 'contacted' | 'booked' | 'closed'
): Promise<ApiResult> {
  const result = await request('PATCH', `/api/admin/enquiries/${encodeURIComponent(enquiryId)}`, {
    status,
  });
  if (result.success) await refreshData();
  return result;
}

/* ------------------------------------------------------------------ */
/* Public actions                                                      */
/* ------------------------------------------------------------------ */

export interface EnquiryInput {
  bizName: string;
  contactName: string;
  phone: string;
  niche: string;
  promo: string;
  goals: string[];
  budget: string;
  start: string;
  bestTimes?: string[];
  notes?: string;
}

export async function createEnquiry(input: EnquiryInput): Promise<ApiResult> {
  return request('POST', '/api/enquiries', {
    ...input,
    notes: input.notes?.trim() ? input.notes.trim() : undefined,
    bestTimes: input.bestTimes ?? [],
  });
}

/**
 * Brand report links are tokenised. The server returns aggregates only; the
 * result is cached in the client projection under the token that was used.
 */
export async function fetchBrandReport(token: string): Promise<ApiResult<BrandViewDoc>> {
  const result = await request<BrandViewDoc>('GET', `/api/brand/${encodeURIComponent(token)}`);
  if (!result.success) return result;
  if (result.data) {
    applyProjection({ brandViews: { ...getDatabaseState().brandViews, [token]: result.data } });
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Support tickets                                                     */
/* ------------------------------------------------------------------ */

export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type SupportTicketCategory =
  | 'payments'
  | 'campaigns'
  | 'clips'
  | 'account'
  | 'technical'
  | 'other';

export interface SupportTicketCreator {
  uid: string;
  handle: string;
  name: string;
  email: string;
  platform: string;
}

export interface SupportTicketSummary {
  id: string;
  number: string;
  subject: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  priority: 'low' | 'normal' | 'high';
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number;
  closedAt: number | null;
  creator: SupportTicketCreator;
}

export interface SupportMessage {
  id: string;
  body: string;
  authorRole: 'creator' | 'admin';
  authorName: string;
  authorHandle: string;
  createdAt: number;
}

export interface SupportTicketList {
  tickets: SupportTicketSummary[];
  counts: Record<string, number>;
  nextOffset: number;
}

export async function fetchSupportTickets(
  params: { status?: string; q?: string; offset?: number } = {}
): Promise<ApiResult<SupportTicketList>> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.q?.trim()) query.set('q', params.q.trim());
  if (params.offset && params.offset > 0) query.set('offset', String(params.offset));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request<SupportTicketList>('GET', `/api/support/tickets${suffix}`);
}

export async function createSupportTicket(input: {
  category: SupportTicketCategory;
  subject: string;
  message: string;
}): Promise<ApiResult<{ ticket: SupportTicketSummary }>> {
  return request<{ ticket: SupportTicketSummary }>('POST', '/api/support/tickets', input);
}

export async function fetchSupportTicket(
  id: string
): Promise<ApiResult<{ ticket: SupportTicketSummary; messages: SupportMessage[] }>> {
  return request<{ ticket: SupportTicketSummary; messages: SupportMessage[] }>(
    'GET',
    `/api/support/tickets/${encodeURIComponent(id)}`
  );
}

export async function replySupportTicket(id: string, message: string): Promise<ApiResult> {
  return request('POST', `/api/support/tickets/${encodeURIComponent(id)}/messages`, { message });
}

export async function updateSupportTicket(
  id: string,
  input: { status?: SupportTicketStatus; priority?: 'low' | 'normal' | 'high' }
): Promise<ApiResult> {
  return request('PATCH', `/api/admin/support/tickets/${encodeURIComponent(id)}`, input);
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export type NotificationAudience =
  | 'creators'
  | 'approved_creators'
  | 'applicants'
  | 'account';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  audience: NotificationAudience;
  createdAt: number;
  readAt: number | null;
}

export interface NotificationList {
  items: NotificationItem[];
  unread: number;
}

export async function fetchNotifications(): Promise<ApiResult<NotificationList>> {
  return request<NotificationList>('GET', '/api/notifications');
}

export async function markNotificationRead(id: string): Promise<ApiResult> {
  return request('POST', `/api/notifications/${encodeURIComponent(id)}/read`);
}

export async function markAllNotificationsRead(): Promise<ApiResult> {
  return request('POST', '/api/notifications/read-all');
}

export async function sendNotification(input: {
  title: string;
  message: string;
  audience: NotificationAudience;
  accountId?: string;
}): Promise<ApiResult<{ notification: NotificationItem }>> {
  return request<{ notification: NotificationItem }>('POST', '/api/admin/notifications', {
    ...input,
    accountId: input.audience === 'account' ? input.accountId : undefined,
  });
}
