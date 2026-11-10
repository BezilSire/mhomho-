-- Blog posts.
--
-- Articles are authored in the Operations console and rendered as server-side
-- HTML at /blog and /blog/:slug so Google receives the full content and meta
-- tags without executing the SPA. This migration is additive.

CREATE TABLE blog_posts (
  id                TEXT PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL CHECK (length(title) BETWEEN 2 AND 160),
  excerpt           TEXT NOT NULL CHECK (length(excerpt) BETWEEN 10 AND 320),
  body_md           TEXT NOT NULL CHECK (length(body_md) BETWEEN 20 AND 60000),
  cover_image_url   TEXT,
  tags              TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags)),
  seo_title         TEXT CHECK (seo_title IS NULL OR length(seo_title) <= 70),
  seo_description   TEXT CHECK (seo_description IS NULL OR length(seo_description) <= 180),
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published')),
  published_at      INTEGER,
  created_by        TEXT REFERENCES accounts (id) ON DELETE SET NULL,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL
);

CREATE INDEX idx_blog_posts_published
  ON blog_posts (status, published_at DESC);
CREATE INDEX idx_blog_posts_updated
  ON blog_posts (updated_at DESC);
