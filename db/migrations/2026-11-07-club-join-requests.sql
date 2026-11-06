-- Players ask to join a partner club from its page; the club admin adds them
-- to a group (or declines). Additive and safe to re-run:
--
--   psql "$DATABASE_URL" -f db/migrations/2026-11-07-club-join-requests.sql
--
-- then (prod): ALTER TABLE club_join_requests OWNER TO cuepoint;

CREATE TABLE IF NOT EXISTS club_join_requests (
  club_id    TEXT NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id  TEXT NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  message    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, player_id)
);
