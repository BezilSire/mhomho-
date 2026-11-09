-- Campaign Zero now has a fixed 15-day qualification window from sign-up.
ALTER TABLE creator_profiles ADD COLUMN campaign_zero_deadline_at INTEGER;

-- Backfill existing applications from their original sign-up time.
UPDATE creator_profiles
   SET campaign_zero_deadline_at = created_at + 1296000000
 WHERE campaign_zero_deadline_at IS NULL;

CREATE INDEX idx_creator_zero_deadline ON creator_profiles (campaign_zero_deadline_at);
