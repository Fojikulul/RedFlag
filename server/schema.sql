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
