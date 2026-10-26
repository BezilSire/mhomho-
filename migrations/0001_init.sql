-- MHOMHO — initial schema (Cloudflare D1 / SQLite).
--
-- Design rules:
--   * All money is integer US cents. Currency is constrained to USD.
--   * Every timestamp is Unix epoch milliseconds (INTEGER).
--   * Financial tables are append-only and enforced by triggers.
--   * Budget over-commitment and negative creator balances are impossible at
--     the database layer, not just in application code.
--   * Foreign keys are enforced by D1 (PRAGMA foreign_keys = on).
--
-- Reversal: this migration is additive. To roll back an environment that has
-- never held real data, drop the tables in reverse dependency order. See
-- docs/DEPLOYMENT.md § Rollback. Never drop these tables in production without
-- exporting the data first.

-- ---------------------------------------------------------------------------
-- Accounts, profiles, sessions
-- ---------------------------------------------------------------------------

CREATE TABLE accounts (
  id                  TEXT PRIMARY KEY,
  email               TEXT NOT NULL,
  email_normalized    TEXT NOT NULL UNIQUE,
  password_hash       TEXT,
  password_salt       TEXT,
  password_iterations INTEGER NOT NULL DEFAULT 210000 CHECK (password_iterations >= 100000),
  role                TEXT NOT NULL CHECK (role IN ('creator', 'admin', 'business')),
  status              TEXT NOT NULL CHECK (status IN ('applied', 'approved', 'rejected', 'suspended')),
  session_version     INTEGER NOT NULL DEFAULT 1 CHECK (session_version >= 1),
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  last_login_at       INTEGER
);

CREATE INDEX idx_accounts_role_status ON accounts (role, status);
CREATE INDEX idx_accounts_created ON accounts (created_at DESC);

CREATE TABLE creator_profiles (
  account_id                     TEXT PRIMARY KEY REFERENCES accounts (id) ON DELETE RESTRICT,
  display_name                   TEXT NOT NULL,
  handle                         TEXT NOT NULL,
  handle_normalized              TEXT NOT NULL,
  platform                       TEXT NOT NULL CHECK (platform IN ('TikTok', 'Instagram', 'YouTube', 'Facebook')),
  niche                          TEXT NOT NULL,
  followers                      INTEGER NOT NULL CHECK (followers >= 0),
  whatsapp_number                TEXT NOT NULL,
  ecocash_number                 TEXT,
  campaign_zero_follow_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (campaign_zero_follow_confirmed IN (0, 1)),
  campaign_zero_submitted_at     INTEGER,
  approved_at                    INTEGER,
  created_at                     INTEGER NOT NULL,
  updated_at                     INTEGER NOT NULL,
  UNIQUE (handle_normalized, platform)
);

CREATE INDEX idx_creator_profiles_status ON creator_profiles (approved_at);

CREATE TABLE creator_campaign_zero_clips (
  id             TEXT PRIMARY KEY,
  account_id     TEXT NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  position       INTEGER NOT NULL CHECK (position >= 0 AND position < 3),
  url            TEXT NOT NULL,
  url_normalized TEXT NOT NULL UNIQUE,
  claimed_views  INTEGER NOT NULL CHECK (claimed_views >= 0),
  added_at       INTEGER NOT NULL,
  UNIQUE (account_id, position)
);

CREATE TABLE sessions (
  token_hash    TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('creator', 'admin', 'business')),
  csrf_token    TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL,
  revoked_at    INTEGER,
  ip_hash       TEXT,
  user_agent_hash TEXT
);

CREATE INDEX idx_sessions_account ON sessions (account_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);

-- ---------------------------------------------------------------------------
-- Campaigns
-- ---------------------------------------------------------------------------

