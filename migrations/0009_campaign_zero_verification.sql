-- Campaign Zero manual view verification.
--
-- The administrator records the live public count they actually saw before
-- approving the creator. The 1,000-view rule is enforced by the Worker so a
-- direct API call cannot skip it.

ALTER TABLE creator_campaign_zero_clips ADD COLUMN verified_views INTEGER;
ALTER TABLE creator_campaign_zero_clips ADD COLUMN verified_by TEXT;
ALTER TABLE creator_campaign_zero_clips ADD COLUMN verified_at INTEGER;
