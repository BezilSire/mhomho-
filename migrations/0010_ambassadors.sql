-- MHOMHO Ambassador programme (Phase 1).
--
-- Accounts for ambassadors use the existing `business` account role. That role
-- is deliberately not accepted by the creator login endpoint, so ambassador
-- sessions can never reach creator campaign, submission or payout APIs.
--
-- This migration is additive. It creates no financial records and does not
-- alter any existing table.

CREATE TABLE ambassador_applications (
  id                  TEXT PRIMARY KEY,
  account_id          TEXT NOT NULL UNIQUE REFERENCES accounts (id) ON DELETE RESTRICT,
  reference           TEXT NOT NULL UNIQUE,
  full_name           TEXT NOT NULL CHECK (length(full_name) BETWEEN 2 AND 120),
  email               TEXT NOT NULL,
  phone               TEXT NOT NULL CHECK (length(phone) BETWEEN 6 AND 32),
  city                TEXT NOT NULL CHECK (length(city) BETWEEN 2 AND 100),
  country             TEXT NOT NULL CHECK (length(country) BETWEEN 2 AND 100),
  territory           TEXT,
  languages           TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(languages)),
  sectors             TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(sectors)),
  experience          TEXT,
  motivation          TEXT,
  social_links        TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(social_links)),
  consent_terms       INTEGER NOT NULL DEFAULT 0 CHECK (consent_terms IN (0, 1)),
  consent_privacy     INTEGER NOT NULL DEFAULT 0 CHECK (consent_privacy IN (0, 1)),
  status              TEXT NOT NULL DEFAULT 'submitted'
                      CHECK (status IN ('submitted', 'under_review', 'needs_info', 'approved', 'rejected', 'withdrawn', 'suspended')),
  admin_notes         TEXT,
  requested_info      TEXT,
  applicant_response  TEXT,
  reviewed_by         TEXT REFERENCES accounts (id) ON DELETE RESTRICT,
  reviewed_at         INTEGER,
  approved_at         INTEGER,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);

CREATE INDEX idx_ambassador_applications_status
  ON ambassador_applications (status, created_at DESC);
CREATE INDEX idx_ambassador_applications_reference
  ON ambassador_applications (reference);

CREATE TABLE ambassador_documents (
  id              TEXT PRIMARY KEY,
  account_id      TEXT NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  application_id  TEXT REFERENCES ambassador_applications (id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('document', 'photo')),
  object_key      TEXT NOT NULL UNIQUE,
  original_name   TEXT,
  content_type    TEXT NOT NULL,
  size_bytes      INTEGER NOT NULL CHECK (size_bytes > 0),
  checksum_sha256 TEXT,
  visibility      TEXT NOT NULL CHECK (visibility IN ('private', 'public')),
  status          TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('pending', 'ready', 'deleted')),
  created_at      INTEGER NOT NULL,
  ready_at        INTEGER,
  CHECK (kind <> 'document' OR visibility = 'private')
);

CREATE INDEX idx_ambassador_documents_application
  ON ambassador_documents (application_id, created_at);
CREATE INDEX idx_ambassador_documents_account
  ON ambassador_documents (account_id, kind, created_at);

CREATE TABLE ambassador_profiles (
  account_id          TEXT PRIMARY KEY REFERENCES accounts (id) ON DELETE RESTRICT,
  ambassador_id       TEXT NOT NULL UNIQUE,
  username            TEXT NOT NULL UNIQUE,
  public_name         TEXT NOT NULL CHECK (length(public_name) BETWEEN 2 AND 120),
  title               TEXT NOT NULL DEFAULT 'MHOMHO Ambassador',
  bio                 TEXT NOT NULL DEFAULT '',
  country             TEXT NOT NULL,
  city                TEXT NOT NULL,
  languages           TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(languages)),
  sectors             TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(sectors)),
  contact_email       TEXT,
  contact_whatsapp    TEXT,
  social_links        TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(social_links)),
  photo_asset_id      TEXT REFERENCES ambassador_documents (id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'published', 'hidden', 'suspended')),
  published_at        INTEGER,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);

CREATE INDEX idx_ambassador_profiles_status
  ON ambassador_profiles (status, published_at DESC);
CREATE INDEX idx_ambassador_profiles_country
  ON ambassador_profiles (country, city);

CREATE TABLE ambassador_reviews (
  id              TEXT PRIMARY KEY,
  application_id  TEXT NOT NULL REFERENCES ambassador_applications (id) ON DELETE CASCADE,
  actor_id        TEXT NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  action          TEXT NOT NULL CHECK (action IN ('note', 'request_info', 'approve', 'reject', 'suspend', 'reinstate')),
  note            TEXT,
  created_at      INTEGER NOT NULL
);

CREATE INDEX idx_ambassador_reviews_application
  ON ambassador_reviews (application_id, created_at DESC);

-- Sequential public Ambassador IDs. The Worker advances this once per approval.
CREATE TABLE ambassador_id_sequence (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  next_value  INTEGER NOT NULL CHECK (next_value >= 1)
);

INSERT INTO ambassador_id_sequence (id, next_value) VALUES (1, 1);