CREATE TABLE campaigns (
  id                       TEXT PRIMARY KEY,
  slug                     TEXT NOT NULL UNIQUE,
  title                    TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  brand_name               TEXT NOT NULL CHECK (length(brand_name) BETWEEN 1 AND 120),
  niche                    TEXT NOT NULL,
  brief                    TEXT NOT NULL,
  required_content         TEXT,
  eligibility              TEXT,
  hook_ideas               TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(hook_ideas)),
  do_nots                   TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(do_nots)),
  brand_asset_url          TEXT,
  poster_asset_id          TEXT,
  status                   TEXT NOT NULL CHECK (status IN ('draft', 'scheduled', 'live', 'paused', 'closing', 'completed', 'cancelled')),
  currency                 TEXT NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  budget_cents             INTEGER NOT NULL CHECK (budget_cents >= 0),
  creator_pool_cents       INTEGER NOT NULL CHECK (creator_pool_cents >= 0),
  brand_cpm_cents          INTEGER NOT NULL CHECK (brand_cpm_cents > 0),
  creator_cpm_cents        INTEGER NOT NULL CHECK (creator_cpm_cents > 0),
  per_post_cap_cents       INTEGER CHECK (per_post_cap_cents IS NULL OR per_post_cap_cents >= 0),
  per_post_cap_bp          INTEGER CHECK (per_post_cap_bp IS NULL OR per_post_cap_bp BETWEEN 0 AND 10000),
  qualifying_view_threshold INTEGER NOT NULL DEFAULT 1000 CHECK (qualifying_view_threshold >= 0),
  joining_close_bp         INTEGER NOT NULL DEFAULT 8000 CHECK (joining_close_bp BETWEEN 0 AND 10000),
  starts_at                INTEGER,
  joining_cutoff_at        INTEGER,
  submission_cutoff_at     INTEGER,
  views_cutoff_at          INTEGER,
  ends_at                  INTEGER,
  terms_version            INTEGER NOT NULL DEFAULT 1,
  created_by               TEXT REFERENCES accounts (id),
  created_at               INTEGER NOT NULL,
  updated_at               INTEGER NOT NULL,
  settled_at               INTEGER,
  cancelled_at             INTEGER,
  CHECK (creator_pool_cents <= budget_cents)
);

CREATE INDEX idx_campaigns_status ON campaigns (status, submission_cutoff_at);
CREATE INDEX idx_campaigns_live ON campaigns (status, starts_at, joining_cutoff_at);

-- Authoritative live counters. Every mutation goes through a guard trigger on
-- earnings_ledger, so these numbers can never drift past the campaign pool.
CREATE TABLE campaign_counters (
  campaign_id        TEXT PRIMARY KEY REFERENCES campaigns (id) ON DELETE RESTRICT,
  committed_cents    INTEGER NOT NULL DEFAULT 0 CHECK (committed_cents >= 0),
  shortfall_cents    INTEGER NOT NULL DEFAULT 0 CHECK (shortfall_cents >= 0),
  verified_views     INTEGER NOT NULL DEFAULT 0 CHECK (verified_views >= 0),
  eligible_views     INTEGER NOT NULL DEFAULT 0 CHECK (eligible_views >= 0),
  joined_count       INTEGER NOT NULL DEFAULT 0 CHECK (joined_count >= 0),
  approved_submissions INTEGER NOT NULL DEFAULT 0 CHECK (approved_submissions >= 0),
  paid_cents         INTEGER NOT NULL DEFAULT 0 CHECK (paid_cents >= 0),
  updated_at         INTEGER NOT NULL
);

-- Append-only record of every budget movement.
CREATE TABLE campaign_budget_ledger (
  id              TEXT PRIMARY KEY,
  campaign_id     TEXT NOT NULL REFERENCES campaigns (id) ON DELETE RESTRICT,
  entry_type      TEXT NOT NULL CHECK (entry_type IN ('allocation', 'top_up', 'earning_commit', 'reversal', 'payout_allocation')),
  amount_cents    INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  actor_id        TEXT REFERENCES accounts (id),
  note            TEXT,
  created_at      INTEGER NOT NULL
);

CREATE INDEX idx_budget_ledger_campaign ON campaign_budget_ledger (campaign_id, created_at);

CREATE TABLE campaign_members (
  campaign_id  TEXT NOT NULL REFERENCES campaigns (id) ON DELETE RESTRICT,
  creator_id   TEXT NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  joined_at    INTEGER NOT NULL,
  terms_version INTEGER NOT NULL,
  PRIMARY KEY (campaign_id, creator_id)
);

CREATE INDEX idx_members_creator ON campaign_members (creator_id, joined_at DESC);

-- ---------------------------------------------------------------------------
-- Submissions, reviews and view observations
-- ---------------------------------------------------------------------------

