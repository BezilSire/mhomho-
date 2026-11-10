-- Brand waitlist.
--
-- Brands are not running campaigns yet, so the public site collects a simple
-- waitlist instead of a campaign brief. This migration is additive and creates
-- no financial records.

CREATE TABLE brand_waitlist (
  id             TEXT PRIMARY KEY,
  brand_name     TEXT NOT NULL CHECK (length(brand_name) BETWEEN 2 AND 160),
  location       TEXT NOT NULL CHECK (length(location) BETWEEN 2 AND 160),
  industry       TEXT NOT NULL CHECK (length(industry) BETWEEN 2 AND 80),
  contact_name   TEXT NOT NULL CHECK (length(contact_name) BETWEEN 2 AND 120),
  contact_email  TEXT NOT NULL CHECK (length(contact_email) BETWEEN 5 AND 200),
  contact_phone  TEXT NOT NULL CHECK (length(contact_phone) BETWEEN 6 AND 32),
  status         TEXT NOT NULL DEFAULT 'new'
                 CHECK (status IN ('new', 'contacted', 'invited', 'closed')),
  admin_notes    TEXT,
  ip_hash        TEXT,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);

CREATE INDEX idx_brand_waitlist_status
  ON brand_waitlist (status, created_at DESC);
CREATE INDEX idx_brand_waitlist_created
  ON brand_waitlist (created_at DESC);
