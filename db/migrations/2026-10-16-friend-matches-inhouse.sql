-- Friends play now counts on the Cue Point in-house leaderboard: a finished
-- 1v1 between two REGISTERED players is written to `matches` (which drives
-- the in-house rating). A guest on either side never is. The link lets a
-- changed or undone result replace / remove its leaderboard entry.
-- Purely additive — run BEFORE deploying the code:
--
--   psql "$DATABASE_URL" -f db/migrations/2026-10-16-friend-matches-inhouse.sql

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS friend_game_id TEXT UNIQUE REFERENCES friend_games(id) ON DELETE CASCADE;
