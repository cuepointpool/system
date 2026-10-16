-- Official tournaments have no player limit: they are stored with
-- capacity_teams = 1024 ("no limit"), so the old 2..64 check is widened.
-- Friend tournaments are still limited in the app (3..32).
-- Run BEFORE deploying the code:
--
--   psql "$DATABASE_URL" -f db/migrations/2026-10-18-official-no-limit.sql

ALTER TABLE friend_tournaments DROP CONSTRAINT IF EXISTS friend_tournaments_capacity_teams_check;
ALTER TABLE friend_tournaments ADD CONSTRAINT friend_tournaments_capacity_teams_check
  CHECK (capacity_teams BETWEEN 2 AND 1024);
UPDATE friend_tournaments SET capacity_teams = 1024 WHERE official AND status = 'registration_open';
