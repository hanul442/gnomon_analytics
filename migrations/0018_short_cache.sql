-- 공매도·신용 card (G-195): the last good /short answer per stock, so a KRX refusal (it turns the Worker away some
-- evenings) shows the latest kept numbers instead of hiding the card. One row per code, replaced on each fresh fetch.
CREATE TABLE IF NOT EXISTS short_cache (
  code TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
