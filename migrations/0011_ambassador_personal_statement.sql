-- MHOMHO Commercial Envoy programme — personal statement.
-- Add a personal statement column so applicants can say what they want about
-- themselves before they apply. Additive; no existing table is altered.

ALTER TABLE ambassador_applications
  ADD COLUMN personal_statement TEXT;
