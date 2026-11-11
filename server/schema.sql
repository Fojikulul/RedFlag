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
