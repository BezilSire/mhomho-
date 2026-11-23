-- Brand waitlist campaign plan.
--
-- A visitor can now save a calculator/package plan with the waitlist entry.
-- Amounts are stored in integer USD cents and recomputed server-side from the
-- budget, never trusted from the browser. Additive only.

ALTER TABLE brand_waitlist ADD COLUMN package_name TEXT;
ALTER TABLE brand_waitlist ADD COLUMN budget_cents INTEGER;
ALTER TABLE brand_waitlist ADD COLUMN view_target INTEGER;
ALTER TABLE brand_waitlist ADD COLUMN creators_to_recruit INTEGER;
