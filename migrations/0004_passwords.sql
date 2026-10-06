-- Email + password login (docs/DESIGN.md §5.13, G-57): an invite code once, then email and password.
-- PBKDF2-SHA256 (100,000 rounds, the Workers limit) with a random salt per user: "pbkdf2$<rounds>$<salt>$<hash>".

ALTER TABLE users ADD COLUMN password_hash TEXT;

-- Failed attempts per email, for a short lockout.
CREATE TABLE login_attempts (
  email TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX login_attempts_email_at ON login_attempts (email, at);
