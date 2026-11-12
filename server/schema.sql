-- Usage counts for RedFlag. Only how many checks happened each day and what
-- the AI said. Never the message, an address or anything about the person.
--
--   npx wrangler d1 execute redflag-stats --remote --file=schema.sql
CREATE TABLE IF NOT EXISTS checks (
  day TEXT NOT NULL,      -- UTC date, e.g. 2026-11-08
  verdict TEXT NOT NULL,  -- red, yellow, green, or none when the AI didn't answer
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, verdict)
);

-- How many phone numbers were looked up each day. Only the count.
CREATE TABLE IF NOT EXISTS lookups (
  day TEXT PRIMARY KEY,   -- UTC date
  n INTEGER NOT NULL DEFAULT 0
);

-- FTC Do Not Call reports, copied in by the scheduled import. Only the
-- reported number, when it was reported, the subject and the robocall flag
-- are kept. Nothing about who reported it, and nothing about lookups.
CREATE TABLE IF NOT EXISTS reports (
  seq INTEGER PRIMARY KEY,
  number TEXT NOT NULL,
  created TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  robocall INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS reports_number ON reports (number, created);

-- How far the import has got for each day.
CREATE TABLE IF NOT EXISTS import_progress (
  day TEXT PRIMARY KEY,
  next_offset INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0
);
