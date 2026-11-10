import type { Ctx } from '../context.ts';
import { recordAudit } from '../audit.ts';
import { requireAdmin } from '../auth.ts';
import { badRequest, conflict, json, notFound } from '../http.ts';
import { body, guardMutation, hashIp } from './helpers.ts';

type Row = Record<string, unknown>;

const BLOG_STATUSES = ['draft', 'published'] as const;

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseTags(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function normaliseSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function cleanTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const tag = item.trim().slice(0, 30);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= 8) break;
  }
  return out;
}

function cleanHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw badRequest('Cover image must be an http(s) URL.');
    }
    return url.toString();
  } catch (error) {
    if (error instanceof Error && 'status' in error) throw error;
    throw badRequest('Cover image must be a valid URL.');
  }
}

function postFromRow(row: Row): Record<string, unknown> {
  return {
    id: str(row.id),
    slug: str(row.slug),
    title: str(row.title),
    excerpt: str(row.excerpt),
    bodyMd: str(row.body_md),
    coverImageUrl: row.cover_image_url === null ? null : str(row.cover_image_url),
    tags: parseTags(row.tags),
    seoTitle: row.seo_title === null ? null : str(row.seo_title),
    seoDescription: row.seo_description === null ? null : str(row.seo_description),
    status: str(row.status),
    publishedAt:
      row.published_at === null
        ? null
        : new Date(num(row.published_at)).toISOString(),
    createdAt: new Date(num(row.created_at)).toISOString(),
    updatedAt: new Date(num(row.updated_at)).toISOString(),
  };
}

async function getPost(ctx: Ctx, id: string): Promise<Row | null> {
  return ctx.env.DB.prepare(`SELECT * FROM blog_posts WHERE id = ?`).bind(id).first<Row>();
}

interface BlogInput {
  title: string;
  slug: string | null;
  excerpt: string;
  bodyMd: string;
  coverImageUrl: string | null;
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  status: (typeof BLOG_STATUSES)[number];
}

const BLOG_SCHEMA = {
  title: { type: 'string' as const, required: true, min: 2, max: 160 },
  slug: { type: 'string' as const, min: 2, max: 80, nullable: true },
  excerpt: { type: 'string' as const, required: true, min: 10, max: 320 },
  bodyMd: { type: 'string' as const, required: true, min: 20, max: 60_000 },
  coverImageUrl: { type: 'string' as const, max: 500, nullable: true },
  tags: {
    type: 'array' as const,
    max: 16,
    items: { type: 'string' as const, min: 1, max: 40 },
  },
  seoTitle: { type: 'string' as const, max: 70, nullable: true },
  seoDescription: { type: 'string' as const, max: 180, nullable: true },
  status: { type: 'string' as const, required: true, values: BLOG_STATUSES },
};

async function resolveSlug(
  ctx: Ctx,
  input: BlogInput,
  existingId: string | null
): Promise<string> {
  const explicit = input.slug ? normaliseSlug(input.slug) : '';
  const base = explicit || normaliseSlug(input.title);
  if (!base) throw badRequest('Enter a title or slug that contains letters or numbers.');

  const check = async (candidate: string) => {
    const row = await ctx.env.DB.prepare(
      `SELECT id FROM blog_posts WHERE slug = ? ${existingId ? 'AND id <> ?' : ''}`
    )
      .bind(...(existingId ? [candidate, existingId] : [candidate]))
      .first<Row>();
    return Boolean(row);
  };

  if (!(await check(base))) return base;

  if (explicit) throw conflict('That slug is already used by another article.');

  for (let index = 2; index <= 50; index += 1) {
    const candidate = `${base}-${index}`;
    if (!(await check(candidate))) return candidate;
  }
  throw conflict('Could not create a unique slug. Try a different title.');
}

export async function handleAdminBlogList(ctx: Ctx): Promise<Response> {
  requireAdmin(ctx);
  const result = await ctx.env.DB.prepare(
    `SELECT * FROM blog_posts ORDER BY updated_at DESC`
  ).all<Row>();
  return json({ ok: true, data: { posts: (result.results ?? []).map(postFromRow) } });
}

