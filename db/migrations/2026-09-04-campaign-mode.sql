-- Campaign Mode — Season 1 player progress.
--
-- Mission CONTENT (chapters, titles, objectives, rewards, the XP curve) is
-- authored game content and lives in lib/campaign/content.ts, NOT in the
-- database. This migration only adds the per-player progress that the app
-- reads and writes: which objectives are ticked, which missions are done,
-- stars earned, and the campaign XP / coin wallet.
--
-- Purely additive — nothing existing is dropped or rewritten, so it is safe
-- to run on the live database BEFORE the new code is deployed. Do it in that
-- order: the current production code ignores these columns entirely, whereas
-- the new code cannot start without them.
--
--   psql "$DATABASE_URL" -f db/migrations/2026-09-04-campaign-mode.sql

ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS campaign_xp    INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS campaign_coins INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS player_missions (
  player_id       TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  mission_id      TEXT NOT NULL,             -- lib/campaign/content.ts id ('m-001'…'m-100')
  objectives_done INT  NOT NULL DEFAULT 0,   -- how many objectives are ticked
  stars           INT  NOT NULL DEFAULT 0,   -- 0-3, derived on write
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,               -- null = in progress
  PRIMARY KEY (player_id, mission_id)
);

CREATE INDEX IF NOT EXISTS player_missions_player_idx
  ON player_missions (player_id);
CREATE INDEX IF NOT EXISTS player_missions_done_idx
  ON player_missions (player_id, completed_at);
