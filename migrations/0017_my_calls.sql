-- 나 vs 위원회 (G-315): a reader's own up/down call on a stock, scored after 20 sessions next to the committee's lean.
-- base_day is the first session whose close counts as the start (the day of the choice if made before 15:30 KST on a
-- weekday, else the next day), so nobody picks after seeing the close they are measured from.
CREATE TABLE my_calls (
  user_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  base_day TEXT NOT NULL,
  stance TEXT NOT NULL,          -- up | down
  com TEXT NOT NULL,             -- the committee's lean when chosen: up | down | flat
  created_at TEXT NOT NULL,
  base_date TEXT,                -- filled when scored: the session used as the start, and the one 20 sessions later
  end_date TEXT,
  base_close REAL,
  end_close REAL,
  hit INTEGER,
  com_hit INTEGER,
  scored_at TEXT,
  PRIMARY KEY (user_id, symbol, base_day)
);
CREATE INDEX my_calls_pending ON my_calls (scored_at, base_day);
