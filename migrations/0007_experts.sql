CREATE TABLE IF NOT EXISTS custom_experts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  focus TEXT NOT NULL,
  style TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS custom_experts_user ON custom_experts(user_id);
