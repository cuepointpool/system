-- Tournaments don't need dates: they run over as many days as the players
-- like. Hosted tournaments may have no start date / registration deadline
-- ("date to be announced"; registration stays open until staff close it), and
-- bracket matches are no longer given a date or a fixed table.
-- Friend matches can be played in parallel; each running match may note the
-- table it's on. Purely additive / relaxing — run BEFORE deploying the code:
--
--   psql "$DATABASE_URL" -f db/migrations/2026-10-17-no-dates-parallel.sql

ALTER TABLE tournaments ALTER COLUMN start_at DROP NOT NULL;
ALTER TABLE tournaments ALTER COLUMN registration_deadline DROP NOT NULL;

-- unplayed hosted bracket matches lose the made-up date/table
UPDATE tournament_matches SET scheduled_at = NULL, table_name = NULL WHERE winner_id IS NULL;

ALTER TABLE friend_games ADD COLUMN IF NOT EXISTS table_name TEXT;
