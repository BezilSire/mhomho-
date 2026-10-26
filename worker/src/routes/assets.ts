import type { Ctx } from '../context.ts';
import type { Env } from '../env.ts';
import { maxUploadBytes } from '../env.ts';
import { recordAudit } from '../audit.ts';
import { newId } from '../auth.ts';
import { sha256Hex } from '../crypto.ts';
import { badRequest, forbidden, json, notFound, tooMany } from '../http.ts';
import { requireAccount } from '../auth.ts';
import { consumeRateLimit } from '../rateLimit.ts';
import { guardMutation, hashIp } from './helpers.ts';

interface Sniffed {
  contentType: 'image/png' | 'image/jpeg' | 'image/webp';
  extension: 'png' | 'jpg' | 'webp';
}

/**
 * Detects the real file type from magic bytes. The client-supplied
 * Content-Type and filename are never trusted.
 */
export function sniffImage(bytes: Uint8Array): Sniffed | null {
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
    return { contentType: 'image/png', extension: 'png' };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: 'image/jpeg', extension: 'jpg' };
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
    return { contentType: 'image/webp', extension: 'webp' };
  }
  return null;
}

export async function handleProofUpload(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const { account } = requireAccount(ctx, ['creator']);
  if (account.status !== 'approved' && account.status !== 'applied') {
    throw forbidden('Uploads are not available for this account.');
  }

  // R2 storage is the only paid resource in this deployment, so uploads are
  // rate limited per account as well as by size and type.
  const uploadLimit = await consumeRateLimit(ctx.env, `upload:${account.id}`, 30, 60 * 60);
  if (!uploadLimit.allowed) {
    throw tooMany('Too many uploads. Try again later.', uploadLimit.retryAfterSeconds);
  }

  const limit = maxUploadBytes(ctx.env);
  const declared = Number(ctx.request.headers.get('Content-Length') ?? '0');
  if (declared > limit) throw badRequest(`Proof images must be under ${formatMb(limit)} MB.`);

  const buffer = await ctx.request.arrayBuffer();
  if (buffer.byteLength === 0) throw badRequest('The uploaded file is empty.');
  if (buffer.byteLength > limit) throw badRequest(`Proof images must be under ${formatMb(limit)} MB.`);

  const bytes = new Uint8Array(buffer);
  const sniffed = sniffImage(bytes);
  if (!sniffed) {
    throw badRequest('Proof must be a PNG, JPEG or WebP image.');
  }

  const now = Date.now();
  const date = new Date(now).toISOString().slice(0, 7).replace('-', '/');
  const objectKey = `proof/${date}/${newId('obj')}.${sniffed.extension}`;
  const assetId = newId('asset');
  const checksum = await sha256Hex(bytesToBase64(bytes));

  await ctx.env.MEDIA.put(objectKey, buffer, {
    httpMetadata: {
      contentType: sniffed.contentType,
      cacheControl: 'private, no-store',
      contentDisposition: 'inline',
    },
    customMetadata: {
      ownerId: account.id,
      assetId,
      visibility: 'private',
    },
  });

  await ctx.env.DB.prepare(
    `INSERT INTO campaign_assets
       (id, campaign_id, owner_id, kind, object_key, original_name, content_type, size_bytes,
        checksum_sha256, visibility, status, created_at, ready_at)
     VALUES (?, NULL, ?, 'proof_screenshot', ?, ?, ?, ?, ?, 'private', 'ready', ?, ?)`
  )
    .bind(
      assetId,
      account.id,
      objectKey,
      'proof',
      sniffed.contentType,
      bytes.byteLength,
      checksum,
      now,
      now
    )
    .run();

  await recordAudit(ctx.env, {
    actorId: account.id,
    actorRole: account.role,
    action: 'asset.upload',
    entityType: 'campaign_asset',
    entityId: assetId,
    after: { contentType: sniffed.contentType, sizeBytes: bytes.byteLength },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json({ ok: true, assetId }, 201);
}

export async function handleAssetRead(ctx: Ctx): Promise<Response> {
  const row = await ctx.env.DB.prepare(
    `SELECT id, owner_id, kind, object_key, content_type, visibility, status
       FROM campaign_assets WHERE id = ?`
  )
    .bind(ctx.params.id)
    .first<Record<string, unknown>>();

  if (!row || row.status !== 'ready') throw notFound('Asset not found.');

  const visibility = String(row.visibility);
  const ownerId = String(row.owner_id);
  const isAdmin = ctx.account?.role === 'admin' && ctx.account.status === 'approved';
  const isOwner = ctx.account?.id === ownerId;

  if (visibility !== 'public' && !isAdmin && !isOwner) {
    throw forbidden('You do not have access to this file.');
  }

  const object = await ctx.env.MEDIA.get(String(row.object_key));
  if (!object) throw notFound('Asset not found.');

  const headers = new Headers();
  headers.set('Content-Type', String(row.content_type));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Content-Security-Policy', "default-src 'none'; sandbox");
  headers.set('Content-Disposition', 'inline');
  headers.set(
    'Cache-Control',
    visibility === 'public' ? 'public, max-age=3600' : 'private, no-store'
  );
  if (object.httpEtag) headers.set('ETag', object.httpEtag);

  return new Response(object.body, { headers });
}

/** Public brand assets (posters, logos) are readable without a session. */
export async function handlePublicAssetRead(ctx: Ctx): Promise<Response> {
  return handleAssetRead(ctx);
}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export function assetContentTypeAllowed(contentType: string): boolean {
  return ['image/png', 'image/jpeg', 'image/webp'].includes(contentType);
}

export function uploadLimitFor(env: Env): number {
  return maxUploadBytes(env);
}
