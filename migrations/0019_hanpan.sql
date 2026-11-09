-- G-338: 오늘의 한 판 answers, counted anonymously. One row per device per turn (the turn's base session); the device id
-- is the same random id as visits (no account, IP or user agent). The answer itself is kept in the reader's browser too.
CREATE TABLE IF NOT EXISTS hanpan_answers (
  day TEXT NOT NULL,
  vid TEXT NOT NULL,
  stance TEXT NOT NULL,
  answered_at TEXT NOT NULL,
  PRIMARY KEY (day, vid)
);
