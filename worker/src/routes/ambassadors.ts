import type { Ctx } from '../context.ts';
import type { AccountRow, Env } from '../env.ts';
import { maxUploadBytes } from '../env.ts';
import {
  newId,
  requireAccount,
  requireAdmin,
} from '../auth.ts';
import { dummyPasswordCheck, hashPassword, sha256Hex, verifyPassword } from '../crypto.ts';
import { recordAudit } from '../audit.ts';
import {
  assertSameOrigin,
  badRequest,
  conflict,
  forbidden,
  json,
  notFound,
  readJson,
  tooMany,
  unauthorized,
} from '../http.ts';
import { consumeRateLimit } from '../rateLimit.ts';
import { validate } from '../validation.ts';
import { body, guardMutation, hashIp, slugify } from './helpers.ts';
import { startSession } from './auth.ts';

type Row = Record<string, unknown>;

const MIN_PASSWORD = 12;
const MAX_PASSWORD = 200;
const MAX_DOCUMENTS = 5;
const OFFICIAL_TITLE = 'MHOMHO Commercial Envoy';
const OFFICIAL_DESCRIPTION =
  'MHOMHO is a Zimbabwean media and creator platform connecting brands with local creators. ' +
  'MHOMHO Ambassadors are formally appointed commercial representatives who introduce ' +
  'credible businesses to the MHOMHO network.';

const SOCIAL_KEYS = [
  'linkedin',
  'instagram',
  'x',
  'facebook',
  'tiktok',
  'youtube',
  'website',
] as const;

/** Route words that must never become a public profile username. */
const RESERVED_USERNAMES = new Set([
  'apply',
  'portal',
  'login',
  'admin',
  'api',
  'ambassadors',
  'envoys',
  'profile',
  'signin',
  'sign-in',
  'register',
]);

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function jsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function jsonObject(value: unknown): Record<string, string> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const out: Record<string, string> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (typeof raw === 'string' && raw.trim()) out[key] = raw.trim();
    }
    return out;
  }
  if (typeof value !== 'string') return {};
  try {
    return jsonObject(JSON.parse(value));
  } catch {
    return {};
  }
}

function cleanText(value: unknown, max = 4000): string {
  return str(value).trim().slice(0, max);
}

function cleanList(value: unknown, maxItems = 12, maxLength = 40): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    const item = raw.trim().slice(0, maxLength);
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}

