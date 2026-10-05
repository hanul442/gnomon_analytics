-- Watchlists kept on the server and intraday alerts (docs/DESIGN.md §5.15, G-52).

CREATE TABLE watchlists (
  user_id TEXT PRIMARY KEY,
  symbols TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- One alert per stock, day and kind, shared by everyone watching the stock.
CREATE TABLE intraday_alerts (
  symbol TEXT NOT NULL,
  date TEXT NOT NULL,
  kind TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (symbol, date, kind)
);