CREATE TABLE submissions (
  id                  TEXT PRIMARY KEY,
  campaign_id         TEXT NOT NULL REFERENCES campaigns (id) ON DELETE RESTRICT,
  creator_id          TEXT NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  platform            TEXT NOT NULL CHECK (platform IN ('TikTok', 'Instagram', 'YouTube', 'Facebook')),
  post_url            TEXT NOT NULL,
  post_url_normalized TEXT NOT NULL UNIQUE,
  claimed_views       INTEGER NOT NULL CHECK (claimed_views >= 0),
  proof_asset_id      TEXT,
  status              TEXT NOT NULL CHECK (status IN ('submitted', 'approved', 'rejected', 'withdrawn')),
  review_note         TEXT,
  reviewed_by         TEXT REFERENCES accounts (id),
  reviewed_at         INTEGER,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  FOREIGN KEY (campaign_id, creator_id)
    REFERENCES campaign_members (campaign_id, creator_id)
);

CREATE INDEX idx_submissions_campaign_status ON submissions (campaign_id, status, created_at);
CREATE INDEX idx_submissions_creator ON submissions (creator_id, created_at DESC);

CREATE TABLE submission_reviews (
  id            TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions (id) ON DELETE RESTRICT,
  decision      TEXT NOT NULL CHECK (decision IN ('approve', 'reject', 'reopen')),
  note          TEXT,
  actor_id      TEXT NOT NULL REFERENCES accounts (id),
  created_at    INTEGER NOT NULL
);

CREATE INDEX idx_reviews_submission ON submission_reviews (submission_id, created_at DESC);

CREATE TABLE view_observations (
  id               TEXT PRIMARY KEY,
  submission_id    TEXT NOT NULL REFERENCES submissions (id) ON DELETE RESTRICT,
  observed_views   INTEGER NOT NULL CHECK (observed_views >= 0),
  verified_views   INTEGER NOT NULL CHECK (verified_views >= 0),
  eligible_views   INTEGER NOT NULL CHECK (eligible_views >= 0),
  gross_cents      INTEGER NOT NULL CHECK (gross_cents >= 0),
  committed_cents  INTEGER NOT NULL CHECK (committed_cents >= 0),
  shortfall_cents  INTEGER NOT NULL DEFAULT 0 CHECK (shortfall_cents >= 0),
  source           TEXT NOT NULL CHECK (source IN ('manual', 'platform_api')),
  evidence_note    TEXT,
  observed_by      TEXT NOT NULL REFERENCES accounts (id),
  observed_at      INTEGER NOT NULL,
  idempotency_key  TEXT NOT NULL UNIQUE,
  supersedes_id    TEXT REFERENCES view_observations (id),
  is_current       INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1)),
  CHECK (verified_views <= observed_views),
  CHECK (eligible_views <= verified_views)
);

CREATE UNIQUE INDEX uniq_current_observation
  ON view_observations (submission_id) WHERE is_current = 1;

CREATE INDEX idx_observations_submission ON view_observations (submission_id, observed_at DESC);

-- ---------------------------------------------------------------------------
-- Earnings ledger (append-only) and payouts
-- ---------------------------------------------------------------------------

CREATE TABLE earnings_ledger (
  id              TEXT PRIMARY KEY,
  creator_id      TEXT NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  campaign_id     TEXT REFERENCES campaigns (id) ON DELETE RESTRICT,
  submission_id   TEXT REFERENCES submissions (id) ON DELETE RESTRICT,
  entry_type      TEXT NOT NULL CHECK (entry_type IN ('earning', 'adjustment', 'reversal', 'payout', 'payout_reversal', 'write_off')),
  amount_cents    INTEGER NOT NULL CHECK (amount_cents <> 0),
  currency        TEXT NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  description     TEXT NOT NULL,
  actor_id        TEXT REFERENCES accounts (id),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at      INTEGER NOT NULL
);

CREATE INDEX idx_ledger_creator ON earnings_ledger (creator_id, created_at DESC);
CREATE INDEX idx_ledger_campaign ON earnings_ledger (campaign_id, entry_type);
CREATE INDEX idx_ledger_submission ON earnings_ledger (submission_id, entry_type);

CREATE TABLE payouts (
  id                 TEXT PRIMARY KEY,
  creator_id         TEXT NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  amount_cents       INTEGER NOT NULL CHECK (amount_cents > 0),
  currency           TEXT NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  status             TEXT NOT NULL CHECK (status IN ('requested', 'approved', 'processing', 'paid', 'failed', 'cancelled')),
  method             TEXT NOT NULL DEFAULT 'ecocash' CHECK (method IN ('ecocash', 'bank_transfer', 'manual')),
  destination_masked TEXT NOT NULL,
  destination_hash   TEXT,
  reference          TEXT,
  failure_reason     TEXT,
  requested_by       TEXT NOT NULL REFERENCES accounts (id),
  decided_by         TEXT REFERENCES accounts (id),
  requested_at       INTEGER NOT NULL,
  decided_at         INTEGER,
  paid_at            INTEGER,
  idempotency_key    TEXT NOT NULL UNIQUE,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL
);

