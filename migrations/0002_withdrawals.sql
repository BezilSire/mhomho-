-- MHOMHO — creator withdrawals, account lifecycle, reconciliation.
--
-- Additive only:
--   * accounts.deleted_at marks a self-deleted (anonymised) account.
--   * A payout reference must be globally unique so a manual EcoCash
--     transaction can never be recorded twice.
--   * Open-payout lookups are indexed.

ALTER TABLE accounts ADD COLUMN deleted_at INTEGER;

CREATE UNIQUE INDEX uniq_payout_reference
  ON payouts (reference) WHERE reference IS NOT NULL;

CREATE INDEX idx_payouts_open
  ON payouts (creator_id, status, requested_at);

-- A creator can only have one withdrawal in flight. The partial index makes a
-- double-submit race impossible at the database layer.
CREATE UNIQUE INDEX uniq_open_payout
  ON payouts (creator_id)
  WHERE status IN ('requested', 'approved', 'processing');
