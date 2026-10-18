-- G-240: which test account an invite code makes. Codes made before this stay alpha; the ops screen picks beta by default.
ALTER TABLE invites ADD COLUMN plan TEXT NOT NULL DEFAULT 'alpha';