function cleanSocialLinks(value: unknown): Record<string, string> {
  const input = jsonObject(value);
  const out: Record<string, string> = {};
  for (const key of SOCIAL_KEYS) {
    const raw = input[key];
    if (!raw) continue;
    const url = raw.trim();
    if (!/^https?:\/\/[^\s<>"']+$/i.test(url) || url.length > 300) continue;
    out[key] = url;
  }
  return out;
}

function applicationFromRow(row: Row): Record<string, unknown> {
  return {
    id: str(row.id),
    reference: str(row.reference),
    fullName: str(row.full_name),
    email: str(row.email),
    phone: str(row.phone),
    city: str(row.city),
    country: str(row.country),
    territory: row.territory === null ? null : str(row.territory),
    languages: jsonArray(row.languages),
    sectors: jsonArray(row.sectors),
    experience: row.experience === null ? '' : str(row.experience),
    motivation: row.motivation === null ? '' : str(row.motivation),
    personalStatement: row.personal_statement === null ? '' : str(row.personal_statement),
    socialLinks: jsonObject(row.social_links),
    consentTerms: num(row.consent_terms) === 1,
    consentPrivacy: num(row.consent_privacy) === 1,
    status: str(row.status),
    requestedInfo: row.requested_info === null ? null : str(row.requested_info),
    applicantResponse: row.applicant_response === null ? null : str(row.applicant_response),
    createdAt: num(row.created_at),
    updatedAt: num(row.updated_at),
    approvedAt: row.approved_at === null ? null : num(row.approved_at),
    accountStatus: str(row.account_status),
  };
}

function applicationAdminFromRow(row: Row): Record<string, unknown> {
  return {
    ...applicationFromRow(row),
    adminNotes: row.admin_notes === null ? null : str(row.admin_notes),
    reviewedBy: row.reviewed_by === null ? null : str(row.reviewed_by),
    reviewedAt: row.reviewed_at === null ? null : num(row.reviewed_at),
  };
}

function profileFromRow(row: Row): Record<string, unknown> {
  const photoAssetId = row.photo_asset_id === null ? null : str(row.photo_asset_id);
  return {
    ambassadorId: str(row.ambassador_id),
    username: str(row.username),
    publicName: str(row.public_name),
    title: str(row.title, OFFICIAL_TITLE),
    bio: str(row.bio),
    country: str(row.country),
    city: str(row.city),
    languages: jsonArray(row.languages),
    sectors: jsonArray(row.sectors),
    contactEmail: row.contact_email === null ? null : str(row.contact_email),
    contactWhatsapp: row.contact_whatsapp === null ? null : str(row.contact_whatsapp),
    socialLinks: jsonObject(row.social_links),
    photoAssetId,
    photoUrl: photoAssetId ? `/api/ambassador-assets/${photoAssetId}` : null,
    status: str(row.status),
    publishedAt: row.published_at === null ? null : num(row.published_at),
    createdAt: num(row.created_at),
    updatedAt: num(row.updated_at),
  };
}

function documentFromRow(row: Row): Record<string, unknown> {
  return {
    id: str(row.id),
    kind: str(row.kind),
    originalName: row.original_name === null ? null : str(row.original_name),
    contentType: str(row.content_type),
    sizeBytes: num(row.size_bytes),
    createdAt: num(row.created_at),
    url: `/api/ambassador-assets/${str(row.id)}`,
  };
}

async function applicationForAccount(env: Env, accountId: string): Promise<Row | null> {
  return env.DB.prepare(
    `SELECT a.*, acc.status AS account_status
       FROM ambassador_applications a
       JOIN accounts acc ON acc.id = a.account_id
      WHERE a.account_id = ?`
  )
    .bind(accountId)
    .first<Row>();
}

async function profileForAccount(env: Env, accountId: string): Promise<Row | null> {
  return env.DB.prepare(`SELECT * FROM ambassador_profiles WHERE account_id = ?`)
    .bind(accountId)
    .first<Row>();
}

async function documentsFor(env: Env, applicationId: string): Promise<Row[]> {
  const result = await env.DB.prepare(
    `SELECT id, kind, original_name, content_type, size_bytes, created_at
       FROM ambassador_documents
      WHERE application_id = ? AND status = 'ready' AND kind = 'document'
      ORDER BY created_at DESC`
  )
    .bind(applicationId)
    .all<Row>();
  return result.results ?? [];
}

async function reviewsFor(env: Env, applicationId: string): Promise<Row[]> {
  const result = await env.DB.prepare(
    `SELECT r.id, r.action, r.note, r.created_at, a.email AS actor_email
       FROM ambassador_reviews r
       LEFT JOIN accounts a ON a.id = r.actor_id
      WHERE r.application_id = ?
      ORDER BY r.created_at DESC`
  )
    .bind(applicationId)
    .all<Row>();
  return result.results ?? [];
}

function applicationReference(): string {
  const year = new Date().getUTCFullYear();
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `AMB-${year}-${suffix}`;
}

function accountFromRow(row: Row): AccountRow {
  return {
    id: str(row.id),
    email: str(row.email),
    email_normalized: str(row.email_normalized),
    role: row.role as AccountRow['role'],
    status: row.status as AccountRow['status'],
    session_version: num(row.session_version, 1),
    created_at: num(row.created_at),
    updated_at: num(row.updated_at),
  };
}

async function notifyAdmins(env: Env, title: string, message: string): Promise<void> {
  const admins = await env.DB.prepare(
    `SELECT id FROM accounts WHERE role = 'admin' AND status = 'approved'`
  ).all<Row>();
  const now = Date.now();
  const statements: D1PreparedStatement[] = [];
  for (const admin of admins.results ?? []) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO notifications (id, title, body, audience, audience_account_id, created_by, created_at)
         VALUES (?, ?, ?, 'account', ?, NULL, ?)`
      ).bind(newId('note'), title, message, str(admin.id), now)
    );
  }
  if (statements.length) await env.DB.batch(statements);
}

/* ------------------------------------------------------------------ */
/* Applicant-facing                                                     */
/* ------------------------------------------------------------------ */

export async function handleAmbassadorApply(ctx: Ctx): Promise<Response> {
  assertSameOrigin(ctx.request, ctx.env.APP_ORIGIN);

  const limit = await consumeRateLimit(
    ctx.env,
    `ambassador-apply:${await hashIp(ctx.env, ctx.request)}`,
    5,
    60 * 60
  );
  if (!limit.allowed) {
    throw tooMany('Too many applications from this connection. Try again later.', limit.retryAfterSeconds);
  }

  const input = await body<{
    fullName: string;
    email: string;
    phone: string;
    city: string;
    country: string;
    territory?: string | null;
    languages?: string[];
    sectors?: string[];
    experience?: string | null;
    motivation?: string | null;
    personalStatement?: string | null;
    socialLinks?: Record<string, unknown>;
    password: string;
    consentTerms: boolean;
    consentPrivacy: boolean;
  }>(ctx, {
    fullName: { type: 'string', required: true, min: 2, max: 120 },
    email: { type: 'email', required: true },
    phone: { type: 'string', required: true, min: 6, max: 32 },
    city: { type: 'string', required: true, min: 2, max: 100 },
    country: { type: 'string', required: true, min: 2, max: 100 },
    territory: { type: 'string', max: 100, nullable: true },
    languages: { type: 'array', max: 12, items: { type: 'string', min: 1, max: 40 } },
    sectors: { type: 'array', max: 12, items: { type: 'string', min: 1, max: 40 } },
    experience: { type: 'string', max: 2000, nullable: true },
    motivation: { type: 'string', max: 2000, nullable: true },
    personalStatement: { type: 'string', max: 2000, nullable: true },
    socialLinks: { type: 'object' },
    password: { type: 'string', required: true, min: MIN_PASSWORD, max: MAX_PASSWORD },
    consentTerms: { type: 'boolean', required: true },
    consentPrivacy: { type: 'boolean', required: true },
  });

  if (!input.consentTerms || !input.consentPrivacy) {
    throw badRequest('Please accept the appointment terms and privacy notice to continue.');
  }

  const existing = await ctx.env.DB.prepare(
    `SELECT id FROM accounts WHERE email_normalized = ?`
  )
    .bind(input.email)
    .first<Row>();
  if (existing) throw badRequest('An account already exists for that email.');

  const password = await hashPassword(input.password);
  const now = Date.now();
  const accountId = newId('acc');
  const applicationId = newId('amb');
  const reference = applicationReference();

  try {
    await ctx.env.DB.batch([
      ctx.env.DB.prepare(
        `INSERT INTO accounts
           (id, email, email_normalized, password_hash, password_salt, password_iterations,
            role, status, session_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'business', 'applied', 1, ?, ?)`
      ).bind(
        accountId,
        input.email,
        input.email,
        password.hash,
        password.salt,
        password.iterations,
        now,
        now
      ),
      ctx.env.DB.prepare(
        `INSERT INTO ambassador_applications
           (id, account_id, reference, full_name, email, phone, city, country, territory,
            languages, sectors, experience, motivation, personal_statement, social_links, consent_terms,
            consent_privacy, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)`
      ).bind(
        applicationId,
        accountId,
        reference,
        input.fullName,
        input.email,
        input.phone,
        input.city,
        input.country,
        input.territory ?? null,
        JSON.stringify(cleanList(input.languages)),
        JSON.stringify(cleanList(input.sectors)),
        cleanText(input.experience, 2000) || null,
        cleanText(input.motivation, 2000) || null,
        cleanText(input.personalStatement, 2000) || null,
        JSON.stringify(cleanSocialLinks(input.socialLinks)),
        input.consentTerms ? 1 : 0,
        input.consentPrivacy ? 1 : 0,
        now,
        now
      ),
    ]);
  } catch (error) {
    console.warn('ambassador application conflict', error);
    throw badRequest('That application could not be saved. Please check your details and try again.');
  }

  await recordAudit(ctx.env, {
    actorId: accountId,
    actorRole: 'business',
    action: 'ambassador.application.submit',
    entityType: 'ambassador_application',
    entityId: applicationId,
    after: { reference },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  await notifyAdmins(
    ctx.env,
    'New MHOMHO Ambassador application',
    `${input.fullName} (${input.city}, ${input.country}) submitted application ${reference}.`
  );

  const account: AccountRow = {
    id: accountId,
    email: input.email,
    email_normalized: input.email,
    role: 'business',
    status: 'applied',
    session_version: 1,
    created_at: now,
    updated_at: now,
  };
  const { response } = await startSession(ctx, account);
  return response;
}

export async function handleAmbassadorLogin(ctx: Ctx): Promise<Response> {
  assertSameOrigin(ctx.request, ctx.env.APP_ORIGIN);

  const ip = await hashIp(ctx.env, ctx.request);
  const ipLimit = await consumeRateLimit(ctx.env, `ambassador-login:${ip}`, 20, 15 * 60);
  if (!ipLimit.allowed) {
    throw tooMany('Too many sign-in attempts. Try again shortly.', ipLimit.retryAfterSeconds);
  }

  const input = await body<{ email: string; password: string }>(ctx, {
    email: { type: 'email', required: true },
    password: { type: 'string', required: true, min: 1, max: MAX_PASSWORD },
  });

  const accountBucket = `ambassador-login-account:${await sha256Hex(input.email)}`;
  const accountLimit = await consumeRateLimit(ctx.env, accountBucket, 30, 15 * 60);
  if (!accountLimit.allowed) {
    throw tooMany('Too many attempts for this account. Try again shortly.', accountLimit.retryAfterSeconds);
  }

  const row = await ctx.env.DB.prepare(
    `SELECT * FROM accounts WHERE email_normalized = ? AND role = 'business'`
  )
    .bind(input.email)
    .first<Row>();

  if (!row) {
    await dummyPasswordCheck(input.password);
    throw unauthorized('Email or password is incorrect.');
  }

  const valid = await verifyPassword(input.password, {
    hash: row.password_hash ? str(row.password_hash) : null,
    salt: row.password_salt ? str(row.password_salt) : null,
    iterations: row.password_iterations ? num(row.password_iterations) : null,
  });
  if (!valid) throw unauthorized('Email or password is incorrect.');

  const account = accountFromRow(row);
  // Suspended ambassadors may still sign in to see their status and the reason
  // for suspension; every write endpoint independently requires `approved`.
  await ctx.env.DB.prepare(`UPDATE accounts SET last_login_at = ?, updated_at = ? WHERE id = ?`)
    .bind(Date.now(), Date.now(), account.id)
    .run();

  const { response } = await startSession(ctx, account);
  return response;
}

export async function handleAmbassadorMe(ctx: Ctx): Promise<Response> {
  const { account } = requireAccount(ctx, ['business']);
  const application = await applicationForAccount(ctx.env, account.id);
  const profile = await profileForAccount(ctx.env, account.id);
  const documents = application ? await documentsFor(ctx.env, str(application.id)) : [];

  return json({
    ok: true,
    data: {
      accountStatus: account.status,
      application: application ? applicationFromRow(application) : null,
      profile: profile ? profileFromRow(profile) : null,
      documents: documents.map(documentFromRow),
    },
  });
}

export async function handleAmbassadorApplicationUpdate(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const { account } = requireAccount(ctx, ['business']);
  const application = await applicationForAccount(ctx.env, account.id);
  if (!application) throw notFound('Application not found.');

  const status = str(application.status);
  if (!['submitted', 'needs_info'].includes(status)) {
    throw conflict('This application can no longer be edited online. Contact partnerships@mhomho.work.');
  }

  const input = await body<{
    fullName?: string;
    phone?: string;
    city?: string;
    country?: string;
    territory?: string | null;
    languages?: string[];
    sectors?: string[];
    experience?: string | null;
    motivation?: string | null;
    personalStatement?: string | null;
    socialLinks?: Record<string, unknown>;
    applicantResponse?: string | null;
  }>(ctx, {
    fullName: { type: 'string', min: 2, max: 120 },
    phone: { type: 'string', min: 6, max: 32 },
    city: { type: 'string', min: 2, max: 100 },
    country: { type: 'string', min: 2, max: 100 },
    territory: { type: 'string', max: 100 },
    languages: { type: 'array', max: 12, items: { type: 'string', min: 1, max: 40 } },
    sectors: { type: 'array', max: 12, items: { type: 'string', min: 1, max: 40 } },
    experience: { type: 'string', max: 2000 },
    motivation: { type: 'string', max: 2000 },
    personalStatement: { type: 'string', max: 2000 },
    socialLinks: { type: 'object' },
    applicantResponse: { type: 'string', max: 2000 },
  });

  const sets: string[] = [];
  const binds: unknown[] = [];
  const add = (column: string, value: unknown) => {
    sets.push(`${column} = ?`);
    binds.push(value);
  };

  if (input.fullName !== undefined) add('full_name', input.fullName);
  if (input.phone !== undefined) add('phone', input.phone);
  if (input.city !== undefined) add('city', input.city);
  if (input.country !== undefined) add('country', input.country);
  if (input.territory !== undefined) add('territory', input.territory);
  if (input.languages !== undefined) add('languages', JSON.stringify(cleanList(input.languages)));
  if (input.sectors !== undefined) add('sectors', JSON.stringify(cleanList(input.sectors)));
  if (input.experience !== undefined) add('experience', cleanText(input.experience, 2000) || null);
  if (input.motivation !== undefined) add('motivation', cleanText(input.motivation, 2000) || null);
  if (input.personalStatement !== undefined) add('personal_statement', cleanText(input.personalStatement, 2000) || null);
  if (input.socialLinks !== undefined) add('social_links', JSON.stringify(cleanSocialLinks(input.socialLinks)));
  if (input.applicantResponse !== undefined) {
    add('applicant_response', cleanText(input.applicantResponse, 2000) || null);
  }

  if (!sets.length) throw badRequest('No changes were supplied.');
  const now = Date.now();
  sets.push('status = ?', 'updated_at = ?');
  binds.push('submitted', now, application.id);

  await ctx.env.DB.prepare(
    `UPDATE ambassador_applications SET ${sets.join(', ')} WHERE id = ?`
  )
    .bind(...binds)
    .run();

  await recordAudit(ctx.env, {
    actorId: account.id,
    actorRole: account.role,
    action: 'ambassador.application.update',
    entityType: 'ambassador_application',
    entityId: str(application.id),
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  const updated = await applicationForAccount(ctx.env, account.id);
  return json({ ok: true, data: { application: updated ? applicationFromRow(updated) : null } });
}

/* ------------------------------------------------------------------ */
/* Documents and photos                                                 */
/* ------------------------------------------------------------------ */

interface SniffedFile {
  contentType: 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp';
  extension: 'pdf' | 'png' | 'jpg' | 'webp';
  isImage: boolean;
}

function sniffFile(bytes: Uint8Array): SniffedFile | null {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return { contentType: 'application/pdf', extension: 'pdf', isImage: false };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { contentType: 'image/png', extension: 'png', isImage: true };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: 'image/jpeg', extension: 'jpg', isImage: true };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { contentType: 'image/webp', extension: 'webp', isImage: true };
  }
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function safeFileName(value: string): string {
  return value.replace(/[^\w.\- ]+/g, '').trim().slice(0, 120) || 'document';
}

export async function handleAmbassadorDocumentUpload(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const { account } = requireAccount(ctx, ['business']);
  if (account.status === 'rejected') throw forbidden('This application is not active.');

  const url = new URL(ctx.request.url);
  const kind = url.searchParams.get('kind') === 'photo' ? 'photo' : 'document';
  const originalName = safeFileName(ctx.request.headers.get('X-File-Name') ?? 'document');

  const limit = await consumeRateLimit(ctx.env, `ambassador-upload:${account.id}`, 20, 60 * 60);
  if (!limit.allowed) throw tooMany('Too many uploads. Try again later.', limit.retryAfterSeconds);

  const application = await applicationForAccount(ctx.env, account.id);
  const profile = await profileForAccount(ctx.env, account.id);

  if (kind === 'document') {
    if (!application) throw notFound('Application not found.');
    if (!['submitted', 'under_review', 'needs_info'].includes(str(application.status))) {
      throw conflict('Documents can no longer be added to this application.');
    }
    const count = await ctx.env.DB.prepare(
      `SELECT COUNT(*) AS total FROM ambassador_documents
        WHERE application_id = ? AND kind = 'document' AND status = 'ready'`
    )
      .bind(str(application.id))
      .first<Row>();
    if (num(count?.total) >= MAX_DOCUMENTS) {
      throw badRequest(`You can upload up to ${MAX_DOCUMENTS} documents.`);
    }
  } else {
    if (account.status !== 'approved' || !profile) {
      throw forbidden('Your public profile is not active yet.');
    }
  }

  const maxBytes = maxUploadBytes(ctx.env);
  const declared = Number(ctx.request.headers.get('Content-Length') ?? '0');
  if (declared > maxBytes) throw badRequest(`Files must be under ${(maxBytes / 1024 / 1024).toFixed(1)} MB.`);

  const buffer = await ctx.request.arrayBuffer();
  if (buffer.byteLength === 0) throw badRequest('The selected file is empty.');
  if (buffer.byteLength > maxBytes) {
    throw badRequest(`Files must be under ${(maxBytes / 1024 / 1024).toFixed(1)} MB.`);
  }

  const bytes = new Uint8Array(buffer);
  const sniffed = sniffFile(bytes);
  if (!sniffed) throw badRequest('Upload a PDF, PNG, JPEG or WebP file.');
  if (kind === 'photo' && !sniffed.isImage) throw badRequest('Profile photographs must be an image.');

  const now = Date.now();
  const objectKey = `ambassador/${account.id}/${kind}/${newId('obj')}.${sniffed.extension}`;
  const documentId = newId('adoc');
  const checksum = await sha256Hex(bytesToBase64(bytes));

  await ctx.env.PROOFS.put(objectKey, buffer);

  const statements: D1PreparedStatement[] = [
    ctx.env.DB.prepare(
      `INSERT INTO ambassador_documents
         (id, account_id, application_id, kind, object_key, original_name, content_type,
          size_bytes, checksum_sha256, visibility, status, created_at, ready_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?)`
    ).bind(
      documentId,
      account.id,
      kind === 'document' ? str(application?.id) : null,
      kind,
      objectKey,
      originalName,
      sniffed.contentType,
      bytes.byteLength,
      checksum,
      kind === 'photo' ? 'public' : 'private',
      now,
      now
    ),
  ];

  if (kind === 'photo') {
    statements.push(
      ctx.env.DB.prepare(
        `UPDATE ambassador_profiles SET photo_asset_id = ?, updated_at = ? WHERE account_id = ?`
      ).bind(documentId, now, account.id)
    );
  }

  await ctx.env.DB.batch(statements);

  await recordAudit(ctx.env, {
    actorId: account.id,
    actorRole: account.role,
    action: kind === 'photo' ? 'ambassador.photo.upload' : 'ambassador.document.upload',
    entityType: 'ambassador_document',
    entityId: documentId,
    after: { kind, contentType: sniffed.contentType, sizeBytes: bytes.byteLength },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json(
    {
      ok: true,
      data: {
        document: {
          id: documentId,
          kind,
          originalName,
          contentType: sniffed.contentType,
          sizeBytes: bytes.byteLength,
          createdAt: now,
          url: `/api/ambassador-assets/${documentId}`,
        },
      },
    },
    201
  );
}

export async function handleAmbassadorAssetRead(ctx: Ctx): Promise<Response> {
  const row = await ctx.env.DB.prepare(
    `SELECT d.id, d.account_id, d.kind, d.object_key, d.content_type, d.visibility, d.status,
            p.status AS profile_status, a.status AS account_status
       FROM ambassador_documents d
       JOIN accounts a ON a.id = d.account_id
       LEFT JOIN ambassador_profiles p ON p.account_id = d.account_id
      WHERE d.id = ?`
  )
    .bind(ctx.params.id)
    .first<Row>();

  if (!row || str(row.status) !== 'ready') throw notFound('File not found.');

  const isPublicPhoto =
    str(row.kind) === 'photo' &&
    str(row.visibility) === 'public' &&
    str(row.profile_status) === 'published' &&
    str(row.account_status) === 'approved';
  const isAdmin = ctx.account?.role === 'admin' && ctx.account.status === 'approved';
  const isOwner = ctx.account?.id === str(row.account_id);
  if (!isPublicPhoto && !isAdmin && !isOwner) {
    throw forbidden('You do not have access to this file.');
  }

  const object = await ctx.env.PROOFS.get(str(row.object_key), 'arrayBuffer');
  if (!object) throw notFound('File not found.');

  const headers = new Headers();
  headers.set('Content-Type', str(row.content_type));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Content-Security-Policy', "default-src 'none'; sandbox");
  headers.set('Content-Disposition', 'inline');
  headers.set(
    'Cache-Control',
    isPublicPhoto ? 'public, max-age=3600' : 'private, no-store'
  );
  return new Response(object, { headers });
}

/* ------------------------------------------------------------------ */
/* Public profile                                                       */
/* ------------------------------------------------------------------ */

export async function handleAmbassadorProfileUpdate(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const { account } = requireAccount(ctx, ['business']);
  if (account.status !== 'approved') throw forbidden('Your appointment is not active.');

  const profile = await profileForAccount(ctx.env, account.id);
  if (!profile) throw notFound('Ambassador profile not found.');

  const rawBody = await readJson(ctx.request, 64 * 1024);
  const input = validate<{
    publicName?: string;
    bio?: string;
    country?: string;
    city?: string;
    languages?: string[];
    sectors?: string[];
    contactEmail?: string | null;
    contactWhatsapp?: string | null;
    socialLinks?: Record<string, unknown>;
    photoAssetId?: string | null;
  }>(rawBody, {
    publicName: { type: 'string', min: 2, max: 120 },
    bio: { type: 'string', max: 2000 },
    country: { type: 'string', min: 2, max: 100 },
    city: { type: 'string', min: 2, max: 100 },
    languages: { type: 'array', max: 12, items: { type: 'string', min: 1, max: 40 } },
    sectors: { type: 'array', max: 12, items: { type: 'string', min: 1, max: 40 } },
    contactEmail: { type: 'email', nullable: true },
    contactWhatsapp: { type: 'string', min: 6, max: 32, nullable: true },
    socialLinks: { type: 'object' },
    photoAssetId: { type: 'string', max: 80, nullable: true },
  });
  const rawInput =
    rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
      ? (rawBody as Record<string, unknown>)
      : {};
  const supplied = (key: string) => Object.prototype.hasOwnProperty.call(rawInput, key);

  if (input.photoAssetId) {
    const photo = await ctx.env.DB.prepare(
      `SELECT id FROM ambassador_documents
        WHERE id = ? AND account_id = ? AND kind = 'photo' AND status = 'ready'`
    )
      .bind(input.photoAssetId, account.id)
      .first<Row>();
    if (!photo) throw badRequest('That photograph could not be found.');
  }

  const nextEmail = supplied('contactEmail')
    ? input.contactEmail ?? null
    : str(profile.contact_email) || null;
  const nextWhatsapp = supplied('contactWhatsapp')
    ? input.contactWhatsapp ?? null
    : str(profile.contact_whatsapp) || null;
  const nextPhoto = supplied('photoAssetId')
    ? input.photoAssetId ?? null
    : str(profile.photo_asset_id) || null;
  const nextLanguages =
    input.languages !== undefined ? cleanList(input.languages) : jsonArray(profile.languages);
  const nextSectors =
    input.sectors !== undefined ? cleanList(input.sectors) : jsonArray(profile.sectors);

  if (str(profile.status) === 'published') {
    if (!nextEmail && !nextWhatsapp) {
      throw badRequest('A published profile needs a public email address or WhatsApp number.');
    }
    if (!nextPhoto) throw badRequest('A published profile needs a photograph.');
    if (!nextLanguages.length) throw badRequest('A published profile needs at least one language.');
    if (!nextSectors.length) throw badRequest('A published profile needs at least one business sector.');
  }

  const sets: string[] = [];
  const binds: unknown[] = [];
  const add = (column: string, value: unknown) => {
    sets.push(`${column} = ?`);
    binds.push(value);
  };

  if (input.publicName !== undefined) add('public_name', input.publicName);
  if (input.bio !== undefined) add('bio', cleanText(input.bio, 2000));
  if (input.country !== undefined) add('country', input.country);
  if (input.city !== undefined) add('city', input.city);
  if (input.languages !== undefined) add('languages', JSON.stringify(cleanList(input.languages)));
  if (input.sectors !== undefined) add('sectors', JSON.stringify(cleanList(input.sectors)));
  if (supplied('contactEmail')) add('contact_email', input.contactEmail ?? null);
  if (supplied('contactWhatsapp')) add('contact_whatsapp', input.contactWhatsapp ?? null);
  if (input.socialLinks !== undefined) add('social_links', JSON.stringify(cleanSocialLinks(input.socialLinks)));
  if (supplied('photoAssetId')) add('photo_asset_id', input.photoAssetId ?? null);

  if (!sets.length) throw badRequest('No changes were supplied.');
  const now = Date.now();
  sets.push('updated_at = ?');
  binds.push(now, account.id);

  await ctx.env.DB.prepare(
    `UPDATE ambassador_profiles SET ${sets.join(', ')} WHERE account_id = ?`
  )
    .bind(...binds)
    .run();

  const updated = await profileForAccount(ctx.env, account.id);
  return json({ ok: true, data: { profile: updated ? profileFromRow(updated) : null } });
}

export async function handleAmbassadorProfilePublish(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const { account } = requireAccount(ctx, ['business']);
  if (account.status !== 'approved') throw forbidden('Your appointment is not active.');

  const profile = await profileForAccount(ctx.env, account.id);
  if (!profile) throw notFound('Ambassador profile not found.');
  if (!profile.photo_asset_id) throw badRequest('Add a professional photograph before publishing.');
  if (cleanText(profile.bio).length < 20) {
    throw badRequest('Add a short biography (at least 20 characters) before publishing.');
  }
  if (!profile.contact_email && !profile.contact_whatsapp) {
    throw badRequest('Add a public email address or WhatsApp number before publishing.');
  }
  if (jsonArray(profile.languages).length === 0) {
    throw badRequest('Add at least one language before publishing.');
  }
  if (jsonArray(profile.sectors).length === 0) {
    throw badRequest('Add at least one business sector before publishing.');
  }

  const now = Date.now();
  await ctx.env.DB.prepare(
    `UPDATE ambassador_profiles
        SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = ?
      WHERE account_id = ?`
  )
    .bind(now, now, account.id)
    .run();

  const updated = await profileForAccount(ctx.env, account.id);
  return json({ ok: true, data: { profile: updated ? profileFromRow(updated) : null } });
}

export async function handlePublicAmbassadorProfile(ctx: Ctx): Promise<Response> {
  const row = await ctx.env.DB.prepare(
    `SELECT p.*, a.status AS account_status
       FROM ambassador_profiles p
       JOIN accounts a ON a.id = p.account_id
      WHERE p.username = ? AND p.status = 'published' AND a.status = 'approved'`
  )
    .bind(str(ctx.params.username).trim().toLowerCase())
    .first<Row>();

  if (!row) throw notFound('Ambassador profile not found.');

  return json({
    ok: true,
    data: {
      profile: profileFromRow(row),
      officialTitle: OFFICIAL_TITLE,
      officialDescription: OFFICIAL_DESCRIPTION,
      verified: true,
    },
  });
}

/* ------------------------------------------------------------------ */
/* Administration                                                       */
/* ------------------------------------------------------------------ */

export async function handleAdminAmbassadorList(ctx: Ctx): Promise<Response> {
  requireAdmin(ctx);
  const result = await ctx.env.DB.prepare(
    `SELECT a.*, acc.status AS account_status,
            p.username, p.ambassador_id, p.status AS profile_status
       FROM ambassador_applications a
       JOIN accounts acc ON acc.id = a.account_id
       LEFT JOIN ambassador_profiles p ON p.account_id = a.account_id
      ORDER BY a.created_at DESC`
  ).all<Row>();

  const items: Array<Record<string, unknown>> = (result.results ?? []).map((row) => ({
    ...applicationAdminFromRow(row),
    username: row.username === null ? null : str(row.username),
    ambassadorId: row.ambassador_id === null ? null : str(row.ambassador_id),
    profileStatus: row.profile_status === null ? null : str(row.profile_status),
  }));

  const counts = {
    total: items.length,
    submitted: items.filter((item) => str(item.status) === 'submitted').length,
    underReview: items.filter((item) => str(item.status) === 'under_review').length,
    needsInfo: items.filter((item) => str(item.status) === 'needs_info').length,
    approved: items.filter((item) => str(item.status) === 'approved').length,
    rejected: items.filter((item) => str(item.status) === 'rejected').length,
  };

  return json({ ok: true, data: { items, counts } });
}

export async function handleAdminAmbassadorGet(ctx: Ctx): Promise<Response> {
  requireAdmin(ctx);
  const row = await ctx.env.DB.prepare(
    `SELECT a.*, acc.status AS account_status,
            p.username, p.ambassador_id, p.status AS profile_status
       FROM ambassador_applications a
       JOIN accounts acc ON acc.id = a.account_id
       LEFT JOIN ambassador_profiles p ON p.account_id = a.account_id
      WHERE a.id = ?`
  )
    .bind(ctx.params.id)
    .first<Row>();
  if (!row) throw notFound('Application not found.');

  const documents = await documentsFor(ctx.env, str(row.id));
  const reviews = await reviewsFor(ctx.env, str(row.id));
  const profile = await profileForAccount(ctx.env, str(row.account_id));

  return json({
    ok: true,
    data: {
      application: {
        ...applicationAdminFromRow(row),
        username: row.username === null ? null : str(row.username),
        ambassadorId: row.ambassador_id === null ? null : str(row.ambassador_id),
        profileStatus: row.profile_status === null ? null : str(row.profile_status),
      },
      documents: documents.map(documentFromRow),
      reviews: reviews.map((review) => ({
        id: str(review.id),
        action: str(review.action),
        note: review.note === null ? null : str(review.note),
        actorEmail: review.actor_email === null ? null : str(review.actor_email),
        createdAt: num(review.created_at),
      })),
      profile: profile ? profileFromRow(profile) : null,
    },
  });
}

async function nextAmbassadorId(env: Env): Promise<string> {
  const row = await env.DB.prepare(
    `UPDATE ambassador_id_sequence
        SET next_value = next_value + 1
      WHERE id = 1
      RETURNING next_value - 1 AS assigned`
  ).first<Row>();
  const assigned = num(row?.assigned, 0);
  if (!assigned) throw conflict('Ambassador ID generation is unavailable. Try again.');
  return `MH-AMB-${String(assigned).padStart(6, '0')}`;
}

async function uniqueUsername(env: Env, fullName: string): Promise<string> {
  const base = slugify(fullName).slice(0, 48) || 'ambassador';
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    if (RESERVED_USERNAMES.has(candidate)) continue;
    const existing = await env.DB.prepare(
      `SELECT account_id FROM ambassador_profiles WHERE username = ?`
    )
      .bind(candidate)
      .first<Row>();
    if (!existing) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}

export async function handleAdminAmbassadorDecision(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const admin = requireAdmin(ctx);

  const input = await body<{
    action: 'note' | 'request_info' | 'approve' | 'reject' | 'suspend' | 'reinstate';
    note?: string | null;
  }>(ctx, {
    action: {
      type: 'string',
      required: true,
      values: ['note', 'request_info', 'approve', 'reject', 'suspend', 'reinstate'],
    },
    note: { type: 'string', max: 3000, nullable: true },
  });

  const application = await ctx.env.DB.prepare(
    `SELECT a.*, acc.status AS account_status
       FROM ambassador_applications a
       JOIN accounts acc ON acc.id = a.account_id
      WHERE a.id = ?`
  )
    .bind(ctx.params.id)
    .first<Row>();
  if (!application) throw notFound('Application not found.');

  const applicationId = str(application.id);
  const accountId = str(application.account_id);
  const status = str(application.status);
  const note = cleanText(input.note, 3000) || null;
  const now = Date.now();

  if (input.action === 'note') {
    await ctx.env.DB.batch([
      ctx.env.DB.prepare(
        `UPDATE ambassador_applications
            SET admin_notes = ?, status = CASE WHEN status = 'submitted' THEN 'under_review' ELSE status END,
                updated_at = ?
          WHERE id = ?`
      ).bind(note, now, applicationId),
      ctx.env.DB.prepare(
        `INSERT INTO ambassador_reviews (id, application_id, actor_id, action, note, created_at)
         VALUES (?, ?, ?, 'note', ?, ?)`
      ).bind(newId('arev'), applicationId, admin.id, note, now),
    ]);
    const updated = await applicationForAccount(ctx.env, accountId);
    return json({ ok: true, data: { application: updated ? applicationAdminFromRow(updated) : null } });
  }

  if (input.action === 'request_info') {
    if (!note) throw badRequest('Tell the applicant what additional information is needed.');
    if (['approved', 'rejected', 'suspended'].includes(status)) {
      throw conflict('This application is not awaiting information.');
    }
    await ctx.env.DB.batch([
      ctx.env.DB.prepare(
        `UPDATE ambassador_applications
            SET status = 'needs_info', requested_info = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
          WHERE id = ?`
      ).bind(note, admin.id, now, now, applicationId),
      ctx.env.DB.prepare(
        `INSERT INTO ambassador_reviews (id, application_id, actor_id, action, note, created_at)
         VALUES (?, ?, ?, 'request_info', ?, ?)`
      ).bind(newId('arev'), applicationId, admin.id, note, now),
    ]);
  } else if (input.action === 'approve') {
    if (status === 'approved') throw conflict('This application is already approved.');
    if (status === 'suspended') {
      throw conflict('Reinstate the suspended appointment instead of approving it again.');
    }
    if (status === 'rejected') throw conflict('Rejected applications must be reinstated before approval.');

    const existingProfile = await profileForAccount(ctx.env, accountId);
    const ambassadorId = existingProfile
      ? str(existingProfile.ambassador_id)
      : await nextAmbassadorId(ctx.env);
    const username = existingProfile
      ? str(existingProfile.username)
      : await uniqueUsername(ctx.env, str(application.full_name));

    const statements: D1PreparedStatement[] = [
      ctx.env.DB.prepare(
        `UPDATE accounts SET status = 'approved', updated_at = ? WHERE id = ?`
      ).bind(now, accountId),
      ctx.env.DB.prepare(
        `UPDATE ambassador_applications
            SET status = 'approved', approved_at = ?, reviewed_by = ?, reviewed_at = ?,
                admin_notes = COALESCE(?, admin_notes), updated_at = ?
          WHERE id = ?`
      ).bind(now, admin.id, now, note, now, applicationId),
    ];

    if (!existingProfile) {
      statements.push(
        ctx.env.DB.prepare(
          `INSERT INTO ambassador_profiles
             (account_id, ambassador_id, username, public_name, title, bio, country, city,
              languages, sectors, contact_email, contact_whatsapp, social_links,
              photo_asset_id, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, NULL, NULL, ?, NULL, 'draft', ?, ?)`
        ).bind(
          accountId,
          ambassadorId,
          username,
          str(application.full_name),
          OFFICIAL_TITLE,
          str(application.country),
          str(application.city),
          JSON.stringify(jsonArray(application.languages)),
          JSON.stringify(jsonArray(application.sectors)),
          JSON.stringify(jsonObject(application.social_links)),
          now,
          now
        )
      );
    }

    statements.push(
      ctx.env.DB.prepare(
        `INSERT INTO ambassador_reviews (id, application_id, actor_id, action, note, created_at)
         VALUES (?, ?, ?, 'approve', ?, ?)`
      ).bind(newId('arev'), applicationId, admin.id, note, now)
    );

    await ctx.env.DB.batch(statements);
  } else if (input.action === 'reject') {
    if (!note) throw badRequest('Add a private reason before rejecting an application.');
    if (status === 'approved') throw conflict('Suspend the appointment before rejecting it.');
    if (status === 'rejected') throw conflict('This application is already rejected.');
    await ctx.env.DB.batch([
      ctx.env.DB.prepare(
        `UPDATE accounts SET status = 'rejected', updated_at = ? WHERE id = ?`
      ).bind(now, accountId),
      ctx.env.DB.prepare(
        `UPDATE ambassador_applications
            SET status = 'rejected', reviewed_by = ?, reviewed_at = ?,
                admin_notes = COALESCE(?, admin_notes), updated_at = ?
          WHERE id = ?`
      ).bind(admin.id, now, note, now, applicationId),
      ctx.env.DB.prepare(
        `UPDATE ambassador_profiles SET status = 'hidden', updated_at = ? WHERE account_id = ?`
      ).bind(now, accountId),
      ctx.env.DB.prepare(
        `INSERT INTO ambassador_reviews (id, application_id, actor_id, action, note, created_at)
         VALUES (?, ?, ?, 'reject', ?, ?)`
      ).bind(newId('arev'), applicationId, admin.id, note, now),
    ]);
  } else if (input.action === 'suspend') {
    if (!note) throw badRequest('Add a private reason before suspending an appointment.');
    if (status !== 'approved') {
      throw conflict('Only an approved appointment can be suspended.');
    }
    await ctx.env.DB.batch([
      ctx.env.DB.prepare(
        `UPDATE accounts SET status = 'suspended', updated_at = ? WHERE id = ?`
      ).bind(now, accountId),
      ctx.env.DB.prepare(
        `UPDATE ambassador_applications SET status = 'suspended', updated_at = ? WHERE id = ?`
      ).bind(now, applicationId),
      ctx.env.DB.prepare(
        `UPDATE ambassador_profiles SET status = 'suspended', updated_at = ? WHERE account_id = ?`
      ).bind(now, accountId),
      ctx.env.DB.prepare(
        `INSERT INTO ambassador_reviews (id, application_id, actor_id, action, note, created_at)
         VALUES (?, ?, ?, 'suspend', ?, ?)`
      ).bind(newId('arev'), applicationId, admin.id, note, now),
    ]);
  } else if (input.action === 'reinstate') {
    if (!['rejected', 'suspended'].includes(status)) {
      throw conflict('Only a rejected or suspended application can be reinstated.');
    }
    const profile = await profileForAccount(ctx.env, accountId);
    if (!profile) {
      // A rejected applicant who never received an Ambassador ID returns to
      // the review queue rather than being approved without a profile.
      await ctx.env.DB.batch([
        ctx.env.DB.prepare(
          `UPDATE accounts SET status = 'applied', updated_at = ? WHERE id = ?`
        ).bind(now, accountId),
        ctx.env.DB.prepare(
          `UPDATE ambassador_applications
              SET status = 'submitted', requested_info = NULL, applicant_response = NULL, updated_at = ?
            WHERE id = ?`
        ).bind(now, applicationId),
        ctx.env.DB.prepare(
          `INSERT INTO ambassador_reviews (id, application_id, actor_id, action, note, created_at)
           VALUES (?, ?, ?, 'reinstate', ?, ?)`
        ).bind(newId('arev'), applicationId, admin.id, note, now),
      ]);
    } else {
      const restoreProfileStatus = profile.published_at !== null ? 'published' : 'draft';
      await ctx.env.DB.batch([
        ctx.env.DB.prepare(
          `UPDATE accounts SET status = 'approved', updated_at = ? WHERE id = ?`
        ).bind(now, accountId),
        ctx.env.DB.prepare(
          `UPDATE ambassador_applications SET status = 'approved', updated_at = ? WHERE id = ?`
        ).bind(now, applicationId),
        ctx.env.DB.prepare(
          `UPDATE ambassador_profiles SET status = ?, updated_at = ? WHERE account_id = ?`
        ).bind(restoreProfileStatus, now, accountId),
        ctx.env.DB.prepare(
          `INSERT INTO ambassador_reviews (id, application_id, actor_id, action, note, created_at)
           VALUES (?, ?, ?, 'reinstate', ?, ?)`
        ).bind(newId('arev'), applicationId, admin.id, note, now),
      ]);
    }
  }

  await recordAudit(ctx.env, {
    actorId: admin.id,
    actorRole: 'admin',
    action: `ambassador.application.${input.action}`,
    entityType: 'ambassador_application',
    entityId: applicationId,
    after: { status: input.action, note },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  const updated = await applicationForAccount(ctx.env, accountId);
  const profile = await profileForAccount(ctx.env, accountId);
  return json({
    ok: true,
    data: {
      application: updated ? applicationAdminFromRow(updated) : null,
      profile: profile ? profileFromRow(profile) : null,
    },
  });
}
