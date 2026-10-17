-- G-223: DART filing originals the chat has read (document.xml as plain text), so a second question reuses them.
CREATE TABLE IF NOT EXISTS filing_texts (
  receipt_no TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  truncated INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT NOT NULL
);
