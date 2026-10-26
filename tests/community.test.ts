/**
 * Community release: preset avatars, recent creators, the monthly verified-view
 * leaderboard and the approved-creator forum.
 *
 * The tests drive the real Worker and D1 so role checks, CSRF, constraints and
 * the moderation state machine are all exercised.
 */
import { describe, expect, it } from 'vitest';
import {
  api,
  approvedCreator,
  createCampaign,
  joinCampaign,
  registerCreator,
  setupAdmin,
  submitClip,
  unique,
  verifySubmission,
  type Session,
} from './helpers.ts';

async function createThread(
  creator: Session,
  values: { category?: string; title?: string; body?: string } = {}
) {
  return api('/api/community/threads', {
    cookie: creator.cookie,
    csrf: creator.csrf,
    body: {
      category: values.category ?? 'general',
      title: values.title ?? unique('How do you price a beauty clip'),
      body:
        values.body ??
        'I am testing a new workflow and would like to hear what works for other creators.',
    },
  });
}

async function replyToThread(creator: Session, threadId: string, body = 'This worked for me too.') {
  return api(`/api/community/threads/${threadId}/replies`, {
    cookie: creator.cookie,
    csrf: creator.csrf,
    body: { body },
  });
}

describe('community access and recent creators', () => {
  it('is visible to approved creators only and never exposes applicants', async () => {
    const admin = await setupAdmin();
    const approvedHandle = unique('approved');
    const otherHandle = unique('other');
    const applicantHandle = unique('applicant');
    const approved = await approvedCreator(admin, { handle: approvedHandle });
    await approvedCreator(admin, { handle: otherHandle });
    const applicant = await registerCreator({ handle: applicantHandle });

    const anonymous = await api('/api/community');
    expect(anonymous.status).toBe(401);

    const underReview = await api('/api/community', { cookie: applicant.cookie });
    expect(underReview.status).toBe(403);

    const response = await api('/api/community', { cookie: approved.cookie });
    expect(response.status).toBe(200);

    const handles = (response.body.data.recentCreators as Array<{ handle: string }>).map(
      (creator) => creator.handle
    );
    expect(handles).toContain(`@${approvedHandle}`);
    expect(handles).toContain(`@${otherHandle}`);
    expect(handles).not.toContain(`@${applicantHandle}`);
    expect(handles.every((handle) => handle.startsWith('@'))).toBe(true);
    expect(response.body.data.month.label).toBeTruthy();
    expect(Array.isArray(response.body.data.leaderboard)).toBe(true);

    const adminView = await api('/api/admin/community', { cookie: admin.cookie });
    expect(adminView.status).toBe(200);
    const adminCreators = adminView.body.data.recentCreators as Array<{
      uid: string;
      status: string;
    }>;
    expect(adminCreators.some((creator) => creator.uid === applicant.accountId)).toBe(true);
    expect(
      adminCreators.some(
        (creator) => creator.uid === applicant.accountId && creator.status === 'applied'
      )
    ).toBe(true);
  });

  it('stores only a validated preset avatar key', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);

    const save = await api('/api/profile', {
      method: 'PATCH',
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: {
        displayName: 'Test Creator',
        niche: 'Beauty',
        followers: 4000,
        platform: 'TikTok',
        whatsappNumber: '+263771234567',
        ecoCashNumber: '+263771234567',
        avatarKey: 'bolt',
      },
    });
    expect(save.status).toBe(200);

    const bootstrap = await api('/api/bootstrap', { cookie: creator.cookie });
    expect(bootstrap.body.data.creatorsPublic[creator.accountId].avatarKey).toBe('bolt');

    const invalid = await api('/api/profile', {
      method: 'PATCH',
      cookie: creator.cookie,
      csrf: creator.csrf,
      body: {
        displayName: 'Test Creator',
        niche: 'Beauty',
        followers: 4000,
        platform: 'TikTok',
        whatsappNumber: '+263771234567',
        ecoCashNumber: '+263771234567',
        avatarKey: 'not-an-avatar',
      },
    });
    expect(invalid.status).toBe(400);

    const after = await api('/api/bootstrap', { cookie: creator.cookie });
    expect(after.body.data.creatorsPublic[creator.accountId].avatarKey).toBe('bolt');
  });
});

describe('monthly verified-view leaderboard', () => {
  it('counts approved views and excludes below-threshold rejections', async () => {
    const admin = await setupAdmin();
    const accepted = await approvedCreator(admin, { handle: unique('accepted') });
    const rejected = await approvedCreator(admin, { handle: unique('rejected') });
    const campaign = await createCampaign(admin);

    await joinCampaign(accepted, campaign.id);
    await joinCampaign(rejected, campaign.id);

    const acceptedClip = await submitClip(accepted, campaign.id, { claimedViews: 6000 });
    const rejectedClip = await submitClip(rejected, campaign.id, { claimedViews: 600 });
    expect(acceptedClip.status).toBe(201);
    expect(rejectedClip.status).toBe(201);

    const acceptedVerify = await verifySubmission(
      admin,
      acceptedClip.body.submissionId,
      5000
    );
    const rejectedVerify = await verifySubmission(
      admin,
      rejectedClip.body.submissionId,
      999
    );
    expect(acceptedVerify.status).toBe(200);
    expect(rejectedVerify.body.rejected).toBe(true);

    const response = await api('/api/community', { cookie: accepted.cookie });
    expect(response.status).toBe(200);

    const leaderboard = response.body.data.leaderboard as Array<{
      uid: string;
      views: number;
      rank: number;
    }>;
    expect(leaderboard).toHaveLength(1);
    expect(leaderboard[0].uid).toBe(accepted.accountId);
    expect(leaderboard[0].views).toBe(5000);
    expect(leaderboard[0].rank).toBe(1);
    expect(response.body.data.viewerRank).toBe(1);
    expect(response.body.data.viewerViews).toBe(5000);
  });
});