CREATE INDEX idx_payouts_creator ON payouts (creator_id, created_at DESC);
CREATE INDEX idx_payouts_status ON payouts (status, created_at);

CREATE TABLE payout_allocations (
  payout_id   TEXT NOT NULL REFERENCES payouts (id) ON DELETE RESTRICT,
  campaign_id TEXT NOT NULL REFERENCES campaigns (id) ON DELETE RESTRICT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  PRIMARY KEY (payout_id, campaign_id)
);

CREATE INDEX idx_allocations_campaign ON payout_allocations (campaign_id);

-- ---------------------------------------------------------------------------
-- Assets (R2 metadata), brand reports, enquiries, audit, ops
-- ---------------------------------------------------------------------------

CREATE TABLE campaign_assets (
  id              TEXT PRIMARY KEY,
  campaign_id     TEXT REFERENCES campaigns (id) ON DELETE RESTRICT,
  owner_id        TEXT NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  kind            TEXT NOT NULL CHECK (kind IN ('poster', 'brand_logo', 'brand_material', 'proof_screenshot')),
  object_key      TEXT NOT NULL UNIQUE,
  original_name   TEXT,
  content_type    TEXT NOT NULL,
  size_bytes      INTEGER NOT NULL CHECK (size_bytes > 0),
  checksum_sha256 TEXT,
  visibility      TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
  status          TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'deleted')),
  created_at      INTEGER NOT NULL,
  ready_at        INTEGER,
  deleted_at      INTEGER,
  CHECK (kind <> 'proof_screenshot' OR visibility = 'private')
);

CREATE INDEX idx_assets_campaign ON campaign_assets (campaign_id, status);
CREATE INDEX idx_assets_owner ON campaign_assets (owner_id, status);
CREATE INDEX idx_assets_pending ON campaign_assets (status, created_at);

CREATE TABLE brand_report_tokens (
  token_hash      TEXT PRIMARY KEY,
  campaign_id     TEXT NOT NULL REFERENCES campaigns (id) ON DELETE RESTRICT,
  label           TEXT,
  created_by      TEXT REFERENCES accounts (id),
  created_at      INTEGER NOT NULL,
  expires_at      INTEGER,
  revoked_at      INTEGER,
  last_viewed_at  INTEGER
);

CREATE TABLE enquiries (
  id           TEXT PRIMARY KEY,
  biz_name     TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone        TEXT NOT NULL,
  niche        TEXT NOT NULL,
  promo        TEXT NOT NULL,
  goals        TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(goals)),
  budget       TEXT NOT NULL,
  start_window TEXT,
  best_times   TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(best_times)),
  notes        TEXT,
  status       TEXT NOT NULL CHECK (status IN ('new', 'contacted', 'booked', 'closed')),
  ip_hash      TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE INDEX idx_enquiries_status ON enquiries (status, created_at DESC);

CREATE TABLE audit_events (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT REFERENCES accounts (id),
  actor_role  TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  before_json TEXT,
  after_json  TEXT,
  request_id  TEXT,
  ip_hash     TEXT,
  created_at  INTEGER NOT NULL
);

