-- 0003_activity.sql
-- Recent-activity feed support.
--
-- The feed is derived from rows that already exist (`accounts.created_at` for
-- sign-ups and `campaign_members.joined_at` for campaign joins). Only an index
-- is needed so the newest joins can be read without scanning the table.
--
-- Additive and forward-only: no table or column is created or dropped.

CREATE INDEX IF NOT EXISTS idx_members_joined ON campaign_members (joined_at DESC);