export async function handleAdminBlogCreate(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const admin = requireAdmin(ctx);

  const input = await body<BlogInput>(ctx, BLOG_SCHEMA);
  const tags = cleanTags(input.tags);
  const cover = cleanHttpUrl(input.coverImageUrl);
  const slug = await resolveSlug(ctx, input, null);
  const now = Date.now();
  const publishedAt = input.status === 'published' ? now : null;
  const id = `post_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;

  await ctx.env.DB.prepare(
    `INSERT INTO blog_posts
       (id, slug, title, excerpt, body_md, cover_image_url, tags, seo_title,
        seo_description, status, published_at, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      slug,
      input.title,
      input.excerpt,
      input.bodyMd,
      cover,
      JSON.stringify(tags),
      input.seoTitle ?? null,
      input.seoDescription ?? null,
      input.status,
      publishedAt,
      admin.id,
      now,
      now
    )
    .run();

  await recordAudit(ctx.env, {
    actorId: admin.id,
    actorRole: 'admin',
    action: 'blog.create',
    entityType: 'blog_post',
    entityId: id,
    after: { slug, title: input.title, status: input.status },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  const row = await getPost(ctx, id);
  return json({ ok: true, data: { post: row ? postFromRow(row) : null } }, 201);
}

export async function handleAdminBlogUpdate(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const admin = requireAdmin(ctx);

  const existing = await getPost(ctx, ctx.params.id);
  if (!existing) throw notFound('Article not found.');

  const input = await body<BlogInput>(ctx, BLOG_SCHEMA);
  const tags = cleanTags(input.tags);
  const cover = cleanHttpUrl(input.coverImageUrl);
  const slug = await resolveSlug(ctx, input, ctx.params.id);
  const now = Date.now();
  const publishedAt =
    input.status === 'published' ? num(existing.published_at, now) || now : existing.published_at;

  await ctx.env.DB.prepare(
    `UPDATE blog_posts
        SET slug = ?, title = ?, excerpt = ?, body_md = ?, cover_image_url = ?,
            tags = ?, seo_title = ?, seo_description = ?, status = ?,
            published_at = ?, updated_at = ?
      WHERE id = ?`
  )
    .bind(
      slug,
      input.title,
      input.excerpt,
      input.bodyMd,
      cover,
      JSON.stringify(tags),
      input.seoTitle ?? null,
      input.seoDescription ?? null,
      input.status,
      publishedAt,
      now,
      ctx.params.id
    )
    .run();

  await recordAudit(ctx.env, {
    actorId: admin.id,
    actorRole: 'admin',
    action: 'blog.update',
    entityType: 'blog_post',
    entityId: ctx.params.id,
    before: { slug: str(existing.slug), title: str(existing.title), status: str(existing.status) },
    after: { slug, title: input.title, status: input.status },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  const row = await getPost(ctx, ctx.params.id);
  return json({ ok: true, data: { post: row ? postFromRow(row) : null } });
}

export async function handleAdminBlogDelete(ctx: Ctx): Promise<Response> {
  guardMutation(ctx);
  const admin = requireAdmin(ctx);

  const existing = await getPost(ctx, ctx.params.id);
  if (!existing) throw notFound('Article not found.');

  await ctx.env.DB.prepare(`DELETE FROM blog_posts WHERE id = ?`).bind(ctx.params.id).run();

  await recordAudit(ctx.env, {
    actorId: admin.id,
    actorRole: 'admin',
    action: 'blog.delete',
    entityType: 'blog_post',
    entityId: ctx.params.id,
    before: {
      slug: str(existing.slug),
      title: str(existing.title),
      status: str(existing.status),
    },
    requestId: ctx.requestId,
    ipHash: await hashIp(ctx.env, ctx.request),
  });

  return json({ ok: true });
}
