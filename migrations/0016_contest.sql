-- G-251: the mock-trading contest against the AI committee (나 vs 위원회). Orders and their judgment cards only;
-- fills, accounts and scores are replayed from the published season file, so nothing here is ever recomputed.
CREATE TABLE contest_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  season TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  symbol TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  up_pct INTEGER,
  invalidation REAL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  cancelled_at TEXT
);
CREATE INDEX contest_orders_season ON contest_orders (season, user_id);

-- G-251: a reader who wants to appear on the season leaderboard picks a nickname; nothing else about them is shown.
CREATE TABLE contest_profiles (
  user_id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  public INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX contest_profiles_nick ON contest_profiles (nickname COLLATE NOCASE);
