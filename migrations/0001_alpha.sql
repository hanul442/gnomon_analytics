-- Alpha accounts (docs/DESIGN.md §5.13, G-44). Cloudflare D1 (SQLite).
-- Credits are a ledger: the balance is the sum of a user's rows, so every grant,
-- spend and refund stays on record.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'alpha',
  role TEXT NOT NULL DEFAULT 'user',
  invite_code TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT,
  terms_at TEXT,
  disabled INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE invites (
  code TEXT PRIMARY KEY,
  note TEXT NOT NULL DEFAULT '',
  max_uses INTEGER NOT NULL DEFAULT 1,
  uses INTEGER NOT NULL DEFAULT 0,
  credits INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_at TEXT NOT NULL
);

-- One-time login links. Only the SHA-256 of the token is stored.
CREATE TABLE login_tokens (
  hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  invite_code TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX login_tokens_email ON login_tokens (email, created_at);

CREATE TABLE sessions (
  hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);

CREATE TABLE ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  kind TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  -- Makes a grant idempotent, e.g. 'grant:2026-10' or 'request:12'.
  ref TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX ledger_user ON ledger (user_id, created_at);
CREATE UNIQUE INDEX ledger_ref ON ledger (user_id, ref) WHERE ref IS NOT NULL;

CREATE TABLE credit_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  granted INTEGER,
  admin_note TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX credit_requests_status ON credit_requests (status, created_at);

-- Report requests, upgrades and expert invitations paid with credits; handled by hand in the alpha.
CREATE TABLE action_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  symbol TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  credits INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  symbol TEXT,
  tier TEXT NOT NULL,
  model TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  credits INTEGER NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  usd REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  rating INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX questions_user ON questions (user_id, created_at);
CREATE INDEX questions_day ON questions (created_at);

CREATE TABLE surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  answers TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX surveys_user ON surveys (user_id, kind, created_at);

CREATE TABLE feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  page TEXT NOT NULL,
  target TEXT NOT NULL,
  rating INTEGER,
  text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  page TEXT NOT NULL DEFAULT '',
  props TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX events_name ON events (name, created_at);
