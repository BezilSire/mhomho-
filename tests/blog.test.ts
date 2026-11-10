/**
 * Journal: admin authoring plus server-rendered public pages, sitemap and robots.
 * These tests assert what a crawler receives over HTTP, not what React renders.
 */
import { describe, expect, it } from 'vitest';
import { api, approvedCreator, setupAdmin } from './helpers.ts';

const APP_ORIGIN = 'http://localhost:3000';

const POST = {
  title: 'How much should a brand pay creators in Zimbabwe?',
  slug: null,
  excerpt:
    'A practical way to price creator work without guessing, from a single post to a full campaign.',
  bodyMd:
    '## Start with the outcome\n\nA creator fee should match the work and the reach it buys. **Never price only by follower count.**\n\n- Agree the deliverable\n- Agree the usage rights\n- Agree the payment date\n\n[Talk to MHOMHO](/) when you are ready to run a campaign.',
  coverImageUrl: null,
  tags: ['creators', 'brands', 'zimbabwe'],
  seoTitle: null,
  seoDescription: null,
  status: 'published' as const,
};

describe('journal', () => {
  it('publishes server-rendered articles with metadata, sitemap and robots', async () => {
    const admin = await setupAdmin();
    const created = await api('/api/admin/blog', {
      body: POST,
      cookie: admin.cookie,
      csrf: admin.csrf,
    });

    expect(created.status).toBe(201);
    const post = created.body.data.post;
    expect(post.status).toBe('published');
    expect(post.slug).toBe('how-much-should-a-brand-pay-creators-in-zimbabwe');

    const page = await api(`/blog/${post.slug}`);
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(page.body).toContain('<title>How much should a brand pay creators in Zimbabwe? — MHOMHO Journal</title>');
    expect(page.body).toContain('name="description"');
    expect(page.body).toContain(`rel="canonical" href="${APP_ORIGIN}/blog/${post.slug}"`);
    expect(page.body).toContain('"@type":"BlogPosting"');
    expect(page.body).toContain('<h2>Start with the outcome</h2>');
    expect(page.body).toContain('<strong>Never price only by follower count.</strong>');
    expect(page.body).not.toContain('<div id="root">');

    const index = await api('/blog');
    expect(index.status).toBe(200);
    expect(index.body).toContain(POST.title);
    expect(index.body).toContain(`/blog/${post.slug}`);

    const sitemap = await api('/sitemap.xml');
    expect(sitemap.status).toBe(200);
    expect(sitemap.headers.get('content-type')).toContain('application/xml');
    expect(sitemap.body).toContain(`<loc>${APP_ORIGIN}/blog/${post.slug}</loc>`);

    const robots = await api('/robots.txt');
    expect(robots.status).toBe(200);
    expect(robots.body).toContain(`Sitemap: ${APP_ORIGIN}/sitemap.xml`);
    expect(robots.body).toContain('Disallow: /console/');

    const rss = await api('/rss.xml');
    expect(rss.status).toBe(200);
    expect(rss.body).toContain('<title>MHOMHO Journal</title>');
    expect(rss.body).toContain(`<link>${APP_ORIGIN}/blog/${post.slug}</link>`);
  });

  it('keeps drafts out of the index, sitemap and public URL until published', async () => {
    const admin = await setupAdmin();
    const created = await api('/api/admin/blog', {
      body: { ...POST, status: 'draft' },
      cookie: admin.cookie,
      csrf: admin.csrf,
    });
    expect(created.status).toBe(201);
    const post = created.body.data.post;

    const hiddenPage = await api(`/blog/${post.slug}`);
    expect(hiddenPage.status).toBe(404);
    expect(hiddenPage.body).toContain('noindex, nofollow');

    const index = await api('/blog');
    expect(index.body).not.toContain(post.slug);

    const sitemap = await api('/sitemap.xml');
    expect(sitemap.body).not.toContain(post.slug);

    const published = await api(`/api/admin/blog/${post.id}`, {
      method: 'PATCH',
      cookie: admin.cookie,
      csrf: admin.csrf,
      body: { ...POST, status: 'published' },
    });
    expect(published.status).toBe(200);

    const live = await api(`/blog/${post.slug}`);
    expect(live.status).toBe(200);
    expect(live.body).toContain(POST.title);
  });

  it('rejects duplicate explicit slugs', async () => {
    const admin = await setupAdmin();
    const input = { ...POST, slug: 'creator-pricing' };
    const first = await api('/api/admin/blog', {
      body: input,
      cookie: admin.cookie,
      csrf: admin.csrf,
    });
    expect(first.status).toBe(201);

    const second = await api('/api/admin/blog', {
      body: { ...input, title: 'Another pricing article' },
      cookie: admin.cookie,
      csrf: admin.csrf,
    });
    expect(second.status).toBe(409);
  });

  it('lets only admins write and enforces validation', async () => {
    const admin = await setupAdmin();
    const creator = await approvedCreator(admin);

    const forbidden = await api('/api/admin/blog', {
      body: POST,
      cookie: creator.cookie,
      csrf: creator.csrf,
    });
    expect(forbidden.status).toBe(403);

    const invalid = await api('/api/admin/blog', {
      body: { ...POST, title: '' },
      cookie: admin.cookie,
      csrf: admin.csrf,
    });
    expect(invalid.status).toBe(400);

    const unsafeCover = await api('/api/admin/blog', {
      body: { ...POST, coverImageUrl: 'javascript:alert(1)' },
      cookie: admin.cookie,
      csrf: admin.csrf,
    });
    expect(unsafeCover.status).toBe(400);
  });
});
