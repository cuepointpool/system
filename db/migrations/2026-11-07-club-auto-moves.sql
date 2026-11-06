-- Club groups regroup automatically once a week's leagues are all finished.
-- `last_moves` remembers what the system moved (so the club admin can see it
-- and undo it). Additive and safe to re-run:
--
--   psql "$DATABASE_URL" -f db/migrations/2026-11-07-club-auto-moves.sql

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS last_moves JSONB;
