-- G-180: every mail the Worker sends (login links, screener alerts, the weekly summary), with its outcome,
-- so a missing mail can be traced without the provider's dashboard.
CREATE TABLE mail_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  email TEXT NOT NULL,
  kind TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX mail_log_user ON mail_log (user_id, created_at);
