-- MHOMHO — creator invite gate.
--
-- Registration stays open until the roster reaches 3,000 creator accounts.
-- After that (or when an administrator switches mode to 'on') a single-use,
-- 30-day invite code is required. Mode and threshold live in app_config so they
-- can be changed without a deployment; the console exposes the mode switch.
--
-- The gate is enforced by a BEFORE INSERT trigger, not just application code,
-- so a burst of concurrent sign-ups cannot slip past the threshold.

CREATE TABLE invite_codes (
  id          TEXT PRIMARY KEY,
  code_hash   TEXT NOT NULL UNIQUE,
  code_hint   TEXT NOT NULL,
  label       TEXT,
  created_by  TEXT NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER,
  used_by     TEXT,
  revoked_at  INTEGER
);

CREATE INDEX idx_invite_codes_active
  ON invite_codes (used_at, revoked_at, expires_at);

CREATE INDEX idx_invite_codes_created
  ON invite_codes (created_at DESC);

-- Deliberately no foreign key here: `invite_codes.created_by` already points at
-- accounts, and a second reference in the other direction creates a cycle that
-- makes table teardown and data export harder. The trigger below validates the
-- claim instead.
ALTER TABLE accounts
  ADD COLUMN invite_code_id TEXT;

INSERT OR IGNORE INTO app_config (key, value, updated_at)
VALUES
  ('creator_invite_mode', 'auto', CAST(strftime('%s', 'now') AS INTEGER) * 1000),
  ('creator_invite_threshold', '3000', CAST(strftime('%s', 'now') AS INTEGER) * 1000);

-- A creator account without a claimed invite is only allowed while the gate is
-- open. `auto` closes the gate at the configured threshold; `on` closes it
-- immediately; `off` disables it.
CREATE TRIGGER accounts_creator_invite_required
BEFORE INSERT ON accounts
WHEN NEW.role = 'creator'
  AND NEW.invite_code_id IS NULL
  AND (
    COALESCE((SELECT value FROM app_config WHERE key = 'creator_invite_mode'), 'auto') = 'on'
    OR (
      COALESCE((SELECT value FROM app_config WHERE key = 'creator_invite_mode'), 'auto') = 'auto'
      AND (SELECT COUNT(*) FROM accounts WHERE role = 'creator') >=
          CAST(
            COALESCE(
              (SELECT value FROM app_config WHERE key = 'creator_invite_threshold'),
              '3000'
            ) AS INTEGER
          )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'invite_required');
END;

-- An invite must have been claimed for this exact account in the same batch.
-- The registration handler updates the invite row before inserting the account,
-- which makes consumption and account creation atomic.
CREATE TRIGGER accounts_creator_invite_valid
BEFORE INSERT ON accounts
WHEN NEW.role = 'creator' AND NEW.invite_code_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'invite_invalid')
  WHERE NOT EXISTS (
    SELECT 1 FROM invite_codes
     WHERE id = NEW.invite_code_id
       AND used_by = NEW.id
       AND used_at IS NOT NULL
       AND revoked_at IS NULL
  );
END;
