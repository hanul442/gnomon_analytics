-- G-293: anonymous visitor and return counts. One row per device per KST day; the device id is random, made in the
-- browser, and tied to nothing else (no account, IP or user agent). Rows older than 120 days are pruned by the cron.
CREATE TABLE IF NOT EXISTS visits (
  day TEXT NOT NULL,
  vid TEXT NOT NULL,
  src TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (day, vid)
);
