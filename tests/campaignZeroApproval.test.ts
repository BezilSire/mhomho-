import { describe, expect, it } from 'vitest';
import {
  api,
  bootstrap,
  completeCampaignZero,
  registerCreator,
  setupAdmin,
  testEnv,
} from './helpers.ts';

describe('Campaign Zero approval verification', () => {
  it('requires a clip and at least 500 verified views', async () => {
    const admin = await setupAdmin();
    const creator = await registerCreator();
    const { clipIds } = await completeCampaignZero(creator);

    const missing = await api(`/api/admin/creators/${creator.accountId}/approve`, {
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: {},
    });
    expect(missing.status).toBe(400);

    const below = await api(`/api/admin/creators/${creator.accountId}/approve`, {
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { verifiedClipId: clipIds[0], verifiedViews: 499 },
    });
    expect(below.status).toBe(400);

    const state = await bootstrap(creator.cookie);
    expect(state.body.data.viewer.status).toBe('applied');

    const row = await testEnv.DB.prepare(
      `SELECT verified_views FROM creator_campaign_zero_clips WHERE id = ?`
    )
      .bind(clipIds[0])
      .first<{ verified_views: number | null }>();
    expect(row?.verified_views).toBeNull();
  });

  it('rejects a clip that belongs to another creator', async () => {
    const admin = await setupAdmin();
    const first = await registerCreator();
    const second = await registerCreator();
    const { clipIds } = await completeCampaignZero(first);
    await completeCampaignZero(second);

    const response = await api(`/api/admin/creators/${second.accountId}/approve`, {
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { verifiedClipId: clipIds[0], verifiedViews: 1500 },
    });

    expect(response.status).toBe(400);
    const state = await bootstrap(second.cookie);
    expect(state.body.data.viewer.status).toBe('applied');
  });

  it('stores the verified count, admin and timestamp on approval', async () => {
    const admin = await setupAdmin();
    const creator = await registerCreator();
    const { clipIds } = await completeCampaignZero(creator);
    const clipId = clipIds[0];

    const response = await api(`/api/admin/creators/${creator.accountId}/approve`, {
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { verifiedClipId: clipId, verifiedViews: 500 },
    });
    expect(response.status).toBe(200);

    const row = await testEnv.DB.prepare(
      `SELECT verified_views, verified_by, verified_at
         FROM creator_campaign_zero_clips WHERE id = ?`
    )
      .bind(clipId)
      .first<{ verified_views: number; verified_by: string; verified_at: number }>();
    expect(row?.verified_views).toBe(500);
    expect(row?.verified_by).toBe(admin.accountId);
    expect(row?.verified_at).toBeGreaterThan(0);

    const audit = await testEnv.DB.prepare(
      `SELECT after_json FROM audit_events
        WHERE action = 'creator.approve' AND entity_id = ?
        ORDER BY created_at DESC LIMIT 1`
    )
      .bind(creator.accountId)
      .first<{ after_json: string }>();
    expect(JSON.parse(String(audit?.after_json))).toMatchObject({
      status: 'approved',
      verifiedClipId: clipId,
      verifiedViews: 500,
    });

    const state = await bootstrap(creator.cookie);
    expect(state.body.data.viewer.status).toBe('approved');
    const clip = state.body.data.creatorsPublic[creator.accountId].campaignZero.clips.find(
      (item: { id: string }) => item.id === clipId
    );
    expect(clip).toMatchObject({
      verifiedViews: 500,
      verifiedBy: admin.accountId,
    });
    expect(clip.verifiedAt).toBeTruthy();
  });
});
