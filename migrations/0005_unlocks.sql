-- Unlocked deep reports (docs/DESIGN.md §5.21, G-61): who opened which committee report, for how
-- many credits. One row per user, symbol and report date; opening again is free.

CREATE TABLE unlocks (
  user_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  date TEXT NOT NULL,
  credits INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, symbol, date)
);
