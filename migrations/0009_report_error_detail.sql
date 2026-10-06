-- The raw failure cause of an on-demand report (provider code and message), for diagnosis only.
-- Users see the friendly message in `error`; this column is never returned by the API.
ALTER TABLE report_jobs ADD COLUMN error_detail TEXT;
