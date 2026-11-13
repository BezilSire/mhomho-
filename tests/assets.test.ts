import { describe, expect, it } from 'vitest';
import { api, PNG_BYTES, registerCreator, setupAdmin, testEnv } from './helpers.ts';

describe('admin journal image uploads', () => {
  it('stores an image and serves it publicly', async () => {
    const admin = await setupAdmin();

    const response = await api('/api/admin/assets', {
      cookie: admin.cookie,
      csrf: admin.csrf,
      rawBody: PNG_BYTES,
      headers: { 'Content-Type': 'image/png' },
    });

    expect(response.status).toBe(201);
    const assetId = String(response.body.assetId ?? '');
    expect(assetId).toBeTruthy();
    expect(String(response.body.url ?? '')).toContain(`/api/public/assets/${assetId}`);

    const row = await testEnv.DB.prepare(
      `SELECT kind, visibility, status, content_type, object_key
         FROM campaign_assets WHERE id = ?`
    )
      .bind(assetId)
      .first<Record<string, string>>();
    expect(row?.kind).toBe('brand_material');
    expect(row?.visibility).toBe('public');
    expect(row?.status).toBe('ready');
    expect(row?.content_type).toBe('image/png');

    // The bytes land in the asset bucket under a journal key.
    const stored = await testEnv.PROOFS.get(String(row?.object_key), 'arrayBuffer');
    expect(stored).toBeTruthy();

    // The public route serves it without a session, so crawlers can fetch it.
    const publicRead = await api(`/api/public/assets/${assetId}`);
    expect(publicRead.status).toBe(200);
    expect(publicRead.headers.get('Content-Type')).toBe('image/png');
    expect(publicRead.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('refuses a creator', async () => {
    const creator = await registerCreator();
    const response = await api('/api/admin/assets', {
      cookie: creator.cookie,
      csrf: creator.csrf,
      rawBody: PNG_BYTES,
      headers: { 'Content-Type': 'image/png' },
    });
    expect(response.status).toBe(403);
  });

  it('refuses a file that is not an image', async () => {
    const admin = await setupAdmin();
    const response = await api('/api/admin/assets', {
      cookie: admin.cookie,
      csrf: admin.csrf,
      rawBody: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
      headers: { 'Content-Type': 'image/png' },
    });
    expect(response.status).toBe(400);
  });

  it('refuses an upload without the csrf token', async () => {
    const admin = await setupAdmin();
    const response = await api('/api/admin/assets', {
      cookie: admin.cookie,
      rawBody: PNG_BYTES,
      headers: { 'Content-Type': 'image/png' },
    });
    expect(response.status).toBe(403);
  });
});



