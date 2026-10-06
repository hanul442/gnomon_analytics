-- Phone push, notification settings, price alerts and a send log (G-97).

-- Web Push subscriptions: one row per browser that turned notifications on.
CREATE TABLE push_subs (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX push_subs_user ON push_subs (user_id);

-- What each user wants to hear about (JSON: daily, watchReport, screen, price, request, push).
CREATE TABLE notify_prefs (
  user_id TEXT PRIMARY KEY,
  prefs TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- "Tell me when this crosses that price": fires once, then stays as a record.
CREATE TABLE price_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  op TEXT NOT NULL,
  price REAL NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  fired_at TEXT,
  fired_price REAL
);
CREATE INDEX price_alerts_open ON price_alerts (fired_at, symbol);
CREATE INDEX price_alerts_user ON price_alerts (user_id);

-- Server-only settings the Worker makes for itself (the Web Push signing key).
CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Once-per-key sends (e.g. the daily report note per user and date).
CREATE TABLE notify_log (
  key TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