CREATE INDEX idx_audit_entity ON audit_events (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_created ON audit_events (created_at DESC);

CREATE TABLE idempotency_keys (
  key             TEXT PRIMARY KEY,
  account_id      TEXT REFERENCES accounts (id),
  endpoint        TEXT NOT NULL,
  request_hash    TEXT NOT NULL,
  response_status INTEGER,
  response_json   TEXT,
  created_at      INTEGER NOT NULL,
  expires_at      INTEGER NOT NULL
);

CREATE INDEX idx_idempotency_expiry ON idempotency_keys (expires_at);

CREATE TABLE rate_limits (
  bucket       TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL CHECK (count >= 0),
  PRIMARY KEY (bucket, window_start)
);

CREATE INDEX idx_rate_limits_window ON rate_limits (window_start);

CREATE TABLE app_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- ---------------------------------------------------------------------------
-- Integrity guards
-- ---------------------------------------------------------------------------

-- The ledger is append-only. Corrections must be new rows.
CREATE TRIGGER earnings_ledger_no_update
BEFORE UPDATE ON earnings_ledger
BEGIN
  SELECT RAISE(ABORT, 'earnings_ledger is append-only');
END;

CREATE TRIGGER earnings_ledger_no_delete
BEFORE DELETE ON earnings_ledger
BEGIN
  SELECT RAISE(ABORT, 'earnings_ledger is append-only');
END;

-- Hard budget guard: a positive creator credit can never push a campaign past
-- its creator pool, even under concurrent requests. Raising ABORT rolls back
-- the whole D1 batch.
CREATE TRIGGER earnings_ledger_budget_guard
BEFORE INSERT ON earnings_ledger
WHEN NEW.campaign_id IS NOT NULL
  AND NEW.entry_type IN ('earning', 'adjustment', 'reversal')
  AND NEW.amount_cents > 0
BEGIN
  SELECT RAISE(ABORT, 'budget_exhausted')
  WHERE (
    SELECT creator_pool_cents FROM campaigns WHERE id = NEW.campaign_id
  ) < (
    SELECT committed_cents FROM campaign_counters WHERE campaign_id = NEW.campaign_id
  ) + NEW.amount_cents;
END;

-- Apply committed budget changes automatically so no code path can forget.
CREATE TRIGGER earnings_ledger_apply_commit
AFTER INSERT ON earnings_ledger
WHEN NEW.campaign_id IS NOT NULL
  AND NEW.entry_type IN ('earning', 'adjustment', 'reversal')
BEGIN
  UPDATE campaign_counters
     SET committed_cents = MAX(0, committed_cents + NEW.amount_cents),
         updated_at = NEW.created_at
   WHERE campaign_id = NEW.campaign_id;
END;

-- Hard balance guard: no ledger row may drive a creator's running balance
-- negative. This covers payouts and negative corrections/reversals. Raising
-- ABORT rolls back the whole D1 batch.
CREATE TRIGGER earnings_ledger_balance_guard
BEFORE INSERT ON earnings_ledger
WHEN NEW.amount_cents < 0
BEGIN
  SELECT RAISE(ABORT, 'insufficient_balance')
  WHERE (
    SELECT COALESCE(SUM(amount_cents), 0) FROM earnings_ledger WHERE creator_id = NEW.creator_id
  ) + NEW.amount_cents < 0;
END;

-- Payout allocations may never exceed what a campaign has actually committed
-- to that creator.
CREATE TRIGGER payout_allocation_guard
BEFORE INSERT ON payout_allocations
BEGIN
  SELECT RAISE(ABORT, 'allocation_exceeds_campaign_earnings')
  WHERE (
    SELECT COALESCE(SUM(amount_cents), 0)
      FROM earnings_ledger
     WHERE creator_id = (SELECT creator_id FROM payouts WHERE id = NEW.payout_id)
       AND campaign_id = NEW.campaign_id
       AND entry_type IN ('earning', 'adjustment', 'reversal')
  ) < (
    SELECT COALESCE(SUM(amount_cents), 0)
      FROM payout_allocations
     WHERE campaign_id = NEW.campaign_id
       AND payout_id IN (
         SELECT id FROM payouts
          WHERE creator_id = (SELECT creator_id FROM payouts WHERE id = NEW.payout_id)
            AND status IN ('requested', 'approved', 'processing', 'paid')
       )
  ) + NEW.amount_cents;
END;

-- Counters that must follow membership / submission facts.
CREATE TRIGGER campaign_member_insert
AFTER INSERT ON campaign_members
BEGIN
  UPDATE campaign_counters
     SET joined_count = joined_count + 1,
         updated_at = NEW.joined_at
   WHERE campaign_id = NEW.campaign_id;
END;

CREATE TRIGGER submission_approved_insert
AFTER UPDATE OF status ON submissions
WHEN NEW.status = 'approved' AND OLD.status <> 'approved'
BEGIN
  UPDATE campaign_counters
     SET approved_submissions = approved_submissions + 1,
         updated_at = NEW.updated_at
   WHERE campaign_id = NEW.campaign_id;
END;

CREATE TRIGGER submission_approved_revert
AFTER UPDATE OF status ON submissions
WHEN OLD.status = 'approved' AND NEW.status <> 'approved'
BEGIN
  UPDATE campaign_counters
     SET approved_submissions = MAX(0, approved_submissions - 1),
         updated_at = NEW.updated_at
   WHERE campaign_id = NEW.campaign_id;
END;
