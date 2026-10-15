-- Friend tournaments: more formats than single elimination.
--
-- A tournament now has a kind (knockout | double_elim | league | groups) and
-- settings (legs, how the league/groups end, 3rd-place match, tie-break rule,
-- weekly schedule). Matches gain a stage (upper/lower bracket, league, group,
-- playoff, 3rd place, decider), a group number, a round label, a "loser goes
-- to" pointer, and a play-by date for weekly leagues.
--
-- Purely additive; existing tournaments become kind 'knockout' with every match
-- in stage 'knockout', which is exactly what they were. Safe on a live
-- database — run BEFORE deploying the code:
--
--   psql "$DATABASE_URL" -f db/migrations/2026-10-16-tournament-formats.sql

ALTER TABLE friend_tournaments
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'knockout'
    CHECK (kind IN ('knockout','double_elim','league','groups')),
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- main = first stage running; tiebreak = deciders / organizer ruling; playoffs = knockout after the table
  ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'main'
    CHECK (phase IN ('main','tiebreak','playoffs')),
  -- recorded tie-break orders: [{ "group": 1|null, "teams": ["winner","loser", …] }]
  ADD COLUMN IF NOT EXISTS tiebreaks JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE friend_games
  ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'knockout'
    CHECK (stage IN ('knockout','upper','lower','grand_final','third_place','league','group','playoff','decider')),
  ADD COLUMN IF NOT EXISTS group_no INT,
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS loser_next_game_id TEXT REFERENCES friend_games(id) DEFERRABLE INITIALLY DEFERRED,
  ADD COLUMN IF NOT EXISTS loser_next_slot TEXT CHECK (loser_next_slot IN ('a','b')),
  ADD COLUMN IF NOT EXISTS due_date DATE;

-- a round/position is now unique within a stage (and group), not the whole tournament
DROP INDEX IF EXISTS friend_games_slot_uq;
CREATE UNIQUE INDEX IF NOT EXISTS friend_games_stage_slot_uq
  ON friend_games (tournament_id, stage, COALESCE(group_no, 0), round, position)
  WHERE tournament_id IS NOT NULL;
