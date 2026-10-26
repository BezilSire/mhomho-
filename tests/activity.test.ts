/**
 * Activity feed and campaign joiner detail.
 *
 * The feed is the only place where one creator's arrival is intentionally
 * visible to someone else, so the disclosure rules are asserted directly:
 * anonymous callers get a first name and no handle, signed-in creators get a
 * handle, and nobody ever sees their own arrival echoed back.
 */
import { describe, expect, it } from 'vitest';
import {
  api,
  approvedCreator,
  createCampaign,
  joinCampaign,
  PNG_BYTES,
  registerCreator,
  setupAdmin,
  unique,
} from './helpers.ts';

describe('activity feed', () => {
  it('shows only a first name to anonymous visitors', async () => {
    await registerCreator({ handle: unique('private-handle') });

    const response = await api('/api/activity');
    expect(response.status).toBe(200);

    const items = response.body.data.items as Array<Record<string, unknown>>;
    const signup = items.find((item) => item.type === 'signup');
    expect(signup).toBeTruthy();
    expect(signup?.firstName).toBe('Test');
    expect(signup?.handle).toBeNull();
    expect(signup?.uid).toBeNull();
  });

  it('gives signed-in creators the handle and never their own event', async () => {
    const viewerHandle = unique('viewer');
    const otherHandle = unique('other');
    const viewer = await registerCreator({ handle: viewerHandle });
    await registerCreator({ handle: otherHandle });

    const response = await api('/api/activity', { cookie: viewer.cookie });
    expect(response.status).toBe(200);

    const items = response.body.data.items as Array<Record<string, unknown>>;
    const handles = items.map((item) => item.handle);
    expect(handles).toContain(`@${otherHandle}`);
    expect(handles).not.toContain(`@${viewerHandle}`);
  });

  it('records campaign joins alongside sign-ups', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const campaign = await createCampaign(admin);
    const joined = await joinCampaign(creator, campaign.id);
    expect(joined.status).toBe(200);

    const response = await api('/api/activity', { cookie: admin.cookie });
    const items = response.body.data.items as Array<Record<string, unknown>>;
    const join = items.find(
      (item) => item.type === 'join' && item.campaignId === campaign.id
    );
    expect(join).toBeTruthy();
    expect(typeof join?.campaignTitle).toBe('string');
    expect((join?.campaignTitle as string).length).toBeGreaterThan(0);
    expect(Number(join?.at)).toBeGreaterThan(0);
  });
});

describe('admin campaign members', () => {
  it('returns joiners with time, platform and review state', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin, { platform: 'Instagram' });
    const campaign = await createCampaign(admin);
    await joinCampaign(creator, campaign.id);

    const response = await api(`/api/admin/campaigns/${campaign.id}/members`, {
      cookie: admin.cookie,
    });
    expect(response.status).toBe(200);
    expect(response.body.data.total).toBe(1);

    const member = response.body.data.members[0];
    expect(member.uid).toBe(creator.accountId);
    expect(member.platform).toBe('Instagram');
    expect(member.joinedAtMs).toBeGreaterThan(0);
    expect(member.accountStatus).toBe('approved');
    expect(member.clipsSubmitted).toBe(0);
  });

  it('refuses non-admins', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const campaign = await createCampaign(admin);

    const response = await api(`/api/admin/campaigns/${campaign.id}/members`, {
      cookie: creator.cookie,
    });
    expect(response.status).toBe(403);
  });
});

describe('campaign creation extensions', () => {
  it('keeps drafts out of the creator feed', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);
    const title = unique('Draft campaign');

    const created = await api('/api/admin/campaigns', {
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: {
        title,
        brandName: 'Draft Brand',
        niche: 'Beauty',
        brief: 'A draft that creators must not see until it is published.',
        budgetCents: 25_000,
        publishMode: 'draft',
      },
    });
    expect(created.status).toBe(201);

    const creatorView = await api('/api/bootstrap', { cookie: creator.cookie });
    const titles = Object.values(creatorView.body.data.campaigns as Record<string, any>).map(
      (campaign) => campaign.title
    );
    expect(titles).not.toContain(title);

    const adminView = await api('/api/bootstrap', { cookie: admin.cookie });
    const adminTitles = Object.values(adminView.body.data.campaigns as Record<string, any>).map(
      (campaign) => campaign.title
    );
    expect(adminTitles).toContain(title);
  });

  it('uploads a public poster and exposes it on the campaign', async () => {
    const admin = await setupAdmin();
    const campaign = await createCampaign(admin);

    const upload = await api(`/api/admin/campaigns/${campaign.id}/poster`, {
      cookie: admin.cookie,
      csrf: admin.csrf,
      rawBody: PNG_BYTES,
      headers: { 'Content-Type': 'image/png' },
    });
    expect(upload.status).toBe(201);
    expect(upload.body.assetId).toMatch(/^asset_/);

    const adminView = await api('/api/bootstrap', { cookie: admin.cookie });
    const stored = adminView.body.data.campaigns[campaign.id];
    expect(stored.posterUrl).toBe(`/api/assets/${upload.body.assetId}`);

    // Posters are public by design; no session is required to render a feed card.
    const asset = await api(`/api/assets/${upload.body.assetId}`);
    expect(asset.status).toBe(200);
  });
});
