-- Official (Cue Point-hosted) tournaments now run on the same engine as
-- friend tournaments: same formats, same match cards, results entered inside
-- the tournament. An official one is a friend_tournaments row with
-- `official = true` plus the event details below. Players sign themselves up
-- on /tournaments/<slug>. Purely additive — run BEFORE deploying the code:
--
--   psql "$DATABASE_URL" -f db/migrations/2026-10-18-official-tournaments.sql

ALTER TABLE friend_tournaments
  ADD COLUMN IF NOT EXISTS official BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS entry_fee INT,
  ADD COLUMN IF NOT EXISTS prize_pool INT,
  ADD COLUMN IF NOT EXISTS rules TEXT,
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS friend_tournaments_slug_uq
  ON friend_tournaments (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS friend_tournaments_official_idx
  ON friend_tournaments (official) WHERE official;
