-- Match length per round: single frame, best of 3 / 5 / 7 / 9.
--
-- Friend tournaments: each match carries its own best_of (chosen per round
-- by the organizer, stored in friend_tournaments.settings.bestOf) and the
-- frame score, plus the score a player reported while it awaits confirmation.
-- Cue Point-hosted tournaments: tournaments.best_of maps a round name
-- ("Quarter Finals", "Final", …) to its length; tournament_matches already
-- keeps the score. Purely additive — run BEFORE deploying the code:
--
--   psql "$DATABASE_URL" -f db/migrations/2026-10-17-best-of.sql

ALTER TABLE friend_games
  ADD COLUMN IF NOT EXISTS best_of INT NOT NULL DEFAULT 1 CHECK (best_of IN (1,3,5,7,9)),
  ADD COLUMN IF NOT EXISTS score_a INT CHECK (score_a >= 0),
  ADD COLUMN IF NOT EXISTS score_b INT CHECK (score_b >= 0),
  ADD COLUMN IF NOT EXISTS reported_score_a INT CHECK (reported_score_a >= 0),
  ADD COLUMN IF NOT EXISTS reported_score_b INT CHECK (reported_score_b >= 0);

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS best_of JSONB NOT NULL DEFAULT '{}'::jsonb;
