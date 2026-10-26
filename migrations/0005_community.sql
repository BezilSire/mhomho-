-- MHOMHO — preset avatars, creator community and monthly leaderboard.
--
-- Additive only. Avatars store a short preset key, never an uploaded image, so
-- a profile change costs a few bytes in D1 and nothing in R2.
--
-- The monthly leaderboard is derived from approved submissions and their
-- current view observation, so no denormalised counter can drift.

ALTER TABLE creator_profiles
  ADD COLUMN avatar_key TEXT NOT NULL DEFAULT 'sun';

-- Monthly leaderboard queries filter observations by time.
CREATE INDEX idx_observations_time
  ON view_observations (observed_at);

CREATE TABLE forum_threads (
  id               TEXT PRIMARY KEY,
  author_id        TEXT NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  category         TEXT NOT NULL CHECK (category IN ('general', 'campaigns', 'payouts', 'wins')),
  title            TEXT NOT NULL CHECK (length(title) BETWEEN 5 AND 100),
  body             TEXT NOT NULL CHECK (length(body) BETWEEN 10 AND 4000),
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked', 'hidden')),
  pinned           INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  reply_count      INTEGER NOT NULL DEFAULT 0 CHECK (reply_count >= 0),
  last_activity_at INTEGER NOT NULL,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);

CREATE INDEX idx_forum_threads_feed
  ON forum_threads (status, pinned DESC, last_activity_at DESC);

CREATE INDEX idx_forum_threads_author
  ON forum_threads (author_id, created_at DESC);

CREATE TABLE forum_replies (
  id         TEXT PRIMARY KEY,
  thread_id  TEXT NOT NULL REFERENCES forum_threads (id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  body       TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_forum_replies_thread
  ON forum_replies (thread_id, created_at);

CREATE INDEX idx_forum_replies_author
  ON forum_replies (author_id, created_at DESC);
