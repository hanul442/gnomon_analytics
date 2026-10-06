-- Preserve disjoint Claude token counts for cost and cache diagnostics.
ALTER TABLE questions ADD COLUMN usage_json TEXT;
ALTER TABLE report_jobs ADD COLUMN usage_json TEXT;
