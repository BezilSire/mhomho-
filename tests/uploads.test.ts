/**
 * Proof-upload security: magic-byte sniffing, size limits, unpredictable keys,
 * private-by-default assets and ownership checks.
 */
import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import {
  APP_ORIGIN,
  PNG_BYTES,
  api,
  approvedCreator,
  createCampaign,
  freshIp,
  joinCampaign,
  setupAdmin,
  submitClip,
  testEnv,
  type Session,
} from './helpers.ts';

async function upload(
  creator: Session,
  body: BodyInit,
  options: { csrf?: string | null; headers?: Record<string, string> } = {}
) {
  return api('/api/uploads/proof', {
    cookie: creator.cookie,
    csrf: options.csrf === undefined ? creator.csrf : options.csrf,
    rawBody: body,
    headers: options.headers,
  });
}

async function assetRow(assetId: string): Promise<Record<string, any>> {
  const row = await testEnv.DB.prepare(`SELECT * FROM campaign_assets WHERE id = ?`)
    .bind(assetId)
    .first<Record<string, any>>();
  if (!row) throw new Error(`No asset ${assetId}`);
  return row;
}

describe('proof uploads', () => {
  it('accepts a real image and stores it privately under an unpredictable key', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);

    const response = await upload(creator, PNG_BYTES);
    expect(response.status).toBe(201);
    expect(response.body.assetId).toMatch(/^asset_/);

    const asset = await assetRow(response.body.assetId);
    expect(asset.kind).toBe('proof_screenshot');
    expect(asset.visibility).toBe('private');
    expect(asset.status).toBe('ready');
    expect(asset.content_type).toBe('image/png');
    expect(asset.owner_id).toBe(creator.accountId);
    expect(asset.size_bytes).toBe(PNG_BYTES.byteLength);
    // Key is generated server-side: month partition + random id, never the
    // client filename.
    expect(asset.object_key).toMatch(/^proof\/\d{4}\/\d{2}\/obj_[0-9a-f]{32}\.png$/);
    expect(asset.object_key).not.toContain('proof.png');

    const object = await testEnv.MEDIA.get(asset.object_key);
    expect(object).not.toBeNull();
    expect((await object!.arrayBuffer()).byteLength).toBe(PNG_BYTES.byteLength);
  });

  it('rejects a spoofed content type, an empty body and a non-image', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);

    const html = await upload(creator, new TextEncoder().encode('<html>not an image</html>'), {
      headers: { 'Content-Type': 'image/png' },
    });
    expect(html.status).toBe(400);
    expect(html.body.error.message).toContain('PNG, JPEG or WebP');

    const svg = await upload(
      creator,
      new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
    expect(svg.status).toBe(400);

    const empty = await upload(creator, new Uint8Array(0));
    expect(empty.status).toBe(400);
  });

  it('rejects files above the configured limit', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);

    const oversized = new Uint8Array(5 * 1024 * 1024 + 1);
    oversized.set(PNG_BYTES);
    const response = await upload(creator, oversized);
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('under');
  });

  it('requires authentication and a CSRF token', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);

    const anonymous = await api('/api/uploads/proof', {
      method: 'POST',
      rawBody: PNG_BYTES,
      headers: { 'Content-Type': 'image/png' },
    });
    expect(anonymous.status).toBe(401);

    const noCsrf = await upload(creator, PNG_BYTES, { csrf: null });
    expect(noCsrf.status).toBe(403);
  });

  it('only lets the owner, an admin or a public asset be read', async () => {
    const admin = await setupAdmin();
    const owner = await approvedCreator(admin);
    const stranger = await approvedCreator(admin);

    const uploaded = await upload(owner, PNG_BYTES);
    const assetId = uploaded.body.assetId;

    const read = (cookie?: string) =>
      SELF.fetch(
        new Request(`${APP_ORIGIN}/api/assets/${assetId}`, {
          headers: {
            'CF-Connecting-IP': freshIp(),
            ...(cookie ? { Cookie: cookie } : {}),
          },
        })
      );

    const ownerRead = await read(owner.cookie);
    expect(ownerRead.status).toBe(200);
    expect(ownerRead.headers.get('Content-Type')).toBe('image/png');
    expect(ownerRead.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(ownerRead.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(ownerRead.headers.get('Cache-Control')).toBe('private, no-store');

    const strangerRead = await read(stranger.cookie);
    expect(strangerRead.status).toBe(403);

    const anonymousRead = await read();
    expect(anonymousRead.status).toBe(403);

    const adminRead = await read(admin.cookie);
    expect(adminRead.status).toBe(200);

    const missing = await SELF.fetch(
      new Request(`${APP_ORIGIN}/api/assets/asset_does_not_exist`, {
        headers: { 'CF-Connecting-IP': freshIp(), Cookie: owner.cookie },
      })
    );
    expect(missing.status).toBe(404);
  });

  it('rate limits uploads per account', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);

    for (let index = 0; index < 30; index += 1) {
      const response = await upload(creator, PNG_BYTES);
      expect(response.status).toBe(201);
    }

    const blocked = await upload(creator, PNG_BYTES);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('rate_limited');
  });

  it('refuses to attach someone else’s proof to a submission', async () => {
    const admin = await setupAdmin();
    const owner = await approvedCreator(admin);
    const other = await approvedCreator(admin);
    const { id } = await createCampaign(admin);

    const uploaded = await upload(owner, PNG_BYTES);
    await joinCampaign(other, id);

    const response = await submitClip(other, id, { proofAssetId: uploaded.body.assetId });
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('could not be found');

    const own = await upload(other, PNG_BYTES);
    const accepted = await submitClip(other, id, { proofAssetId: own.body.assetId });
    expect(accepted.status).toBe(201);
  });
});
