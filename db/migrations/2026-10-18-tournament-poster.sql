-- Official tournaments can carry a poster (a path under /media). Shown on
-- the Tournaments page card, the tournament page and link previews.
-- Purely additive — run BEFORE deploying the code:
--
--   psql "$DATABASE_URL" -f db/migrations/2026-10-18-tournament-poster.sql

ALTER TABLE friend_tournaments ADD COLUMN IF NOT EXISTS poster TEXT;
