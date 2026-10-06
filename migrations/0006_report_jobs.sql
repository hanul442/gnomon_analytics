-- Durable on-demand generation; Queue messages contain only the job id.
CREATE TABLE report_jobs (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL, symbol TEXT NOT NULL,
 kind TEXT NOT NULL, input_hash TEXT NOT NULL, input_json TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'queued', stage TEXT NOT NULL DEFAULT 'searching',
 credits INTEGER NOT NULL, reserved_usd REAL NOT NULL, usd REAL NOT NULL DEFAULT 0,
 result_json TEXT, error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX report_jobs_user ON report_jobs(user_id, created_at);
CREATE INDEX report_jobs_status ON report_jobs(status, updated_at);
CREATE TABLE ai_requests (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL, reserved_usd REAL NOT NULL,
 usd REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'running', created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX report_jobs_active ON report_jobs(user_id,symbol,kind,input_hash) WHERE status!='failed';
