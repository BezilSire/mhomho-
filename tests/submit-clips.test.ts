/**
 * Batch clip submission: up to two clips in one call, one per platform.
 */
import { describe, expect, it } from 'vitest';
import {
  api,
  approvedCreator,
  createCampaign,
  joinCampaign,
  postUrl,
  setupAdmin,
  testEnv,
} from './helpers.ts';

describe('clip submissions', () => {
  it('accepts two clips on different platforms in one submission', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const campaign = await createCampaign(admin);
    await joinCampaign(creator, campaign.id);

    const response = await api('/api/submissions', {
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: {
        campaignId: campaign.id,
        clips: [
          { platform: 'TikTok', postUrl: postUrl('TikTok'), claimedViews: 4200 },
          { platform: 'Instagram', postUrl: postUrl('Instagram'), claimedViews: 2600 },
        ],
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.submissionIds).toHaveLength(2);

    const rows = await testEnv.DB.prepare(
      `SELECT platform, claimed_views FROM submissions WHERE campaign_id = ? AND creator_id = ? ORDER BY platform`
    )
      .bind(campaign.id, creator.accountId)
      .all<Record<string, unknown>>();

    expect(rows.results).toHaveLength(2);
    expect(rows.results?.map((row) => row.platform).sort()).toEqual(['Instagram', 'TikTok']);
  });

  it('rejects two clips on the same platform', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const campaign = await createCampaign(admin);
    await joinCampaign(creator, campaign.id);

    const response = await api('/api/submissions', {
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: {
        campaignId: campaign.id,
        clips: [
          { platform: 'TikTok', postUrl: postUrl('TikTok'), claimedViews: 4200 },
          { platform: 'TikTok', postUrl: postUrl('TikTok'), claimedViews: 2600 },
        ],
      },
    });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('different platform');
  });

  it('rejects more than two clips in one call', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const campaign = await createCampaign(admin);
    await joinCampaign(creator, campaign.id);

    const response = await api('/api/submissions', {
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: {
        campaignId: campaign.id,
        clips: [
          { platform: 'TikTok', postUrl: postUrl('TikTok'), claimedViews: 4200 },
          { platform: 'Instagram', postUrl: postUrl('Instagram'), claimedViews: 2600 },
          { platform: 'YouTube', postUrl: postUrl('YouTube'), claimedViews: 1800 },
        ],
      },
    });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('too many');
  });
});
