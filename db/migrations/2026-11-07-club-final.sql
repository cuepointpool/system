-- Club final: after a week's group leagues, the top players of every group
-- can play one more tournament together to find the overall winner.
-- Also: "manual" seeding (entries in the order given — group winners first).
-- Additive and safe to re-run:
--
--   psql "$DATABASE_URL" -f db/migrations/2026-11-07-club-final.sql

-- { enabled: bool, perGroup: n, settings: TournamentSettings }
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS final_settings JSONB NOT NULL DEFAULT '{}';

ALTER TABLE friend_tournaments DROP CONSTRAINT IF EXISTS friend_tournaments_seeding_check;
ALTER TABLE friend_tournaments
  ADD CONSTRAINT friend_tournaments_seeding_check CHECK (seeding IN ('random','ranking','manual'));