describe('creator discussions', () => {
  it('lets approved creators post, reply, lock and hide with admin moderation', async () => {
    const admin = await setupAdmin();
    const author = await approvedCreator(admin, { handle: unique('author') });
    const reader = await approvedCreator(admin, { handle: unique('reader') });

    const created = await createThread(author);
    expect(created.status).toBe(201);
    const threadId = created.body.data.threadId as string;
    expect(threadId).toBeTruthy();

    const list = await api('/api/community/threads', { cookie: reader.cookie });
    expect(list.status).toBe(200);
    expect(
      (list.body.data.threads as Array<{ id: string }>).some((thread) => thread.id === threadId)
    ).toBe(true);

    const reply = await replyToThread(reader, threadId);
    expect(reply.status).toBe(201);

    const detail = await api(`/api/community/threads/${threadId}`, { cookie: author.cookie });
    expect(detail.status).toBe(200);
    expect(detail.body.data.thread.replyCount).toBe(1);
    expect(detail.body.data.replies).toHaveLength(1);
    expect(detail.body.data.replies[0].body).toContain('worked for me');

    const locked = await api(`/api/admin/community/threads/${threadId}`, {
      method: 'PATCH',
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { status: 'locked' },
    });
    expect(locked.status).toBe(200);

    const blockedReply = await replyToThread(reader, threadId, 'Too late');
    expect(blockedReply.status).toBe(409);

    const hidden = await api(`/api/admin/community/threads/${threadId}`, {
      method: 'PATCH',
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { status: 'hidden', pinned: true },
    });
    expect(hidden.status).toBe(200);

    const readerDetail = await api(`/api/community/threads/${threadId}`, {
      cookie: reader.cookie,
    });
    expect(readerDetail.status).toBe(404);

    const readerList = await api('/api/community/threads', { cookie: reader.cookie });
    expect(
      (readerList.body.data.threads as Array<{ id: string }>).some(
        (thread) => thread.id === threadId
      )
    ).toBe(false);

    const adminOverview = await api('/api/admin/community', { cookie: admin.cookie });
    expect(adminOverview.status).toBe(200);
    const adminThread = (
      adminOverview.body.data.threads as Array<{ id: string; status: string; pinned: boolean }>
    ).find((thread) => thread.id === threadId);
    expect(adminThread?.status).toBe('hidden');
    expect(adminThread?.pinned).toBe(true);

    const restored = await api(`/api/admin/community/threads/${threadId}`, {
      method: 'PATCH',
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { status: 'active' },
    });
    expect(restored.status).toBe(200);

    const visibleAgain = await api(`/api/community/threads/${threadId}`, {
      cookie: reader.cookie,
    });
    expect(visibleAgain.status).toBe(200);
  });

  it('refuses creator moderation and missing CSRF', async () => {
    const admin = await setupAdmin();
    const author = await approvedCreator(admin);
    const created = await createThread(author);
    const threadId = created.body.data.threadId as string;

    const noCsrf = await api(`/api/community/threads/${threadId}/replies`, {
      method: 'POST',
      cookie: author.cookie,
      body: { body: 'No token here' },
    });
    expect(noCsrf.status).toBe(403);

    const blank = await createThread(author, { title: '     ', body: '          ' });
    expect(blank.status).toBe(400);

    const creatorModeration = await api(`/api/admin/community/threads/${threadId}`, {
      method: 'PATCH',
      cookie: author.cookie,
      csrf: author.csrf,
      body: { status: 'hidden' },
    });
    expect(creatorModeration.status).toBe(403);
  });

  it('enforces the hourly thread and reply write limits', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);

    const createdIds: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      const created = await createThread(creator, {
        title: unique(`Rate limit discussion ${index}`),
        body: `This is discussion number ${index} and it has enough detail to pass validation.`,
      });
      expect(created.status).toBe(201);
      createdIds.push(created.body.data.threadId as string);
    }

    const sixthThread = await createThread(creator, { title: unique('One too many') });
    expect(sixthThread.status).toBe(429);
    expect(sixthThread.body.error.details.retryAfterSeconds).toBeGreaterThan(0);

    for (let index = 0; index < 20; index += 1) {
      const reply = await replyToThread(creator, createdIds[0], `Reply number ${index}`);
      expect(reply.status).toBe(201);
    }

    const extraReply = await replyToThread(creator, createdIds[0], 'One reply too many');
    expect(extraReply.status).toBe(429);
    expect(extraReply.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('hides an individual reply without deleting the thread', async () => {
    const admin = await setupAdmin();
    const author = await approvedCreator(admin);
    const reader = await approvedCreator(admin);

    const created = await createThread(author);
    const threadId = created.body.data.threadId as string;
    const reply = await replyToThread(reader, threadId);
    const replyId = reply.body.data.replyId as string;

    const hidden = await api(`/api/admin/community/replies/${replyId}`, {
      method: 'PATCH',
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { status: 'hidden' },
    });
    expect(hidden.status).toBe(200);

    const creatorView = await api(`/api/community/threads/${threadId}`, {
      cookie: author.cookie,
    });
    expect(creatorView.status).toBe(200);
    expect(creatorView.body.data.replies).toHaveLength(0);

    const adminView = await api(`/api/community/threads/${threadId}`, {
      cookie: admin.cookie,
    });
    expect(adminView.status).toBe(200);
    expect(adminView.body.data.replies).toHaveLength(1);
    expect(adminView.body.data.replies[0].status).toBe('hidden');
  });
});
