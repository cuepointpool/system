-- Friends tournaments — guest players.
--
-- An organizer can fill a seat with someone who has no account: just a name.
-- A guest is always "accepted" (there is nobody to invite), gets no
-- notifications and earns nothing. A match with a guest on either side awards
-- no Friends League points, and a tournament with any guest awards no
-- placement points, so guests can't be used to farm the ledger.
--
-- Purely additive and idempotent — safe to run on the live database BEFORE
-- deploying the new code:
--
--   psql "$DATABASE_URL" -f db/migrations/2026-10-04-friend-guests.sql

CREATE TABLE IF NOT EXISTS friend_team_guests (
  id            TEXT PRIMARY KEY,
  team_id       TEXT NOT NULL REFERENCES friend_teams(id) ON DELETE CASCADE,
  tournament_id TEXT NOT NULL REFERENCES friend_tournaments(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  added_by      TEXT REFERENCES player_profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS friend_guests_team_idx ON friend_team_guests (team_id);
CREATE INDEX IF NOT EXISTS friend_guests_tournament_idx ON friend_team_guests (tournament_id);
-- one guest name per tournament, whatever the capitalisation
CREATE UNIQUE INDEX IF NOT EXISTS friend_guests_name_uq
  ON friend_team_guests (tournament_id, lower(name));
