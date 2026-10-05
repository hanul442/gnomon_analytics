-- Saved screens and the daily alerts they send (docs/DESIGN.md §5.14, G-50).

CREATE TABLE screens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  screen TEXT NOT NULL,
  alert INTEGER NOT NULL DEFAULT 0,
  -- Symbols that matched on the last checked date, JSON array.
  last_symbols TEXT,
  last_date TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX screens_user ON screens (user_id);
CREATE INDEX screens_alert ON screens (alert);

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX notifications_user ON notifications (user_id, created_at);
