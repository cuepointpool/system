-- Groups → final rounds without waiting for every group: the knockout is
-- built when the tournament starts, and each slot remembers where its player
-- comes from ("2:1" = Group B, 1st place). When a group finishes, its
-- qualifiers drop straight in. Purely additive — run BEFORE deploying the code:
--
--   psql "$DATABASE_URL" -f db/migrations/2026-10-17-group-slot-sources.sql

ALTER TABLE friend_games
  ADD COLUMN IF NOT EXISTS a_source TEXT,
  ADD COLUMN IF NOT EXISTS b_source TEXT;
