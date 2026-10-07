-- G-109: settings that follow the account across browsers (view, chart indicators, drawings, dismissed tours).
CREATE TABLE user_settings (
  user_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
