-- Link previews and submission snapshots.
--
-- `link_previews` is a short-lived cache keyed by the canonical post URL, so a
-- paste and the subsequent submission share one outbound request. The snapshot
-- columns on submissions and Campaign Zero clips preserve what the link looked
-- like when it was submitted; admins still verify the live count manually.

CREATE TABLE link_previews (
  url_key       TEXT PRIMARY KEY,
  platform      TEXT NOT NULL,
  title         TEXT,
  author        TEXT,
  thumbnail_url TEXT,
  provider      TEXT,
  preview_views INTEGER,
  preview_likes INTEGER,
  source        TEXT NOT NULL,
  fetched_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL
);

CREATE INDEX idx_link_previews_expiry ON link_previews (expires_at);

ALTER TABLE submissions ADD COLUMN preview_title TEXT;
ALTER TABLE submissions ADD COLUMN preview_author TEXT;
ALTER TABLE submissions ADD COLUMN preview_thumbnail_url TEXT;
ALTER TABLE submissions ADD COLUMN preview_provider TEXT;
ALTER TABLE submissions ADD COLUMN preview_views INTEGER;
ALTER TABLE submissions ADD COLUMN preview_likes INTEGER;
ALTER TABLE submissions ADD COLUMN preview_source TEXT;
ALTER TABLE submissions ADD COLUMN preview_fetched_at INTEGER;

ALTER TABLE creator_campaign_zero_clips ADD COLUMN preview_title TEXT;
ALTER TABLE creator_campaign_zero_clips ADD COLUMN preview_author TEXT;
ALTER TABLE creator_campaign_zero_clips ADD COLUMN preview_thumbnail_url TEXT;
ALTER TABLE creator_campaign_zero_clips ADD COLUMN preview_provider TEXT;
ALTER TABLE creator_campaign_zero_clips ADD COLUMN preview_views INTEGER;
ALTER TABLE creator_campaign_zero_clips ADD COLUMN preview_likes INTEGER;
ALTER TABLE creator_campaign_zero_clips ADD COLUMN preview_source TEXT;
ALTER TABLE creator_campaign_zero_clips ADD COLUMN preview_fetched_at INTEGER;
