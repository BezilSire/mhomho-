import React, { useCallback, useEffect, useState } from 'react';
import { Card } from '../../components/Card.tsx';
import { Tag } from '../../components/Tag.tsx';
import { Button } from '../../components/Button.tsx';
import {
  AdminBlogPost,
  BlogPostInput,
  BlogPostStatus,
  createBlogPost,
  deleteBlogPost,
  listBlogPosts,
  updateBlogPost,
} from '../../lib/api.ts';

interface Draft {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  bodyMd: string;
  coverImageUrl: string;
  tags: string;
  seoTitle: string;
  seoDescription: string;
  status: BlogPostStatus;
}

const EMPTY_DRAFT: Draft = {
  id: null,
  title: '',
  slug: '',
  excerpt: '',
  bodyMd: '',
  coverImageUrl: '',
  tags: '',
  seoTitle: '',
  seoDescription: '',
  status: 'draft',
};

function draftFromPost(post: AdminBlogPost): Draft {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    bodyMd: post.bodyMd,
    coverImageUrl: post.coverImageUrl ?? '',
    tags: post.tags.join(', '),
    seoTitle: post.seoTitle ?? '',
    seoDescription: post.seoDescription ?? '',
    status: post.status,
  };
}

function formatDate(value: string | null): string {
  if (!value) return 'Not published';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

const fieldClass =
  'w-full rounded-[12px] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[13.5px] text-[var(--text)] outline-none focus:border-[var(--a1)]';

const labelClass = 'mb-1.5 block text-[11.5px] font-bold uppercase tracking-[0.08em] text-[var(--faint)]';

const Editor: React.FC<{
  draft: Draft;
  saving: boolean;
  error: string;
  onChange: (draft: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
}> = ({ draft, saving, error, onChange, onCancel, onSave }) => {
  const update = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const words = wordCount(draft.bodyMd);
  const isPublished = draft.status === 'published';

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-[17px] font-bold">
            {draft.id ? 'Edit article' : 'New article'}
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">
            {words} words · {isPublished ? 'Visible to Google and readers' : 'Draft only'}
          </p>
        </div>
        <Tag variant={isPublished ? 'ok' : 'warn'}>{draft.status}</Tag>
      </div>

      <div className="mt-4 grid gap-4">
        <div>
          <label className={labelClass} htmlFor="blog-title">
            Title
          </label>
          <input
            id="blog-title"
            className={fieldClass}
            value={draft.title}
            maxLength={160}
            placeholder="How much should a brand pay creators in Zimbabwe?"
            onChange={(event) => update({ title: event.target.value })}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="blog-slug">
            Slug
          </label>
          <input
            id="blog-slug"
            className={fieldClass}
            value={draft.slug}
            maxLength={80}
            placeholder="auto-created-from-title"
            onChange={(event) => update({ slug: event.target.value })}
          />
          <p className="mt-1 text-[11px] text-[var(--faint)]">
            mhomho.work/blog/{draft.slug || 'auto-created-from-title'}
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="blog-excerpt">
            Excerpt
          </label>
          <textarea
            id="blog-excerpt"
            className={`${fieldClass} min-h-[74px] resize-y`}
            value={draft.excerpt}
            maxLength={320}
            placeholder="One or two sentences that appear on the Journal page and in search results."
            onChange={(event) => update({ excerpt: event.target.value })}
          />
          <p className="mt-1 text-right text-[11px] text-[var(--faint)]">
            {draft.excerpt.length}/320
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="blog-body">
            Article
          </label>
          <textarea
            id="blog-body"
            className={`${fieldClass} min-h-[320px] resize-y font-mono text-[12.5px] leading-relaxed`}
            value={draft.bodyMd}
            maxLength={60000}
            placeholder={'Write in Markdown.\n\n## A heading\n\nA paragraph with **bold**, *italic* and [a link](https://example.com).\n\n- First point\n- Second point'}
            onChange={(event) => update({ bodyMd: event.target.value })}
          />
          <p className="mt-1 text-[11px] text-[var(--faint)]">
            Markdown: ## headings, **bold**, *italic*, [links](url), lists, quotes and code blocks.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="blog-cover">
              Cover image URL
            </label>
            <input
              id="blog-cover"
              className={fieldClass}
              value={draft.coverImageUrl}
              maxLength={500}
              placeholder="https://…"
              onChange={(event) => update({ coverImageUrl: event.target.value })}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="blog-tags">
              Tags
            </label>
            <input
              id="blog-tags"
              className={fieldClass}
              value={draft.tags}
              placeholder="creators, brands, zimbabwe"
              onChange={(event) => update({ tags: event.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="blog-seo-title">
              SEO title
            </label>
            <input
              id="blog-seo-title"
              className={fieldClass}
              value={draft.seoTitle}
              maxLength={70}
              placeholder="Defaults to the article title"
              onChange={(event) => update({ seoTitle: event.target.value })}
            />
            <p className="mt-1 text-right text-[11px] text-[var(--faint)]">
              {draft.seoTitle.length}/70
            </p>
          </div>
          <div>
            <label className={labelClass} htmlFor="blog-seo-description">
              SEO description
            </label>
            <input
              id="blog-seo-description"
              className={fieldClass}
              value={draft.seoDescription}
              maxLength={180}
              placeholder="Defaults to the excerpt"
              onChange={(event) => update({ seoDescription: event.target.value })}
            />
            <p className="mt-1 text-right text-[11px] text-[var(--faint)]">
              {draft.seoDescription.length}/180
            </p>
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="blog-status">
            Status
          </label>
          <select
            id="blog-status"
            className={fieldClass}
            value={draft.status}
            onChange={(event) => update({ status: event.target.value as BlogPostStatus })}
          >
            <option value="draft">Draft — hidden from everyone</option>
            <option value="published">Published — live on /blog</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-[10px] border border-[var(--err)]/40 bg-[var(--err)]/10 px-3 py-2 text-[12.5px] text-[var(--err)]">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button onClick={onSave} disabled={saving} fullWidth={false}>
          {saving ? 'Saving…' : isPublished ? 'Save and publish' : 'Save draft'}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving} fullWidth={false}>
          Cancel
        </Button>
        {draft.id && isPublished && (
          <a
            className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--r-btn)] border border-[var(--line)] px-4 text-[13px] font-semibold text-[var(--text)] no-underline"
            href={`/blog/${draft.slug}`}
            target="_blank"
            rel="noreferrer"
          >
            View live
          </a>
        )}
      </div>
    </Card>
  );
};

export const AdminBlog: React.FC = () => {
  const [posts, setPosts] = useState<AdminBlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const result = await listBlogPosts();
    if (result.success) {
      setPosts(result.data?.posts ?? []);
    } else {
      setLoadError(result.error || 'Could not load articles.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setSaveError('');
    const input: BlogPostInput = {
      title: draft.title.trim(),
      slug: draft.slug.trim() || null,
      excerpt: draft.excerpt.trim(),
      bodyMd: draft.bodyMd.trim(),
      coverImageUrl: draft.coverImageUrl.trim() || null,
      tags: draft.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      seoTitle: draft.seoTitle.trim() || null,
      seoDescription: draft.seoDescription.trim() || null,
      status: draft.status,
    };

    const result = draft.id
      ? await updateBlogPost(draft.id, input)
      : await createBlogPost(input);

    if (!result.success) {
      setSaveError(result.error || 'Could not save this article.');
      setSaving(false);
      return;
    }

    const post = result.data?.post;
    if (post) {
      setPosts((current) => {
        const exists = current.some((item) => item.id === post.id);
        return exists
          ? current.map((item) => (item.id === post.id ? post : item))
          : [post, ...current];
      });
      setNotice(post.status === 'published' ? 'Article published.' : 'Draft saved.');
    }
    setDraft(null);
    setSaving(false);
  };

  const remove = async (post: AdminBlogPost) => {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
    const result = await deleteBlogPost(post.id);
    if (!result.success) {
      setLoadError(result.error || 'Could not delete this article.');
      return;
    }
    setPosts((current) => current.filter((item) => item.id !== post.id));
    setNotice('Article deleted.');
  };

  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[18px] font-bold">Journal</h2>
            <p className="mt-1 max-w-[56ch] text-[12.5px] text-[var(--muted)]">
              Articles are rendered as server-side HTML with canonical, Open Graph and
              BlogPosting structured data. Published posts appear in sitemap.xml and RSS.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--r-btn)] border border-[var(--line)] px-4 text-[13px] font-semibold text-[var(--text)] no-underline"
              href="/blog"
              target="_blank"
              rel="noreferrer"
            >
              Open Journal
            </a>
            <Button
              size="sm"
              fullWidth={false}
              onClick={() => {
                setDraft({ ...EMPTY_DRAFT });
                setSaveError('');
                setNotice('');
              }}
            >
              New article
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11.5px] text-[var(--faint)]">
          <span>{posts.length} total</span>
          <span>·</span>
          <span>{posts.filter((post) => post.status === 'published').length} published</span>
          <span>·</span>
          <span>{posts.filter((post) => post.status === 'draft').length} drafts</span>
        </div>
      </Card>

      {notice && (
        <p className="rounded-[12px] border border-[var(--ok)]/40 bg-[var(--ok)]/10 px-3 py-2 text-[12.5px] text-[var(--ok)]">
          {notice}
        </p>
      )}
      {loadError && (
        <p className="rounded-[12px] border border-[var(--err)]/40 bg-[var(--err)]/10 px-3 py-2 text-[12.5px] text-[var(--err)]">
          {loadError}
        </p>
      )}

      {draft ? (
        <Editor
          draft={draft}
          saving={saving}
          error={saveError}
          onChange={setDraft}
          onCancel={() => {
            setDraft(null);
            setSaveError('');
          }}
          onSave={() => void save()}
        />
      ) : (
        <div className="grid gap-3">
          {loading && <Card>Loading articles…</Card>}
          {!loading && posts.length === 0 && (
            <Card>
              <p className="text-[13px] text-[var(--muted)]">
                No articles yet. Publish the first one and it will be indexed at
                mhomho.work/blog.
              </p>
            </Card>
          )}
          {posts.map((post) => (
            <Card key={post.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-[14.5px]">{post.title}</b>
                    <Tag variant={post.status === 'published' ? 'ok' : 'warn'}>
                      {post.status}
                    </Tag>
                  </div>
                  <p className="mt-1 break-all text-[11.5px] text-[var(--faint)]">
                    /blog/{post.slug} · {wordCount(post.bodyMd)} words
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--muted)]">
                    {post.status === 'published'
                      ? `Published ${formatDate(post.publishedAt)}`
                      : `Updated ${formatDate(post.updatedAt)}`}
                  </p>
                  {post.tags.length > 0 && (
                    <p className="mt-1 text-[11.5px] text-[var(--faint)]">
                      {post.tags.join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    fullWidth={false}
                    onClick={() => {
                      setDraft(draftFromPost(post));
                      setSaveError('');
                      setNotice('');
                    }}
                  >
                    Edit
                  </Button>
                  {post.status === 'published' && (
                    <a
                      className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--r-btn)] border border-[var(--line)] px-3 text-[13px] font-semibold text-[var(--text)] no-underline"
                      href={`/blog/${post.slug}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="danger"
                    fullWidth={false}
                    onClick={() => void remove(post)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
